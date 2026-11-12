/**
 * On-device benchmark for the live try-on (`#/again?...&bench=1`). Off unless asked for; does nothing to normal users.
 *
 * Measures what can be measured in a web page: frame rate and the slowest frames, how long the pose / hand
 * detection calls take, the JS time per frame, JS heap, battery level (Android Chrome only), and how all of
 * that changes over a few minutes — a drop in FPS or a rise in detection time over a long run is the page-visible
 * sign of thermal throttling. A web page cannot read the phone's temperature: note it by hand
 * (docs/ai-fitting-upgrade/DEVICE-TEST-PROCEDURE.md). Results: `window.__bench`, the on-screen panel, "복사" (clipboard).
 */
interface Win {
  tSec: number;
  fps: number;
  fps1pctLow: number;
  frameMsP95: number;
  longFrames: number;
  poseMs: number;
  handMs: number;
  jsMs: number;
  heapMB: number | null;
  battery: number | null;
}

const pct = (a: number[], p: number) => {
  if (!a.length) return 0;
  const s = [...a].sort((x, y) => x - y);
  return s[Math.min(s.length - 1, Math.floor(p * s.length))];
};
const avg = (a: number[]) => (a.length ? a.reduce((x, y) => x + y, 0) / a.length : 0);

export class FitBench {
  readonly windows: Win[] = [];
  private frames: number[] = [];
  private js: number[] = [];
  private pose: number[] = [];
  private hand: number[] = [];
  private last = 0;
  private start = performance.now();
  private winStart = performance.now();
  private battery: { level: number } | null = null;
  private panel: HTMLDivElement;
  private line: HTMLDivElement;
  private timer: number;
  private post: boolean;
  private meta: Record<string, unknown>;
  // Tracking: a "loss" is the stretch where the hand tracker had no fresh detection. What the page can see of
  // it is how long it lasted, whether a bag was still drawn, and how far the drawn bag moved per frame after.
  private tracked = true;
  private intervals: number[] = [];
  private lossStart = 0;
  private lossDrawnMs = 0;
  private lossHiddenMs = 0;
  private lastDrawn: { x: number; y: number; at: number } | null = null;
  private lastDrawTime = 0;
  private recoverUntil = 0;
  private recoverSteps: number[] = [];
  private currentRecoverMax = 0;
  readonly losses: { lostMs: number; drawnMs: number; hiddenMs: number; recoverStepPx: number }[] = [];
  private framesTracked = 0;
  private framesDrawn = 0;
  private framesAll = 0;
  private ended = false;
  private durSec: number;

  constructor(label: string, opts: { durSec?: number; device?: string; post?: boolean } = {}) {
    this.durSec = opts.durSec ?? 0;
    this.post = !!opts.post;
    const nav = navigator as Navigator & { deviceMemory?: number; getBattery?: () => Promise<{ level: number }> };
    this.meta = {
      label,
      ua: navigator.userAgent,
      cores: navigator.hardwareConcurrency,
      memoryGB: nav.deviceMemory ?? null,
      screen: `${screen.width}x${screen.height}@${devicePixelRatio}`,
      startedAt: new Date().toISOString(),
      device: opts.device ?? null,
      durSecRequested: opts.durSec ?? null,
    };
    nav.getBattery?.().then((b) => (this.battery = b)).catch(() => undefined);
    (window as unknown as { __bench: unknown }).__bench = { meta: this.meta, windows: this.windows, summary: () => this.summary() };
    this.panel = document.createElement('div');
    this.panel.setAttribute('data-testid', 'fit-bench');
    this.panel.style.cssText = 'position:fixed;left:8px;bottom:8px;z-index:99999;background:rgba(0,0,0,.78);color:#fff;font:12px/1.4 monospace;padding:8px 10px;border-radius:8px;max-width:92vw';
    this.line = document.createElement('div');
    const btn = (t: string, f: () => void) => {
      const b = document.createElement('button');
      b.textContent = t;
      b.style.cssText = 'margin:6px 6px 0 0;padding:6px 10px;border-radius:6px;background:#fff;color:#000;font:12px sans-serif';
      b.onclick = f;
      return b;
    };
    this.panel.append(
      this.line,
      btn('결과 복사', () => void navigator.clipboard?.writeText(JSON.stringify(this.summary(), null, 1)).then(() => (this.line.textContent = '복사됨'))),
      btn('파일로 저장', () => this.download()),
      btn('저장된 전체 복사', () => void navigator.clipboard?.writeText(JSON.stringify(FitBench.saved(), null, 1)).then(() => (this.line.textContent = `전체 ${FitBench.saved().length}건 복사됨`))),
      ...(this.post ? [btn('서버로 저장', () => void this.upload())] : []),
      btn('끄기', () => this.stop()),
    );
    document.body.append(this.panel);
    this.timer = window.setInterval(() => this.flush(), 10000);
  }

  /** Call once per rendered frame with the rAF timestamp and the JS time this frame took. */
  frame(now: number, jsMs: number) {
    if (this.ended) return;
    this.framesAll++;
    if (this.durSec && (performance.now() - this.start) / 1000 >= this.durSec) {
      this.finish();
      return;
    }
    if (this.last) this.frames.push(now - this.last);
    this.last = now;
    this.js.push(jsMs);
    if (this.frames.length > 0 && this.frames.length % 15 === 0) {
      const f = this.frames.slice(-60);
      this.line.textContent = `fps ${(1000 / Math.max(1, avg(f))).toFixed(0)} · js ${avg(this.js.slice(-60)).toFixed(1)}ms · pose ${avg(this.pose.slice(-20)).toFixed(0)}ms · hand ${avg(this.hand.slice(-20)).toFixed(0)}ms · ${Math.round((performance.now() - this.start) / 1000)}s`;
    }
  }

  /** Per frame: does the tracker currently have the hand (a fresh detection)? */
  track(now: number, tracked: boolean, detectIntervalMs = 0) {
    if (this.ended) return;
    if (detectIntervalMs) this.intervals.push(detectIntervalMs);
    if (tracked) this.framesTracked++;
    if (this.tracked && !tracked) {
      this.tracked = false;
      this.lossStart = now;
      this.lossDrawnMs = 0;
      this.lossHiddenMs = 0;
    } else if (!this.tracked && tracked) {
      this.tracked = true;
      this.currentRecoverMax = 0;
      this.recoverUntil = now + 400;
      this.pendingLoss = { lostMs: now - this.lossStart, drawnMs: this.lossDrawnMs, hiddenMs: this.lossHiddenMs };
    }
    if (this.pendingLoss && now >= this.recoverUntil) {
      this.losses.push({ ...this.pendingLoss, recoverStepPx: +this.currentRecoverMax.toFixed(1) });
      this.recoverSteps.push(this.currentRecoverMax);
      this.pendingLoss = null;
    }
  }
  private pendingLoss: { lostMs: number; drawnMs: number; hiddenMs: number } | null = null;

  /** Per frame: where the bag was drawn (null = not drawn). Fed from the 3D layer's render calls. */
  draw(now: number, pose: { x: number; y: number; alpha: number } | null) {
    if (this.ended) return;
    const dt = this.lastDrawTime ? now - this.lastDrawTime : 0;
    this.lastDrawTime = now;
    const shown = !!pose && pose.alpha > 0.5;
    if (shown) this.framesDrawn++;
    if (!this.tracked) {
      if (shown) this.lossDrawnMs += dt;
      else this.lossHiddenMs += dt;
    }
    if (shown && this.lastDrawn && now - this.lastDrawn.at < 100 && this.pendingLoss) {
      this.currentRecoverMax = Math.max(this.currentRecoverMax, Math.hypot(pose!.x - this.lastDrawn.x, pose!.y - this.lastDrawn.y));
    }
    this.lastDrawn = shown ? { x: pose!.x, y: pose!.y, at: now } : null;
  }

  det(kind: 'pose' | 'hand', ms: number) {
    (kind === 'pose' ? this.pose : this.hand).push(ms);
  }

  private flush() {
    if (this.frames.length < 5) return;
    const heap = (performance as Performance & { memory?: { usedJSHeapSize: number } }).memory;
    const slow = this.frames.filter((f) => f > 50);
    this.windows.push({
      tSec: Math.round((performance.now() - this.start) / 1000),
      fps: +(1000 / avg(this.frames)).toFixed(1),
      fps1pctLow: +(1000 / pct(this.frames, 0.99)).toFixed(1),
      frameMsP95: +pct(this.frames, 0.95).toFixed(1),
      longFrames: slow.length,
      poseMs: +avg(this.pose).toFixed(1),
      handMs: +avg(this.hand).toFixed(1),
      jsMs: +avg(this.js).toFixed(2),
      heapMB: heap ? +(heap.usedJSHeapSize / 1e6).toFixed(0) : null,
      battery: this.battery ? +this.battery.level.toFixed(3) : null,
    });
    this.frames = [];
    this.js = [];
    this.pose = [];
    this.hand = [];
    this.winStart = performance.now();
  }

  /** First vs last third of the run: the page-visible sign of throttling is fps falling and detection time rising. */
  summary() {
    this.flush();
    const w = this.windows;
    const third = Math.max(1, Math.floor(w.length / 3));
    const head = w.slice(0, third);
    const tail = w.slice(-third);
    const m = (a: Win[], k: keyof Win) => avg(a.map((x) => Number(x[k] ?? 0)));
    const dur = w.length ? w[w.length - 1].tSec : 0;
    const b0 = w.find((x) => x.battery !== null)?.battery ?? null;
    const b1 = [...w].reverse().find((x) => x.battery !== null)?.battery ?? null;
    return {
      meta: this.meta,
      seconds: dur,
      fpsFirstThird: +m(head, 'fps').toFixed(1),
      fpsLastThird: +m(tail, 'fps').toFixed(1),
      fpsDropPct: head.length ? +((1 - m(tail, 'fps') / Math.max(0.1, m(head, 'fps'))) * 100).toFixed(1) : null,
      detectMsFirstThird: +(m(head, 'poseMs') + m(head, 'handMs')).toFixed(1),
      detectMsLastThird: +(m(tail, 'poseMs') + m(tail, 'handMs')).toFixed(1),
      worstFps1pctLow: w.length ? Math.min(...w.map((x) => x.fps1pctLow)) : null,
      longFramesTotal: w.reduce((a, x) => a + x.longFrames, 0),
      detectIntervalMsMean: this.intervals.length ? Math.round(avg(this.intervals)) : null,
      framesDrawnPct: this.framesAll ? +((this.framesDrawn / this.framesAll) * 100).toFixed(1) : null,
      framesTrackedPct: this.framesAll ? +((this.framesTracked / this.framesAll) * 100).toFixed(1) : null,
      lossEvents: this.losses.length,
      lossMeanMs: this.losses.length ? Math.round(avg(this.losses.map((l) => l.lostMs))) : null,
      lossDrawnMsMean: this.losses.length ? Math.round(avg(this.losses.map((l) => l.drawnMs))) : null,
      recoverStepPxMax: this.losses.length ? +Math.max(...this.losses.map((l) => l.recoverStepPx)).toFixed(1) : null,
      recoverStepPxMean: this.losses.length ? +avg(this.losses.map((l) => l.recoverStepPx)).toFixed(1) : null,
      losses: this.losses,
      batteryPctPerMin: b0 !== null && b1 !== null && dur > 0 ? +(((b0 - b1) * 100) / (dur / 60)).toFixed(2) : null,
      windows: w,
    };
  }

  /** Ends the run, saves its summary in this browser (localStorage) and shows it. */
  finish() {
    if (this.ended) return;
    this.flush();
    const sum = this.summary();
    this.ended = true;
    window.clearInterval(this.timer);
    try {
      const all = FitBench.saved();
      all.push(sum);
      localStorage.setItem('lagi-bench-runs', JSON.stringify(all));
    } catch {
      /* private mode: copy/download still work */
    }
    this.line.textContent = `완료 ${sum.seconds}s · fps ${sum.fpsFirstThird}→${sum.fpsLastThird} · 유실 ${sum.lossEvents}회 · 저장됨(${FitBench.saved().length}건)`;
  }

  static saved(): ReturnType<FitBench['summary']>[] {
    try {
      return JSON.parse(localStorage.getItem('lagi-bench-runs') ?? '[]');
    } catch {
      return [];
    }
  }

  private download() {
    const sum = this.summary();
    const blob = new Blob([JSON.stringify(sum, null, 1)], { type: 'application/json' });
    const a = document.createElement('a');
    a.href = URL.createObjectURL(blob);
    a.download = `lagi-bench-${String(this.meta.label).replace(/\W+/g, '-')}-${Date.now()}.json`;
    a.click();
    setTimeout(() => URL.revokeObjectURL(a.href), 5000);
  }

  /** Posts the summary to the host that serves this page (scripts/device-test-server.mjs). Same origin only. */
  private async upload() {
    try {
      const r = await fetch('/__bench-upload', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(this.summary()) });
      this.line.textContent = r.ok ? '서버에 저장됨' : `서버 저장 실패 (${r.status})`;
    } catch {
      this.line.textContent = '서버 저장 실패';
    }
  }

  stop() {
    window.clearInterval(this.timer);
    this.flush();
    this.panel.remove();
  }
}

/**
 * TEST DOUBLE for @decartai/sdk — only used when the app is built with RT_MOCK=1 (see vite.config.ts). It never contacts
 * Decart and draws "MOCK" over the visitor's own camera, so a pass here proves the page's wiring (permissions, token order,
 * states, cleanup, recording) and says NOTHING about real AI video quality. Behaviour is chosen by window.__rtMock.mode.
 */
type Handler = (e: unknown) => void;
declare global {
  interface Window {
    __rtMock?: { mode?: 'ok' | 'noframes' | 'refuse-image' | 'drop' | 'reconnect' | 'netfail' };
    __rtLog?: string[];
  }
}
const log = (m: string) => (window.__rtLog ??= []).push(m);

/** Real SDK has no such export, so the page can say plainly that this is not Decart. */
export const isMock = true;

export const models = {
  realtime: (name: string) => ({ name, fps: 30, width: 1280, height: 720 }),
};

export function createDecartClient(opts: { apiKey: string }) {
  log(`client:${opts.apiKey ? 'key' : 'nokey'}`);
  return {
    realtime: {
      // The real one only gathers ICE candidates (free, no session). 'netfail' = a network that cannot carry realtime video.
      async checkConnectivity() {
        log('preflight');
        return window.__rtMock?.mode === 'netfail' ? { quality: 'critical', metrics: { transport: 'failed', rttMs: null }, reasons: [] } : { quality: 'good', metrics: { transport: 'udp', rttMs: 30 }, reasons: [] };
      },
      async connect(input: MediaStream, o: { onRemoteStream: (s: MediaStream) => void; model?: { name: string }; speed?: string; initialState?: { image?: Blob; prompt?: { text: string } } }) {
        const mode = window.__rtMock?.mode ?? 'ok';
        log(`connect:${mode}`);
        log(`model:${o.model?.name}`);
        log(`retries:${(o as { retries?: number }).retries}`);
        log(`prompt:${o.initialState?.prompt?.text ?? ''}`);
        log(`speed:${o.speed ?? 'standard'}`);
        // The product photo and instruction arrive WITH the connection (initialState), as Decart's own examples do.
        if (o.initialState?.image) {
          if (mode === 'refuse-image') throw new Error('mock refused');
          log(`setImage:${(o.initialState.prompt?.text ?? '').slice(0, 40)}`);
          log('initialState:with-connect');
        }
        const handlers = new Map<string, Handler>();
        const v = document.createElement('video');
        v.muted = true;
        v.playsInline = true;
        v.srcObject = input;
        await v.play().catch(() => undefined);
        const c = document.createElement('canvas');
        c.width = 640;
        c.height = 360;
        const g = c.getContext('2d')!;
        let alive = true;
        const draw = () => {
          if (!alive) return;
          g.drawImage(v, 0, 0, c.width, c.height);
          g.fillStyle = 'rgba(0,80,255,0.35)';
          g.fillRect(0, 0, c.width, c.height);
          g.fillStyle = '#fff';
          g.font = '700 28px sans-serif';
          g.fillText('MOCK — NOT AI', 16, 40);
          requestAnimationFrame(draw);
        };
        draw();
        if (mode !== 'noframes') o.onRemoteStream(c.captureStream(30)); // 'noframes': connected but the model never sends video
        window.setTimeout(() => handlers.get('connectionChange')?.('connected'), 50);
        if (mode === 'ok') window.setTimeout(() => handlers.get('connectionChange')?.('generating'), 600);
        window.setTimeout(() => handlers.get('diagnostic')?.({ name: 'client-session-connection-breakdown', data: { attempt: 1, success: true, totalDurationMs: 40, phases: [] } }), 60);
        if (mode === 'ok') for (const t of [700, 1200, 1700]) window.setTimeout(() => handlers.get('generationTick')?.({}), t);
        if (mode === 'reconnect') window.setTimeout(() => handlers.get('connectionChange')?.('reconnecting'), 2500);
        if (mode === 'drop') window.setTimeout(() => handlers.get('error')?.({ message: 'mock drop' }), 2500);
        return {
          on: (ev: string, h: Handler) => void handlers.set(ev, h),
          async setImage(_b: Blob, p: { prompt: string }) {
            if (mode === 'refuse-image') throw new Error('mock refused');
            log(`setImage:${p.prompt.slice(0, 40)}`);
          },
          async setPrompt(p: string) {
            log(`setPrompt:${p.slice(0, 40)}`);
          },
          disconnect() {
            alive = false;
            log('disconnect');
          },
        };
      },
    },
  };
}

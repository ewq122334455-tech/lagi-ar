import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { MapTryOn } from '../MapTryOn';
import { useRealProducts } from '../data';
import type { LabApi, LabEngine, LabOptions, LabStats } from '../labTypes';

/**
 * Fitting comparison lab — DEVELOPMENT ONLY (built with VITE_LAB=1; the public site has no code of this page).
 * Runs the real live try-on pipeline once per chosen engine on ONE shared input (camera or a recorded clip),
 * next to the untouched camera picture, with live numbers, hand-made calibration and saving of pictures/clips.
 * With several panes the detection work is multiplied, so FPS here is lower than a single engine on its own.
 */

const ENGINES: { id: LabEngine; label: string; note: string }[] = [
  { id: 'v1', label: 'V1', note: '처음 구조' },
  { id: 'v2', label: 'V2', note: '기본값' },
  { id: 'v3', label: 'V3', note: '그림자·유실 정책·흔들림' },
  { id: 'v4', label: 'V4', note: 'V3 + 선행 보정(실험)' },
  { id: 'v5', label: 'V5', note: 'V3 + 빠른 추종 + 마디 줄 크기(실험)' },
];

const DEFAULT_OPTIONS: LabOptions = { size: 1, gain: 1, gripCm: null, shadow: true, mask: true, swing: true, grip: true, scale: 'all', refPxPerCm: null, refPalmPx: null };

const css = {
  page: { minHeight: '100vh', background: '#101318', color: '#e8ebf0', font: '14px/1.5 system-ui, sans-serif', padding: 16 } as const,
  banner: { background: '#5b3d00', color: '#ffd98a', padding: '6px 12px', borderRadius: 6, marginBottom: 12, fontSize: 13 } as const,
  bar: { display: 'flex', flexWrap: 'wrap', gap: 12, alignItems: 'center', marginBottom: 12 } as const,
  box: { background: '#181d25', border: '1px solid #2a3140', borderRadius: 8, padding: 12, marginBottom: 12 } as const,
  btn: { background: '#2b6cf0', color: '#fff', border: 0, borderRadius: 6, padding: '6px 12px', cursor: 'pointer' } as const,
  btn2: { background: '#2a3140', color: '#e8ebf0', border: 0, borderRadius: 6, padding: '6px 12px', cursor: 'pointer' } as const,
  grid: { display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(380px, 1fr))', gap: 12 } as const,
  th: { textAlign: 'left', padding: '3px 8px', color: '#9aa4b5', fontWeight: 500 } as const,
  td: { padding: '3px 8px', fontVariantNumeric: 'tabular-nums' } as const,
};

const f1 = (n: number | undefined | null, d = 1) => (n == null || !Number.isFinite(n) ? '–' : n.toFixed(d));

function download(blob: Blob, name: string) {
  const a = document.createElement('a');
  a.href = URL.createObjectURL(blob);
  a.download = name;
  a.click();
  window.setTimeout(() => URL.revokeObjectURL(a.href), 5000);
}

export default function Lab() {
  const { products } = useRealProducts();
  const withModel = useMemo(() => products.filter((p) => p.model3d), [products]);
  const [productId, setProductId] = useState('plano-bag');
  const product = withModel.find((p) => p.id === productId) ?? withModel[0];
  const [engines, setEngines] = useState<LabEngine[]>(['v2', 'v3', 'v5']);
  const [opts, setOpts] = useState<LabOptions>(DEFAULT_OPTIONS);
  const [source, setSource] = useState<'none' | 'camera' | 'file'>('none');
  const [mirror, setMirror] = useState(true);
  const [stream, setStream] = useState<MediaStream | null>(null);
  const [msg, setMsg] = useState<string | null>(null);
  const [stats, setStats] = useState<Partial<Record<LabEngine, LabStats>>>({});
  const apis = useRef<Partial<Record<LabEngine, LabApi | null>>>({});
  const clip = useRef<HTMLVideoElement | null>(null);
  const [recording, setRecording] = useState(false);
  const rec = useRef<{ mr: MediaRecorder; chunks: Blob[]; timer: number } | null>(null);
  const set = <K extends keyof LabOptions>(k: K, v: LabOptions[K]) => setOpts((o) => ({ ...o, [k]: v }));

  useEffect(() => () => stream?.getTracks().forEach((t) => t.stop()), [stream]);

  async function openCamera() {
    setMsg(null);
    try {
      const s = await navigator.mediaDevices.getUserMedia({ audio: false, video: { facingMode: 'user', width: { ideal: 1280 }, height: { ideal: 720 } } });
      stream?.getTracks().forEach((t) => t.stop());
      setMirror(true);
      setSource('camera');
      setStream(s);
    } catch (e) {
      setMsg(`카메라를 켜지 못했습니다: ${(e as Error).message}`);
    }
  }

  async function openClip(file: File) {
    setMsg(null);
    try {
      const v = clip.current!;
      v.src = URL.createObjectURL(file);
      v.loop = true;
      v.muted = true;
      await v.play();
      const cap = (v as HTMLVideoElement & { captureStream?: () => MediaStream }).captureStream?.();
      if (!cap) throw new Error('이 브라우저는 영상 재생 입력(captureStream)을 지원하지 않습니다. Chrome을 사용해 주세요.');
      stream?.getTracks().forEach((t) => t.stop());
      setMirror(false);
      setSource('file');
      setStream(cap);
    } catch (e) {
      setMsg(`영상을 열지 못했습니다: ${(e as Error).message}`);
    }
  }

  const onStats = useCallback((s: LabStats) => setStats((o) => ({ ...o, [s.engine]: s })), []);

  // ---- saving ----
  function grid(): HTMLCanvasElement | null {
    const cells: { label: string; c: HTMLCanvasElement }[] = [];
    const rawSrc = engines.map((e) => apis.current[e]?.raw()).find(Boolean);
    if (rawSrc) cells.push({ label: '원본 카메라', c: rawSrc });
    for (const e of engines) {
      const c = apis.current[e]?.compose();
      if (c) cells.push({ label: `${e.toUpperCase()}${stats[e] ? ` · ${f1(stats[e]!.fps, 0)}fps · ${stats[e]!.tracked ? '손 추적' : '손 없음'}` : ''}`, c });
    }
    if (!cells.length) return null;
    const cols = cells.length > 2 ? 2 : cells.length;
    const rows = Math.ceil(cells.length / cols);
    const cw = 640;
    const ch = Math.round((cells[0].c.height / cells[0].c.width) * cw);
    const out = document.createElement('canvas');
    out.width = cols * cw;
    out.height = rows * (ch + 28) + 28;
    const x = out.getContext('2d')!;
    x.fillStyle = '#101318';
    x.fillRect(0, 0, out.width, out.height);
    x.font = '16px system-ui, sans-serif';
    x.fillStyle = '#e8ebf0';
    x.fillText(`${product?.id ?? ''} · size ${opts.size} · gain ${opts.gain} · grip ${opts.gripCm ?? 'auto'} · scale ${opts.scale} · shadow ${opts.shadow ? 'on' : 'off'} mask ${opts.mask ? 'on' : 'off'} swing ${opts.swing ? 'on' : 'off'} grip-rule ${opts.grip ? 'on' : 'off'} · ${source}`, 8, 19);
    cells.forEach((cell, i) => {
      const cx = (i % cols) * cw;
      const cy = 28 + Math.floor(i / cols) * (ch + 28);
      x.fillStyle = '#e8ebf0';
      x.fillText(cell.label, cx + 6, cy + 20);
      x.drawImage(cell.c, cx, cy + 28 - 4, cw, ch);
    });
    return out;
  }

  function saveImage() {
    const g = grid();
    if (!g) return setMsg('저장할 화면이 아직 없습니다.');
    g.toBlob((b) => b && download(b, `lagi-lab-${product?.id ?? 'x'}-${Date.now()}.png`), 'image/png');
  }

  function toggleRecord() {
    if (rec.current) {
      rec.current.mr.stop();
      return;
    }
    const first = grid();
    if (!first) return setMsg('녹화할 화면이 아직 없습니다.');
    const cv = document.createElement('canvas');
    cv.width = first.width;
    cv.height = first.height;
    const cx = cv.getContext('2d')!;
    const mr = new MediaRecorder(cv.captureStream(15), { mimeType: MediaRecorder.isTypeSupported('video/webm;codecs=vp9') ? 'video/webm;codecs=vp9' : 'video/webm' });
    const chunks: Blob[] = [];
    mr.ondataavailable = (e) => e.data.size && chunks.push(e.data);
    const timer = window.setInterval(() => {
      const g = grid();
      if (g) cx.drawImage(g, 0, 0, cv.width, cv.height);
    }, 66);
    mr.onstop = () => {
      window.clearInterval(timer);
      download(new Blob(chunks, { type: 'video/webm' }), `lagi-lab-${product?.id ?? 'x'}-${Date.now()}.webm`);
      rec.current = null;
      setRecording(false);
    };
    mr.start(500);
    rec.current = { mr, chunks, timer };
    setRecording(true);
  }

  // ---- reference calibration ----
  const frozen = useRef<HTMLCanvasElement | null>(null);
  const [frozenInfo, setFrozenInfo] = useState<{ palmPx: number; est: { all: number; mcp: number; knuckle: number } } | null>(null);
  const [pts, setPts] = useState<{ x: number; y: number }[]>([]);
  const [refCm, setRefCm] = useState('30');
  function freeze() {
    const first = engines.map((e) => ({ e, s: stats[e], a: apis.current[e] })).find((x) => x.a && x.s?.scales);
    const snap = first?.a?.raw();
    if (!first || !snap || !first.s?.scales) return setMsg('손이 인식된 상태에서 눌러 주세요(손 추적 중 화면이 필요합니다).');
    setPts([]);
    setFrozenInfo({ palmPx: first.s.scales.palmPx, est: { all: first.s.scales.all, mcp: first.s.scales.mcp, knuckle: first.s.scales.knuckle } });
    window.setTimeout(() => {
      const cv = frozen.current;
      if (!cv) return;
      cv.width = snap.width;
      cv.height = snap.height;
      cv.getContext('2d')!.drawImage(snap, 0, 0);
    }, 0);
  }
  const refPx = pts.length === 2 ? Math.hypot(pts[0].x - pts[1].x, pts[0].y - pts[1].y) : null;
  const refPxPerCm = refPx && Number(refCm) > 0 ? refPx / Number(refCm) : null;
  function onFrozenClick(e: React.MouseEvent<HTMLCanvasElement>) {
    const cv = e.currentTarget;
    const r = cv.getBoundingClientRect();
    const p = { x: ((e.clientX - r.left) / r.width) * cv.width, y: ((e.clientY - r.top) / r.height) * cv.height };
    setPts((o) => (o.length >= 2 ? [p] : [...o, p]));
    const x = cv.getContext('2d')!;
    // redraw marks
    window.setTimeout(() => {
      x.fillStyle = '#ff3b6b';
      x.beginPath();
      x.arc(p.x, p.y, 6, 0, Math.PI * 2);
      x.fill();
    }, 0);
  }
  function applyRef() {
    if (!refPxPerCm || !frozenInfo) return;
    setOpts((o) => ({ ...o, scale: 'ref', refPxPerCm, refPalmPx: frozenInfo.palmPx }));
  }

  // ---- A/B cost calculator (same arithmetic as scripts/ai-fitting-ab.mjs) ----
  const [ab, setAb] = useState({ products: 3, styles: 2, arms: 3, runs: 2, usd: 0.04, cached: false });
  const abCalls = ab.products * ab.styles * ab.arms * ab.runs;
  const abCut = ab.cached ? 0 : ab.products;
  const abUnits = abCalls + abCut;
  const abWorst = abCalls * 3 + abCut * 3;

  const first = engines.map((e) => stats[e]).find(Boolean);
  const dims = product?.dimensions;
  const m3 = product?.model3d;

  return (
    <div style={css.page} data-testid="lab-page">
      <div style={css.banner}>개발 전용 비교 도구입니다. 운영 사이트에는 포함되지 않습니다. 이 화면의 AI 합성(Gemini)·실시간(Decart) 호출은 없습니다.</div>
      <video ref={clip} playsInline muted style={{ display: 'none' }} />
      <div style={css.bar}>
        <b>피팅 비교 랩</b>
        <button type="button" style={css.btn} onClick={openCamera} data-testid="lab-camera">카메라 켜기</button>
        <label style={css.btn2}>
          녹화 영상 재생
          <input type="file" accept="video/*" style={{ display: 'none' }} data-testid="lab-file" onChange={(e) => e.target.files?.[0] && openClip(e.target.files[0])} />
        </label>
        <label>
          <input type="checkbox" checked={mirror} onChange={(e) => setMirror(e.target.checked)} /> 좌우 반전(셀카)
        </label>
        <span>입력: <b data-testid="lab-source">{source === 'none' ? '없음' : source === 'camera' ? '실제 카메라' : '녹화 영상(실기기 검증 아님)'}</b></span>
        <label>
          제품{' '}
          <select value={product?.id ?? ''} onChange={(e) => setProductId(e.target.value)} data-testid="lab-product">
            {withModel.map((p) => (
              <option key={p.id} value={p.id}>
                {p.name.value ?? p.id}
              </option>
            ))}
          </select>
        </label>
        <span>엔진:</span>
        {ENGINES.map((e) => (
          <label key={e.id} title={e.note}>
            <input type="checkbox" checked={engines.includes(e.id)} onChange={(ev) => setEngines((o) => (ev.target.checked ? [...o, e.id].sort() : o.filter((x) => x !== e.id)))} data-testid={`lab-eng-${e.id}`} /> {e.label}
          </label>
        ))}
      </div>
      {msg && <div style={{ ...css.box, color: '#ff9aa2' }} role="alert">{msg}</div>}

      <div style={css.box}>
        <div style={css.bar}>
          <label>크기 {opts.size.toFixed(2)} <input type="range" min={0.7} max={1.4} step={0.05} value={opts.size} onChange={(e) => set('size', Number(e.target.value))} data-testid="lab-size" /></label>
          <label>크기 보정(곱) {opts.gain.toFixed(2)} <input type="range" min={0.5} max={1.5} step={0.01} value={opts.gain} onChange={(e) => set('gain', Number(e.target.value))} data-testid="lab-gain" /></label>
          <label>손잡이 위치 {opts.gripCm == null ? '자동(3cm)' : `${opts.gripCm.toFixed(1)}cm`} <input type="range" min={0} max={8} step={0.5} value={opts.gripCm ?? 3} onChange={(e) => set('gripCm', Number(e.target.value))} data-testid="lab-grip" /></label>
          <button type="button" style={css.btn2} onClick={() => set('gripCm', null)}>자동</button>
          <label>손 크기 추정{' '}
            <select value={opts.scale} onChange={(e) => set('scale', e.target.value as LabOptions['scale'])} data-testid="lab-scale">
              <option value="all">9개 뼈 평균(V1~V4)</option>
              <option value="mcp">마디 줄(V5)</option>
              <option value="knuckle">7.5cm 가정</option>
              <option value="ref" disabled={!opts.refPxPerCm}>기준물 보정값</option>
            </select>
          </label>
        </div>
        <div style={css.bar}>
          {(['shadow', 'mask', 'swing', 'grip'] as const).map((k) => (
            <label key={k}>
              <input type="checkbox" checked={opts[k]} onChange={(e) => set(k, e.target.checked)} data-testid={`lab-${k}`} /> {{ shadow: '그림자', mask: '손 가림 정리', swing: '흔들림', grip: '손잡이 규칙(V3+)' }[k]}
            </label>
          ))}
          <button type="button" style={css.btn} onClick={saveImage} data-testid="lab-save-image">비교 이미지 저장</button>
          <button type="button" style={recording ? { ...css.btn, background: '#c0392b' } : css.btn} onClick={toggleRecord} data-testid="lab-record">{recording ? '녹화 중지·저장' : '비교 영상 녹화'}</button>
        </div>
      </div>

      <div style={css.grid}>
        <div>
          <div style={{ marginBottom: 4 }}>원본 카메라(참고: 아래 각 칸이 같은 입력을 씁니다)</div>
          <RawView stream={stream} mirror={mirror} />
        </div>
        {product &&
          engines.map((e) => (
            <div key={`${e}-${product.id}-${stream?.id ?? 'x'}`}>
              <div style={{ marginBottom: 4 }}>
                <b>{e.toUpperCase()}</b> · {ENGINES.find((x) => x.id === e)?.note}
              </div>
              <MapTryOn
                product={product}
                styleKey="hand"
                stylePrompt=""
                styleChips={null}
                lab={{ engine: e, stream, mirror, options: opts, onStats, onApi: (a) => (apis.current[e] = a) }}
              />
            </div>
          ))}
      </div>

      <div style={{ ...css.box, marginTop: 12, overflowX: 'auto' }}>
        <b>실시간 수치</b> <span style={{ color: '#9aa4b5' }}>(칸이 여러 개면 감지 작업도 그만큼 늘어 FPS가 단독 실행보다 낮게 나옵니다. 추적 지연은 감지 시간 + 감지 간격의 절반으로 추정한 값입니다.)</span>
        <table style={{ borderCollapse: 'collapse', marginTop: 6 }} data-testid="lab-stats">
          <thead>
            <tr>{['엔진', 'FPS', '프레임 ms', '포즈 ms', '손 ms', '감지 간격 ms', '지연 추정 ms', '손 추적', '유실 횟수', '마지막 유실 ms', '복귀 최대 이동 px', '가방 그림', '가방 폭 px'].map((h) => <th key={h} style={css.th}>{h}</th>)}</tr>
          </thead>
          <tbody>
            {engines.map((e) => {
              const s = stats[e];
              return (
                <tr key={e}>
                  <td style={css.td}><b>{e.toUpperCase()}</b></td>
                  <td style={css.td}>{f1(s?.fps, 0)}</td>
                  <td style={css.td}>{f1(s?.frameMs)}</td>
                  <td style={css.td}>{f1(s?.poseMs, 0)}</td>
                  <td style={css.td}>{f1(s?.handMs, 0)}</td>
                  <td style={css.td}>{f1(s?.detectIntervalMs, 0)}</td>
                  <td style={css.td}>{f1(s?.lagEstimateMs, 0)}</td>
                  <td style={{ ...css.td, color: s?.tracked ? '#5dd196' : '#ff9aa2' }}>{s ? (s.tracked ? '추적 중' : s.currentLossMs ? `유실 ${f1(s.currentLossMs, 0)}ms` : '없음') : '–'}</td>
                  <td style={css.td}>{s?.losses ?? '–'}</td>
                  <td style={css.td}>{f1(s?.lastLossMs, 0)}</td>
                  <td style={css.td}>{f1(s?.recoverStepPx)}</td>
                  <td style={css.td}>{s ? (s.drawn ? '표시' : '숨김') : '–'}</td>
                  <td style={css.td}>{f1(s?.widthPx, 0)}</td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>

      <div style={css.box} data-testid="lab-size-panel">
        <b>제품 크기 확인</b>
        <div style={{ color: '#9aa4b5', margin: '4px 0' }}>실제 치수는 product.json, 3D 모델 치수는 model3d입니다(둘 다 단위 cm, 3D는 미터로 변환해 그림). 실측 자료가 없으면 절대 크기가 맞는지는 알 수 없습니다.</div>
        <table style={{ borderCollapse: 'collapse' }}>
          <tbody>
            <tr><td style={css.th}>상품 치수(W×H×D cm)</td><td style={css.td}>{dims ? `${dims.widthCm ?? '–'} × ${dims.heightCm ?? '–'} × ${dims.depthCm ?? '–'}` : '–'}</td></tr>
            <tr><td style={css.th}>3D 모델(W×H×D, 손잡이 cm)</td><td style={css.td}>{m3 ? `${m3.widthCm} × ${m3.heightCm} × ${m3.depthCm}, 손잡이 ${m3.handleCm}` : '–'}</td></tr>
            <tr><td style={css.th}>지금 쓰는 px/cm(추정)</td><td style={css.td}>{f1(first?.scales?.used)} (9뼈 {f1(first?.scales?.all)} · 마디 줄 {f1(first?.scales?.mcp)} · 7.5cm 가정 {f1(first?.scales?.knuckle)})</td></tr>
            <tr><td style={css.th}>화면의 가방 폭 ÷ px/cm</td><td style={css.td}>{first && m3 && first.scales ? `${f1(first.widthPx / (first.scales.used * opts.gain * opts.size), 1)} cm (3D 폭 ${m3.widthCm}cm와 같아야 함)` : '–'}</td></tr>
          </tbody>
        </table>
      </div>

      <div style={css.box} data-testid="lab-calib">
        <b>기준물로 크기 보정</b>
        <div style={{ color: '#9aa4b5', margin: '4px 0' }}>1) 자(또는 A4 용지 긴 변 29.7cm)를 손과 같은 거리에 두고 손이 인식된 채로 &quot;화면 고정&quot; → 2) 고정된 화면에서 기준물의 양 끝을 차례로 클릭 → 3) 실제 길이(cm) 입력 → &quot;이 값으로 보정&quot;. 기준물과 손이 같은 깊이에 있어야 합니다. 보정값은 손이 카메라에서 멀어지면 마디 줄 너비 비율로 따라갑니다(회전에는 약함).</div>
        <div style={css.bar}>
          <button type="button" style={css.btn2} onClick={freeze} data-testid="lab-freeze">화면 고정</button>
          <label>실제 길이 <input value={refCm} onChange={(e) => setRefCm(e.target.value)} size={5} data-testid="lab-refcm" /> cm</label>
          <span data-testid="lab-refresult">{refPxPerCm ? `기준물 ${f1(refPx, 0)}px → ${f1(refPxPerCm, 2)} px/cm` : '두 점을 클릭하세요'}</span>
          <button type="button" style={css.btn} disabled={!refPxPerCm} onClick={applyRef} data-testid="lab-applyref">이 값으로 보정</button>
        </div>
        {frozenInfo && (
          <>
            <canvas ref={frozen} onClick={onFrozenClick} style={{ width: '100%', maxWidth: 720, cursor: 'crosshair', background: '#000' }} data-testid="lab-frozen" />
            {refPxPerCm && (
              <table style={{ borderCollapse: 'collapse', marginTop: 6 }}>
                <thead><tr><th style={css.th}>추정 방식</th><th style={css.th}>px/cm</th><th style={css.th}>기준물 대비</th><th style={css.th}>필요한 크기 보정(곱)</th></tr></thead>
                <tbody>
                  {([['9개 뼈 평균', frozenInfo.est.all], ['마디 줄', frozenInfo.est.mcp], ['7.5cm 가정', frozenInfo.est.knuckle]] as const).map(([n, v]) => (
                    <tr key={n}><td style={css.td}>{n}</td><td style={css.td}>{f1(v, 2)}</td><td style={css.td}>{f1((v / refPxPerCm) * 100, 0)}%</td><td style={css.td}>{f1(refPxPerCm / v, 2)}</td></tr>
                  ))}
                </tbody>
              </table>
            )}
          </>
        )}
      </div>

      <div style={css.box} data-testid="lab-cost">
        <b>AI 사진 합성 A/B 시험 예상 비용 (실제 호출 아님)</b>
        <div style={css.bar}>
          {(['products', 'styles', 'arms', 'runs'] as const).map((k) => (
            <label key={k}>{{ products: '제품 수', styles: '착용 방식 수', arms: '비교 방식 수(v1/v2/v2faces)', runs: '반복 수' }[k]} <input type="number" min={1} max={8} value={ab[k]} onChange={(e) => setAb((o) => ({ ...o, [k]: Math.max(1, Number(e.target.value) || 1) }))} style={{ width: 52 }} /></label>
          ))}
          <label>1유닛 단가(USD, 확인 필요) <input type="number" step={0.005} value={ab.usd} onChange={(e) => setAb((o) => ({ ...o, usd: Number(e.target.value) || 0 }))} style={{ width: 70 }} /></label>
          <label><input type="checkbox" checked={ab.cached} onChange={(e) => setAb((o) => ({ ...o, cached: e.target.checked }))} /> 컷아웃이 이미 캐시됨</label>
        </div>
        <div data-testid="lab-cost-result">
          합성 {abCalls}회 + 컷아웃 {abCut}회 = <b>{abUnits}유닛</b> ≈ <b>USD {(abUnits * ab.usd).toFixed(2)}</b> (재시도가 모두 일어나는 최악의 경우 {abWorst}유닛 ≈ USD {(abWorst * ab.usd).toFixed(2)}).
          <div style={{ color: '#9aa4b5' }}>추정치입니다. 시도 횟수가 금액의 상한을 보장하지는 않습니다. 실행은 <code>scripts/ai-fitting-ab.mjs --max-usd …</code>로만 하며, 승인과 동의받은 인물 사진이 있어야 합니다.</div>
        </div>
      </div>
    </div>
  );
}

/** The untouched camera picture (same stream the panes use). */
function RawView({ stream, mirror }: { stream: MediaStream | null; mirror: boolean }) {
  const ref = useRef<HTMLVideoElement>(null);
  useEffect(() => {
    if (ref.current) {
      ref.current.srcObject = stream;
      void ref.current.play().catch(() => undefined);
    }
  }, [stream]);
  return (
    <div style={{ background: '#000', aspectRatio: '16 / 9', overflow: 'hidden' }}>
      <video ref={ref} playsInline muted style={{ width: '100%', height: '100%', objectFit: 'contain', transform: mirror ? 'scaleX(-1)' : 'none' }} data-testid="lab-raw" />
    </div>
  );
}

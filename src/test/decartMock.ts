/**
 * TEST DOUBLE for @decartai/sdk — only used when the app is built with RT_MOCK=1 (see vite.config.ts). It never contacts
 * Decart and draws "MOCK" over the visitor's own camera, so a pass here proves the page's wiring (permissions, token order,
 * states, cleanup, recording) and says NOTHING about real AI video quality. Behaviour is chosen by window.__rtMock.mode.
 */
type Handler = (e: unknown) => void;
declare global {
  interface Window {
    __rtMock?: { mode?: 'ok' | 'noframes' | 'refuse-image' | 'drop' };
    __rtLog?: string[];
  }
}
const log = (m: string) => (window.__rtLog ??= []).push(m);

export const models = {
  realtime: (name: string) => ({ name, fps: 30, width: 1280, height: 720 }),
};

export function createDecartClient(opts: { apiKey: string }) {
  log(`client:${opts.apiKey ? 'key' : 'nokey'}`);
  return {
    realtime: {
      async connect(input: MediaStream, o: { onRemoteStream: (s: MediaStream) => void }) {
        const mode = window.__rtMock?.mode ?? 'ok';
        log(`connect:${mode}`);
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
        if (mode === 'ok') window.setTimeout(() => handlers.get('generationTick')?.({}), 700);
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

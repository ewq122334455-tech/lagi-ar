export { QuotaCounter } from '/home/user/lagi-ar/server/tryon-worker/src/index';
interface Env { QUOTA: { idFromName(n: string): unknown; get(id: unknown): { fetch(u: string, i?: RequestInit): Promise<Response> } } }
export default {
  async fetch(req: Request, env: Env) {
    const u = new URL(req.url);
    const n = Number(u.searchParams.get('n') ?? 1);
    const sameIp = u.searchParams.get('ip');
    const siteCap = Number(u.searchParams.get('site') ?? 5);
    const ipCap = Number(u.searchParams.get('ipcap') ?? 99);
    const day = u.searchParams.get('day') ?? 'tryon:test';
    const res = await Promise.all(Array.from({ length: n }, (_, i) => env.QUOTA.get(env.QUOTA.idFromName(day)).fetch('https://quota/take', { method: 'POST', body: JSON.stringify({ ip: sameIp ?? `10.0.${i}.1`, siteCap, ipCap }) }).then((r) => r.json() as Promise<{ ok: boolean; reason?: string }>)));
    return Response.json({ served: res.filter((x) => x.ok).length, refusedSite: res.filter((x) => x.reason === 'site_limit').length, refusedIp: res.filter((x) => x.reason === 'daily_limit').length });
  },
};

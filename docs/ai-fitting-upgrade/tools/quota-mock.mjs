// A Durable Object namespace for tests: the real QuotaCounter class behind a one-request-at-a-time queue (like input gates),
// with a little storage latency. failure options: failGet / failPut / unreachable / garbage.
export function makeQuotaNs(QuotaCounter, opts = {}) {
  const store = new Map(); const instances = new Map(); const delay = (ms) => new Promise((r) => setTimeout(r, ms));
  const get = (name) => {
    if (!instances.has(name)) {
      const m = new Map(); let chain = Promise.resolve();
      const inst = new QuotaCounter({ storage: { get: async (k) => { await delay(1); if (opts.failGet) throw new Error('storage get failed'); return m.get(k); }, put: async (e) => { await delay(1); if (opts.failPut) throw new Error('storage put failed'); for (const [k, v] of Object.entries(e)) m.set(k, v); } } });
      instances.set(name, { m, run: (fn) => (chain = chain.then(fn)) });
      instances.get(name).inst = inst;
    }
    const o = instances.get(name);
    return { fetch: (u, init) => { if (opts.unreachable) return Promise.reject(new Error('DO unreachable')); if (opts.garbage) return Promise.resolve(new Response('<html>oops</html>')); return o.run(() => o.inst.fetch(new Request(u, init))); } };
  };
  return { idFromName: (n) => n, get, _instances: instances, _store: store };
}

import type { Product } from './productTypes';

const MANIFEST_URL = `${import.meta.env.BASE_URL}products/manifest.json`;
const LOCAL_DRAFTS_KEY = 'lagi.workspace.drafts.v1';

let cache: Product[] | null = null;
let inFlight: Promise<Product[]> | null = null;

interface Manifest {
  products: string[];
}

async function fetchProduct(id: string): Promise<Product | null> {
  try {
    const res = await fetch(`${import.meta.env.BASE_URL}products/${id}/product.json`, { cache: 'no-cache' });
    if (!res.ok) return null;
    return (await res.json()) as Product;
  } catch {
    return null;
  }
}

/** Draft products saved locally by the workspace (no backend to publish to — see AssetWorkspace). */
export function readLocalDrafts(): Product[] {
  try {
    const raw = localStorage.getItem(LOCAL_DRAFTS_KEY);
    if (!raw) return [];
    return JSON.parse(raw) as Product[];
  } catch {
    return [];
  }
}

export function writeLocalDraft(product: Product): void {
  const drafts = readLocalDrafts().filter((p) => p.id !== product.id);
  drafts.push(product);
  localStorage.setItem(LOCAL_DRAFTS_KEY, JSON.stringify(drafts));
}

export function deleteLocalDraft(id: string): void {
  const drafts = readLocalDrafts().filter((p) => p.id !== id);
  localStorage.setItem(LOCAL_DRAFTS_KEY, JSON.stringify(drafts));
}

/**
 * Loads every published product (spec §13: adding a product should not require
 * rebuilding the app — the manifest + per-product JSON are fetched at runtime).
 */
export async function loadProducts(): Promise<Product[]> {
  if (cache) return cache;
  if (inFlight) return inFlight;

  inFlight = (async () => {
    const manifestRes = await fetch(MANIFEST_URL, { cache: 'no-cache' });
    if (!manifestRes.ok) {
      throw new Error('PRODUCT_MANIFEST_UNAVAILABLE');
    }
    const manifest = (await manifestRes.json()) as Manifest;
    const results = await Promise.all(manifest.products.map(fetchProduct));
    const published = results.filter((p): p is Product => p !== null);
    cache = published;
    return published;
  })();

  try {
    return await inFlight;
  } finally {
    inFlight = null;
  }
}

export async function loadProduct(id: string): Promise<Product | null> {
  const published = await loadProducts();
  const found = published.find((p) => p.id === id);
  if (found) return found;
  return readLocalDrafts().find((p) => p.id === id) ?? null;
}

export function invalidateProductCache(): void {
  cache = null;
}

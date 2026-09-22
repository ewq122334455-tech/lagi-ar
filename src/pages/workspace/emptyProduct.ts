import type { Product } from '@/data/productTypes';
import { contentRequired } from '@/utils/contentStatus';

export function createEmptyProduct(id: string): Product {
  return {
    id,
    name: contentRequired(),
    category: contentRequired(),
    price: contentRequired(),
    currency: 'KRW',
    shortDescription: contentRequired(),
    description: contentRequired(),
    images: [],
    gallery: [],
    colors: [],
    dimensions: {},
    materials: [],
    process: [],
    details: [],
    story: contentRequired(),
    lagiSelectionReason: contentRequired(),
    model3D: '',
    animations: [],
    arTarget: '',
    arSettings: { scale: 1, position: { x: 0, y: 0, z: 0 }, rotation: { x: 0, y: 0, z: 0 } },
    hotspots: [],
    shopUrl: { value: 'https://smartstore.naver.com/lagi_official', status: 'VERIFIED', source: 'Official LAGI Smart Store' },
    instagramUrl: 'https://www.instagram.com/lagi.official/',
    arAvailable: false,
    threeDAvailable: false,
    featured: false,
  };
}

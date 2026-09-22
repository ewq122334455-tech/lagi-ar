import type { VerifiableField, Observation } from '@/utils/contentStatus';
import type { ModelFormat } from '@/utils/modelFile';

export type HotspotCategory =
  | 'MATERIAL'
  | 'DETAIL'
  | 'CRAFT'
  | 'PROCESS'
  | 'STRUCTURE'
  | 'FUNCTION';

export interface Vector3Like {
  x: number;
  y: number;
  z: number;
}

/** Reusable across the 3D viewer and AR (spec §26, §63). */
export interface Hotspot {
  id: string;
  title: string;
  category: HotspotCategory;
  /** Anchor position on the 3D model, in model local space. */
  position: Vector3Like;
  description: VerifiableField<string>;
  image?: string;
  cameraTarget?: {
    position: Vector3Like;
    lookAt: Vector3Like;
  };
  highlight?: {
    radius: number;
    color?: string;
  };
}

export interface ProcessStep {
  order: number;
  title: string;
  description: VerifiableField<string>;
  image?: string;
}

export interface MaterialEntry {
  name: VerifiableField<string>;
  image?: string;
  characteristics: VerifiableField<string>;
  productLocation: VerifiableField<string>;
  reasonForUse: VerifiableField<string>;
  relatedHotspotId?: string;
}

export interface ProductAnimation {
  id: string;
  label: string;
  /** Name of the GLB animation clip this control plays. */
  clipName: string;
}

/** Original-file identity of an uploaded 3D model, independent of the (possibly blob:) URL used to render it. */
export interface ModelAssetInfo {
  filename: string;
  format: ModelFormat;
  mimeType?: string;
  url: string;
}

export interface ARSettings {
  scale: number;
  position: Vector3Like;
  rotation: Vector3Like;
}

export interface ProductDimensions {
  widthCm?: number;
  heightCm?: number;
  depthCm?: number;
  weightG?: number;
}

/** Image-analysis findings recorded per spec §70, kept separate from verified facts. */
export interface ImageAnalysis {
  observations: Observation[];
  analyzedAt?: string;
  imageRef?: string;
}

export interface Product {
  id: string;
  name: VerifiableField<string>;
  category: VerifiableField<string>;
  price: VerifiableField<number>;
  currency: 'KRW';
  shortDescription: VerifiableField<string>;
  description: VerifiableField<string>;
  images: string[];
  gallery: string[];
  colors: string[];
  dimensions: ProductDimensions;
  materials: MaterialEntry[];
  process: ProcessStep[];
  details: Hotspot[];
  story: VerifiableField<string>;
  lagiSelectionReason: VerifiableField<string>;

  /** Empty string = no verified 3D asset yet; viewer falls back to a labeled placeholder. */
  model3D: string;
  /**
   * Original-file metadata for model3D, captured at upload time. Needed because model3D is
   * often a browser `blob:` URL during editing — a random UUID with no filename or extension
   * of its own — so extension/format validation must read this instead of the URL string.
   */
  model3DAsset?: ModelAssetInfo;
  animations: ProductAnimation[];

  /** Empty string = AR not yet configured for this product. */
  arTarget: string;
  arSettings: ARSettings;

  hotspots: Hotspot[];
  imageAnalysis?: ImageAnalysis;

  shopUrl: VerifiableField<string>;
  instagramUrl: string;

  arAvailable: boolean;
  threeDAvailable: boolean;
  featured?: boolean;
}

import type { VerifiableField, Observation } from '@/utils/contentStatus';
/** Legacy 3D file format kept only so old product.json files still type-check. */
type ModelFormat = 'glb' | 'gltf';

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

/** What part of the body a try-on garment is worn on — decides which pose landmarks it anchors to. */
export type GarmentType = 'TOP' | 'OUTER' | 'DRESS' | 'BOTTOM' | 'BAG';

/** How a BAG is worn. Visitors can switch between these in the try-on itself. */
export type CarryStyle = 'HAND' | 'SHOULDER' | 'CROSSBODY';

export interface Point2D {
  x: number;
  y: number;
}

/**
 * Virtual try-on (camera body-tracking) setup. The garment is a flat, front-facing cut-out
 * PNG with a transparent background. Two calibration anchors mark where the garment meets
 * the body — the shoulder seams for TOP/OUTER/DRESS, the waistband ends for BOTTOM, the
 * tops of the handles/strap ends for BAG — as fractions (0–1) of the image's width/height,
 * measured as the image is viewed (the wearer's right side is on the image's left).
 */
export interface TryOnSettings {
  garmentImage: string;
  garmentType: GarmentType;
  anchorLeft: Point2D;
  anchorRight: Point2D;
  /** Extra width multiplier for loose or oversized fits. 1 = anchors land exactly on the body. */
  fit: number;
  /** Vertical nudge, as a fraction of the anchor span. Positive moves the garment down. */
  offsetY: number;
  /** BAG only: the default way to wear it. */
  carry?: CarryStyle;
  /**
   * BAG only: real width of the bag in cm, which sizes it against the wearer's shoulders.
   * The image must be cropped tight to the bag for this to be accurate. Falls back to
   * dimensions.widthCm, then to a typical bag width.
   */
  realWidthCm?: number;
  /** BAG only: colour of the strap drawn for cross-body wear. */
  strapColor?: string;
}

/** One buyable combination. Sizes/colours a product does not have are simply null. */
export interface ProductVariant {
  id: string;
  size: string | null;
  color: string | null;
  /** null = stock not tracked. 0 = sold out. */
  stock: number | null;
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

/** Delivery cost as listed on the store. fee 0 = free shipping. */
export interface ShippingInfo {
  fee: number;
  /** Order total from which shipping becomes free. */
  freeOver?: number;
}

export interface Product {
  id: string;
  /** Brand line shown above the name, e.g. a collaboration ("LAGI × POPSICLUS"). Defaults to LAGI. */
  brandLabel?: string;
  shipping?: ShippingInfo;
  name: VerifiableField<string>;
  category: VerifiableField<string>;
  price: VerifiableField<number>;
  currency: 'KRW';
  shortDescription: VerifiableField<string>;
  description: VerifiableField<string>;
  images: string[];
  gallery: string[];
  /**
   * AI-generated styling shots (the product being carried). Never product photos: shown in their own
   * section, each labelled as AI imagery that may differ from the real product.
   */
  styledImages?: string[];
  colors: string[];
  /** Optional: products published before variants existed simply have none. */
  variants?: ProductVariant[];
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
  /**
   * Optional part-separated model for the /again colour remix. Needed when model3D is a single
   * fused mesh (e.g. an AI-generated scan) whose parts cannot be recoloured independently.
   */
  remixModel?: string;
  animations: ProductAnimation[];

  /** Empty string = AR not yet configured for this product. */
  arTarget: string;
  /** Optional picture of the image arTarget was compiled from, shown so visitors know what to scan. */
  arTargetPreview?: string;
  arSettings: ARSettings;

  hotspots: Hotspot[];
  imageAnalysis?: ImageAnalysis;

  shopUrl: VerifiableField<string>;
  instagramUrl: string;

  /** Optional: only wearable products have a try-on garment. */
  tryOn?: TryOnSettings;

  arAvailable: boolean;
  threeDAvailable: boolean;
  /** Editorial switch for the camera try-on, mirroring arAvailable. */
  tryOnAvailable?: boolean;
  featured?: boolean;
  /** Placeholder product made up for layout; not on sale yet, so it cannot be bought. */
  sample?: boolean;
}

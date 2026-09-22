/** A model's bounding sphere in its own local space, used to auto-frame the camera. */
export interface ModelBounds {
  center: [number, number, number];
  radius: number;
}

/** Roughly encloses PlaceholderModel's fixed synthetic geometry. */
export const PLACEHOLDER_BOUNDS: ModelBounds = { center: [0, 0.05, 0], radius: 1.1 };

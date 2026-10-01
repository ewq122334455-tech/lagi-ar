/** A model's bounding sphere in its own local space, used to auto-frame the camera. */
export interface ModelBounds {
  center: [number, number, number];
  radius: number;
  /** Lowest point of the model, so ground contact shadows sit on its base rather than the
   *  bounding sphere's underside (which floats for anything that isn't a ball). */
  minY: number;
}

/** Roughly encloses PlaceholderModel's fixed synthetic geometry. */
export const PLACEHOLDER_BOUNDS: ModelBounds = { center: [0, 0.05, 0], radius: 1.1, minY: -0.75 };

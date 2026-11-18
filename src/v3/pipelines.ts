/**
 * The realtime fitting pipelines that can be compared under the same conditions (address flag `&pipe=`).
 *
 *   A   Gemini-redrawn product cut-out      + lucy-vton-3.6   (the old way)
 *   B   the ORIGINAL clean product photo    + lucy-vton-3.6   (default: nothing is redrawn)
 *   C   Extreme Precision reference picture + lucy-vton-3.6   (the visitor carrying the product, checked before use)
 *   D   the ORIGINAL clean product photo    + lucy-2.6
 *   DC  Extreme Precision reference picture + lucy-2.6
 *
 * `&provider=fal` makes the reference picture with Decart's example model (FLUX Klein 9B + try-on LoRA) instead of Gemini.
 * Old flags still work: `&prefit=1` = C, `&model=` forces the realtime model.
 */
export type Reference = 'legacy' | 'original' | 'prefit';
export type PipeId = 'A' | 'B' | 'C' | 'D' | 'DC';
export type RealtimeModel = 'lucy-vton-3.6' | 'lucy-vton-3.5' | 'lucy-2.6';

export interface Pipeline {
  id: PipeId;
  reference: Reference;
  model: RealtimeModel;
  provider?: 'gemini' | 'fal';
}

const TABLE: Record<PipeId, { reference: Reference; model: RealtimeModel }> = {
  A: { reference: 'legacy', model: 'lucy-vton-3.6' },
  B: { reference: 'original', model: 'lucy-vton-3.6' },
  C: { reference: 'prefit', model: 'lucy-vton-3.6' },
  D: { reference: 'original', model: 'lucy-2.6' },
  DC: { reference: 'prefit', model: 'lucy-2.6' },
};

export function parsePipeline(flags: string): Pipeline {
  const pipe = /[?&]pipe=(A|B|C|DC|D)(&|$)/i.exec(flags)?.[1]?.toUpperCase() as PipeId | undefined;
  const id: PipeId = pipe ?? (/[?&]prefit=1(&|$)/.test(flags) ? 'C' : 'B');
  const model = (/[?&]model=(lucy-vton-3\.6|lucy-vton-3\.5|lucy-2\.6)(&|$)/.exec(flags)?.[1] as RealtimeModel | undefined) ?? TABLE[id].model;
  const provider = /[?&]provider=(fal|gemini)(&|$)/.exec(flags)?.[1] as 'fal' | 'gemini' | undefined;
  return { id, reference: TABLE[id].reference, model, provider };
}

export type Garment = 'top' | 'bottom' | 'set' | 'outer' | 'dress' | 'bag' | 'item';
/** What kind of thing a product is, from the store's category value (Top, Bottom, Set, Outer, Dress, Bag …). */
export function garmentOf(category: string | null | undefined): Garment {
  const c = (category ?? '').toLowerCase();
  if (c === 'top') return 'top';
  if (c === 'bottom') return 'bottom';
  if (c === 'set') return 'set';
  if (c === 'outer') return 'outer';
  if (c === 'dress') return 'dress';
  return c.includes('bag') ? 'bag' : 'item';
}
export const isGarment = (g: Garment) => g === 'top' || g === 'bottom' || g === 'set' || g === 'outer' || g === 'dress';

/** How the bag is carried, from the instruction text of the chosen way of wearing it. */
export function carryOf(stylePrompt: string): 'hand' | 'shoulder' {
  return /shoulder/i.test(stylePrompt) ? 'shoulder' : 'hand';
}

/**
 * The instruction for the realtime model. Each carry style and each model family has its own wording, so they can be tuned
 * and compared separately (Decart's guide for the VTON models: one action, "Add … to the outfit", only what the reference
 * shows, at most ~750 characters; the general Lucy 2.6 editor takes plain descriptive sentences).
 */
export function realtimePrompt(opts: { model: RealtimeModel; carry: 'hand' | 'shoulder'; kind: string; description?: string; prefit: boolean; garment?: Garment }): string {
  const { model, carry, kind, description, prefit, garment } = opts;
  if (garment && isGarment(garment)) {
    // Clothing — what the VTON models were made for. Decart's two patterns: "Substitute the current <part> with …" (20-30 words: colour, material, pattern, fit).
    const part = garment === 'top' ? 'top' : garment === 'bottom' ? 'pants' : garment === 'outer' ? 'top layer' : 'outfit';
    const what = description ? description.slice(0, 380) : garment === 'set' ? 'the matching set shown in the reference image' : `the ${garment === 'bottom' ? 'pants' : 'garment'} shown in the reference image`;
    // The strongest wording that still stays inside Decart's guide (one action, only what the reference shows, well under 750 characters in all).
    const exact =
      'It must look identical to the reference image: the same weave and fabric texture, the same colours, the same print size, position and lettering, the same neckline, sleeve length and fit. Do not simplify, restyle, shrink or move any graphic, and do not add details. Keep the wearer\'s own face, hair, body shape, chest and build, and the background, exactly unchanged.';
    if (model.startsWith('lucy-vton')) return garment === 'set' ? `Substitute the current top and bottoms with ${what} ${exact}` : `Substitute the current ${part} with ${what}. ${exact}${prefit ? ' Exactly as in the reference image.' : ''}`;
    return `The person wears the ${garment === 'set' ? 'matching set' : garment === 'bottom' ? 'pants' : 'garment'} from the reference image in place of their current ${garment === 'set' ? 'outfit' : part}. ${description ? `It is ${description.slice(0, 380)} ` : ''}${exact}`;
  }
  const what = description ? `the ${kind}: ${description.slice(0, 380)}` : `the ${kind} shown in the reference image`;
  const place =
    carry === 'shoulder'
      ? `resting on one shoulder by its handles or strap, hanging down at hip height`
      : `held in one hand by its handle, hanging straight down below the fist, not touching the body`;
  const exact = 'Copy its exact shape, colours, prints and lettering; do not invent details.';
  if (model.startsWith('lucy-vton')) {
    // The reference may already show the person carrying it (Extreme Precision): then the instruction only has to keep it.
    return prefit
      ? `Add ${what} to the outfit, ${place}, exactly as in the reference image. ${exact}`
      : `Add ${what} to the outfit, ${place}. ${exact}`;
  }
  return prefit
    ? `The person carries the ${kind} from the reference image, ${place}, exactly as shown there. ${description ? `The ${kind}: ${description.slice(0, 380)}. ` : ''}${exact} It is an accessory, not clothing: keep the person's clothes and the background unchanged.`
    : `Add the ${kind} from the reference image, ${place}. ${description ? `The ${kind}: ${description.slice(0, 380)}. ` : ''}${exact} It is an accessory, not clothing: keep the person's clothes and the background unchanged.`;
}

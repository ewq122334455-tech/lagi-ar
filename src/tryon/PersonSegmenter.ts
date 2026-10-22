import type { ImageSegmenter } from '@mediapipe/tasks-vision';
import { visionFileset } from './PoseTracker';

/**
 * Splits the wearer from the background (and into hair / face / skin / clothes) with MediaPipe's
 * selfie multiclass model, so the try-on can tuck garments behind the face and hands and keep
 * clothes inside the body outline. Runs on a small downscaled copy of the frame for speed.
 */
const SEGMENT_MODEL =
  'https://storage.googleapis.com/mediapipe-models/image_segmenter/selfie_multiclass_256x256/float32/latest/selfie_multiclass_256x256.tflite';
const INPUT_SIZE = 256;

/** selfie_multiclass categories. */
const CAT = { BACKGROUND: 0, HAIR: 1, BODY_SKIN: 2, FACE_SKIN: 3, CLOTHES: 4, OTHERS: 5 } as const;

/** Alpha masks at segmentation resolution, in the un-mirrored orientation of the source frame. */
export interface PersonMasks {
  /** Everything that is the person (not background). */
  person: HTMLCanvasElement;
  /** Hair and face — drawn back over a collar or strap. */
  head: HTMLCanvasElement;
  /** Arms and hands — drawn back over a bag handle held in the hand. */
  skin: HTMLCanvasElement;
}

export class PersonSegmenter {
  private segmenter: ImageSegmenter | null = null;
  private mode: 'VIDEO' | 'IMAGE' = 'VIDEO';
  private lastTimestamp = -1;
  private input = document.createElement('canvas');
  private masks: PersonMasks = {
    person: document.createElement('canvas'),
    head: document.createElement('canvas'),
    skin: document.createElement('canvas'),
  };

  async load(): Promise<void> {
    if (this.segmenter) return;
    const { ImageSegmenter } = await import('@mediapipe/tasks-vision');
    const fileset = await visionFileset();
    const create = (delegate: 'GPU' | 'CPU') =>
      ImageSegmenter.createFromOptions(fileset, {
        baseOptions: { modelAssetPath: SEGMENT_MODEL, delegate },
        runningMode: 'VIDEO',
        outputCategoryMask: true,
        outputConfidenceMasks: false,
      });
    try {
      this.segmenter = await create('GPU');
    } catch {
      this.segmenter = await create('CPU');
    }
    this.mode = 'VIDEO';
  }

  private async setMode(mode: 'VIDEO' | 'IMAGE') {
    if (!this.segmenter || this.mode === mode) return;
    await this.segmenter.setOptions({ runningMode: mode });
    this.mode = mode;
    this.lastTimestamp = -1;
  }

  private downscale(source: CanvasImageSource, w: number, h: number) {
    const s = INPUT_SIZE / Math.max(w, h);
    this.input.width = Math.max(1, Math.round(w * s));
    this.input.height = Math.max(1, Math.round(h * s));
    this.input.getContext('2d')!.drawImage(source, 0, 0, this.input.width, this.input.height);
    return this.input;
  }

  async segmentVideo(video: HTMLVideoElement): Promise<PersonMasks | null> {
    if (!this.segmenter || !video.videoWidth) return null;
    await this.setMode('VIDEO');
    const frame = this.downscale(video, video.videoWidth, video.videoHeight);
    const ts = Math.max(performance.now(), this.lastTimestamp + 1);
    this.lastTimestamp = ts;
    let out: PersonMasks | null = null;
    this.segmenter.segmentForVideo(frame, ts, (r) => {
      if (r.categoryMask) out = this.toMasks(r.categoryMask.getAsUint8Array(), r.categoryMask.width, r.categoryMask.height);
    });
    return out;
  }

  async segmentImage(image: HTMLImageElement): Promise<PersonMasks | null> {
    if (!this.segmenter) return null;
    await this.setMode('IMAGE');
    const frame = this.downscale(image, image.naturalWidth, image.naturalHeight);
    let out: PersonMasks | null = null;
    this.segmenter.segment(frame, (r) => {
      if (r.categoryMask) out = this.toMasks(r.categoryMask.getAsUint8Array(), r.categoryMask.width, r.categoryMask.height);
    });
    return out;
  }

  private toMasks(cats: Uint8Array, w: number, h: number): PersonMasks {
    const paint = (canvas: HTMLCanvasElement, keep: (c: number) => boolean) => {
      canvas.width = w;
      canvas.height = h;
      const ctx = canvas.getContext('2d')!;
      const img = ctx.createImageData(w, h);
      for (let i = 0; i < cats.length; i++) {
        const o = i * 4;
        img.data[o] = img.data[o + 1] = img.data[o + 2] = 255;
        img.data[o + 3] = keep(cats[i]) ? 255 : 0;
      }
      ctx.putImageData(img, 0, 0);
    };
    paint(this.masks.person, (c) => c !== CAT.BACKGROUND);
    paint(this.masks.head, (c) => c === CAT.HAIR || c === CAT.FACE_SKIN);
    paint(this.masks.skin, (c) => c === CAT.BODY_SKIN);
    return this.masks;
  }

  close() {
    this.segmenter?.close();
    this.segmenter = null;
  }
}

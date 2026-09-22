/** GLB/glTF file identification shared by the workspace upload handler and validateProduct. */

export type ModelFormat = 'glb' | 'gltf';

const EXTENSION_TO_FORMAT: Record<string, ModelFormat> = {
  '.glb': 'glb',
  '.gltf': 'gltf',
};

const MIME_TO_FORMAT: Record<string, ModelFormat> = {
  'model/gltf-binary': 'glb',
  'model/gltf+json': 'gltf',
};

export function isBlobUrl(url: string): boolean {
  return url.startsWith('blob:');
}

/** Derives the model format from a filename's extension — never from a blob: URL string. */
export function formatFromFilename(filename: string): ModelFormat | null {
  const lower = filename.toLowerCase();
  const ext = Object.keys(EXTENSION_TO_FORMAT).find((e) => lower.endsWith(e));
  return ext ? EXTENSION_TO_FORMAT[ext] : null;
}

export function formatFromMimeType(mimeType: string | undefined | null): ModelFormat | null {
  if (!mimeType) return null;
  return MIME_TO_FORMAT[mimeType] ?? null;
}

/** True when the given File is a GLB/glTF by filename extension or, failing that, MIME type. */
export function isValidModelFile(file: File): boolean {
  return formatFromFilename(file.name) !== null || formatFromMimeType(file.type) !== null;
}

export function modelFormatOf(file: File): ModelFormat | null {
  return formatFromFilename(file.name) ?? formatFromMimeType(file.type);
}

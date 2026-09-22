export interface ThreeDGenerationRequest {
  imageUrls: string[];
  prompt: string;
  productId: string;
}

export type ThreeDGenerationStatus = 'unavailable' | 'queued' | 'processing' | 'complete' | 'failed';

export interface ThreeDGenerationResult {
  status: ThreeDGenerationStatus;
  modelUrl?: string;
  previewImageUrl?: string;
  errorMessage?: string;
}

/**
 * 3D generation service abstraction (spec §21, §69). Kept separate from AIProvider
 * because a project may use one vendor for image/text AI and a different, dedicated
 * vendor for image-to-3D generation.
 */
export interface ThreeDGenerationProvider {
  readonly id: string;
  readonly available: boolean;
  generate(request: ThreeDGenerationRequest): Promise<ThreeDGenerationResult>;
}

/** No generation backend configured — never returns a fake "complete" result (spec §21: "Never fake successful generation"). */
export class NullThreeDGenerationProvider implements ThreeDGenerationProvider {
  readonly id = 'none';
  readonly available = false;

  async generate(): Promise<ThreeDGenerationResult> {
    return {
      status: 'unavailable',
      errorMessage: '연결된 3D 생성 서비스가 없습니다. GLB 파일을 직접 업로드해 주세요.',
    };
  }
}

/** Client for a secure backend that proxies to a real image-to-3D generation vendor. */
export class RemoteThreeDGenerationProvider implements ThreeDGenerationProvider {
  readonly id = 'remote';
  readonly available = true;
  constructor(private baseUrl: string) {}

  async generate(request: ThreeDGenerationRequest): Promise<ThreeDGenerationResult> {
    try {
      const res = await fetch(`${this.baseUrl}/generate-3d`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(request),
      });
      if (!res.ok) return { status: 'failed', errorMessage: `생성 서비스 오류 (${res.status})` };
      return (await res.json()) as ThreeDGenerationResult;
    } catch {
      return { status: 'failed', errorMessage: '생성 서비스에 연결하지 못했습니다.' };
    }
  }
}

let cached: ThreeDGenerationProvider | null = null;

export function getThreeDGenerationProvider(): ThreeDGenerationProvider {
  if (cached) return cached;
  const base = import.meta.env.VITE_3D_GENERATION_API_BASE as string | undefined;
  cached = base ? new RemoteThreeDGenerationProvider(base) : new NullThreeDGenerationProvider();
  return cached;
}

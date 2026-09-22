import type { Observation } from '@/utils/contentStatus';

export interface ImageAnalysisResult {
  observations: Observation[];
}

export interface DraftTextResult {
  text: string;
  /** Always 'AI_DRAFT' — AI copy is never auto-promoted to VERIFIED (spec §43-44). */
  status: 'AI_DRAFT';
}

export interface ThreeDAssistRequest {
  imageUrls: string[];
  productName?: string;
  notes?: string;
}

export interface ThreeDAssistResult {
  /** A structured brief a human (or a ThreeDGenerationProvider) can act on — never a fabricated model. */
  suggestedPrompt: string;
  observations: Observation[];
}

/**
 * AI capability abstraction (spec §20). No single vendor is hard-coded above this
 * interface — swap the implementation returned by getAIProvider() to change providers.
 */
export interface AIProvider {
  readonly id: string;
  readonly available: boolean;
  analyzeProductImage(imageUrl: string): Promise<ImageAnalysisResult>;
  analyzeProductStructure(imageUrls: string[]): Promise<ImageAnalysisResult>;
  generateProductDescription(input: { productName?: string; observations: Observation[] }): Promise<DraftTextResult>;
  assist3DGeneration(input: ThreeDAssistRequest): Promise<ThreeDAssistResult>;
}

/**
 * Default provider when no AI backend is configured. It never invents observations
 * or copy — every call resolves to an explicit "not available" result (spec §19: "If
 * direct generation is not available in the current environment: DO NOT PRETEND IT
 * WAS GENERATED").
 */
export class NullAIProvider implements AIProvider {
  readonly id = 'none';
  readonly available = false;

  async analyzeProductImage(): Promise<ImageAnalysisResult> {
    return { observations: [{ level: 'UNKNOWN', label: 'AI 이미지 분석 서비스가 연결되어 있지 않습니다.' }] };
  }

  async analyzeProductStructure(): Promise<ImageAnalysisResult> {
    return { observations: [{ level: 'UNKNOWN', label: 'AI 구조 분석 서비스가 연결되어 있지 않습니다.' }] };
  }

  async generateProductDescription(): Promise<DraftTextResult> {
    throw new AIProviderUnavailableError('설명 초안을 생성할 AI 서비스가 연결되어 있지 않습니다.');
  }

  async assist3DGeneration(): Promise<ThreeDAssistResult> {
    throw new AIProviderUnavailableError('3D 생성을 보조할 AI 서비스가 연결되어 있지 않습니다.');
  }
}

/**
 * Talks to a secure backend boundary (spec §68: frontend never holds provider secret
 * keys — only this base URL, pointing at a server this app does not itself implement).
 * Activates automatically once VITE_AI_API_BASE is configured in the deployment.
 */
export class RemoteAIProvider implements AIProvider {
  readonly id = 'remote';
  readonly available = true;
  constructor(private baseUrl: string) {}

  private async post<T>(path: string, body: unknown): Promise<T> {
    const res = await fetch(`${this.baseUrl}${path}`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(body),
    });
    if (!res.ok) throw new AIProviderUnavailableError(`AI 서비스 오류 (${res.status})`);
    return res.json() as Promise<T>;
  }

  analyzeProductImage(imageUrl: string) {
    return this.post<ImageAnalysisResult>('/analyze-image', { imageUrl });
  }

  analyzeProductStructure(imageUrls: string[]) {
    return this.post<ImageAnalysisResult>('/analyze-structure', { imageUrls });
  }

  generateProductDescription(input: { productName?: string; observations: Observation[] }) {
    return this.post<DraftTextResult>('/generate-description', input);
  }

  assist3DGeneration(input: ThreeDAssistRequest) {
    return this.post<ThreeDAssistResult>('/assist-3d', input);
  }
}

export class AIProviderUnavailableError extends Error {}

let cached: AIProvider | null = null;

export function getAIProvider(): AIProvider {
  if (cached) return cached;
  const base = import.meta.env.VITE_AI_API_BASE as string | undefined;
  cached = base ? new RemoteAIProvider(base) : new NullAIProvider();
  return cached;
}

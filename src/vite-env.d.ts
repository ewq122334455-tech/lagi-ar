/// <reference types="vite/client" />

interface ImportMetaEnv {
  readonly VITE_AI_API_BASE?: string;
  readonly VITE_3D_GENERATION_API_BASE?: string;
}

interface ImportMeta {
  readonly env: ImportMetaEnv;
}

/// <reference types="vite/client" />

interface ImportMetaEnv {
  readonly VITE_AI_API_BASE?: string;
  /** Toss Payments client key (public). Without it the checkout shows payment as not connected. */
  readonly VITE_TOSS_CLIENT_KEY?: string;
  /** Worker URL for orders; defaults to the AI try-on Worker. */
  readonly VITE_ORDER_API_URL?: string;
  /** "1" compiles the fitting comparison lab (#/lab) into the build. Never set for the published site. */
  readonly VITE_LAB?: string;
  /** "1" compiles the on-device benchmark panel into the build. Never set for the published site. */
  readonly VITE_BENCH?: string;
}

interface ImportMeta {
  readonly env: ImportMetaEnv;
}

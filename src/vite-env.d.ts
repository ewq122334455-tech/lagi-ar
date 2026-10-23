/// <reference types="vite/client" />

interface ImportMetaEnv {
  readonly VITE_AI_API_BASE?: string;
  /** Toss Payments client key (public). Without it the checkout shows payment as not connected. */
  readonly VITE_TOSS_CLIENT_KEY?: string;
  /** Worker URL for orders; defaults to the AI try-on Worker. */
  readonly VITE_ORDER_API_URL?: string;
}

interface ImportMeta {
  readonly env: ImportMetaEnv;
}

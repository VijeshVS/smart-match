/// <reference types="vite/client" />

interface ImportMetaEnv {
  readonly VITE_APP_NAME?: string;
  readonly VITE_SITE_URL?: string;
  readonly VITE_CANDIDATE_PORTAL_URL?: string;
  readonly VITE_API_GATEWAY_URL?: string;
  readonly VITE_NOTIFICATION_WS_URL?: string;
}

interface ImportMeta {
  readonly env: ImportMetaEnv;
}

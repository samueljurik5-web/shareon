/** Short git commit of the build (see vite.config.ts). */
declare const __APP_VERSION__: string;

interface ImportMetaEnv {
  readonly VITE_API_URL?: string;
  /** Public Instagram profile (https://…) for the footer – optional, set at build time. */
  readonly VITE_INSTAGRAM_URL?: string;
  /** Public contact e-mail for /ako-to-funguje#kontakt – optional, set at build time. */
  readonly VITE_CONTACT_EMAIL?: string;
}

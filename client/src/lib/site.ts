/** Public site links configured at build time (Render: environment variables of the web service). */
const env = import.meta.env;

/** Instagram profile – only an https URL is accepted. */
export const INSTAGRAM_URL = env.VITE_INSTAGRAM_URL && /^https:\/\/\S+$/.test(env.VITE_INSTAGRAM_URL) ? env.VITE_INSTAGRAM_URL : null;

export const CONTACT_EMAIL = env.VITE_CONTACT_EMAIL && /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(env.VITE_CONTACT_EMAIL) ? env.VITE_CONTACT_EMAIL : null;

/** Operator of the service (name) – set in Render, see DEPLOYMENT.md. */
const clean = (v?: string) => (v && v.trim() ? v.trim() : null);
export const OPERATOR = {
  name: clean(env.VITE_OPERATOR_NAME),
};

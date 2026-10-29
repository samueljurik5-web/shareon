import { useEffect, useState } from 'react';
import { get } from '../api/client';

/** Public site links (Render: environment variables of the web service). Build-time values are a fallback. */
const env = import.meta.env;

/** Instagram profile – only an https URL is accepted. */
export const INSTAGRAM_URL = env.VITE_INSTAGRAM_URL && /^https:\/\/\S+$/.test(env.VITE_INSTAGRAM_URL) ? env.VITE_INSTAGRAM_URL : null;

export const CONTACT_EMAIL = env.VITE_CONTACT_EMAIL && /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(env.VITE_CONTACT_EMAIL) ? env.VITE_CONTACT_EMAIL : null;

/** Operator of the service (name) – set in Render, see DEPLOYMENT.md. */
const clean = (v?: string) => (v && v.trim() ? v.trim() : null);
export const OPERATOR = {
  name: clean(env.VITE_OPERATOR_NAME),
};

export interface SiteInfo {
  operatorName: string | null;
  contactEmail: string | null;
  instagramUrl: string | null;
}

const buildTime: SiteInfo = { operatorName: OPERATOR.name, contactEmail: CONTACT_EMAIL, instagramUrl: INSTAGRAM_URL };
let cache: Promise<SiteInfo> | null = null;

/** Operator/contact info read by the server at runtime (no rebuild needed), loaded once per page load. */
export const useSite = (): SiteInfo => {
  const [site, setSite] = useState<SiteInfo>(buildTime);
  useEffect(() => {
    cache ??= get<{ site?: Partial<SiteInfo> }>('/api/settings/public')
      .then((r) => ({
        operatorName: r.site?.operatorName ?? buildTime.operatorName,
        contactEmail: r.site?.contactEmail ?? buildTime.contactEmail,
        instagramUrl: r.site?.instagramUrl ?? buildTime.instagramUrl,
      }))
      .catch(() => buildTime);
    let alive = true;
    void cache.then((s) => alive && setSite(s));
    return () => {
      alive = false;
    };
  }, []);
  return site;
};

/** Anonymous funnel counter – no cookies, no identifiers; failures are ignored. */
export type TrackEvent = 'visit_home' | 'view_search' | 'view_item' | 'view_sample_item' | 'rent_click' | 'add_item_open';

export const track = (name: TrackEvent) => {
  try {
    void fetch(`${import.meta.env.VITE_API_URL ?? ''}/api/launch/events`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ name }),
      keepalive: true,
    }).catch(() => undefined);
  } catch {
    // analytics must never break the page
  }
};

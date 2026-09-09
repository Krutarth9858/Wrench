import { useEffect, useState } from 'react';

/**
 * Which experience to render.
 *
 * Wrench ships two deliberate experiences rather than one responsive layout:
 * the approved desktop UI at >= 768px, and a purpose-built mobile UI below it.
 * Pages branch on this hook; they do not reflow the desktop DOM.
 *
 * `matchMedia` rather than a resize listener: the browser only notifies us when
 * the answer actually changes, so rotating or resizing does not re-render on
 * every intermediate pixel.
 */
export const MOBILE_MAX_WIDTH = 767;
const QUERY = `(max-width: ${MOBILE_MAX_WIDTH}px)`;

export function useIsMobile(): boolean {
  const [isMobile, setIsMobile] = useState(
    // Read synchronously so the first paint is already the right experience —
    // mounting desktop and swapping would flash the wrong layout on a phone.
    () => typeof window !== 'undefined' && window.matchMedia(QUERY).matches,
  );

  useEffect(() => {
    const media = window.matchMedia(QUERY);
    const onChange = (event: MediaQueryListEvent) => setIsMobile(event.matches);
    media.addEventListener('change', onChange);
    setIsMobile(media.matches);
    return () => media.removeEventListener('change', onChange);
  }, []);

  return isMobile;
}

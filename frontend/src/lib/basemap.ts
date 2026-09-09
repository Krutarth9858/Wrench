/**
 * The CARTO basemap both maps draw on.
 *
 * CARTO watermarks its raster tiles with "API KEY REQUIRED" unless the request
 * carries a key, so the key is what makes the map legible rather than what
 * makes it work — tiles still load without one, just stamped.
 *
 * The key travels in the tile URL because Leaflet loads tiles through `<img>`
 * elements, which cannot carry an Authorization header. That makes it visible
 * in the browser, as every web-map tile key is: it is not a secret, and the
 * protection is a domain/referrer restriction set on the key in CARTO, not
 * concealment. Nothing else in Wrench is exposed by it.
 */

const TILES = 'https://{s}.basemaps.cartocdn.com/light_all/{z}/{x}/{y}{r}.png';

/** Empty when unset, which is a watermarked but working map. */
const KEY: string = import.meta.env.VITE_CARTO_API_KEY ?? '';

export const BASEMAP_URL = KEY ? `${TILES}?key=${encodeURIComponent(KEY)}` : TILES;

export const BASEMAP_OPTIONS = {
  maxZoom: 19,
  subdomains: 'abcd',
  attribution: '&copy; OpenStreetMap contributors &copy; CARTO',
} as const;

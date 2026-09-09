/**
 * Rough arrival estimate from straight-line distance.
 *
 * Presented as an estimate because that is all it is: Wrench has no routing
 * provider, so this assumes ~22 km/h average city speed plus a few minutes to
 * set off. It is never shown without a "~", so it does not read as a promise.
 * Swap this for a routing API when one exists — nothing else needs to change.
 */
export function estimateMinutes(distanceKm: number): number {
  return Math.max(3, Math.round((distanceKm / 22) * 60) + 4);
}

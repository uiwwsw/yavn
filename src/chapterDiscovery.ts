/**
 * Numbered chapters are found by asking the host whether `0.yaml`, `1.yaml` … exist, and the
 * probe only learns where a game ends by running off it. Every miss is a 404 the browser
 * prints to the console, so a five-chapter game greeted its player with four red lines on
 * every load and spent the requests to earn them.
 *
 * A game that states its chapter count in `config.yaml` skips all of that.
 */
export function resolveDeclaredChapterNumbers({
  declaredCount,
  startsAtZero,
}: {
  declaredCount: number;
  startsAtZero: boolean;
}): number[] {
  if (!Number.isInteger(declaredCount) || declaredCount <= 0) return [];
  const first = startsAtZero ? 0 : 1;
  return Array.from({ length: declaredCount }, (_, index) => first + index);
}

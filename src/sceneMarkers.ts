type Point = { x: number; y: number };

export const SCENE_MARKER_SIZE = 44;

/** Keep touch areas separate when cropped image points land on the same screen edge. */
export function placeSceneMarkers(points: Point[], width: number, height: number): Point[] {
  const placed: Point[] = [];
  const radius = SCENE_MARKER_SIZE / 2;
  const clamp = (value: number, extent: number) =>
    Math.max(radius, Math.min(extent - radius, value));
  for (const point of points) {
    const columns = [point.x, ...placed.flatMap(p => [p.x - SCENE_MARKER_SIZE, p.x + SCENE_MARKER_SIZE])];
    const rows = [point.y, ...placed.flatMap(p => [p.y - SCENE_MARKER_SIZE, p.y + SCENE_MARKER_SIZE])];
    let best: Point | undefined;
    let bestDistance = Infinity;
    for (const column of columns) {
      for (const row of rows) {
        const x = clamp(column, width);
        const y = clamp(row, height);
        const distance = (point.x - x) ** 2 + (point.y - y) ** 2;
        if (distance >= bestDistance || placed.some(p =>
          Math.abs(p.x - x) < SCENE_MARKER_SIZE && Math.abs(p.y - y) < SCENE_MARKER_SIZE)) continue;
        best = { x, y };
        bestDistance = distance;
      }
    }
    placed.push(best ?? point);
  }
  return placed;
}

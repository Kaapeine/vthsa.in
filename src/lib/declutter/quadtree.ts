import type { Quadtree } from 'd3-quadtree';

export function visitWithin<T extends { dx: number; dy: number }>(
  tree: Quadtree<T>,
  cx: number,
  cy: number,
  r: number,
  cb: (d: T) => void,
): void {
  const r2 = r * r;
  tree.visit((node, x0, y0, x1, y1) => {
    if (!('length' in node)) {
      let leaf: typeof node | undefined = node;
      do {
        const d = (leaf as { data: T }).data;
        const ddx = d.dx - cx;
        const ddy = d.dy - cy;
        if (ddx * ddx + ddy * ddy <= r2) cb(d);
        leaf = (leaf as { next?: typeof node }).next;
      } while (leaf);
    }
    return x0 > cx + r || x1 < cx - r || y0 > cy + r || y1 < cy - r;
  });
}

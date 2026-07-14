// Pure geometry for relation arrows. Given two anchor points, returns the SVG
// path for an arc that bows upward, plus where to place its label.
export interface Arc {
  d: string;
  labelX: number;
  labelY: number;
}

export function arc(
  x1: number,
  y1: number,
  x2: number,
  y2: number,
  bow = 28,
): Arc {
  const mx = (x1 + x2) / 2;
  const apexY = Math.min(y1, y2) - bow;
  // Quadratic Bézier through a single control point above the midpoint.
  const d = `M ${x1} ${y1} Q ${mx} ${apexY} ${x2} ${y2}`;
  // y of the curve at its midpoint (t = 0.5), for label placement.
  const midY = 0.25 * y1 + 0.5 * apexY + 0.25 * y2;
  return { d, labelX: mx, labelY: midY - 4 };
}

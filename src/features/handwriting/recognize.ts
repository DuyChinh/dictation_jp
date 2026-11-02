/**
 * Handwriting recognition by stroke matching. A drawing is scaled the same way as the stored characters (longest
 * side fills a 64-unit box), every stroke becomes 8 points, and each stored character is scored by pairing its
 * strokes with the drawn ones. Pairing ignores the order the strokes were drawn in (learners often get it wrong)
 * and only mildly prefers the right order; a missing or extra stroke costs a fixed amount.
 */

export type Point = { x: number; y: number };

export type StrokeData = {
  points: number;
  grid: number;
  /** Character → its strokes, 8 points of two letters each, strokes joined with ",". */
  chars: Record<string, string>;
};

export type Template = { ch: string; strokes: Float32Array[] };

const ALPHABET = "0123456789ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz-_";
const POINTS = 8;
const GRID = 63;
/** What a stroke with no partner costs, in the same units as the distance between strokes. */
const UNMATCHED = 22;
/** How much drawing a stroke at a different place in the order costs, per full length of the order. */
const ORDER_WEIGHT = 5;
/** A stroke drawn the wrong way round is allowed, at a price. */
const REVERSED = 1.35;
/** Stroke counts further than this from the drawing are not tried. */
const COUNT_SLACK = 3;

const CODE = new Map([...ALPHABET].map((c, i) => [c, i]));

export function parseTemplates(data: StrokeData): Template[] {
  return Object.entries(data.chars).map(([ch, packed]) => ({
    ch,
    strokes: packed.split(",").map((s) => {
      const out = new Float32Array(s.length);
      for (let i = 0; i < s.length; i++) out[i] = CODE.get(s[i]!) ?? 0;
      return out;
    }),
  }));
}

function resample(points: Point[], n: number): Point[] {
  if (points.length === 1) return Array.from({ length: n }, () => points[0]!);
  const seg: number[] = [];
  let total = 0;
  for (let i = 0; i < points.length - 1; i++) {
    const d = Math.hypot(points[i + 1]!.x - points[i]!.x, points[i + 1]!.y - points[i]!.y);
    seg.push(d);
    total += d;
  }
  if (total === 0) return Array.from({ length: n }, () => points[0]!);
  const out: Point[] = [];
  let j = 0;
  let acc = 0;
  for (let k = 0; k < n; k++) {
    const target = (total * k) / (n - 1);
    while (j < seg.length - 1 && acc + seg[j]! < target) {
      acc += seg[j]!;
      j++;
    }
    const t = seg[j] === 0 ? 0 : Math.min(1, Math.max(0, (target - acc) / seg[j]!));
    const a = points[j]!;
    const b = points[j + 1]!;
    out.push({ x: a.x + (b.x - a.x) * t, y: a.y + (b.y - a.y) * t });
  }
  return out;
}

/** The drawing in the stored form: scaled to the 64-unit box, 8 points per stroke. */
export function normalizeDrawing(strokes: Point[][]): Float32Array[] {
  const drawn = strokes.filter((s) => s.length > 0);
  if (drawn.length === 0) return [];
  let minX = Infinity;
  let minY = Infinity;
  let maxX = -Infinity;
  let maxY = -Infinity;
  for (const s of drawn) {
    for (const p of s) {
      minX = Math.min(minX, p.x);
      minY = Math.min(minY, p.y);
      maxX = Math.max(maxX, p.x);
      maxY = Math.max(maxY, p.y);
    }
  }
  const w = maxX - minX;
  const h = maxY - minY;
  const scale = GRID / Math.max(w, h, 1);
  const ox = (GRID - w * scale) / 2 - minX * scale;
  const oy = (GRID - h * scale) / 2 - minY * scale;
  return drawn.map((s) => {
    const out = new Float32Array(POINTS * 2);
    resample(s, POINTS).forEach((p, i) => {
      out[i * 2] = p.x * scale + ox;
      out[i * 2 + 1] = p.y * scale + oy;
    });
    return out;
  });
}

function strokeDistance(a: Float32Array, b: Float32Array): number {
  let fwd = 0;
  let rev = 0;
  for (let i = 0; i < POINTS; i++) {
    fwd += Math.hypot(a[i * 2]! - b[i * 2]!, a[i * 2 + 1]! - b[i * 2 + 1]!);
    const r = POINTS - 1 - i;
    rev += Math.hypot(a[i * 2]! - b[r * 2]!, a[i * 2 + 1]! - b[r * 2 + 1]!);
  }
  return Math.min(fwd, rev * REVERSED) / POINTS;
}

/** Cheapest way to pair every row with a distinct column (rows <= columns): the Hungarian algorithm. */
function assign(cost: number[][], rows: number, cols: number): number {
  const INF = 1e9;
  const u = new Array<number>(rows + 1).fill(0);
  const v = new Array<number>(cols + 1).fill(0);
  const p = new Array<number>(cols + 1).fill(0);
  const way = new Array<number>(cols + 1).fill(0);
  for (let i = 1; i <= rows; i++) {
    p[0] = i;
    let j0 = 0;
    const minv = new Array<number>(cols + 1).fill(INF);
    const used = new Array<boolean>(cols + 1).fill(false);
    do {
      used[j0] = true;
      const i0 = p[j0]!;
      let delta = INF;
      let j1 = 0;
      for (let j = 1; j <= cols; j++) {
        if (used[j]) continue;
        const cur = cost[i0 - 1]![j - 1]! - u[i0]! - v[j]!;
        if (cur < minv[j]!) {
          minv[j] = cur;
          way[j] = j0;
        }
        if (minv[j]! < delta) {
          delta = minv[j]!;
          j1 = j;
        }
      }
      for (let j = 0; j <= cols; j++) {
        if (used[j]) {
          u[p[j]!] = u[p[j]!]! + delta;
          v[j] = v[j]! - delta;
        } else {
          minv[j] = minv[j]! - delta;
        }
      }
      j0 = j1;
    } while (p[j0] !== 0);
    do {
      const j1 = way[j0]!;
      p[j0] = p[j1]!;
      j0 = j1;
    } while (j0);
  }
  let total = 0;
  for (let j = 1; j <= cols; j++) {
    if (p[j]) total += cost[p[j]! - 1]![j - 1]!;
  }
  return total;
}

/** Lower is closer. Characters with a very different number of strokes are not scored. */
export function score(drawing: Float32Array[], t: Template): number {
  const n = drawing.length;
  const m = t.strokes.length;
  if (Math.abs(n - m) > COUNT_SLACK) return Infinity;
  // Rows are the shorter side, so every one of them gets a partner and the rest are the unmatched strokes.
  const rowsAreDrawing = n <= m;
  const rows = rowsAreDrawing ? n : m;
  const cols = rowsAreDrawing ? m : n;
  const cost: number[][] = [];
  for (let r = 0; r < rows; r++) {
    const line: number[] = [];
    for (let c = 0; c < cols; c++) {
      const a = rowsAreDrawing ? drawing[r]! : drawing[c]!;
      const b = rowsAreDrawing ? t.strokes[c]! : t.strokes[r]!;
      const di = rowsAreDrawing ? r : c;
      const ti = rowsAreDrawing ? c : r;
      const order = Math.abs(di / Math.max(n - 1, 1) - ti / Math.max(m - 1, 1));
      line.push(strokeDistance(a, b) + ORDER_WEIGHT * order);
    }
    cost.push(line);
  }
  return (assign(cost, rows, cols) + UNMATCHED * Math.abs(n - m)) / Math.max(n, m);
}

/** The closest characters to the drawing, best first. */
export function recognize(strokes: Point[][], templates: Template[], limit = 12): string[] {
  const drawing = normalizeDrawing(strokes);
  if (drawing.length === 0) return [];
  const scored: Array<{ ch: string; s: number }> = [];
  for (const t of templates) {
    const s = score(drawing, t);
    if (s !== Infinity) scored.push({ ch: t.ch, s });
  }
  scored.sort((a, b) => a.s - b.s);
  return scored.slice(0, limit).map((x) => x.ch);
}

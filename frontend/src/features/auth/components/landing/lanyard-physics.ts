// A small rope simulation for the hero dog's lanyard (AU-01): Verlet points joined by fixed-length links, solved a few
// times per step. Units are pixels of the dog picture (971 × 1286), so the picture's size on screen doesn't matter.
// No library: the 3D physics stacks (three.js + Rapier) would add over a megabyte to the landing page.

export type Point = { x: number; y: number; px: number; py: number; invMass: number };
type Side = "left" | "right";
/** `side`: which half of the strap a link belongs to (its length stretches with that half); none for the card. */
type Link = { a: number; b: number; length: number; rest: number; side?: Side };

export type Lanyard = {
  points: Point[];
  links: Link[];
  /** Index of the clip, where both ends of the strap meet and the card hangs. */
  clip: number;
  /** Index of the card's bottom edge; the clip → bottom link sets the card's angle. */
  cardBottom: number;
  /** Index ranges of the two strap halves, anchor to clip. */
  left: number[];
  right: number[];
  /** How far each half is stretched right now (1 = its rest length). */
  stretch: Record<Side, number>;
};

export const PICTURE = { width: 971, height: 1286 };

/**
 * Where the strap ends, behind the dog's neck on either side (measured on the picture). Both points sit well inside the
 * neck fur, which NECK_CLIP redraws over the strap, so the strap seems to come out from behind the neck.
 */
export const ANCHORS = { left: { x: 168, y: 342 }, right: { x: 352, y: 302 } };

/**
 * The dog's head and neck fur, down to where the fur meets the white shirt collar, as a CSS clip-path on the picture.
 * A copy of the picture clipped to this is drawn over the strap.
 */
export const NECK_CLIP = `polygon(${[
  [0, 0], [971, 0], [971, 250], [430, 300], [392, 312], [350, 345], [300, 380], [260, 410], [225, 428],
  [195, 415], [170, 396], [145, 376], [130, 366], [100, 340], [0, 330],
]
  .map(([x, y]) => `${((x / 971) * 100).toFixed(2)}% ${((y / 1286) * 100).toFixed(2)}%`)
  .join(", ")})`;

/**
 * Length of each half of the strap, chosen so the card rests in the middle of the dog's chest, over its tie (clip at
 * about 272, 654). The right anchor sits higher on the turned neck, so that half is a little longer.
 */
const STRAP: Record<Side, number> = { left: 330, right: 360 };
/** The strap is elastic: a held card can pull it to 1.6 × its length, and it eases back when let go. */
const MAX_STRETCH = 1.6;
const RECOIL = 0.06;
const SEGMENTS = 6;
const GRAVITY = 9000;
const AIR_DAMPING = 0.988;
const ITERATIONS = 12;
export const STEP_SECONDS = 1 / 120;

/** The lanyard hanging straight down at rest, with the card `cardHeight` tall. */
export function createLanyard(cardHeight: number): Lanyard {
  const points: Point[] = [];
  const add = (x: number, y: number, invMass: number) => {
    points.push({ x, y, px: x, py: y, invMass });
    return points.length - 1;
  };
  const { left: a, right: b } = ANCHORS;
  const middle = { x: (a.x + b.x) / 2, y: Math.max(a.y, b.y) + Math.min(STRAP.left, STRAP.right) * 0.8 };

  // Left anchor → clip, then clip → right anchor, as one chain; the clip and card are heavier than the strap.
  const leftIndexes: number[] = [];
  for (let i = 0; i < SEGMENTS; i++) {
    const t = i / SEGMENTS;
    leftIndexes.push(add(a.x + (middle.x - a.x) * t, a.y + (middle.y - a.y) * t, i === 0 ? 0 : 1));
  }
  const clip = add(middle.x, middle.y, 0.3);
  const rightIndexes: number[] = [clip];
  for (let i = SEGMENTS - 1; i >= 0; i--) {
    const t = i / SEGMENTS;
    rightIndexes.push(add(b.x + (middle.x - b.x) * t, b.y + (middle.y - b.y) * t, i === 0 ? 0 : 1));
  }
  const cardBottom = add(middle.x, middle.y + cardHeight, 0.3);

  const chain = [...leftIndexes, ...rightIndexes]; // rightIndexes starts with the clip
  const links: Link[] = [];
  for (let i = 0; i < chain.length - 1; i++) {
    const side: Side = i < SEGMENTS ? "left" : "right";
    const length = STRAP[side] / SEGMENTS;
    links.push({ a: chain[i], b: chain[i + 1], length, rest: length, side });
  }
  links.push({ a: clip, b: cardBottom, length: cardHeight, rest: cardHeight });

  const lanyard: Lanyard = {
    points,
    links,
    clip,
    cardBottom,
    left: [...leftIndexes, clip],
    right: rightIndexes.reverse(),
    stretch: { left: 1, right: 1 },
  };
  settle(lanyard);
  return lanyard;
}

/** Runs the simulation until the lanyard hangs still. Deterministic, so server and browser agree on the first paint. */
export function settle(lanyard: Lanyard, steps = 900) {
  for (let i = 0; i < steps; i++) step(lanyard, null, 0.9);
  for (const point of lanyard.points) {
    point.px = point.x;
    point.py = point.y;
  }
}

/** Sets the card's height (it changes with the screen size), keeping the clip where it is. */
export function setCardHeight(lanyard: Lanyard, cardHeight: number) {
  const card = lanyard.links[lanyard.links.length - 1];
  card.length = cardHeight;
  card.rest = cardHeight;
}

/**
 * One fixed step. `hold` pins the clip to a point (the card being dragged), within reach of both anchors; the strap
 * stretches as far as it needs to (up to MAX_STRETCH) and eases back once the card is let go. `damping` is per step;
 * lower settles faster.
 */
export function step(lanyard: Lanyard, hold: { x: number; y: number } | null, damping = AIR_DAMPING) {
  const { points, links, clip } = lanyard;
  const gravity = GRAVITY * STEP_SECONDS * STEP_SECONDS;

  for (const point of points) {
    if (point.invMass === 0) continue;
    const vx = (point.x - point.px) * damping;
    const vy = (point.y - point.py) * damping;
    point.px = point.x;
    point.py = point.y;
    point.x += vx;
    point.y += vy + gravity;
  }

  const held = hold ? withinReach(hold) : null;
  for (const side of ["left", "right"] as const) {
    const anchor = ANCHORS[side];
    const needed = held ? Math.hypot(held.x - anchor.x, held.y - anchor.y) / STRAP[side] : 1;
    const target = Math.max(1, needed);
    lanyard.stretch[side] += (target - lanyard.stretch[side]) * (held ? 1 : RECOIL);
  }
  for (const link of links) if (link.side) link.length = link.rest * lanyard.stretch[link.side];

  for (let iteration = 0; iteration < ITERATIONS; iteration++) {
    if (held) {
      points[clip].x = held.x;
      points[clip].y = held.y;
    }
    for (const link of links) {
      const a = points[link.a];
      const b = points[link.b];
      const wa = held && link.a === clip ? 0 : a.invMass;
      const wb = held && link.b === clip ? 0 : b.invMass;
      if (wa + wb === 0) continue;
      const dx = b.x - a.x;
      const dy = b.y - a.y;
      const distance = Math.hypot(dx, dy) || 0.0001;
      const correction = (distance - link.length) / (distance * (wa + wb));
      a.x += dx * correction * wa;
      a.y += dy * correction * wa;
      b.x -= dx * correction * wb;
      b.y -= dy * correction * wb;
    }
  }
}

/** Moves a point back inside the circle each half of the strap can reach from its anchor, fully stretched. */
export function withinReach(target: { x: number; y: number }) {
  let { x, y } = target;
  for (const side of ["left", "right"] as const) {
    const anchor = ANCHORS[side];
    const reach = STRAP[side] * MAX_STRETCH;
    const dx = x - anchor.x;
    const dy = y - anchor.y;
    const distance = Math.hypot(dx, dy);
    if (distance > reach) {
      x = anchor.x + (dx / distance) * reach;
      y = anchor.y + (dy / distance) * reach;
    }
  }
  return { x, y };
}

/** The card's tilt in degrees (clockwise positive, as CSS rotate), from the clip → bottom link. */
export function cardAngle(lanyard: Lanyard): number {
  const top = lanyard.points[lanyard.clip];
  const bottom = lanyard.points[lanyard.cardBottom];
  return (-Math.atan2(bottom.x - top.x, bottom.y - top.y) * 180) / Math.PI;
}

/** How far everything moved in the last step; near zero once the lanyard hangs still. */
export function motion(lanyard: Lanyard): number {
  let total = 0;
  for (const point of lanyard.points) total += Math.abs(point.x - point.px) + Math.abs(point.y - point.py);
  return total;
}

/** A smooth SVG path through the points (midpoint quadratic curves). */
export function strapPath(lanyard: Lanyard, indexes: number[]): string {
  const p = indexes.map((index) => lanyard.points[index]);
  let d = `M${p[0].x.toFixed(1)} ${p[0].y.toFixed(1)}`;
  for (let i = 1; i < p.length - 1; i++) {
    const mx = (p[i].x + p[i + 1].x) / 2;
    const my = (p[i].y + p[i + 1].y) / 2;
    d += ` Q${p[i].x.toFixed(1)} ${p[i].y.toFixed(1)} ${mx.toFixed(1)} ${my.toFixed(1)}`;
  }
  const last = p[p.length - 1];
  return `${d} L${last.x.toFixed(1)} ${last.y.toFixed(1)}`;
}

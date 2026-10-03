import { describe, expect, it } from "vitest";
import {
  ANCHORS,
  cardAngle,
  createLanyard,
  motion,
  step,
  strapPath,
  withinReach,
} from "@/features/auth/components/landing/lanyard-physics";

const CARD_HEIGHT = 300;

function linkStretch(lanyard: ReturnType<typeof createLanyard>) {
  return Math.max(
    ...lanyard.links.map((link) => {
      const a = lanyard.points[link.a];
      const b = lanyard.points[link.b];
      return Math.abs(Math.hypot(b.x - a.x, b.y - a.y) - link.length) / link.length;
    }),
  );
}

describe("dog lanyard physics (AU-01)", () => {
  it("hangs still in the middle of the dog's chest, card straight down", () => {
    const lanyard = createLanyard(CARD_HEIGHT);
    const clip = lanyard.points[lanyard.clip];
    expect(clip.x).toBeGreaterThan(245);
    expect(clip.x).toBeLessThan(290);
    expect(clip.y).toBeGreaterThan(620);
    expect(clip.y).toBeLessThan(700);
    expect(Math.abs(cardAngle(lanyard))).toBeLessThan(0.5);
    expect(motion(lanyard)).toBe(0);
    expect(linkStretch(lanyard)).toBeLessThan(0.02);
  });

  it("is deterministic, so the server and the browser paint the same first frame", () => {
    expect(createLanyard(CARD_HEIGHT).points).toEqual(createLanyard(CARD_HEIGHT).points);
  });

  it("keeps the strap ends fixed at the collar", () => {
    const lanyard = createLanyard(CARD_HEIGHT);
    for (let i = 0; i < 240; i++) step(lanyard, { x: 900, y: 1200 });
    const [left, right] = [lanyard.points[lanyard.left[0]], lanyard.points[lanyard.right[0]]];
    expect(left).toMatchObject(ANCHORS.left);
    expect(right).toMatchObject(ANCHORS.right);
  });

  it("lets a dragged card stretch the strap to at most 1.6 × its length", () => {
    const target = withinReach({ x: 2000, y: 2000 });
    expect(Math.hypot(target.x - ANCHORS.left.x, target.y - ANCHORS.left.y)).toBeLessThanOrEqual(330 * 1.6 + 0.01);
    expect(Math.hypot(target.x - ANCHORS.right.x, target.y - ANCHORS.right.y)).toBeLessThanOrEqual(360 * 1.6 + 0.01);

    const lanyard = createLanyard(CARD_HEIGHT);
    for (let i = 0; i < 240; i++) step(lanyard, { x: 2000, y: 2000 });
    const { left, right } = lanyard.stretch;
    expect(Math.max(left, right)).toBeGreaterThan(1.2);
    expect(Math.max(left, right)).toBeLessThanOrEqual(1.6 + 1e-9);
    expect(linkStretch(lanyard)).toBeLessThan(0.05);
  });

  it("swings back to rest after being let go", () => {
    const lanyard = createLanyard(CARD_HEIGHT);
    const rest = { ...lanyard.points[lanyard.clip] };
    for (let i = 0; i < 60; i++) step(lanyard, { x: 200, y: 450 });
    expect(Math.abs(lanyard.points[lanyard.clip].x - rest.x)).toBeGreaterThan(50);
    for (let i = 0; i < 120 * 12; i++) step(lanyard, null);
    expect(lanyard.stretch).toEqual({ left: expect.closeTo(1, 3), right: expect.closeTo(1, 3) });
    expect(lanyard.points[lanyard.clip].x).toBeCloseTo(rest.x, 0);
    expect(lanyard.points[lanyard.clip].y).toBeCloseTo(rest.y, 0);
  });

  it("draws each strap half from its anchor to the clip", () => {
    const lanyard = createLanyard(CARD_HEIGHT);
    const path = strapPath(lanyard, lanyard.left);
    expect(path.startsWith(`M${ANCHORS.left.x.toFixed(1)} ${ANCHORS.left.y.toFixed(1)}`)).toBe(true);
    const clip = lanyard.points[lanyard.clip];
    expect(path.endsWith(`L${clip.x.toFixed(1)} ${clip.y.toFixed(1)}`)).toBe(true);
  });
});

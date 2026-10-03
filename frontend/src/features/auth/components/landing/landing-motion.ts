// The landing hero's story (AU-01), told in motion and replayed every CYCLE_MS while the hero is on screen: the job
// offer is sent (the chip's timer runs and its icon rolls to a check), the job is loved (the heart beats), then both
// reset and it plays again. On the first run only, the lanyard card also shows its back, "Furever home". Reduced
// motion shows the end states and doesn't loop.

/** When the offer chip starts sending within a cycle, and how long sending takes. */
export const OFFER_START_MS = 300;
export const OFFER_SEND_MS = 2200;

/** The moment the offer is sent: the chip's check rolls in and turns yellow. */
export const OFFER_SENT_MS = OFFER_START_MS + OFFER_SEND_MS;

/** One heartbeat, and the point in it (the heart's smallest) where it swaps to solid yellow. */
export const HEART_BEAT_DURATION_MS = 560;
export const HEART_SWAP_AT = 0.4;

/**
 * The heart starts its beat early enough that its swap to yellow lands on the same frame as the chip's yellow check,
 * so the two turn yellow together. Both reset together just before the next cycle.
 */
export const HEART_BEAT_MS = OFFER_SENT_MS - HEART_BEAT_DURATION_MS * HEART_SWAP_AT;
export const HEART_RESET_MS = 6600;

/** One full run of the story. */
export const CYCLE_MS = 7000;

/**
 * Elements the How it works target cursor frames (target-cursor.tsx): `="hired"` frames in gold. Kept here, in a plain
 * module, because a server component that imports a constant from a "use client" file gets a reference, not the value.
 */
export const CURSOR_TARGET_ATTR = "data-cursor-target";

/** The card turns over after the first heartbeat, and how long its back stays up. */
export const CARD_HINT_MS = HEART_BEAT_MS + 800;
export const CARD_HINT_HOLD_MS = 1800;

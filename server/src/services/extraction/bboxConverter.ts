import { BoundingBox } from '@landvision/types';

/**
 * Gemini's `box_2d` bounding-box format.
 *
 * Returned by Gemini's structured-output mode (and the Google Cloud
 * Document AI layout endpoint) as a 4-tuple of integers normalised to
 * the range [0, 1000]:
 *
 *   box_2d = [ymin, xmin, ymax, xmax]
 *
 * The origin (0, 0) is the TOP-LEFT corner of the image, so:
 *   - ymin is the distance from the top edge to the top of the box
 *   - xmin is the distance from the left edge to the left of the box
 *   - ymax is the distance from the top edge to the bottom of the box
 *   - xmax is the distance from the left edge to the right of the box
 *
 * (Note: this is a different order than the more common Pascal-VOC
 *  `[xmin, ymin, xmax, ymax]` — Gemini puts the y-axis first.)
 *
 * LandVision's internal `BoundingBox` uses normalised 0-1 coordinates
 * with an origin at the top-left and (x, y, width, height) — i.e. the
 * same orientation but a different parameterisation.
 */

/** The integer scale Gemini uses for box_2d normalisation. */
export const GEMINI_BOX_SCALE = 1000;

/** Shape of the raw 4-tuple coming back from Gemini. */
export type GeminiBox2D = [number, number, number, number] | number[];

/**
 * Convert one Gemini `box_2d` tuple `[ymin, xmin, ymax, xmax]` (0-1000)
 * into LandVision's `BoundingBox` shape (0-1, x/y/width/height).
 *
 * Behaviour:
 *  - If the input is missing or has fewer than 4 numeric entries, returns null.
 *  - Out-of-range values (>1000 or <0) are clamped to [0, 1000] before
 *    normalisation, so a slightly-out-of-spec model output still
 *    produces a valid bbox.
 *  - If `ymin > ymax` (or `xmin > xmax`) after clamping — which can
 *    happen with model noise — the two are swapped so width/height
 *    are always non-negative.
 *  - The optional `pageNo` is attached to the returned bbox so the
 *    caller can record which page of a multi-page document the box
 *    belongs to.
 *
 * Pure & side-effect-free — safe to use from unit tests or in a worker.
 */
export function geminiBoxToBoundingBox(
  box: GeminiBox2D | null | undefined,
  pageNo?: number,
): BoundingBox | null {
  if (!box || !Array.isArray(box) || box.length < 4) {
    return null;
  }

  // Pull the four edges out and clamp to [0, GEMINI_BOX_SCALE].
  const clamp = (v: number): number => {
    if (typeof v !== 'number' || !Number.isFinite(v)) return 0;
    if (v < 0) return 0;
    if (v > GEMINI_BOX_SCALE) return GEMINI_BOX_SCALE;
    return v;
  };

  let ymin = clamp(Number(box[0]));
  let xmin = clamp(Number(box[1]));
  let ymax = clamp(Number(box[2]));
  let xmax = clamp(Number(box[3]));

  // Defensive: if the model returns the corners in the wrong order,
  // swap them so width/height are non-negative downstream.
  if (ymin > ymax) {
    [ymin, ymax] = [ymax, ymin];
  }
  if (xmin > xmax) {
    [xmin, xmax] = [xmax, xmin];
  }

  const x = xmin / GEMINI_BOX_SCALE;
  const y = ymin / GEMINI_BOX_SCALE;
  const width = (xmax - xmin) / GEMINI_BOX_SCALE;
  const height = (ymax - ymin) / GEMINI_BOX_SCALE;

  const result: BoundingBox = { x, y, width, height };
  if (typeof pageNo === 'number' && pageNo > 0) {
    result.pageNo = pageNo;
  }
  return result;
}

/**
 * Batch helper — converts an object whose values are Gemini `box_2d`
 * tuples into the same object shape with `BoundingBox` values.
 *
 * Useful when you have a record like
 *   `{ ownerName: [10, 20, 30, 40], village: [50, 60, 70, 80] }`
 * and want a parallel
 *   `{ ownerName: BoundingBox, village: BoundingBox }` map.
 */
export function geminiBoxMapToBoundingBoxMap(
  boxes: Record<string, GeminiBox2D | null | undefined> | null | undefined,
  pageNo?: number,
): Record<string, BoundingBox | null> {
  if (!boxes) return {};
  const out: Record<string, BoundingBox | null> = {};
  for (const [key, value] of Object.entries(boxes)) {
    out[key] = geminiBoxToBoundingBox(value, pageNo);
  }
  return out;
}

export default geminiBoxToBoundingBox;

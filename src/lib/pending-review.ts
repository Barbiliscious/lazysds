import type { ExtractedIndexRow, SDSSourceKind } from "@shared/types";

/**
 * In-memory hand-off between the intake flow and the approval screen.
 * Deliberately not persisted: a File object can't survive a page refresh
 * anyway, and re-uploading is cheap. If the user refreshes /review, the
 * page redirects home.
 */

export interface PendingReview {
  file: File;
  extracted: ExtractedIndexRow;
  /** How the PDF got here - recorded on the saved record. */
  source: SDSSourceKind;
}

let pending: PendingReview | null = null;

export function setPendingReview(review: PendingReview): void {
  pending = review;
}

export function getPendingReview(): PendingReview | null {
  return pending;
}

export function clearPendingReview(): void {
  pending = null;
}

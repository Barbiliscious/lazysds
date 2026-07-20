/**
 * A queue of PDFs to review one after another, for when the worker uploads
 * several safety sheets at once. Deliberately in-memory (like the pending
 * review): File objects can't survive a refresh, and re-uploading is cheap.
 *
 * The intake flow puts the files here and reviews the first; the approval
 * screen advances to the next after each save.
 */

let files: File[] = [];
let index = 0;

export function startQueue(list: File[]): void {
  files = list;
  index = 0;
}

/** Position of the current item, or null when it's a single PDF (no batch UI). */
export function queuePosition(): { current: number; total: number } | null {
  return files.length > 1 ? { current: index + 1, total: files.length } : null;
}

export function hasNext(): boolean {
  return index + 1 < files.length;
}

/** Move to the next file and return it, or null if the batch is finished. */
export function advance(): File | null {
  index += 1;
  return files[index] ?? null;
}

export function clearQueue(): void {
  files = [];
  index = 0;
}

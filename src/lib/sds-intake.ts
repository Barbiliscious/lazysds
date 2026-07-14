import type { SDSSourceKind } from "@shared/types";
import { extractPdfText } from "./pdf-text";
import { extractSDS } from "./api-client";
import { setPendingReview } from "./pending-review";

/**
 * The one pipeline every SDS enters through, whatever page it started on:
 * read the PDF's text in the browser, send it to /api/extract, and park
 * the result for the review screen. Throws Errors with messages that are
 * safe to show the user as-is.
 */

export type IntakePhase = "reading-pdf" | "extracting";

export async function prepareReview(
  file: File,
  source: SDSSourceKind,
  onPhase: (phase: IntakePhase) => void,
): Promise<void> {
  if (file.type !== "application/pdf" && !file.name.toLowerCase().endsWith(".pdf")) {
    throw new Error("That doesn't look like a PDF. The safety sheet needs to be a PDF file.");
  }
  onPhase("reading-pdf");
  const text = await extractPdfText(file);
  if (text.length < 50) {
    throw new Error(
      "We couldn't read any text in that PDF — it might be a scanned image. Try a PDF downloaded from the manufacturer's website.",
    );
  }
  onPhase("extracting");
  const extracted = await extractSDS(text);
  setPendingReview({ file, text, extracted, source });
}

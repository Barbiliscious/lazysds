import { useEffect, useState, type ReactNode } from "react";
import { loadPdfSections, type RenderedBlock } from "@/lib/pdf-sections";

interface PdfSectionReviewProps {
  file: File;
  /** Fields for one SDS section, or null if that section has no indexed fields. */
  renderSectionFields: (sectionNumber: number) => ReactNode;
  /** Called once the PDF is split, with which section numbers were found. */
  onLoaded: (info: { pageCount: number; sectionNumbers: number[] }) => void;
}

type State =
  | { phase: "loading" }
  | { phase: "ready"; blocks: RenderedBlock[]; detected: boolean }
  | { phase: "error"; message: string };

/**
 * Shows the source PDF broken into its SDS sections, each section's slice on
 * the left with the extracted fields for that section on the right, so a
 * reviewer can check value against source section by section.
 */
export default function PdfSectionReview({ file, renderSectionFields, onLoaded }: PdfSectionReviewProps) {
  const [state, setState] = useState<State>({ phase: "loading" });

  useEffect(() => {
    let cancelled = false;
    loadPdfSections(file)
      .then((result) => {
        if (cancelled) return;
        setState({ phase: "ready", blocks: result.blocks, detected: result.detected });
        const sectionNumbers = [
          ...new Set(result.blocks.map((b) => b.sectionNumber).filter((n): n is number => n !== null)),
        ];
        onLoaded({ pageCount: result.pageCount, sectionNumbers });
      })
      .catch((error: unknown) => {
        if (!cancelled) {
          setState({
            phase: "error",
            message: error instanceof Error ? error.message : "The PDF could not be displayed.",
          });
        }
      });
    return () => {
      cancelled = true;
    };
  }, [file, onLoaded]);

  if (state.phase === "loading") {
    return (
      <div className="rounded-lg border border-slate-200 bg-white p-6 text-slate-600">
        Splitting the PDF into sections...
      </div>
    );
  }

  if (state.phase === "error") {
    return (
      <div role="alert" className="rounded-lg border border-red-200 bg-red-50 p-4 text-red-800">
        Could not display the PDF: {state.message}
      </div>
    );
  }

  return (
    <div className="space-y-8">
      {!state.detected && (
        <div className="rounded-lg border border-amber-300 bg-amber-50 px-4 py-3 text-sm text-amber-900">
          Couldn't detect section headings in this PDF, so it's shown as full pages. All extracted fields are
          listed below the pages.
        </div>
      )}

      {state.blocks.map((block, index) => {
        const fields = block.sectionNumber !== null ? renderSectionFields(block.sectionNumber) : null;
        const heading =
          block.sectionNumber !== null
            ? block.title ?? `Section ${block.sectionNumber}`
            : block.title ?? "Document header";

        return (
          <article key={`${block.sectionNumber ?? "pre"}-${index}`}>
            <h2 className="mb-2 text-sm font-bold uppercase tracking-wide text-slate-500">{heading}</h2>
            <div className="grid items-start gap-6 lg:grid-cols-[minmax(0,1.05fr)_minmax(0,0.95fr)]">
              <section
                aria-label={`Source PDF: ${heading}`}
                className="overflow-hidden rounded-lg border border-slate-200 bg-white shadow-sm"
              >
                {block.images.map((src, i) => (
                  <img key={i} src={src} alt={`${heading} (part ${i + 1})`} className="block h-auto w-full bg-white" />
                ))}
              </section>
              <aside aria-label={`Extracted details: ${heading}`} className="space-y-4">
                {fields ??
                  (block.sectionNumber !== null ? (
                    <p className="rounded-lg border border-slate-200 bg-white p-4 text-sm text-slate-500">
                      No indexed fields come from this section.
                    </p>
                  ) : null)}
              </aside>
            </div>
          </article>
        );
      })}
    </div>
  );
}

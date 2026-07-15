import { useEffect, useRef, useState, type ReactNode } from "react";
import type { PDFDocumentLoadingTask, PDFDocumentProxy, RenderTask } from "pdfjs-dist";

interface PdfReviewPagesProps {
  file: File;
  renderReview: (pageNumber: number, pageCount: number) => ReactNode;
  onPageCount: (pageCount: number) => void;
}

type PdfState =
  | { phase: "loading" }
  | { phase: "ready"; document: PDFDocumentProxy }
  | { phase: "error"; message: string };

/**
 * Renders every PDF page as one full page with its matching review fields.
 * There is deliberately no thumbnail strip or separate PDF scroll area.
 */
export default function PdfReviewPages({ file, renderReview, onPageCount }: PdfReviewPagesProps) {
  const [state, setState] = useState<PdfState>({ phase: "loading" });

  useEffect(() => {
    let cancelled = false;
    let loadingTask: PDFDocumentLoadingTask | null = null;

    async function loadPdf() {
      try {
        const [pdfjs, { default: workerUrl }] = await Promise.all([
          import("pdfjs-dist"),
          import("pdfjs-dist/build/pdf.worker.min.mjs?url"),
        ]);
        pdfjs.GlobalWorkerOptions.workerSrc = workerUrl;

        const data = await file.arrayBuffer();
        loadingTask = pdfjs.getDocument({ data });
        const loadedDocument = await loadingTask.promise;
        if (cancelled) {
          await loadingTask.destroy();
          return;
        }

        setState({ phase: "ready", document: loadedDocument });
        onPageCount(loadedDocument.numPages);
      } catch (error) {
        if (!cancelled) {
          setState({
            phase: "error",
            message: error instanceof Error ? error.message : "The PDF pages could not be displayed.",
          });
        }
      }
    }

    void loadPdf();

    return () => {
      cancelled = true;
      if (loadingTask) void loadingTask.destroy();
    };
  }, [file, onPageCount]);

  if (state.phase === "loading") {
    return (
      <div className="rounded-lg border border-slate-200 bg-white p-6 text-slate-600">
        Loading the PDF pages...
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
    <div className="space-y-10">
      {Array.from({ length: state.document.numPages }, (_, index) => index + 1).map((pageNumber) => (
        <article
          key={pageNumber}
          className="grid items-start gap-6 lg:grid-cols-[minmax(0,1.05fr)_minmax(0,0.95fr)]"
        >
          <section aria-label={`Source PDF page ${pageNumber}`} className="overflow-hidden rounded-lg border border-slate-200 bg-white shadow-sm">
            <div className="border-b border-slate-200 px-3 py-2 text-sm font-semibold text-slate-600">
              PDF page {pageNumber} of {state.document.numPages}
            </div>
            <PdfPageCanvas document={state.document} pageNumber={pageNumber} />
          </section>

          <aside aria-label={`AI details from PDF page ${pageNumber}`} className="space-y-6">
            {renderReview(pageNumber, state.document.numPages)}
          </aside>
        </article>
      ))}
    </div>
  );
}

function PdfPageCanvas({ document, pageNumber }: { document: PDFDocumentProxy; pageNumber: number }) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    let renderTask: RenderTask | null = null;

    async function renderPage() {
      try {
        const page = await document.getPage(pageNumber);
        const canvas = canvasRef.current;
        if (!canvas || cancelled) return;

        // Render larger than the displayed width so small SDS text stays clear.
        const viewport = page.getViewport({ scale: 1.75 });
        const context = canvas.getContext("2d");
        if (!context) throw new Error("Your browser could not prepare the PDF page.");

        canvas.width = Math.floor(viewport.width);
        canvas.height = Math.floor(viewport.height);
        renderTask = page.render({ canvas, canvasContext: context, viewport });
        await renderTask.promise;
      } catch (error) {
        if (!cancelled && !(error instanceof Error && error.name === "RenderingCancelledException")) {
          setError(error instanceof Error ? error.message : "This page could not be displayed.");
        }
      }
    }

    void renderPage();

    return () => {
      cancelled = true;
      renderTask?.cancel();
    };
  }, [document, pageNumber]);

  if (error) {
    return <div role="alert" className="p-4 text-sm text-red-700">Could not display this page: {error}</div>;
  }

  return (
    <canvas
      ref={canvasRef}
      aria-label={`Safety Data Sheet page ${pageNumber}`}
      className="block h-auto w-full bg-white"
    />
  );
}

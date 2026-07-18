/**
 * Splits an SDS PDF into per-section image blocks for the approval screen.
 *
 * SDS fields map to sections, not pages, so the review layout should too. We
 * find each "SECTION N" heading in the PDF text layer, work out where it sits
 * on the rendered page, and crop the page into contiguous section slices (a
 * section that runs across a page break becomes several slices). Each block is
 * returned as one or more PNG data URLs so the component can render them as
 * plain <img> without holding canvases.
 *
 * The pure geometry (heading parsing + slice ranges) is exported for tests;
 * pdf.js is imported lazily inside loadPdfSections so importing this module in
 * a test does not pull in the browser-only library.
 */

export interface SectionSlice {
  page: number;
  /** px from the top of the page's rendered canvas. */
  top: number;
  bottom: number;
}

export interface DetectedHeading {
  sectionNumber: number;
  title: string;
  page: number;
  top: number;
}

export interface SectionBlock {
  /** null = the document header / preamble above SECTION 1, or a fallback page. */
  sectionNumber: number | null;
  title: string | null;
  slices: SectionSlice[];
}

/** A block with its slices rendered to PNG data URLs, ready to display. */
export interface RenderedBlock {
  sectionNumber: number | null;
  title: string | null;
  images: string[];
}

export interface PdfSections {
  pageCount: number;
  blocks: RenderedBlock[];
  /** true when at least one real "SECTION N" heading was found. */
  detected: boolean;
}

const HEADING_RE = /^section\s+(\d{1,2})\b/i;

/** If a text line is an SDS section heading, return its number (1-16), else null. */
export function parseSectionHeading(line: string): number | null {
  const match = HEADING_RE.exec(line.trim());
  if (!match?.[1]) return null;
  const n = Number.parseInt(match[1], 10);
  return n >= 1 && n <= 16 ? n : null;
}

/** Slices covering the vertical span from (startPage, startTop) to (endPage, endTop). */
export function slicesBetween(
  startPage: number,
  startTop: number,
  endPage: number,
  endTop: number,
  pageHeights: Record<number, number>,
): SectionSlice[] {
  const slices: SectionSlice[] = [];
  for (let p = startPage; p <= endPage; p++) {
    const top = p === startPage ? startTop : 0;
    const bottom = p === endPage ? endTop : (pageHeights[p] ?? 0);
    if (bottom - top > 2) slices.push({ page: p, top, bottom });
  }
  return slices;
}

/**
 * Turns detected headings into contiguous section blocks, with a leading
 * preamble block for anything above the first heading. Pure — takes page
 * heights in px, returns slice ranges.
 */
export function buildBlocks(
  headings: DetectedHeading[],
  pageCount: number,
  pageHeights: Record<number, number>,
): SectionBlock[] {
  const ordered = [...headings].sort((a, b) => a.page - b.page || a.top - b.top);
  if (ordered.length === 0) return [];

  const blocks: SectionBlock[] = [];
  const docEndTop = pageHeights[pageCount] ?? 0;

  const first = ordered[0]!;
  const preamble = slicesBetween(1, 0, first.page, first.top, pageHeights);
  if (preamble.length > 0) blocks.push({ sectionNumber: null, title: null, slices: preamble });

  for (let i = 0; i < ordered.length; i++) {
    const h = ordered[i]!;
    const next = ordered[i + 1];
    const endPage = next ? next.page : pageCount;
    const endTop = next ? next.top : docEndTop;
    blocks.push({
      sectionNumber: h.sectionNumber,
      title: h.title,
      slices: slicesBetween(h.page, h.top, endPage, endTop, pageHeights),
    });
  }
  return blocks;
}

/** The rendered-canvas scale. Larger = crisper small SDS text, bigger data URLs. */
const SCALE = 2;

/**
 * Renders the PDF, detects section headings, and crops each section into PNG
 * data URLs. Falls back to one block per full page when no headings are found.
 */
export async function loadPdfSections(file: File): Promise<PdfSections> {
  const [pdfjs, { default: workerUrl }] = await Promise.all([
    import("pdfjs-dist"),
    import("pdfjs-dist/build/pdf.worker.min.mjs?url"),
  ]);
  pdfjs.GlobalWorkerOptions.workerSrc = workerUrl;

  const data = await file.arrayBuffer();
  const loadingTask = pdfjs.getDocument({ data });
  const pdf = await loadingTask.promise;

  try {
    const pageCanvases: Record<number, HTMLCanvasElement> = {};
    const pageHeights: Record<number, number> = {};
    const headings: DetectedHeading[] = [];

    for (let pageNumber = 1; pageNumber <= pdf.numPages; pageNumber++) {
      const page = await pdf.getPage(pageNumber);
      const viewport = page.getViewport({ scale: SCALE });

      const canvas = document.createElement("canvas");
      canvas.width = Math.floor(viewport.width);
      canvas.height = Math.floor(viewport.height);
      const context = canvas.getContext("2d");
      if (!context) throw new Error("Your browser could not prepare the PDF page.");
      await page.render({ canvas, canvasContext: context, viewport }).promise;

      pageCanvases[pageNumber] = canvas;
      pageHeights[pageNumber] = canvas.height;

      // Group text runs into lines by baseline, then test each line for a heading.
      const content = await page.getTextContent();
      const lines = new Map<number, { text: string; baseline: number; height: number }>();
      for (const item of content.items) {
        if (!("str" in item) || item.str.trim() === "") continue;
        const x = item.transform[4] as number;
        const y = item.transform[5] as number;
        const key = Math.round(y / 3); // ~3pt tolerance groups a visual line
        const existing = lines.get(key);
        const height = typeof item.height === "number" ? item.height : 0;
        if (existing) {
          // Keep reading order left-to-right.
          existing.text += (x >= 0 ? " " : "") + item.str;
          existing.baseline = Math.max(existing.baseline, y);
          existing.height = Math.max(existing.height, height);
        } else {
          lines.set(key, { text: item.str, baseline: y, height });
        }
      }

      for (const line of lines.values()) {
        const sectionNumber = parseSectionHeading(line.text.replace(/\s+/g, " "));
        if (sectionNumber === null) continue;
        // Top of the glyphs in PDF space, converted to canvas px (origin top-left).
        const topPdf = line.baseline + line.height;
        const [, vy] = viewport.convertToViewportPoint(0, topPdf);
        const top = Math.max(0, Math.floor(vy) - 4);
        headings.push({ sectionNumber, title: line.text.replace(/\s+/g, " ").trim(), page: pageNumber, top });
      }
    }

    const detected = headings.length > 0;
    const blocks: SectionBlock[] = detected
      ? buildBlocks(headings, pdf.numPages, pageHeights)
      : Array.from({ length: pdf.numPages }, (_, i) => ({
          sectionNumber: null,
          title: `Page ${i + 1}`,
          slices: [{ page: i + 1, top: 0, bottom: pageHeights[i + 1] ?? 0 }],
        }));

    const rendered: RenderedBlock[] = blocks.map((block) => ({
      sectionNumber: block.sectionNumber,
      title: block.title,
      images: block.slices.map((slice) => cropToDataUrl(pageCanvases[slice.page]!, slice.top, slice.bottom)),
    }));

    return { pageCount: pdf.numPages, blocks: rendered, detected };
  } finally {
    void loadingTask.destroy();
  }
}

/** Crops a full-width horizontal band out of a page canvas into a PNG data URL. */
function cropToDataUrl(source: HTMLCanvasElement, top: number, bottom: number): string {
  const height = Math.max(1, Math.floor(bottom) - Math.floor(top));
  const slice = document.createElement("canvas");
  slice.width = source.width;
  slice.height = height;
  const context = slice.getContext("2d");
  if (!context) return source.toDataURL("image/png");
  context.drawImage(source, 0, Math.floor(top), source.width, height, 0, 0, source.width, height);
  return slice.toDataURL("image/png");
}

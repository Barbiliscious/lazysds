/**
 * Extracts plain text from a PDF in the browser.
 * Done client-side on purpose: the serverless function then only receives
 * text (small, fast, no 4.5MB body-limit problems with big scanned PDFs).
 *
 * pdfjs-dist is ~700KB, so it's imported dynamically — the home screen
 * stays light and the library only downloads when a file is chosen.
 *
 * Note: scanned/image-only PDFs produce little or no text — callers should
 * treat a near-empty result as "this PDF can't be read automatically".
 */
export async function extractPdfText(file: File): Promise<string> {
  const [pdfjs, { default: workerUrl }] = await Promise.all([
    import("pdfjs-dist"),
    import("pdfjs-dist/build/pdf.worker.min.mjs?url"),
  ]);
  pdfjs.GlobalWorkerOptions.workerSrc = workerUrl;

  const data = await file.arrayBuffer();
  const pdf = await pdfjs.getDocument({ data }).promise;

  const pages: string[] = [];
  for (let pageNum = 1; pageNum <= pdf.numPages; pageNum++) {
    const page = await pdf.getPage(pageNum);
    const content = await page.getTextContent();
    const pageText = content.items
      .map((item) => ("str" in item ? item.str : ""))
      .join(" ");
    pages.push(pageText);
  }

  return pages.join("\n\n").trim();
}

/**
 * Thin wrapper around the zxing browser scanner so pages don't deal with
 * its API (and so the library - ~300 kB - only loads when a camera is
 * actually opened, via the dynamic import).
 */

export interface RunningScanner {
  stop: () => void;
}

export async function startBarcodeScanner(
  video: HTMLVideoElement,
  onCode: (code: string) => void,
): Promise<RunningScanner> {
  const [{ BrowserMultiFormatReader }, { BarcodeFormat, DecodeHintType }] = await Promise.all([
    import("@zxing/browser"),
    import("@zxing/library"),
  ]);

  // Retail product barcodes only - skipping QR & friends cuts false reads.
  const hints = new Map();
  hints.set(DecodeHintType.POSSIBLE_FORMATS, [
    BarcodeFormat.EAN_13,
    BarcodeFormat.EAN_8,
    BarcodeFormat.UPC_A,
    BarcodeFormat.UPC_E,
  ]);

  const reader = new BrowserMultiFormatReader(hints);
  // undefined device id = let the browser pick (rear camera on phones).
  const controls = await reader.decodeFromVideoDevice(undefined, video, (result) => {
    if (result) onCode(result.getText());
  });
  return { stop: () => controls.stop() };
}

import { describe, expect, it } from "vitest";
import { isValidBarcode, normalizeBarcode } from "./barcode";

describe("normalizeBarcode", () => {
  it("strips the spaces and dashes people type between digit groups", () => {
    expect(normalizeBarcode("93 549 87")).toBe("9354987");
    expect(normalizeBarcode("9310031-000")).toBe("9310031000");
  });
});

describe("isValidBarcode", () => {
  it("accepts real EAN-13, UPC-A and EAN-8 codes", () => {
    expect(isValidBarcode("4006381333931")).toBe(true); // EAN-13
    expect(isValidBarcode("036000291452")).toBe(true); // UPC-A
    expect(isValidBarcode("96385074")).toBe(true); // EAN-8
  });

  it("rejects a code whose check digit is wrong", () => {
    expect(isValidBarcode("4006381333932")).toBe(false);
    expect(isValidBarcode("036000291453")).toBe(false);
  });

  it("rejects wrong lengths and non-digits", () => {
    expect(isValidBarcode("1234")).toBe(false);
    expect(isValidBarcode("930083000012934534")).toBe(false);
    expect(isValidBarcode("93008300001BC")).toBe(false);
    expect(isValidBarcode("")).toBe(false);
  });

  it("tolerates spaces via normalization", () => {
    expect(isValidBarcode("4 006381 333931")).toBe(true);
  });
});

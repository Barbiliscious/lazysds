import { describe, expect, it } from "vitest";
import { buildDeterministicId, sdsFilename } from "./sds-id";

describe("buildDeterministicId", () => {
  it("joins SUPPLIER-PRODUCT-ISSUEDATE, sanitised and uppercased", () => {
    expect(buildDeterministicId("Recochem Inc", "Methylated Spirits", "2025-01-06")).toBe(
      "RECOCHEM-INC-METHYLATED-SPIRITS-2025-01-06",
    );
  });

  it("strips accents rather than dropping the letter entirely", () => {
    expect(buildDeterministicId("Café Products", "Naïve Chemical", "2025-01-06")).toBe(
      "CAFE-PRODUCTS-NAIVE-CHEMICAL-2025-01-06",
    );
  });

  it("replaces punctuation and collapses repeated separators to one hyphen", () => {
    expect(buildDeterministicId("A.C.M.E,  Pty Ltd!!", "Bleach (5L)", "2025-01-06")).toBe(
      "A-C-M-E-PTY-LTD-BLEACH-5L-2025-01-06",
    );
  });

  it("fills placeholders for missing parts", () => {
    expect(buildDeterministicId(null, "X", null)).toBe("UNKNOWN-X-NODATE");
  });

  it("caps the total length at 120 characters and never ends in a hyphen", () => {
    const longProduct = "Sodium ".repeat(30);
    const id = buildDeterministicId("Acme", longProduct, "2025-01-06");
    expect(id.length).toBeLessThanOrEqual(120);
    expect(id.endsWith("-")).toBe(false);
  });
});

describe("sdsFilename", () => {
  it("is the record id plus .pdf", () => {
    expect(sdsFilename("RECOCHEM-INC-METHYLATED-SPIRITS-2025-01-06")).toBe(
      "RECOCHEM-INC-METHYLATED-SPIRITS-2025-01-06.pdf",
    );
  });
});

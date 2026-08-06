import { describe, expect, it } from "vitest";
import { buildFilenameStem, sdsFilename } from "./sds-id";

describe("buildFilenameStem", () => {
  it("cleans a product name to the permitted character set", () => {
    expect(buildFilenameStem("Dulux Aquanamel Gloss Enamel")).toBe("Dulux-Aquanamel-Gloss-Enamel");
  });

  it("strips accents rather than dropping the letter entirely", () => {
    expect(buildFilenameStem("Café Naïve Cleaner")).toBe("Cafe-Naive-Cleaner");
  });

  it("replaces punctuation and collapses repeated separators to one hyphen", () => {
    expect(buildFilenameStem("Bleach (5L) & Degreaser!!")).toBe("Bleach-5L-Degreaser");
  });

  it("caps at 40 characters and never ends in a hyphen", () => {
    const longName = "Sodium ".repeat(30);
    const stem = buildFilenameStem(longName);
    expect(stem.length).toBeLessThanOrEqual(40);
    expect(stem.endsWith("-")).toBe(false);
  });

  it("falls back to a placeholder for an empty or null product name", () => {
    expect(buildFilenameStem(null)).toBe("SDS");
    expect(buildFilenameStem("   ")).toBe("SDS");
  });
});

describe("sdsFilename", () => {
  it("joins the stem to the number parsed out of the record id", () => {
    expect(sdsFilename("Aquanamel", "SDS-042")).toBe("Aquanamel-042");
  });

  it("preserves the zero-padded width from the record id", () => {
    expect(sdsFilename("Aquanamel", "SDS-1024")).toBe("Aquanamel-1024");
  });

  it("never appends a .pdf extension - that's the caller's job", () => {
    expect(sdsFilename("Aquanamel", "SDS-042")).not.toContain(".pdf");
  });
});

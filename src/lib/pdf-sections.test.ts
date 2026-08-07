import { describe, expect, it } from "vitest";
import { buildBlocks, parseSectionHeading, slicesBetween, type DetectedHeading } from "./pdf-sections";

describe("parseSectionHeading", () => {
  it("recognises SECTION N headings", () => {
    expect(parseSectionHeading("SECTION 1: Identification of the substance")).toBe(1);
    expect(parseSectionHeading("  Section 14 - Transport information")).toBe(14);
    expect(parseSectionHeading("SECTION 8 Exposure controls")).toBe(8);
  });
  it("recognises 'N. Title' headings when the title is a GHS section title", () => {
    expect(parseSectionHeading("1. Identification of the substance")).toBe(1);
    expect(parseSectionHeading("14) Transport information")).toBe(14);
    expect(parseSectionHeading("4 First aid measures")).toBe(4);
    expect(parseSectionHeading("5 Firefighting measures")).toBe(5);
  });
  it("recognises 'N - Title' / 'N – Title' headings from older pre-GHS templates", () => {
    expect(parseSectionHeading("1 - Chemical Product and Company Identification")).toBe(1);
    expect(parseSectionHeading("2 – Hazards Identification")).toBe(2);
    expect(parseSectionHeading("14 – Transportation Information")).toBe(14);
  });
  it("recognises 'Material and Supply Company Identification', another common section 1 title", () => {
    expect(parseSectionHeading("1. MATERIAL AND SUPPLY COMPANY IDENTIFICATION")).toBe(1);
  });
  it("ignores non-headings and out-of-range numbers", () => {
    expect(parseSectionHeading("1.2 Product identifier")).toBeNull();
    expect(parseSectionHeading("2.2 Label elements")).toBeNull();
    expect(parseSectionHeading("5 litres of water")).toBeNull(); // numbered, but not a GHS title
    expect(parseSectionHeading("Store below 30 C")).toBeNull();
    expect(parseSectionHeading("SECTION 20 Nope")).toBeNull();
  });
});

describe("slicesBetween", () => {
  const heights = { 1: 1000, 2: 1000 };
  it("returns a single slice within one page", () => {
    expect(slicesBetween(1, 100, 1, 400, heights)).toEqual([{ page: 1, top: 100, bottom: 400 }]);
  });
  it("spans a page break into multiple slices", () => {
    expect(slicesBetween(1, 800, 2, 200, heights)).toEqual([
      { page: 1, top: 800, bottom: 1000 },
      { page: 2, top: 0, bottom: 200 },
    ]);
  });
  it("drops empty slices", () => {
    expect(slicesBetween(1, 1000, 2, 0, heights)).toEqual([]);
  });
});

describe("buildBlocks", () => {
  const heights = { 1: 1000, 2: 1000 };

  it("adds a preamble block above the first heading, then one block per section", () => {
    const headings: DetectedHeading[] = [
      { sectionNumber: 1, title: "SECTION 1", page: 1, top: 200 },
      { sectionNumber: 2, title: "SECTION 2", page: 1, top: 600 },
    ];
    const blocks = buildBlocks(headings, 2, heights);
    expect(blocks.map((b) => b.sectionNumber)).toEqual([null, 1, 2]);
    // preamble: top of page 1 down to section 1
    expect(blocks[0]!.slices).toEqual([{ page: 1, top: 0, bottom: 200 }]);
    // section 1: from its heading to section 2
    expect(blocks[1]!.slices).toEqual([{ page: 1, top: 200, bottom: 600 }]);
    // section 2 (last): to the end of the document
    expect(blocks[2]!.slices).toEqual([
      { page: 1, top: 600, bottom: 1000 },
      { page: 2, top: 0, bottom: 1000 },
    ]);
  });

  it("returns nothing when there are no headings", () => {
    expect(buildBlocks([], 2, heights)).toEqual([]);
  });
});

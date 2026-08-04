import { describe, expect, it } from "vitest";
import type { SDSField } from "@shared/types";
import { FIELD_SPECS } from "@shared/sds-fields";
import { CANONICAL_SECTION, firstSdsSection, sectionForField } from "./sds-sections";

const stated = (location: string | null): SDSField => ({ value: "x", status: "STATED", excerpt: "x", location });
const notStated: SDSField = { value: null, status: "NOT_STATED", excerpt: null, location: null };

describe("firstSdsSection", () => {
  it("reads the section number from a location string", () => {
    expect(firstSdsSection("Section 8, SDS page 2")).toBe(8);
    expect(firstSdsSection("Section 14, SDS pages 4 and 5")).toBe(14);
  });
  it("returns null for no/invalid section", () => {
    expect(firstSdsSection(null)).toBeNull();
    expect(firstSdsSection("SDS page 2")).toBeNull();
    expect(firstSdsSection("Section 99")).toBeNull(); // out of 1-16 range
  });
});

describe("sectionForField", () => {
  it("prefers the cited section", () => {
    expect(sectionForField("ppe", stated("Section 8, SDS page 2"))).toBe(8);
  });
  it("falls back to the canonical section when there is no location", () => {
    expect(sectionForField("ppe", notStated)).toBe(CANONICAL_SECTION.ppe);
    expect(sectionForField("dangerous_goods", notStated)).toBe(2);
  });
  it("always uses the canonical section for dangerous_goods, ignoring any cited location", () => {
    // Dangerous Goods is commonly stated in Section 14 (Transport), but
    // Transport isn't shown as its own review section - the field always
    // surfaces with the rest of the hazard-at-a-glance facts in Section 2.
    expect(sectionForField("dangerous_goods", stated("Section 14, SDS page 6"))).toBe(2);
  });
});

describe("CANONICAL_SECTION", () => {
  it("covers every field key exactly once", () => {
    const specKeys = FIELD_SPECS.map((s) => s.key).sort();
    expect(Object.keys(CANONICAL_SECTION).sort()).toEqual(specKeys);
  });
});

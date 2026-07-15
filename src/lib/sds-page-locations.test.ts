import { describe, expect, it } from "vitest";
import { firstSdsPage } from "./sds-page-locations";

describe("firstSdsPage", () => {
  it("reads a single cited SDS page", () => {
    expect(firstSdsPage("Section 2, SDS page 1")).toBe(1);
  });

  it("uses the first page when several pages are cited", () => {
    expect(firstSdsPage("Section 8, SDS pages 4 and 5")).toBe(4);
  });

  it("accepts the shorter page wording", () => {
    expect(firstSdsPage("Section 14, page 8")).toBe(8);
  });

  it("returns null when no usable page is cited", () => {
    expect(firstSdsPage("Section 2")).toBeNull();
    expect(firstSdsPage(null)).toBeNull();
  });
});

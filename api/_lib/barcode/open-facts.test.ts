import { describe, expect, it } from "vitest";
import { parseOpenFactsResponse } from "./open-facts.js";

describe("parseOpenFactsResponse", () => {
  it("extracts the name and the first of the comma-separated brands", () => {
    expect(
      parseOpenFactsResponse({
        status: 1,
        product: { product_name: "Glen 20 Original Scent", brands: "Glen 20,Reckitt" },
      }),
    ).toEqual({ name: "Glen 20 Original Scent", brand: "Glen 20" });
  });

  it("returns null when the database doesn't know the barcode", () => {
    expect(parseOpenFactsResponse({ status: 0, status_verbose: "product not found" })).toBeNull();
  });

  it("returns null when the entry exists but has no usable name", () => {
    expect(parseOpenFactsResponse({ status: 1, product: { product_name: "", brands: "X" } })).toBeNull();
    expect(parseOpenFactsResponse({ status: 1, product: {} })).toBeNull();
  });

  it("survives garbage without throwing", () => {
    expect(parseOpenFactsResponse(null)).toBeNull();
    expect(parseOpenFactsResponse("nope")).toBeNull();
    expect(parseOpenFactsResponse({ status: 1, product: { product_name: 42 } })).toBeNull();
  });

  it("maps a missing brand to null", () => {
    expect(parseOpenFactsResponse({ status: 1, product: { product_name: "Thing" } })).toEqual({
      name: "Thing",
      brand: null,
    });
  });
});

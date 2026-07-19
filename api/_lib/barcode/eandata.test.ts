import { describe, expect, it } from "vitest";
import { parseEandataResponse } from "./eandata.js";

describe("parseEandataResponse", () => {
  it("reads the product name and brand from a v3 response", () => {
    const json = {
      status: { code: "200" },
      product: { attributes: { product: "Glen 20 Disinfectant Spray", brand: "Glen 20" } },
    };
    expect(parseEandataResponse(json)).toEqual({ name: "Glen 20 Disinfectant Spray", brand: "Glen 20" });
  });

  it("falls back to the company name when brand is blank", () => {
    const json = {
      status: { code: "200" },
      product: { attributes: { product: "Jaws", brand: "" } },
      company: { name: "Universal Pictures" },
    };
    expect(parseEandataResponse(json)).toEqual({ name: "Jaws", brand: "Universal Pictures" });
  });

  it("treats masked ***free-tier*** values as no data", () => {
    const json = {
      status: { code: "200" },
      product: { attributes: { product: "Some Product", brand: "***masked***" } },
      company: { name: "***masked***" },
    };
    expect(parseEandataResponse(json)).toEqual({ name: "Some Product", brand: null });
  });

  it("returns null when there is no product name", () => {
    expect(parseEandataResponse({ status: { code: "200" }, product: { attributes: { product: "" } } })).toBeNull();
  });

  it("returns null for a non-200 status", () => {
    expect(parseEandataResponse({ status: { code: "404" }, product: { attributes: { product: "X" } } })).toBeNull();
  });

  it("returns null for a malformed body", () => {
    expect(parseEandataResponse(null)).toBeNull();
    expect(parseEandataResponse("nope")).toBeNull();
  });
});

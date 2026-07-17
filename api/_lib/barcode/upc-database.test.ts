import { afterEach, describe, expect, it, vi } from "vitest";
import {
  lookupUpcDatabaseBarcode,
  parseUpcDatabaseResponse,
} from "./upc-database.js";

afterEach(() => {
  vi.unstubAllGlobals();
});

describe("parseUpcDatabaseResponse", () => {
  it("extracts a product name and brand from a successful response", () => {
    expect(
      parseUpcDatabaseResponse({
        success: "true",
        title: "WD-40 Multi-Use Product",
        brand: "WD-40",
      }),
    ).toEqual({ name: "WD-40 Multi-Use Product", brand: "WD-40" });
  });

  it("uses the documented alternative fields when the main fields are blank", () => {
    expect(
      parseUpcDatabaseResponse({
        success: true,
        title: " ",
        alias: "Surface Cleaner",
        manufacturer: "Example Manufacturer",
      }),
    ).toEqual({ name: "Surface Cleaner", brand: "Example Manufacturer" });
  });

  it("returns null for misses, errors and unusable records", () => {
    expect(parseUpcDatabaseResponse({ success: false, error: { code: 404 } })).toBeNull();
    expect(parseUpcDatabaseResponse({ success: "true", title: "" })).toBeNull();
    expect(parseUpcDatabaseResponse(null)).toBeNull();
  });

  it("sends the token in the server-side Bearer header", async () => {
    const requests: Array<{ input: RequestInfo | URL; init?: RequestInit }> = [];
    vi.stubGlobal("fetch", async (input: RequestInfo | URL, init?: RequestInit) => {
      requests.push({ input, init });
      return new Response(
        JSON.stringify({ success: true, title: "Dishwashing Liquid", brand: "Example" }),
        { status: 200, headers: { "Content-Type": "application/json" } },
      );
    });

    await expect(lookupUpcDatabaseBarcode("4006381333931", "test-token")).resolves.toEqual({
      name: "Dishwashing Liquid",
      brand: "Example",
    });
    expect(String(requests[0]?.input)).toBe("https://api.upcdatabase.org/product/4006381333931");
    expect(new Headers(requests[0]?.init?.headers).get("Authorization")).toBe("Bearer test-token");
  });
});

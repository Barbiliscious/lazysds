import { describe, expect, it } from "vitest";
import { firstBarcodeMatch, firstLabelledMatch, type BarcodeLookup } from "./lookup.js";

describe("firstBarcodeMatch", () => {
  it("stops after the first database returns a product", async () => {
    const calls: string[] = [];
    const first: BarcodeLookup = async (code) => {
      calls.push(`first:${code}`);
      return { name: "Laundry Liquid", brand: "Example" };
    };
    const second: BarcodeLookup = async (code) => {
      calls.push(`second:${code}`);
      return { name: "Should not run", brand: null };
    };

    await expect(firstBarcodeMatch("4006381333931", [first, second])).resolves.toEqual({
      name: "Laundry Liquid",
      brand: "Example",
    });
    expect(calls).toEqual(["first:4006381333931"]);
  });

  it("falls back after a miss or provider failure", async () => {
    const miss: BarcodeLookup = async () => null;
    const failure: BarcodeLookup = async () => {
      throw new Error("provider unavailable");
    };
    const fallback: BarcodeLookup = async () => ({ name: "Fly Spray", brand: null });

    await expect(firstBarcodeMatch("4006381333931", [miss, failure, fallback])).resolves.toEqual({
      name: "Fly Spray",
      brand: null,
    });
  });

  it("returns null when every database misses", async () => {
    const miss: BarcodeLookup = async () => null;
    await expect(firstBarcodeMatch("4006381333931", [miss, miss])).resolves.toBeNull();
  });
});

describe("firstLabelledMatch", () => {
  it("tags the result with the id of whichever provider actually hit", async () => {
    const miss: BarcodeLookup = async () => null;
    const hit: BarcodeLookup = async () => ({ name: "Fly Spray", brand: "Mortein" });

    await expect(
      firstLabelledMatch("4006381333931", [
        { id: "open_facts", run: miss },
        { id: "eandata", run: hit },
      ]),
    ).resolves.toEqual({ product: { name: "Fly Spray", brand: "Mortein" }, providerId: "eandata" });
  });

  it("skips a provider that throws and returns null when every provider misses", async () => {
    const failure: BarcodeLookup = async () => {
      throw new Error("provider unavailable");
    };
    const miss: BarcodeLookup = async () => null;

    await expect(
      firstLabelledMatch("4006381333931", [
        { id: "upc_database", run: failure },
        { id: "open_facts", run: miss },
      ]),
    ).resolves.toBeNull();
  });
});

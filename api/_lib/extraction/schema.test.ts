import { describe, expect, it } from "vitest";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { extractedSDSSchema } from "./schema.js";

function loadFixture(name: string): unknown {
  return JSON.parse(readFileSync(join(__dirname, "../../../tests/fixtures", name), "utf-8"));
}

describe("extractedSDSSchema", () => {
  it("accepts a fully-populated extraction", () => {
    const result = extractedSDSSchema.safeParse(loadFixture("extraction-valid.json"));
    expect(result.success).toBe(true);
    if (result.success) {
      expect(result.data.un_number).toBe("1950");
      expect(result.data.hazard_statements).toHaveLength(2);
    }
  });

  it("accepts an extraction where nothing was stated (all nulls, empty statements)", () => {
    const result = extractedSDSSchema.safeParse(loadFixture("extraction-all-nulls.json"));
    expect(result.success).toBe(true);
  });

  it("rejects wrong types and out-of-vocabulary confidence values", () => {
    const result = extractedSDSSchema.safeParse(loadFixture("extraction-invalid-guessy.json"));
    expect(result.success).toBe(false);
    if (!result.success) {
      const badPaths = result.error.issues.map((i) => i.path.join("."));
      expect(badPaths).toContain("is_hazardous"); // "yes" is not a boolean
      expect(badPaths).toContain("dangerous_goods_class"); // number, not string
      expect(badPaths).toContain("hazard_statements"); // string, not array
      expect(badPaths).toContain("confidence.manufacturer"); // "medium" not allowed
    }
  });

  it("rejects a payload with missing fields", () => {
    const result = extractedSDSSchema.safeParse({ product_name: "X" });
    expect(result.success).toBe(false);
  });
});

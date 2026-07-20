import { describe, expect, it } from "vitest";
import { extractJsonPayload } from "./web-search.js";

// Representative of real Claude responses observed live: it narrates its
// search, then answers - sometimes fenced, sometimes not, and a "no match"
// answer is prefixed with an explanation rather than being bare JSON.

describe("extractJsonPayload", () => {
  it("extracts a JSON object even when wrapped in prose and a markdown fence", () => {
    const text = [
      "I'll search for this ISBN barcode to identify the product.",
      "Based on the search results, I found clear information about this barcode.",
      "The ISBN corresponds to a well-known book.",
      "```json",
      '{"name":"Effective Java","brand":"Addison-Wesley","manufacturerProductCode":null,"size":null,"variant":"3rd Edition","sourceUrl":"https://isbnsearch.org/isbn/9780134685991","confidence":"high"}',
      "```",
    ].join("\n\n");
    expect(extractJsonPayload(text)).toEqual({
      name: "Effective Java",
      brand: "Addison-Wesley",
      manufacturerProductCode: null,
      size: null,
      variant: "3rd Edition",
      sourceUrl: "https://isbnsearch.org/isbn/9780134685991",
      confidence: "high",
    });
  });

  it("extracts an unfenced trailing JSON object", () => {
    const text = 'Found it after a second search.\n\n{"name":"Widget","brand":null,"manufacturerProductCode":null,"size":null,"variant":null,"sourceUrl":null,"confidence":"medium"}';
    const result = extractJsonPayload(text);
    expect(result).toMatchObject({ name: "Widget" });
  });

  it("treats a trailing bare null preceded by an explanation as an explicit no-match", () => {
    const text =
      "Based on my search attempts, I was unable to find any product information for this barcode in the search results. The searches returned general barcode lookup service information and unrelated documents, but no specific product details matching this barcode.\n\nnull";
    expect(extractJsonPayload(text)).toBeNull();
  });

  it("returns undefined (retry signal) when nothing usable is present", () => {
    expect(extractJsonPayload("I searched but couldn't reach a conclusion.")).toBeUndefined();
  });

  it("takes the last object when narration happens to mention an earlier brace-looking fragment", () => {
    const text = 'Some notes {not json}\n\nFinal answer: {"name":"Real Product","brand":null,"manufacturerProductCode":null,"size":null,"variant":null,"sourceUrl":null,"confidence":"low"}';
    const result = extractJsonPayload(text) as { name: string };
    expect(result.name).toBe("Real Product");
  });
});

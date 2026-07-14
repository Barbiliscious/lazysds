import { describe, expect, it } from "vitest";
import { buildSdsSearchUrl, checkSdsUrl } from "./sds-url";

describe("checkSdsUrl", () => {
  it("accepts a trusted domain and its subdomains", () => {
    expect(checkSdsUrl("https://sigmaaldrich.com/sds/foo.pdf").ok).toBe(true);
    expect(checkSdsUrl("https://www.sigmaaldrich.com/sds/foo.pdf").ok).toBe(true);
    expect(checkSdsUrl("https://au.docs.sigmaaldrich.com/foo.pdf").ok).toBe(true);
  });

  it("rejects lookalike domains that merely end with a trusted name", () => {
    expect(checkSdsUrl("https://evilsigmaaldrich.com/foo.pdf").ok).toBe(false);
    expect(checkSdsUrl("https://sigmaaldrich.com.attacker.net/foo.pdf").ok).toBe(false);
  });

  it("rejects non-https and non-URLs with readable reasons", () => {
    const http = checkSdsUrl("http://sigmaaldrich.com/foo.pdf");
    expect(http).toEqual({ ok: false, reason: expect.stringContaining("https") as string });
    const garbage = checkSdsUrl("not a link at all");
    expect(garbage.ok).toBe(false);
  });

  it("rejects untrusted hosts and tells the user what to do instead", () => {
    const result = checkSdsUrl("https://random-blog.example/sds.pdf");
    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.reason).toContain("random-blog.example");
      expect(result.reason).toContain("upload");
    }
  });

  it("is case-insensitive about the hostname", () => {
    expect(checkSdsUrl("https://WWW.SIGMAALDRICH.COM/foo.pdf").ok).toBe(true);
  });
});

describe("buildSdsSearchUrl", () => {
  it("quotes the product name and restricts results to PDFs", () => {
    const url = new URL(buildSdsSearchUrl("Mortein Outdoor"));
    expect(url.hostname).toBe("www.google.com");
    expect(url.searchParams.get("q")).toBe('"Mortein Outdoor" safety data sheet filetype:pdf');
  });

  it("trims whitespace from the product name", () => {
    const url = new URL(buildSdsSearchUrl("  Glen 20  "));
    expect(url.searchParams.get("q")).toContain('"Glen 20"');
  });
});

import { describe, expect, it } from "vitest";
import { buildSdsSearchUrl, checkSdsUrl, isBlockedIp } from "./sds-url";

describe("checkSdsUrl", () => {
  it("accepts any normal public https URL (no brand whitelist)", () => {
    expect(checkSdsUrl("https://www.dymark.com.au/sds/foo.pdf").ok).toBe(true);
    expect(checkSdsUrl("https://sigmaaldrich.com/sds/foo.pdf").ok).toBe(true);
    expect(checkSdsUrl("https://some-random-manufacturer.example/sds.pdf").ok).toBe(true);
  });

  it("rejects non-https with a readable reason", () => {
    const http = checkSdsUrl("http://dymark.com.au/foo.pdf");
    expect(http).toEqual({ ok: false, reason: expect.stringContaining("https") as string });
  });

  it("rejects things that aren't URLs", () => {
    expect(checkSdsUrl("not a link at all").ok).toBe(false);
  });

  it("blocks private / local hosts (SSRF)", () => {
    expect(checkSdsUrl("https://localhost/x.pdf").ok).toBe(false);
    expect(checkSdsUrl("https://127.0.0.1/x.pdf").ok).toBe(false);
    expect(checkSdsUrl("https://169.254.169.254/latest/meta-data/").ok).toBe(false); // cloud metadata
    expect(checkSdsUrl("https://10.0.0.5/x.pdf").ok).toBe(false);
    expect(checkSdsUrl("https://192.168.1.1/x.pdf").ok).toBe(false);
    expect(checkSdsUrl("https://[::1]/x.pdf").ok).toBe(false);
    expect(checkSdsUrl("https://printer.local/x.pdf").ok).toBe(false);
  });

  it("rejects embedded credentials and non-standard ports", () => {
    expect(checkSdsUrl("https://user:pass@dymark.com.au/x.pdf").ok).toBe(false);
    expect(checkSdsUrl("https://dymark.com.au:8080/x.pdf").ok).toBe(false);
  });

  it("is case-insensitive about the hostname", () => {
    expect(checkSdsUrl("https://WWW.DYMARK.COM.AU/foo.pdf").ok).toBe(true);
  });
});

describe("isBlockedIp", () => {
  it("blocks private, loopback, link-local and reserved addresses", () => {
    for (const ip of ["0.0.0.0", "10.1.2.3", "127.0.0.1", "169.254.169.254", "172.16.0.1", "172.31.255.255", "192.168.0.1", "100.64.0.1", "224.0.0.1", "::1", "fe80::1", "fc00::1", "fd12::1", "::ffff:10.0.0.1"]) {
      expect(isBlockedIp(ip), ip).toBe(true);
    }
  });

  it("allows normal public addresses (incl. the edges of the private ranges)", () => {
    for (const ip of ["8.8.8.8", "1.1.1.1", "142.250.70.14", "172.15.0.1", "172.32.0.1", "2404:6800:4006::1"]) {
      expect(isBlockedIp(ip), ip).toBe(false);
    }
  });
});

describe("buildSdsSearchUrl", () => {
  it("quotes the product name and restricts results to PDFs", () => {
    const url = new URL(buildSdsSearchUrl("Mortein Outdoor"));
    expect(url.hostname).toBe("www.google.com");
    expect(url.searchParams.get("q")).toBe('"Mortein Outdoor" safety data sheet filetype:pdf');
  });
});

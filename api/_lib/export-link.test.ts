import { describe, expect, it } from "vitest";
import { isAllowedExportUrl, isValidEmail } from "./export-link";

describe("isValidEmail", () => {
  it("accepts plausible addresses", () => {
    expect(isValidEmail("aaron@lazysds.com")).toBe(true);
    expect(isValidEmail("  a.b+tag@sub.example.co  ")).toBe(true);
  });

  it("rejects obviously malformed input", () => {
    expect(isValidEmail("not-an-email")).toBe(false);
    expect(isValidEmail("missing-domain@")).toBe(false);
    expect(isValidEmail("@missing-local.com")).toBe(false);
    expect(isValidEmail("no dots here@nodot")).toBe(false);
    expect(isValidEmail("")).toBe(false);
  });
});

const SUPABASE_URL = "https://ijqwxgjlnvatfgduohwo.supabase.co";
const GOOD_URL = `${SUPABASE_URL}/storage/v1/object/public/sds-pdfs/exports/abc-123.zip`;

describe("isAllowedExportUrl", () => {
  it("allows a link into this project's own export path", () => {
    expect(isAllowedExportUrl(GOOD_URL, SUPABASE_URL)).toBe(true);
  });

  it("rejects a different bucket or path", () => {
    expect(isAllowedExportUrl(`${SUPABASE_URL}/storage/v1/object/public/sds-pdfs/some-record.pdf`, SUPABASE_URL)).toBe(false);
    expect(isAllowedExportUrl(`${SUPABASE_URL}/storage/v1/object/public/other-bucket/exports/x.zip`, SUPABASE_URL)).toBe(false);
  });

  it("rejects a different origin, even one that contains the expected path as a substring", () => {
    expect(isAllowedExportUrl(`https://evil.example${SUPABASE_URL.replace("https://", "/")}/storage/v1/object/public/sds-pdfs/exports/x.zip`, SUPABASE_URL)).toBe(false);
    expect(isAllowedExportUrl("https://evil.example/storage/v1/object/public/sds-pdfs/exports/x.zip", SUPABASE_URL)).toBe(false);
  });

  it("rejects a malformed URL", () => {
    expect(isAllowedExportUrl("not a url", SUPABASE_URL)).toBe(false);
  });

  it("rejects everything when the project's own Supabase URL isn't configured", () => {
    expect(isAllowedExportUrl(GOOD_URL, undefined)).toBe(false);
  });
});

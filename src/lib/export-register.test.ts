import { describe, expect, it } from "vitest";
import type { SDSRecord } from "@shared/types";
import { formatCell, registerToCsv } from "./export-register";

function makeRecord(overrides: Partial<SDSRecord> = {}): SDSRecord {
  return {
    id: "00000000-0000-0000-0000-000000000001",
    product_name: "Mortein Outdoor",
    manufacturer: "Reckitt",
    supplier: null,
    is_hazardous: true,
    dangerous_goods_class: "2.1",
    un_number: "1950",
    issue_date: "12 March 2024",
    hazard_statements: ["H222 Extremely flammable aerosol.", "H229 Pressurised container."],
    confidence: { product_name: "high", manufacturer: "high", is_hazardous: "high" },
    pdf_url: "https://example.com/sds.pdf",
    source: "upload",
    reviewed_by: "AM",
    created_at: "2026-07-14T02:30:00.000Z",
    ...overrides,
  };
}

describe("formatCell", () => {
  it("renders booleans as Yes/No and null as empty", () => {
    expect(formatCell(makeRecord(), "is_hazardous")).toBe("Yes");
    expect(formatCell(makeRecord({ is_hazardous: false }), "is_hazardous")).toBe("No");
    expect(formatCell(makeRecord({ is_hazardous: null }), "is_hazardous")).toBe("");
    expect(formatCell(makeRecord({ supplier: null }), "supplier")).toBe("");
  });

  it("joins hazard statements with semicolons", () => {
    expect(formatCell(makeRecord(), "hazard_statements")).toBe(
      "H222 Extremely flammable aerosol.; H229 Pressurised container.",
    );
  });

  it("keeps only the date part of created_at", () => {
    expect(formatCell(makeRecord(), "created_at")).toBe("2026-07-14");
  });
});

describe("registerToCsv", () => {
  it("starts with the configured headers", () => {
    const firstLine = registerToCsv([]).split("\r\n")[0];
    expect(firstLine).toContain("Product Name");
    expect(firstLine).toContain("Reviewed By");
  });

  it("quotes values containing commas, quotes or newlines", () => {
    const csv = registerToCsv([
      makeRecord({ product_name: 'Cleaner, "Heavy Duty"', manufacturer: "Line1\nLine2" }),
    ]);
    expect(csv).toContain('"Cleaner, ""Heavy Duty"""');
    expect(csv).toContain('"Line1\nLine2"');
  });

  it("produces one CRLF-terminated line per record plus the header", () => {
    const csv = registerToCsv([makeRecord(), makeRecord()]);
    expect(csv.endsWith("\r\n")).toBe(true);
    expect(csv.trimEnd().split("\r\n")).toHaveLength(3);
  });
});

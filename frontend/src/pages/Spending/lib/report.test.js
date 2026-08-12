import { describe, it, expect, vi, beforeEach } from "vitest";

const { mockDoc, jsPDFMock, autoTableMock } = vi.hoisted(() => {
  const mockDoc = {
    setFontSize: vi.fn(),
    text: vi.fn(),
    splitTextToSize: vi.fn((text) => [text]),
    save: vi.fn(),
  };
  return {
    mockDoc,
    jsPDFMock: vi.fn(() => mockDoc),
    autoTableMock: vi.fn(),
  };
});
vi.mock("jspdf", () => ({ jsPDF: jsPDFMock }));
vi.mock("jspdf-autotable", () => ({ default: autoTableMock }));

import { buildReportSummary, generateReportPdf, downloadMonthlyReport } from "./report";

describe("buildReportSummary", () => {
  it("shapes rows, finds the top spending category, and computes savings rate", () => {
    const report = {
      total_income: 3000,
      total_expenses: -460.2,
      net: 2539.8,
      breakdown: { Salary: 3000, Food: -340.2, Transport: -120 },
    };

    const summary = buildReportSummary(report, "2026-08");

    expect(summary.month).toBe("2026-08");
    expect(summary.monthLabel).toBe("August 2026");
    expect(summary.rows).toEqual([
      { category: "Salary", income: 3000, expenses: 0 },
      { category: "Food", income: 0, expenses: 340.2 },
      { category: "Transport", income: 0, expenses: 120 },
    ]);
    expect(summary.totalIncome).toBe(3000);
    expect(summary.totalExpenses).toBe(-460.2);
    expect(summary.net).toBe(2539.8);
    expect(summary.topCategory).toBe("Food");
    expect(summary.savingsRate).toBe("84.7");
    expect(summary.summaryText).toBe(
      "In August 2026, you earned $3,000.00 and spent $460.20. Largest spending category: Food. Savings rate: 84.7%."
    );
  });

  it("omits the savings rate clause when there is no income", () => {
    const report = { total_income: 0, total_expenses: -50, net: -50, breakdown: { Food: -50 } };

    const summary = buildReportSummary(report, "2026-08");

    expect(summary.savingsRate).toBeNull();
    expect(summary.summaryText).toBe(
      "In August 2026, you earned $0.00 and spent $50.00. Largest spending category: Food."
    );
  });

  it("omits the top-category clause and returns no rows when the breakdown is empty", () => {
    const report = { total_income: 0, total_expenses: 0, net: 0, breakdown: {} };

    const summary = buildReportSummary(report, "2026-08");

    expect(summary.rows).toEqual([]);
    expect(summary.topCategory).toBeNull();
    expect(summary.summaryText).toBe("In August 2026, you earned $0.00 and spent $0.00.");
  });
});

describe("generateReportPdf", () => {
  beforeEach(() => {
    jsPDFMock.mockClear();
    autoTableMock.mockClear();
    mockDoc.text.mockClear();
  });

  it("writes the headline stats, summary text, and a category table", () => {
    const summary = buildReportSummary(
      { total_income: 3000, total_expenses: -460.2, net: 2539.8, breakdown: { Salary: 3000, Food: -460.2 } },
      "2026-08"
    );

    const doc = generateReportPdf(summary);

    expect(doc).toBe(mockDoc);
    expect(jsPDFMock).toHaveBeenCalledTimes(1);
    const allText = mockDoc.text.mock.calls.map((call) => call[0]).flat().join(" | ");
    expect(allText).toContain("August 2026");
    expect(allText).toContain(summary.summaryText);

    expect(autoTableMock).toHaveBeenCalledTimes(1);
    const [tableDoc, options] = autoTableMock.mock.calls[0];
    expect(tableDoc).toBe(mockDoc);
    expect(options.body).toEqual([
      ["Salary", "$3,000.00", "$0.00"],
      ["Food", "$0.00", "$460.20"],
    ]);
  });
});

describe("downloadMonthlyReport", () => {
  it("builds the summary, generates the doc, and saves it with a month-stamped filename", () => {
    mockDoc.save.mockClear();
    const report = { total_income: 100, total_expenses: 0, net: 100, breakdown: { Salary: 100 } };

    downloadMonthlyReport(report, "2026-08");

    expect(mockDoc.save).toHaveBeenCalledWith("spending-report-2026-08.pdf");
  });
});

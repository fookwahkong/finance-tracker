import { jsPDF } from "jspdf";
import autoTable from "jspdf-autotable";
import { money, monthLabel } from "../../../lib/format";

// Shapes a /api/reports/monthly response into the data the PDF report
// needs. Ports Report.jsx's chartData/topCategory/savingsRate/summary
// calculations verbatim.
export function buildReportSummary(report, month) {
  const rows = Object.entries(report.breakdown).map(([category, value]) => ({
    category,
    income: value > 0 ? value : 0,
    expenses: value < 0 ? Math.abs(value) : 0,
  }));

  const topCategory = rows.length > 0
    ? rows.reduce((a, b) => (b.expenses > a.expenses ? b : a)).category
    : null;

  const savingsRate = report.total_income > 0
    ? ((report.net / report.total_income) * 100).toFixed(1)
    : null;

  let summaryText = `In ${monthLabel(month)}, you earned ${money(report.total_income)} and spent ${money(report.total_expenses)}.`;
  if (topCategory) summaryText += ` Largest spending category: ${topCategory}.`;
  if (savingsRate !== null) summaryText += ` Savings rate: ${savingsRate}%.`;

  return {
    month,
    monthLabel: monthLabel(month),
    rows,
    totalIncome: report.total_income,
    totalExpenses: report.total_expenses,
    net: report.net,
    topCategory,
    savingsRate,
    summaryText,
  };
}

// Builds (but does not save) a jsPDF document from a shaped report summary.
export function generateReportPdf(summary) {
  const doc = new jsPDF();

  doc.setFontSize(18);
  doc.text(`Spending Report — ${summary.monthLabel}`, 14, 20);

  doc.setFontSize(11);
  doc.text(`Total income: ${money(summary.totalIncome)}`, 14, 32);
  doc.text(`Total expenses: ${money(summary.totalExpenses)}`, 14, 39);
  doc.text(`Net / savings: ${money(summary.net)}`, 14, 46);
  doc.text(`Savings rate: ${summary.savingsRate !== null ? `${summary.savingsRate}%` : "—"}`, 14, 53);

  const summaryLines = doc.splitTextToSize(summary.summaryText, 180);
  doc.text(summaryLines, 14, 65);

  autoTable(doc, {
    startY: 65 + summaryLines.length * 6 + 6,
    head: [["Category", "Income", "Expenses"]],
    body: summary.rows.map((r) => [r.category, money(r.income), money(r.expenses)]),
    foot: [["Total", money(summary.totalIncome), money(summary.totalExpenses)]],
  });

  return doc;
}

// Shapes, renders, and downloads the current month's report as a PDF.
export function downloadMonthlyReport(report, month) {
  const summary = buildReportSummary(report, month);
  const doc = generateReportPdf(summary);
  doc.save(`spending-report-${month}.pdf`);
}

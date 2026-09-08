import type { ReportRange, ReportSnapshot } from "./supabase-reports.service";

function safeFilePart(value: string): string {
  return value.toLowerCase().replaceAll(" ", "-").replace(/[^a-z0-9-]/g, "");
}

export async function exportReportPdf(report: ReportSnapshot, range: ReportRange): Promise<void> {
  const [{ jsPDF }, { default: autoTable }] = await Promise.all([import("jspdf"), import("jspdf-autotable")]);
  const pdf = new jsPDF({ unit: "mm", format: "a4" });
  const pageWidth = pdf.internal.pageSize.getWidth();
  const margin = 14;
  const contentWidth = pageWidth - margin * 2;
  const gold: [number, number, number] = [177, 128, 34];
  const dark: [number, number, number] = [24, 27, 25];

  pdf.setFillColor(...dark);
  pdf.rect(0, 0, pageWidth, 40, "F");
  pdf.setTextColor(245, 202, 114);
  pdf.setFont("helvetica", "bold");
  pdf.setFontSize(20);
  pdf.text("Cafe Sales Report", margin, 17);
  pdf.setFont("helvetica", "normal");
  pdf.setFontSize(10);
  pdf.setTextColor(225, 225, 225);
  pdf.text(`Period: ${range}`, margin, 26);
  pdf.text(`Generated: ${new Date().toLocaleString()}`, margin, 33);

  const cardGap = 4;
  const cardWidth = (contentWidth - cardGap * 2) / 3;
  const cards = [
    ["TOTAL SALES", `${report.totalSales.toFixed(2)} EGP`],
    ["PAID ORDERS", String(report.orderCount)],
    ["AVERAGE ORDER", `${report.averageOrder.toFixed(2)} EGP`],
  ];
  cards.forEach(([label, value], index) => {
    const x = margin + index * (cardWidth + cardGap);
    pdf.setFillColor(248, 248, 246);
    pdf.setDrawColor(220, 204, 167);
    pdf.roundedRect(x, 47, cardWidth, 25, 2, 2, "FD");
    pdf.setFont("helvetica", "normal");
    pdf.setFontSize(8);
    pdf.setTextColor(105, 105, 105);
    pdf.text(label, x + 4, 56);
    pdf.setFont("helvetica", "bold");
    pdf.setFontSize(13);
    pdf.setTextColor(...dark);
    pdf.text(value, x + 4, 66);
  });

  pdf.setFont("helvetica", "bold");
  pdf.setFontSize(13);
  pdf.setTextColor(...dark);
  pdf.text("Daily Sales", margin, 84);
  autoTable(pdf, {
    startY: 89,
    margin: { left: margin, right: margin },
    head: [["Date", "Day", "Sales (EGP)"]],
    body: report.chart.map((point) => [point.date, point.label, point.amount.toFixed(2)]),
    theme: "grid",
    headStyles: { fillColor: dark, textColor: [245, 202, 114], fontStyle: "bold" },
    alternateRowStyles: { fillColor: [248, 248, 246] },
    styles: { font: "helvetica", fontSize: 9, cellPadding: 3 },
    columnStyles: { 2: { halign: "right", fontStyle: "bold" } },
  });

  const dailyTableEnd = (pdf as typeof pdf & { lastAutoTable?: { finalY: number } }).lastAutoTable?.finalY ?? 89;
  let productsTitleY = dailyTableEnd + 11;
  if (productsTitleY > pdf.internal.pageSize.getHeight() - 35) {
    pdf.addPage();
    productsTitleY = 20;
  }
  pdf.setFont("helvetica", "bold");
  pdf.setFontSize(13);
  pdf.setTextColor(...dark);
  pdf.text("Popular Products", margin, productsTitleY);
  autoTable(pdf, {
    startY: productsTitleY + 5,
    margin: { left: margin, right: margin },
    head: [["#", "Product", "Units Sold", "Revenue (EGP)"]],
    body: report.products.length
      ? report.products.map((product, index) => [index + 1, product.name.replace(/[\r\n]+/g, " "), product.sold, product.revenue.toFixed(2)])
      : [["-", "No paid products in this period", 0, "0.00"]],
    theme: "grid",
    headStyles: { fillColor: gold, textColor: [20, 20, 20], fontStyle: "bold" },
    alternateRowStyles: { fillColor: [248, 248, 246] },
    styles: { font: "helvetica", fontSize: 9, cellPadding: 3, overflow: "linebreak" },
    columnStyles: {
      0: { halign: "center", cellWidth: 12 },
      1: { cellWidth: "auto" },
      2: { halign: "center", cellWidth: 28 },
      3: { halign: "right", cellWidth: 35, fontStyle: "bold" },
    },
  });

  const pages = pdf.getNumberOfPages();
  for (let page = 1; page <= pages; page += 1) {
    pdf.setPage(page);
    pdf.setDrawColor(220, 220, 220);
    pdf.line(margin, pdf.internal.pageSize.getHeight() - 12, pageWidth - margin, pdf.internal.pageSize.getHeight() - 12);
    pdf.setFont("helvetica", "normal");
    pdf.setFontSize(8);
    pdf.setTextColor(120, 120, 120);
    pdf.text(`Page ${page} of ${pages}`, pageWidth / 2, pdf.internal.pageSize.getHeight() - 7, { align: "center" });
  }
  pdf.save(`cafe-report-${safeFilePart(range)}.pdf`);
}

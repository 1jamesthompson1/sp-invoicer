// Host-side plugin code. Runs in the Super Productivity renderer (not the
// sandboxed iframe), which has a 5 MB budget for plugin.js and where file
// downloads are not blocked. The PDF library lives here rather than in
// index.html because index.html is capped at 100 KB.
//
// The UI iframe hands us a structured invoice model through
// window.__spInvoicerGeneratePdf (same-origin, see plugin/app.js). We render
// it as a real text PDF (selectable/copyable), not a rasterised image.

import { jsPDF } from 'jspdf';

const PAGE_WIDTH = 595.28;
const PAGE_HEIGHT = 841.89;
const MARGIN = 48;

const COLOR = {
  green: [76, 175, 80],
  heading: [40, 40, 40],
  body: [60, 60, 60],
  muted: [120, 120, 120],
  faint: [150, 150, 150],
  border: [225, 225, 225],
  headerBg: [245, 245, 245]
};

function money(value) {
  return `$${Number(value || 0).toFixed(2)}`;
}

function buildInvoicePdf(model) {
  const pdf = new jsPDF({ unit: 'pt', format: 'a4', orientation: 'portrait' });
  const left = MARGIN;
  const right = PAGE_WIDTH - MARGIN;
  const contentWidth = right - left;
  let y = MARGIN;

  const setFont = (style, size, color) => {
    pdf.setFont('helvetica', style);
    pdf.setFontSize(size);
    const c = color || COLOR.body;
    pdf.setTextColor(c[0], c[1], c[2]);
  };

  const ensureSpace = (needed) => {
    if (y + needed > PAGE_HEIGHT - MARGIN) {
      pdf.addPage();
      y = MARGIN;
    }
  };

  // ---------- Header ----------
  setFont('bold', 24, COLOR.green);
  pdf.text(model.invoiceTitle || 'INVOICE', left, y + 16);

  setFont('normal', 10, COLOR.muted);
  pdf.text(`#${model.invoiceNumber}`, left, y + 32);

  let businessY = y + 12;
  setFont('bold', 12, COLOR.heading);
  pdf.text(model.business.name || '', right, businessY, { align: 'right' });
  businessY += 16;
  setFont('normal', 9, COLOR.muted);
  if (model.business.taxId) {
    pdf.text(
      `${model.business.taxIdLabel || 'Tax ID'}: ${model.business.taxId}`,
      right,
      businessY,
      { align: 'right' }
    );
    businessY += 12;
  }
  if (model.business.email) {
    pdf.text(model.business.email, right, businessY, { align: 'right' });
    businessY += 12;
  }
  if (model.business.phone) {
    pdf.text(model.business.phone, right, businessY, { align: 'right' });
    businessY += 12;
  }

  y = Math.max(y + 32, businessY) + 12;
  pdf.setDrawColor(COLOR.green[0], COLOR.green[1], COLOR.green[2]);
  pdf.setLineWidth(2);
  pdf.line(left, y, right, y);
  y += 26;

  // ---------- Bill To / Invoice details ----------
  const gap = 28;
  const colWidth = (contentWidth - gap) / 2;
  const rightColX = left + colWidth + gap;

  let billY = y;
  setFont('bold', 8, COLOR.faint);
  pdf.text('BILL TO', left, billY);
  billY += 14;
  setFont('bold', 11, COLOR.heading);
  pdf.text(model.client.name || '', left, billY);
  billY += 14;
  setFont('normal', 9, COLOR.muted);
  if (model.client.email) {
    pdf.text(model.client.email, left, billY);
    billY += 12;
  }
  if (model.client.address) {
    pdf.splitTextToSize(model.client.address, colWidth).forEach(line => {
      pdf.text(line, left, billY);
      billY += 12;
    });
  }

  let detailY = y;
  setFont('bold', 8, COLOR.faint);
  pdf.text('INVOICE DETAILS', rightColX, detailY);
  detailY += 14;
  const details = [['Invoice Date:', model.dateFormatted]];
  if (model.dueDateFormatted) details.push(['Due Date:', model.dueDateFormatted]);
  if (model.period) details.push(['Period:', model.period]);
  details.forEach(([label, value]) => {
    setFont('bold', 9, COLOR.muted);
    pdf.text(label, rightColX, detailY);
    setFont('normal', 9, COLOR.body);
    pdf.text(String(value || ''), right, detailY, { align: 'right' });
    detailY += 13;
  });
  if (model.periodDateRange) {
    setFont('normal', 8, COLOR.faint);
    pdf.text(model.periodDateRange, right, detailY, { align: 'right' });
    detailY += 12;
  }

  y = Math.max(billY, detailY) + 22;

  // ---------- Line items table ----------
  const amountRight = right;
  const rateRight = right - 66;
  const hoursRight = rateRight - 58;
  const descWidth = hoursRight - 24 - left;

  const drawTableHeader = () => {
    ensureSpace(26);
    pdf.setFillColor(COLOR.headerBg[0], COLOR.headerBg[1], COLOR.headerBg[2]);
    pdf.rect(left, y, contentWidth, 22, 'F');
    setFont('bold', 9, COLOR.heading);
    const textY = y + 15;
    pdf.text('Description', left + 6, textY);
    pdf.text(`Hours (${model.totalHoursLabel})`, hoursRight, textY, { align: 'right' });
    pdf.text('Rate', rateRight, textY, { align: 'right' });
    pdf.text('Amount', amountRight, textY, { align: 'right' });
    y += 22;
  };

  drawTableHeader();

  const drawItem = (item) => {
    setFont('bold', 10, COLOR.heading);
    const descLines = pdf.splitTextToSize(item.description, descWidth);

    const detailLines = [];
    (item.details || []).forEach(detail => {
      const indent = 10 + (detail.level || 0) * 14;
      setFont('normal', 8.5, COLOR.muted);
      pdf.splitTextToSize(detail.text, descWidth - indent).forEach(line => {
        detailLines.push({ line, indent });
      });
    });

    const textHeight = descLines.length * 13 + detailLines.length * 12;
    const rowHeight = Math.max(textHeight + 10, 24);

    if (y + rowHeight > PAGE_HEIGHT - MARGIN) {
      pdf.addPage();
      y = MARGIN;
      drawTableHeader();
    }

    const topY = y + 14;
    let rowY = topY;
    setFont('bold', 10, COLOR.heading);
    descLines.forEach((line, index) => {
      pdf.text(line, left, rowY);
      if (index < descLines.length - 1) rowY += 13;
    });
    rowY += 13;

    setFont('normal', 8.5, COLOR.muted);
    detailLines.forEach(detail => {
      pdf.text(detail.line, left + detail.indent, rowY);
      rowY += 12;
    });

    setFont('normal', 10, COLOR.body);
    pdf.text(item.hours.toFixed(2), hoursRight, topY, { align: 'right' });
    pdf.text(money(item.rate), rateRight, topY, { align: 'right' });
    setFont('bold', 10, COLOR.heading);
    pdf.text(money(item.amount), amountRight, topY, { align: 'right' });

    y += rowHeight;
    pdf.setDrawColor(COLOR.border[0], COLOR.border[1], COLOR.border[2]);
    pdf.setLineWidth(0.5);
    pdf.line(left, y, right, y);
  };

  (model.lineItems || []).forEach(drawItem);

  // ---------- Totals ----------
  y += 14;
  const totalsLabelX = right - 220;
  ensureSpace(80);

  const totalRow = (label, value, opts = {}) => {
    setFont(opts.bold ? 'bold' : 'normal', opts.size || 10, opts.color || COLOR.body);
    pdf.text(label, totalsLabelX, y);
    pdf.text(value, right, y, { align: 'right' });
    y += opts.gap || 16;
  };

  totalRow('Subtotal:', money(model.subtotal));
  if (model.taxEnabled) {
    totalRow(`${model.taxName} (${model.taxRate}%):`, money(model.taxAmount));
  }
  pdf.setDrawColor(COLOR.heading[0], COLOR.heading[1], COLOR.heading[2]);
  pdf.setLineWidth(1);
  pdf.line(totalsLabelX, y, right, y);
  y += 18;
  totalRow('Total:', money(model.total), { bold: true, size: 14, color: COLOR.heading, gap: 20 });

  // ---------- Payment details ----------
  if (model.bankDetails) {
    ensureSpace(60);
    y += 16;
    pdf.setDrawColor(COLOR.border[0], COLOR.border[1], COLOR.border[2]);
    pdf.setLineWidth(0.5);
    pdf.line(left, y, right, y);
    y += 18;
    setFont('bold', 8, COLOR.faint);
    pdf.text('PAYMENT DETAILS', left, y);
    y += 14;
    setFont('normal', 9, COLOR.muted);
    pdf.splitTextToSize(model.bankDetails, contentWidth).forEach(line => {
      ensureSpace(14);
      pdf.text(line, left, y);
      y += 12;
    });
  }

  // ---------- Footer ----------
  ensureSpace(60);
  y += 20;
  pdf.setDrawColor(COLOR.border[0], COLOR.border[1], COLOR.border[2]);
  pdf.setLineWidth(0.5);
  pdf.line(left, y, right, y);
  y += 18;
  if (model.invoiceMessage) {
    setFont('normal', 9, COLOR.muted);
    pdf.text(model.invoiceMessage, left + contentWidth / 2, y, { align: 'center' });
    y += 14;
  }
  if (model.business.website) {
    setFont('normal', 9, COLOR.green);
    pdf.text(model.business.website, left + contentWidth / 2, y, { align: 'center' });
  }

  return pdf;
}

function downloadBlob(filename, blob) {
  const url = URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.href = url;
  link.download = filename;
  link.rel = 'noopener';
  link.style.display = 'none';
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
  setTimeout(() => URL.revokeObjectURL(url), 10000);
}

function generateAndDownloadPdf(request) {
  const filename = (request && request.filename) || 'invoice.pdf';
  const model = request && request.model;

  if (!model) {
    throw new Error('No invoice data provided');
  }

  const pdf = buildInvoicePdf(model);
  downloadBlob(filename, pdf.output('blob'));
  return { filename };
}

window.__spInvoicerGeneratePdf = generateAndDownloadPdf;

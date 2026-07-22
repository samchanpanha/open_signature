import ExcelJS from 'exceljs';
import { PDFDocument, rgb, StandardFonts } from 'pdf-lib';

interface ExcelToPdfOptions {
  pageSize?: [number, number];
  margin?: number;
}

const DEFAULT_OPTIONS: ExcelToPdfOptions = {
  pageSize: [612, 792], // US Letter
  margin: 50,
};

export async function convertExcelToPdf(
  excelBuffer: Buffer | Uint8Array,
  options?: ExcelToPdfOptions
): Promise<Buffer> {
  const opts = { ...DEFAULT_OPTIONS, ...options };
  const [pageWidth, pageHeight] = opts.pageSize!;
  const margin = opts.margin!;
  const contentWidth = pageWidth - 2 * margin;

  // Read Excel file
  const workbook = new ExcelJS.Workbook();
  await workbook.xlsx.load(new Uint8Array(excelBuffer) as any);

  const pdfDoc = await PDFDocument.create();
  const font = await pdfDoc.embedFont(StandardFonts.Helvetica);
  const boldFont = await pdfDoc.embedFont(StandardFonts.HelveticaBold);

  let page = pdfDoc.addPage([pageWidth, pageHeight]);
  let y = pageHeight - margin;

  function ensureSpace(needed: number): void {
    if (y - needed < margin + 20) {
      page = pdfDoc.addPage([pageWidth, pageHeight]);
      y = pageHeight - margin;
    }
  }

  function drawText(text: string, x: number, yPos: number, size: number, useFont: any, color?: any): void {
    try {
      page.drawText(text, { x, y: yPos, size, font: useFont, color: color || rgb(0, 0, 0) });
    } catch {
      // Fallback for unsupported characters
      page.drawText(text.replace(/[^\x20-\x7E]/g, '?'), { x, y: yPos, size, font: useFont, color: color || rgb(0, 0, 0) });
    }
  }

  function truncateText(text: string, maxChars: number): string {
    if (text.length <= maxChars) return text;
    return text.substring(0, maxChars - 3) + '...';
  }

  const sheetNames = workbook.worksheets.map(ws => ws.name);

  for (let wsIdx = 0; wsIdx < workbook.worksheets.length; wsIdx++) {
    const worksheet = workbook.worksheets[wsIdx];

    if (wsIdx > 0) {
      // Add separator between sheets
      ensureSpace(60);
      y -= 10;
    }

    // Sheet title
    ensureSpace(40);
    y -= 6;
    drawText(`Sheet: ${worksheet.name}`, margin, y, 16, boldFont, rgb(0.1, 0.1, 0.1));
    y -= 24;

    // Get data
    const rows: any[][] = [];
    let maxCols = 0;

    worksheet.eachRow((row, rowNumber) => {
      if (rowNumber > 200) return; // Limit rows
      const rowData: any[] = [];
      row.eachCell({ includeEmpty: true }, (cell, colNumber) => {
        if (colNumber > 50) return; // Limit columns
        let value = cell.value;
        if (value === null || value === undefined) {
          rowData.push('');
        } else if (typeof value === 'object' && 'result' in value) {
          // Formula cell
          rowData.push(String(value.result ?? ''));
        } else if (value instanceof Date) {
          rowData.push(value.toLocaleDateString());
        } else {
          rowData.push(String(value));
        }
      });
      if (rowData.length > 0) {
        rows.push(rowData);
        maxCols = Math.max(maxCols, rowData.length);
      }
    });

    if (rows.length === 0) {
      drawText('(Empty sheet)', margin, y, 10, font, rgb(0.5, 0.5, 0.5));
      y -= 16;
      continue;
    }

    // Limit columns to fit page
    const displayCols = Math.min(maxCols, 8);
    const colWidth = Math.min(contentWidth / displayCols, 120);
    const tableWidth = colWidth * displayCols;
    const rowHeight = 18;
    const cellPadding = 4;
    const maxCharsPerCell = Math.floor(colWidth / 5);

    // Draw header row (first row)
    if (rows.length > 0) {
      ensureSpace(rowHeight + 4);
      y -= 2;

      // Header background
      page.drawRectangle({
        x: margin,
        y: y - rowHeight + 4,
        width: tableWidth,
        height: rowHeight,
        color: rgb(0.15, 0.56, 0.49), // emerald-600
      });

      const headerRow = rows[0];
      for (let col = 0; col < displayCols; col++) {
        const cellX = margin + col * colWidth;
        const cellText = truncateText(String(headerRow[col] || `Col ${col + 1}`), maxCharsPerCell);
        drawText(cellText, cellX + cellPadding, y - 4, 9, boldFont, rgb(1, 1, 1));
      }
      y -= rowHeight;
    }

    // Draw data rows
    for (let rowIdx = 1; rowIdx < rows.length; rowIdx++) {
      ensureSpace(rowHeight);

      const row = rows[rowIdx];

      // Alternating row background
      if (rowIdx % 2 === 0) {
        page.drawRectangle({
          x: margin,
          y: y - rowHeight + 4,
          width: tableWidth,
          height: rowHeight,
          color: rgb(0.96, 0.96, 0.96),
        });
      }

      // Cell borders and text
      for (let col = 0; col < displayCols; col++) {
        const cellX = margin + col * colWidth;

        // Cell border
        page.drawRectangle({
          x: cellX,
          y: y - rowHeight + 4,
          width: colWidth,
          height: rowHeight,
          borderColor: rgb(0.85, 0.85, 0.85),
          borderWidth: 0.3,
        });

        // Cell text
        const cellText = truncateText(String(row[col] || ''), maxCharsPerCell);
        if (cellText) {
          drawText(cellText, cellX + cellPadding, y - 4, 8, font);
        }
      }
      y -= rowHeight;
    }

    // Summary
    y -= 6;
    drawText(`${rows.length - 1} rows × ${maxCols} columns`, margin, y, 8, font, rgb(0.5, 0.5, 0.5));
    y -= 12;

    // If more columns than displayed, note it
    if (maxCols > displayCols) {
      drawText(`(Showing ${displayCols} of ${maxCols} columns)`, margin, y, 8, font, rgb(0.5, 0.5, 0.5));
      y -= 12;
    }
  }

  // Add metadata page with sheet list if multiple sheets
  if (workbook.worksheets.length > 1) {
    ensureSpace(60);
    y -= 10;
    page.drawLine({
      start: { x: margin, y },
      end: { x: pageWidth - margin, y },
      thickness: 1,
      color: rgb(0.8, 0.8, 0.8),
    });
    y -= 16;
    drawText(`Workbook: ${sheetNames.length} sheets`, margin, y, 10, boldFont);
    y -= 14;
    for (const name of sheetNames) {
      drawText(`  • ${name}`, margin, y, 9, font, rgb(0.4, 0.4, 0.4));
      y -= 12;
    }
  }

  const pdfBytes = await pdfDoc.save();
  return Buffer.from(pdfBytes);
}

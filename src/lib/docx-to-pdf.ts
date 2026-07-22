import mammoth from 'mammoth';
import { PDFDocument, rgb, StandardFonts } from 'pdf-lib';

interface DocxOptions {
  pageSize?: [number, number];
  margin?: number;
  fontSize?: number;
}

const DEFAULT_OPTIONS: DocxOptions = {
  pageSize: [612, 792],
  margin: 50,
  fontSize: 11,
};

interface TextRun {
  text: string;
  bold?: boolean;
  italic?: boolean;
  underline?: boolean;
}

interface BlockElement {
  type: 'heading' | 'paragraph' | 'list-item' | 'table' | 'hr';
  level?: number;
  runs: TextRun[];
  indent?: number;
  alignment?: 'left' | 'center' | 'right';
  tableData?: TextRun[][][];
}

// Simple regex-based HTML parser for server-side use (no DOM needed)
function htmlToBlocks(html: string): BlockElement[] {
  const blocks: BlockElement[] = [];

  // Process top-level elements using regex
  const tagRegex = /<(h[1-6]|p|ul|ol|table|hr|div|span|strong|b|em|i|u|br)([^>]*)>([\s\S]*?)<\/\1>|<(hr|br)\s*\/?>/gi;

  function extractRunsFromHtml(htmlStr: string): TextRun[] {
    const runs: TextRun[] = [];
    // Remove all tags but track formatting
    let result = htmlStr;
    const segments: { text: string; bold: boolean; italic: boolean; underline: boolean }[] = [];

    // Split by tags, keeping track of what's inside each
    const parts = result.split(/(<[^>]+>)/);
    let isBold = false;
    let isItalic = false;
    let isUnderline = false;

    for (const part of parts) {
      if (!part) continue;
      if (part.startsWith('<')) {
        const tag = part.toLowerCase();
        if (tag.match(/<(strong|b)/)) isBold = true;
        else if (tag.match(/<\/(strong|b)/)) isBold = false;
        else if (tag.match(/<(em|i)/)) isItalic = true;
        else if (tag.match(/<\/(em|i)/)) isItalic = false;
        else if (tag.match(/<(u)/)) isUnderline = true;
        else if (tag.match(/<\/(u)/)) isUnderline = false;
        else if (tag === '<br>' || tag === '<br/>') {
          segments.push({ text: '\n', bold: isBold, italic: isItalic, underline: isUnderline });
        }
      } else {
        const text = part.replace(/&amp;/g, '&').replace(/&lt;/g, '<').replace(/&gt;/g, '>').replace(/&nbsp;/g, ' ').replace(/&#39;/g, "'").replace(/&quot;/g, '"');
        if (text) {
          segments.push({ text, bold: isBold, italic: isItalic, underline: isUnderline });
        }
      }
    }

    // Merge adjacent segments with same formatting
    for (const seg of segments) {
      if (runs.length > 0) {
        const last = runs[runs.length - 1];
        if (last.bold === seg.bold && last.italic === seg.italic && last.underline === seg.underline) {
          last.text += seg.text;
          continue;
        }
      }
      runs.push({ ...seg });
    }

    return runs;
  }

  function processTableContent(innerHtml: string): TextRun[][][] {
    const rows: TextRun[][][] = [];
    const rowMatches = innerHtml.match(/<tr[^>]*>([\s\S]*?)<\/tr>/gi) || [];
    for (const rowHtml of rowMatches) {
      const cellMatches = rowHtml.match(/<(td|th)[^>]*>([\s\S]*?)<\/\1>/gi) || [];
      const cells: TextRun[][] = [];
      for (const cellHtml of cellMatches) {
        const inner = cellHtml.replace(/<\/?(td|th)[^>]*>/gi, '');
        cells.push(extractRunsFromHtml(inner));
      }
      if (cells.length > 0) rows.push(cells);
    }
    return rows;
  }

  // Tokenize the HTML into top-level elements
  const elementRegex = /<(h[1-6]|p|ul|ol|table|div|hr)([^>]*)>([\s\S]*?)<\/\1>|<(hr)\s*\/?>/gi;
  let match;
  let lastIndex = 0;
  const textBefore = html.substring(0, html.search(elementRegex) || 0).replace(/<[^>]*>/g, '').trim();

  while ((match = elementRegex.exec(html)) !== null) {
    const tag = (match[1] || match[4] || '').toLowerCase();
    const innerHtml = match[3] || '';

    if (tag === 'table') {
      const tableData = processTableContent(innerHtml);
      if (tableData.length > 0) {
        blocks.push({ type: 'table', runs: [], tableData });
      }
    } else if (tag === 'hr') {
      blocks.push({ type: 'hr', runs: [] });
    } else if (tag.match(/^h([1-6])$/)) {
      const level = parseInt(tag[1]);
      const runs = extractRunsFromHtml(innerHtml);
      if (runs.length > 0) blocks.push({ type: 'heading', level, runs });
    } else if (tag === 'ul' || tag === 'ol') {
      const isOrdered = tag === 'ol';
      let counter = 1;
      const liRegex = /<li[^>]*>([\s\S]*?)<\/li>/gi;
      let liMatch;
      while ((liMatch = liRegex.exec(innerHtml)) !== null) {
        const prefix = isOrdered ? `${counter}. ` : '\u2022 ';
        const runs = extractRunsFromHtml(liMatch[1]);
        if (runs.length > 0) {
          runs[0] = { ...runs[0], text: prefix + runs[0].text };
          blocks.push({ type: 'list-item', runs });
        }
        counter++;
      }
    } else if (tag === 'p' || tag === 'div') {
      const runs = extractRunsFromHtml(innerHtml);
      if (runs.length > 0 && runs.some(r => r.text.trim())) {
        blocks.push({ type: 'paragraph', runs });
      }
    }
  }

  // If no blocks found, try extracting plain text
  if (blocks.length === 0) {
    const text = html.replace(/<[^>]*>/g, ' ').replace(/&amp;/g, '&').replace(/&lt;/g, '<').replace(/&gt;/g, '>').replace(/&nbsp;/g, ' ').replace(/\s+/g, ' ').trim();
    if (text) {
      // Split into paragraphs by double newlines or periods followed by spaces
      const paragraphs = text.split(/\n\s*\n/).filter(p => p.trim());
      for (const para of paragraphs) {
        blocks.push({ type: 'paragraph', runs: [{ text: para.trim() }] });
      }
      if (blocks.length === 0) {
        blocks.push({ type: 'paragraph', runs: [{ text }] });
      }
    }
  }

  return blocks;
}

function wrapText(text: string, font: any, fontSize: number, maxWidth: number): string[] {
  const words = text.split(/(\s+)/);
  const lines: string[] = [];
  let currentLine = '';

  for (const word of words) {
    if (!word) continue;
    const testLine = currentLine + word;
    try {
      const width = font.widthOfTextAtSize(testLine, fontSize);
      if (width > maxWidth && currentLine.trim()) {
        lines.push(currentLine);
        currentLine = word.trimStart();
      } else {
        currentLine = testLine;
      }
    } catch {
      currentLine = testLine;
    }
  }
  if (currentLine.trim()) lines.push(currentLine);
  return lines.length > 0 ? lines : [''];
}

export async function convertDocxToPdf(docxBuffer: Buffer, options?: DocxOptions): Promise<Buffer> {
  const opts = { ...DEFAULT_OPTIONS, ...options };
  const [pageWidth, pageHeight] = opts.pageSize!;
  const margin = opts.margin!;
  const contentWidth = pageWidth - 2 * margin;

  const result = await mammoth.convertToHtml({ buffer: docxBuffer });
  const html = result.value;

  const blocks = htmlToBlocks(html);

  const pdfDoc = await PDFDocument.create();
  const font = await pdfDoc.embedFont(StandardFonts.Helvetica);
  const boldFont = await pdfDoc.embedFont(StandardFonts.HelveticaBold);
  const italicFont = await pdfDoc.embedFont(StandardFonts.HelveticaOblique);
  const boldItalicFont = await pdfDoc.embedFont(StandardFonts.HelveticaBoldOblique);

  let page = pdfDoc.addPage([pageWidth, pageHeight]);
  let y = pageHeight - margin;

  function getFont(run: TextRun): any {
    if (run.bold && run.italic) return boldItalicFont;
    if (run.bold) return boldFont;
    if (run.italic) return italicFont;
    return font;
  }

  function ensureSpace(needed: number): void {
    if (y - needed < margin) {
      page = pdfDoc.addPage([pageWidth, pageHeight]);
      y = pageHeight - margin;
    }
  }

  function drawText(text: string, x: number, yPos: number, size: number, useFont: any, color?: any): void {
    try {
      page.drawText(text, { x, y: yPos, size, font: useFont, color: color || rgb(0, 0, 0) });
    } catch {
      page.drawText(text.replace(/[^\x20-\x7E]/g, '?'), { x, y: yPos, size, font, color: color || rgb(0, 0, 0) });
    }
  }

  function drawTextRuns(runs: TextRun[], maxWidth: number, fontSize: number, align?: string): void {
    const fullText = runs.map(r => r.text).join('');
    const textBlocks = fullText.split('\n');

    for (const block of textBlocks) {
      const lines = wrapText(block || ' ', font, fontSize, maxWidth);
      for (const line of lines) {
        ensureSpace(fontSize + 4);
        let x = margin;
        if (align === 'center') {
          const tw = font.widthOfTextAtSize(line, fontSize);
          x = margin + (contentWidth - tw) / 2;
        } else if (align === 'right') {
          const tw = font.widthOfTextAtSize(line, fontSize);
          x = margin + contentWidth - tw;
        }
        const run = runs[0] || { text: line };
        drawText(line, x, y, fontSize, getFont(run));
        y -= fontSize + 4;
      }
    }
  }

  for (const block of blocks) {
    switch (block.type) {
      case 'heading': {
        const size = block.level === 1 ? 22 : block.level === 2 ? 18 : block.level === 3 ? 15 : block.level === 4 ? 13 : 11;
        ensureSpace(size + 12);
        y -= 6;
        const text = block.runs.map(r => r.text).join('');
        const lines = wrapText(text, boldFont, size, contentWidth);
        for (const line of lines) {
          drawText(line, margin, y, size, boldFont, rgb(0.1, 0.1, 0.1));
          y -= size + 4;
        }
        y -= 4;
        break;
      }

      case 'paragraph':
        drawTextRuns(block.runs, contentWidth, opts.fontSize!);
        y -= 4;
        break;

      case 'list-item': {
        const indent = (block.indent || 0) * 18 + margin;
        drawTextRuns(block.runs, pageWidth - indent - margin, opts.fontSize!);
        break;
      }

      case 'hr':
        ensureSpace(12);
        y -= 6;
        page.drawLine({ start: { x: margin, y }, end: { x: pageWidth - margin, y }, thickness: 0.5, color: rgb(0.7, 0.7, 0.7) });
        y -= 8;
        break;

      case 'table': {
        if (!block.tableData || block.tableData.length === 0) break;
        const numCols = Math.max(...block.tableData.map(r => r.length));
        const colWidth = contentWidth / numCols;
        const rowHeight = 18;
        const tableWidth = colWidth * numCols;

        ensureSpace(rowHeight * block.tableData.length + 10);
        y -= 4;

        for (let ri = 0; ri < block.tableData.length; ri++) {
          const row = block.tableData[ri];
          ensureSpace(rowHeight);

          if (ri === 0) {
            page.drawRectangle({ x: margin, y: y - rowHeight + 4, width: tableWidth, height: rowHeight, color: rgb(0.15, 0.56, 0.49) });
          } else if (ri % 2 === 0) {
            page.drawRectangle({ x: margin, y: y - rowHeight + 4, width: tableWidth, height: rowHeight, color: rgb(0.96, 0.96, 0.96) });
          }

          for (let ci = 0; ci < numCols; ci++) {
            const cellX = margin + ci * colWidth;
            page.drawRectangle({ x: cellX, y: y - rowHeight + 4, width: colWidth, height: rowHeight, borderColor: rgb(0.8, 0.8, 0.8), borderWidth: 0.3 });
            const cellText = (row[ci]?.map(r => r.text).join(' ') || '').substring(0, 40);
            if (cellText) {
              drawText(cellText, cellX + 3, y - 3, 8, ri === 0 ? boldFont : font, ri === 0 ? rgb(1, 1, 1) : rgb(0, 0, 0));
            }
          }
          y -= rowHeight;
        }
        y -= 8;
        break;
      }
    }

    if (y < margin) {
      page = pdfDoc.addPage([pageWidth, pageHeight]);
      y = pageHeight - margin;
    }
  }

  const pdfBytes = await pdfDoc.save();
  return Buffer.from(pdfBytes);
}

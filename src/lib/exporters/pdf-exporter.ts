/**
 * PDF Exporter - Generates PDF documents from templates
 */

import PDFDocument from 'pdfkit';
import { Readable } from 'stream';

export interface PDFOptions {
  title: string;
  content: Array<{ type: 'text' | 'image' | 'table'; data: any }>;
  pageSize?: 'A4' | 'Letter' | 'Legal';
  margins?: { top: number; bottom: number; left: number; right: number };
}

export class PDFExporter {
  private doc: typeof PDFDocument.prototype;
  private options: PDFOptions;

  constructor(options: PDFOptions) {
    this.options = {
      pageSize: 'A4',
      margins: { top: 50, bottom: 50, left: 50, right: 50 },
      ...options,
    };
    this.doc = new PDFDocument({
      size: this.options.pageSize,
      margins: this.options.margins,
    });
  }

  async generate(): Promise<Buffer> {
    const chunks: Buffer[] = [];

    this.doc.on('data', (chunk) => chunks.push(chunk));

    // Add title
    this.doc
      .fontSize(24)
      .font('Helvetica-Bold')
      .text(this.options.title, { align: 'center' })
      .moveDown(2);

    // Process content
    for (const item of this.options.content) {
      switch (item.type) {
        case 'text':
          this.addText(item.data);
          break;
        case 'image':
          await this.addImage(item.data);
          break;
        case 'table':
          this.addTable(item.data);
          break;
      }
    }

    this.doc.end();

    return new Promise((resolve) => {
      this.doc.on('end', () => {
        resolve(Buffer.concat(chunks));
      });
    });
  }

  private addText(data: { text: string; fontSize?: number; bold?: boolean }) {
    this.doc
      .fontSize(data.fontSize || 12)
      .font(data.bold ? 'Helvetica-Bold' : 'Helvetica')
      .text(data.text, { align: 'left' })
      .moveDown(0.5);
  }

  private async addImage(data: { src: string; width?: number; height?: number }) {
    const { src, width = 200, height = undefined } = data;
    this.doc.image(src, { width, height });
    this.doc.moveDown(1);
  }

  private addTable(data: { headers: string[]; rows: string[][] }) {
    const { headers, rows } = data;
    const tableTop = this.doc.y;
    const tableLeft = this.doc.page.margins.left;
    const colWidths = headers.map(() => 100);

    // Draw headers
    this.doc.font('Helvetica-Bold').fontSize(12);
    headers.forEach((header, i) => {
      this.doc.text(header, tableLeft + colWidths.slice(0, i).reduce((a, b) => a + b, 0), tableTop);
    });

    this.doc.moveTo(tableLeft, tableTop + 20).lineTo(tableLeft + colWidths.reduce((a, b) => a + b, 0), tableTop + 20).stroke();

    // Draw rows
    this.doc.font('Helvetica').fontSize(11);
    rows.forEach((row, rowIndex) => {
      const rowTop = tableTop + 30 + rowIndex * 20;
      row.forEach((cell, colIndex) => {
        this.doc.text(cell, tableLeft + colWidths.slice(0, colIndex).reduce((a, b) => a + b, 0), rowTop);
      });
    });

    this.doc.moveDown(rows.length + 2);
  }

  static async export(options: PDFOptions): Promise<Buffer> {
    const exporter = new PDFExporter(options);
    return exporter.generate();
  }
}

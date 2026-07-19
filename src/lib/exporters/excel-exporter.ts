/**
 * Excel Exporter - Generates Excel documents using exceljs
 */

import ExcelJS from 'exceljs';

export interface ExcelSheet {
  name: string;
  columns: { header: string; key: string; width?: number }[];
  rows: any[];
}

export interface ExcelOptions {
  filename: string;
  sheets: ExcelSheet[];
}

export class ExcelExporter {
  private workbook: ExcelJS.Workbook;
  private options: ExcelOptions;

  constructor(options: ExcelOptions) {
    this.options = options;
    this.workbook = new ExcelJS.Workbook();
  }

  async generate(): Promise<Buffer> {
    for (const sheet of this.options.sheets) {
      const worksheet = this.workbook.addWorksheet(sheet.name);
      
      // Set columns
      worksheet.columns = sheet.columns.map(col => ({
        header: col.header,
        key: col.key,
        width: col.width || 15,
      }));

      // Add rows
      worksheet.addRows(sheet.rows);

      // Style header row
      const headerRow = worksheet.getRow(1);
      headerRow.font = { bold: true };
      headerRow.fill = {
        type: 'pattern',
        pattern: 'solid',
        fgColor: { argb: 'FFE0E0E0' },
      };
    }

    return this.workbook.xlsx.writeBuffer() as unknown as Promise<Buffer<ArrayBufferLike>>;
  }

  static async export(options: ExcelOptions): Promise<Buffer<ArrayBufferLike>> {
    const exporter = new ExcelExporter(options);
    return exporter.generate();
  }
}

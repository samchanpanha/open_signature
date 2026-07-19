/**
 * Excel Importer - Imports data from Excel/CSV files
 */

import ExcelJS from 'exceljs';

export interface ImportResult {
  sheets: Array<{
    name: string;
    columns: string[];
    rows: any[];
  }>;
  errors: string[];
}

export class ExcelImporter {
  private workbook: ExcelJS.Workbook | null = null;

  async load(buffer: Buffer | ArrayBuffer): Promise<ImportResult> {
    const result: ImportResult = {
      sheets: [],
      errors: [],
    };

    try {
      this.workbook = new ExcelJS.Workbook();
      await this.workbook.xlsx.load(buffer as any);

      this.workbook.eachSheet((worksheet, sheetId) => {
        const columns: string[] = [];
        const rows: any[] = [];

        // Extract column headers
        worksheet.getRow(1).eachCell((cell) => {
          columns.push(cell.value?.toString() || '');
        });

        // Extract data rows
        worksheet.eachRow((row, rowNumber) => {
          if (rowNumber === 1) return; // Skip header

          const rowData: any = {};
          row.eachCell((cell, colNumber) => {
            const columnName = columns[colNumber - 1] || `col${colNumber}`;
            rowData[columnName] = cell.value;
          });
          rows.push(rowData);
        });

        result.sheets.push({
          name: worksheet.name,
          columns,
          rows,
        });
      });
    } catch (error) {
      result.errors.push(`Failed to parse Excel file: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }

    return result;
  }

  static async import(buffer: Buffer): Promise<ImportResult> {
    const importer = new ExcelImporter();
    return importer.load(buffer);
  }
}

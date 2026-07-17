/**
 * Word Exporter - Generates Word documents using docx
 */

import { Document, Packer, Paragraph, Table, TableRow, TableCell, WidthType, TextRun } from 'docx';

export interface WordSection {
  type: 'text' | 'table' | 'heading';
  data: any;
}

export interface WordOptions {
  title: string;
  sections: WordSection[];
}

export class WordExporter {
  private options: WordOptions;

  constructor(options: WordOptions) {
    this.options = options;
  }

  async generate(): Promise<Buffer> {
    const children: (Paragraph | Table)[] = [];

    // Add title
    children.push(
      new Paragraph({
        text: this.options.title,
        heading: 'Heading1',
        spacing: { after: 400 },
      })
    );

    // Process sections
    for (const section of this.options.sections) {
      switch (section.type) {
        case 'heading':
          children.push(
            new Paragraph({
              text: section.data.text,
              heading: section.data.level === 2 ? 'Heading2' : 'Heading3',
              spacing: { before: 200, after: 100 },
            })
          );
          break;
        case 'text':
          children.push(
            new Paragraph({
              children: [
                new TextRun({
                  text: section.data.text,
                  size: section.data.fontSize ? section.data.fontSize * 2 : 24,
                  bold: section.data.bold || false,
                }),
              ],
              spacing: { after: 200 },
            })
          );
          break;
        case 'table':
          children.push(this.createTable(section.data));
          break;
      }
    }

    const doc = new Document({
      sections: [
        {
          properties: {},
          children,
        },
      ],
    });

    return Packer.toBuffer(doc);
  }

  private createTable(data: { headers: string[]; rows: string[][] }): Table {
    const { headers, rows } = data;

    const tableRows = [
      new TableRow({
        children: headers.map(
          (header) =>
            new TableCell({
              children: [new Paragraph({ text: header })],
              shading: { fill: 'E0E0E0' },
            })
        ),
      }),
      ...rows.map(
        (row) =>
          new TableRow({
            children: row.map(
              (cell) =>
                new TableCell({
                  children: [new Paragraph({ text: cell })],
                })
            ),
          })
      ),
    ];

    return new Table({
      width: { size: 100, type: WidthType.PERCENTAGE },
      rows: tableRows,
    });
  }

  static async export(options: WordOptions): Promise<Buffer> {
    const exporter = new WordExporter(options);
    return exporter.generate();
  }
}

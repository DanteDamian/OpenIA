import "server-only";
import { Document, HeadingLevel, Packer, Paragraph, Table, TableCell, TableRow, TextRun, WidthType } from "docx";
import { PDFDocument, StandardFonts, rgb } from "pdf-lib";
import { formatMoney } from "@/lib/business/validation";
import { decimalHundredths } from "./validation";
import type { ProposalItem } from "./model";

export type ProposalDocumentData = {
  code: string; version: number; title: string; clientName: string; validUntil: string | null;
  sections: { title: string; content: string; position: number }[]; items: ProposalItem[];
};
const navy = "12233D", teal = "0D8C87";
const money = (value: string) => formatMoney(decimalHundredths(value));

export async function createDocx(data: ProposalDocumentData) {
  const itemRows = data.items.map((item) => new TableRow({ children: [item.description, item.quantity, money(item.unit_price), money(item.total)].map((text) => new TableCell({ children: [new Paragraph(String(text))] })) }));
  const children = [
    new Paragraph({ children: [new TextRun({ text: "AIGENTERRA", bold: true, color: navy, size: 34 })] }),
    new Paragraph({ text: "PROPUESTA", heading: HeadingLevel.TITLE }),
    new Paragraph({ children: [new TextRun({ text: data.title, bold: true, color: teal, size: 28 })] }),
    new Paragraph(`Código ${data.code} · Versión ${data.version} · Cliente ${data.clientName}${data.validUntil ? ` · Vigente hasta ${data.validUntil}` : ""}`),
    ...data.sections.flatMap((section) => [
      new Paragraph({ text: `${section.position}. ${section.title}`, heading: HeadingLevel.HEADING_1 }),
      ...section.content.split(/\n+/).filter(Boolean).map((text) => new Paragraph(text)),
      ...(section.position === 11 && data.items.length ? [new Table({ width: { size: 100, type: WidthType.PERCENTAGE }, rows: [new TableRow({ children: ["Concepto", "Cantidad", "Valor unitario", "Total"].map((text) => new TableCell({ children: [new Paragraph({ children: [new TextRun({ text, bold: true, color: navy })] })] })) }), ...itemRows] })] : []),
    ]),
  ];
  return Packer.toBuffer(new Document({ sections: [{ properties: {}, children }] }));
}

export async function createPdf(data: ProposalDocumentData) {
  const pdf = await PDFDocument.create();
  const regular = await pdf.embedFont(StandardFonts.Helvetica);
  const bold = await pdf.embedFont(StandardFonts.HelveticaBold);
  const pageSize: [number, number] = [595.28, 841.89];
  let page = pdf.addPage(pageSize), y = 790;
  const addPage = () => { page = pdf.addPage(pageSize); y = 790; };
  const write = (text: string, size = 10, isBold = false, color = rgb(0.07, 0.14, 0.24)) => {
    const font = isBold ? bold : regular; const max = Math.max(20, Math.floor(92 / (size / 10)));
    const words = text.replace(/\s+/g, " ").trim().split(" "); let line = "";
    for (const word of words) { const candidate = line ? `${line} ${word}` : word; if (candidate.length > max) { if (y < 55) addPage(); page.drawText(line, { x: 50, y, size, font, color }); y -= size + 5; line = word; } else line = candidate; }
    if (line) { if (y < 55) addPage(); page.drawText(line, { x: 50, y, size, font, color }); y -= size + 5; }
  };
  write("AIGENTERRA", 20, true); write("PROPUESTA", 11, true, rgb(0.05, 0.55, 0.53)); y -= 12;
  write(data.title, 17, true); write(`Código ${data.code} · Versión ${data.version} · Cliente ${data.clientName}`, 9); y -= 18;
  for (const section of data.sections) {
    write(`${section.position}. ${section.title}`, 13, true, rgb(0.05, 0.55, 0.53));
    if (section.content) for (const paragraph of section.content.split(/\n+/)) write(paragraph, 10);
    if (section.position === 11 && data.items.length) for (const item of data.items) write(`${item.description} · ${item.quantity} × ${money(item.unit_price)} · ${money(item.total)}`, 9);
    y -= 10;
  }
  return Buffer.from(await pdf.save());
}

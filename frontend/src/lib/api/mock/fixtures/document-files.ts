import type { SubmittedDocument } from "@/types/account-status";

// Stand-ins for the files on the API's private disk, drawn on request so the document viewer (AU-23, AU-24) has real
// PNG and PDF bytes to show and no picture of anyone's ID sits in the repository (SEC-PRIV-06). Images are always
// PNG, whatever format the fixture says was uploaded.

export type MockFile = { type: string; bytes: Uint8Array<ArrayBuffer> };

type Shape = [kind: "rect" | "oval", x: number, y: number, width: number, height: number, color: number];

// Colours follow the blue, yellow and gray of the design tokens. A pixel holds an index into this list; 0, the
// first, is what an image starts filled with.
const PALETTE = [0xeef1fa, 0xffffff, 0x3341c2, 0xfccb1a, 0xc9cee0, 0x4b5275, 0xdfe4f7, 0x9aa1bd, 0xb98a4e];
const WHITE = 1;
const BLUE = 2;
const YELLOW = 3;
const PALE = 4;
const DARK = 5;
const SKY = 6;
const GRAY = 7;
const BROWN = 8;

/** The file for one submitted document. `seed` varies the drawing, so three pet photos don't look the same. */
export function mockDocumentFile(document: SubmittedDocument, seed: number, owner: string): MockFile {
  if (document.mime_type === "application/pdf") {
    const kind = document.document_type === "valid_id" ? "Valid ID (scanned)" : "Vet record";
    return { type: "application/pdf", bytes: pdf([`${kind}: ${owner}`, "Made-up document for Pawfolio mock mode.", "Nothing here is real."]) };
  }
  return { type: "image/png", bytes: document.document_type === "pet_photo" ? petPhoto(seed) : idCard(seed) };
}

function idCard(seed: number): Uint8Array<ArrayBuffer> {
  const line = (y: number, width: number): Shape => ["rect", 190, y, width, 12, PALE];
  return png(480, 300, [
    ["rect", 20, 20, 440, 260, WHITE],
    ["rect", 20, 20, 440, 56, seed % 2 ? DARK : BLUE],
    ["rect", 44, 100, 120, 150, PALE],
    ["oval", 74, 118, 60, 60, GRAY],
    ["oval", 62, 186, 84, 64, GRAY],
    ["rect", 190, 104, 200 + (seed % 3) * 20, 16, DARK],
    line(138, 180),
    line(162, 240 - (seed % 4) * 20),
    line(186, 150),
    ["rect", 190, 226, 110, 24, YELLOW],
  ]);
}

function petPhoto(seed: number): Uint8Array<ArrayBuffer> {
  const fur = [BROWN, GRAY, WHITE, YELLOW][seed % 4];
  return png(480, 360, [
    ["rect", 0, 0, 480, 360, SKY],
    ["rect", 0, 270, 480, 90, PALE],
    ["oval", 150, 190, 180, 160, fur],
    ["oval", 148, 66, 54, 90, fur],
    ["oval", 278, 66, 54, 90, fur],
    ["oval", 165, 90, 150, 140, fur],
    ["oval", 204, 140, 18, 22, DARK],
    ["oval", 258, 140, 18, 22, DARK],
    ["oval", 227, 178, 26, 18, DARK],
  ]);
}

/** A palette PNG with stored (uncompressed) data: small enough here, and nothing to decode but the format itself. */
function png(width: number, height: number, shapes: Shape[]): Uint8Array<ArrayBuffer> {
  // One filter byte (0, none) starts every row.
  const stride = width + 1;
  const rows = new Uint8Array(height * stride);
  for (const [kind, left, top, w, h, color] of shapes) {
    for (let y = Math.max(top, 0); y < Math.min(top + h, height); y++) {
      for (let x = Math.max(left, 0); x < Math.min(left + w, width); x++) {
        const dx = (x + 0.5 - left) / w - 0.5;
        const dy = (y + 0.5 - top) / h - 0.5;
        if (kind === "rect" || dx * dx + dy * dy <= 0.25) rows[y * stride + 1 + x] = color;
      }
    }
  }

  const header = new Uint8Array(13);
  const view = new DataView(header.buffer);
  view.setUint32(0, width);
  view.setUint32(4, height);
  header.set([8, 3, 0, 0, 0], 8); // 8 bits per pixel, palette colour, no interlace

  const palette = new Uint8Array(PALETTE.flatMap((rgb) => [rgb >>> 16, (rgb >>> 8) & 255, rgb & 255]));
  const signature = new Uint8Array([137, 80, 78, 71, 13, 10, 26, 10]);
  return join([signature, chunk("IHDR", header), chunk("PLTE", palette), chunk("IDAT", zlibStored(rows)), chunk("IEND", new Uint8Array(0))]);
}

function chunk(type: string, data: Uint8Array): Uint8Array<ArrayBuffer> {
  const out = new Uint8Array(12 + data.length);
  const view = new DataView(out.buffer);
  view.setUint32(0, data.length);
  out.set(new TextEncoder().encode(type), 4);
  out.set(data, 8);
  view.setUint32(8 + data.length, crc32(out.subarray(4, 8 + data.length)));
  return out;
}

function zlibStored(data: Uint8Array): Uint8Array<ArrayBuffer> {
  const BLOCK = 65535;
  const blocks = Math.max(Math.ceil(data.length / BLOCK), 1);
  const out = new Uint8Array(2 + blocks * 5 + data.length + 4);
  out.set([0x78, 0x01]);
  let offset = 2;
  for (let index = 0; index < blocks; index++) {
    const part = data.subarray(index * BLOCK, (index + 1) * BLOCK);
    out.set([index === blocks - 1 ? 1 : 0, part.length & 255, part.length >>> 8, ~part.length & 255, (~part.length >>> 8) & 255], offset);
    out.set(part, offset + 5);
    offset += 5 + part.length;
  }
  let a = 1;
  let b = 0;
  for (const byte of data) {
    a = (a + byte) % 65521;
    b = (b + a) % 65521;
  }
  new DataView(out.buffer).setUint32(offset, ((b << 16) | a) >>> 0);
  return out;
}

const CRC_TABLE = Array.from({ length: 256 }, (_, n) => {
  let c = n;
  for (let bit = 0; bit < 8; bit++) c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1;
  return c >>> 0;
});

function crc32(data: Uint8Array): number {
  let crc = 0xffffffff;
  for (const byte of data) crc = CRC_TABLE[(crc ^ byte) & 255] ^ (crc >>> 8);
  return (crc ^ 0xffffffff) >>> 0;
}

function join(parts: Uint8Array[]): Uint8Array<ArrayBuffer> {
  const out = new Uint8Array(parts.reduce((total, part) => total + part.length, 0));
  let offset = 0;
  for (const part of parts) {
    out.set(part, offset);
    offset += part.length;
  }
  return out;
}

/** A one-page PDF with a few lines of plain ASCII text. */
function pdf(lines: string[]): Uint8Array<ArrayBuffer> {
  const text = lines.map((line) => `(${line.replace(/[^\x20-\x7e]/g, "?").replace(/[\\()]/g, "\\$&")}) Tj T*`).join(" ");
  const content = `BT /F1 16 Tf 72 708 Td 26 TL ${text} ET`;
  const objects = [
    "<< /Type /Catalog /Pages 2 0 R >>",
    "<< /Type /Pages /Kids [3 0 R] /Count 1 >>",
    "<< /Type /Page /Parent 2 0 R /MediaBox [0 0 612 792] /Contents 4 0 R /Resources << /Font << /F1 5 0 R >> >> >>",
    `<< /Length ${content.length} >>\nstream\n${content}\nendstream`,
    "<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica >>",
  ];

  let file = "%PDF-1.4\n";
  const offsets = objects.map((body, index) => {
    const offset = file.length;
    file += `${index + 1} 0 obj\n${body}\nendobj\n`;
    return offset;
  });
  const xref = file.length;
  file += `xref\n0 ${objects.length + 1}\n0000000000 65535 f \n`;
  file += offsets.map((offset) => `${String(offset).padStart(10, "0")} 00000 n \n`).join("");
  file += `trailer\n<< /Size ${objects.length + 1} /Root 1 0 R >>\nstartxref\n${xref}\n%%EOF\n`;
  // ASCII only, so one character is one byte and the offsets above hold.
  return new TextEncoder().encode(file);
}

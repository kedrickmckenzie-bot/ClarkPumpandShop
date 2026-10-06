import { expect, it } from "vitest";
import { pickRelevantPages, splitTextPages, saveDocumentPages, extractDocumentPages } from "@/lib/ops/document-pages";
import { showcaseDocuments } from "@/lib/ops/showcase-documents";
import { createOpsFixtureRepository } from "@/lib/ops/fixture-repository";
import { buildShowcaseFixture } from "@/lib/ops/showcase-fixture";

const beerCave = showcaseDocuments["org-northline-demo/showcase-v1/beer-cave-troubleshooting.txt"].text;
const rtu = showcaseDocuments["org-northline-demo/showcase-v1/rtu-service-guide.txt"].text;

it("keeps a document's own page numbers, and cuts unmarked text into parts", () => {
  const pages = splitTextPages(beerCave);
  expect(pages.map(p => p.pageLabel)).toEqual(["Page 1", "Page 3", "Page 5", "Page 8", "Page 10", "Page 12"]);
  expect(pages.find(p => p.pageNumber === 8)?.text).toContain("defrost termination switch");
  expect(splitTextPages(showcaseDocuments["org-northline-demo/showcase-v1/ice-machine-wiring-sheet.txt"].text).map(p => p.pageLabel)).toEqual(["Sheet 1", "Sheet 2", "Sheet 3"]);
  const long = splitTextPages("x".repeat(7000));
  expect(long.map(p => p.pageLabel)).toEqual(["Part 1", "Part 2", "Part 3"]);
  expect(splitTextPages("   ")).toEqual([]);
});

it("picks the pages that match the question", () => {
  const pages = [...splitTextPages(beerCave).map(p => ({ ...p, documentId: "cave" })), ...splitTextPages(rtu).map(p => ({ ...p, documentId: "rtu" }))];
  const top = (q: string) => pickRelevantPages(pages, q, { max: 2 }).map(p => `${p.documentId} ${p.pageLabel}`);
  expect(top("coil keeps icing up, is it the defrost?")[0]).toBe("cave Page 8");
  expect(top("compressor trips off, terminal connections loose")[0]).toBe("cave Page 10");
  expect(top("control board flashing 2 flashes")[0]).toBe("rtu Page 13");
  expect(top("the the and")).toEqual([]);
  expect(pickRelevantPages(pages, "defrost compressor coil", { max: 4, maxChars: 900 }).reduce((n, p) => n + p.text.length, 0)).toBeLessThanOrEqual(900);
});

it("reads text files by type, has no text for pictures, and saves pages once", async () => {
  expect((await extractDocumentPages("text/plain", new TextEncoder().encode(beerCave).buffer)).length).toBe(6);
  expect(await extractDocumentPages("image/png", new ArrayBuffer(8))).toEqual([]);
  const fixture = buildShowcaseFixture("2026-10-05T12:00:00.000Z"), org = "org-northline-demo";
  const repository = createOpsFixtureRepository(fixture);
  const documentId = fixture.equipmentDocuments![0].id;
  await saveDocumentPages(repository, org, documentId, splitTextPages(beerCave), "2026-10-05T12:00:00.000Z");
  await saveDocumentPages(repository, org, documentId, splitTextPages(beerCave), "2026-10-05T12:00:00.000Z");
  expect((await repository.listDocumentPages(org, [documentId])).map(p => p.pageNumber)).toEqual([1, 3, 5, 8, 10, 12]);
  expect(await repository.listDocumentPages("another-org", [documentId])).toEqual([]);
  const picture = fixture.equipmentDocuments![1].id;
  await saveDocumentPages(repository, org, picture, [], "2026-10-05T12:00:00.000Z");
  expect(await repository.listDocumentPages(org, [picture])).toEqual([{ documentId: picture, pageNumber: 0, pageLabel: "No readable text", text: "" }]);
});

/** A tiny two-page PDF written by hand, so the real PDF reader is exercised without a binary fixture. */
function twoPagePdf(first: string, second: string) {
  const objects = [
    "<< /Type /Catalog /Pages 2 0 R >>",
    "<< /Type /Pages /Kids [3 0 R 5 0 R] /Count 2 >>",
    "<< /Type /Page /Parent 2 0 R /MediaBox [0 0 300 200] /Contents 4 0 R /Resources << /Font << /F1 7 0 R >> >> >>",
    `<< /Length ${`BT /F1 12 Tf 20 150 Td (${first}) Tj ET`.length} >>\nstream\nBT /F1 12 Tf 20 150 Td (${first}) Tj ET\nendstream`,
    "<< /Type /Page /Parent 2 0 R /MediaBox [0 0 300 200] /Contents 6 0 R /Resources << /Font << /F1 7 0 R >> >> >>",
    `<< /Length ${`BT /F1 12 Tf 20 150 Td (${second}) Tj ET`.length} >>\nstream\nBT /F1 12 Tf 20 150 Td (${second}) Tj ET\nendstream`,
    "<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica >>",
  ];
  let body = "%PDF-1.4\n";
  const offsets: number[] = [];
  objects.forEach((object, index) => { offsets.push(body.length); body += `${index + 1} 0 obj\n${object}\nendobj\n`; });
  const xref = body.length;
  body += `xref\n0 ${objects.length + 1}\n0000000000 65535 f \n${offsets.map(o => `${String(o).padStart(10, "0")} 00000 n \n`).join("")}trailer\n<< /Size ${objects.length + 1} /Root 1 0 R >>\nstartxref\n${xref}\n%%EOF\n`;
  return new TextEncoder().encode(body).buffer;
}

it("reads a real PDF page by page", async () => {
  const pages = await extractDocumentPages("application/pdf", twoPagePdf("Defrost timer 4 per day", "Oil level 1/4 to 1/2 sight glass"));
  expect(pages.map(p => p.pageLabel)).toEqual(["Page 1", "Page 2"]);
  expect(pages[1].text).toContain("sight glass");
  expect(pickRelevantPages(pages.map(p => ({ ...p, documentId: "d" })), "what oil level in the sight glass")[0].pageNumber).toBe(2);
}, 30_000);

import type { OpsRepository } from "./repository";

/** One page of readable text from a knowledge-base document. Page 0 with empty text records "no readable text". */
export interface DocumentPage {
  documentId: string;
  pageNumber: number;
  pageLabel: string;
  text: string;
}

const PAGE_TEXT_LIMIT = 12000;
const PART_SIZE = 3000;

/**
 * Splits plain text into pages. Text with "--- Page 7 — Title ---" style markers keeps those page numbers;
 * other text is cut into parts so one long file never reaches the AI whole.
 */
export function splitTextPages(text: string): Omit<DocumentPage, "documentId">[] {
  const marker = /^---\s*(Page|Sheet)\s+(\d+)\b[^\n]*$/gim;
  const marks = [...text.matchAll(marker)];
  if (marks.length) {
    return marks.map((mark, index) => {
      const end = index + 1 < marks.length ? marks[index + 1].index : text.length;
      return { pageNumber: Number(mark[2]), pageLabel: `${mark[1][0].toUpperCase()}${mark[1].slice(1).toLowerCase()} ${mark[2]}`, text: text.slice(mark.index, end).trim().slice(0, PAGE_TEXT_LIMIT) };
    }).filter((page, index, all) => page.pageNumber > 0 && all.findIndex(other => other.pageNumber === page.pageNumber) === index);
  }
  const clean = text.trim();
  if (!clean) return [];
  const parts: Omit<DocumentPage, "documentId">[] = [];
  for (let start = 0, n = 1; start < clean.length; start += PART_SIZE, n++) parts.push({ pageNumber: n, pageLabel: `Part ${n}`, text: clean.slice(start, start + PART_SIZE) });
  return parts.slice(0, 400);
}

/** Pulls text from a PDF page by page. Scanned PDFs (pictures of pages) return no text. */
export async function pdfPages(bytes: ArrayBuffer): Promise<Omit<DocumentPage, "documentId">[]> {
  const { extractText, getDocumentProxy } = await import("unpdf");
  const pdf = await getDocumentProxy(new Uint8Array(bytes));
  const { text } = await extractText(pdf, { mergePages: false });
  return text.slice(0, 1000)
    .map((page, index) => ({ pageNumber: index + 1, pageLabel: `Page ${index + 1}`, text: page.replace(/[ \t]+/g, " ").replace(/\n{3,}/g, "\n\n").trim().slice(0, PAGE_TEXT_LIMIT) }))
    .filter(page => page.text.length > 0);
}

/** Reads a stored document into pages by its file type. Pictures have no text yet. */
export async function extractDocumentPages(contentType: string, bytes: ArrayBuffer) {
  if (contentType === "application/pdf") return pdfPages(bytes);
  if (contentType.startsWith("text/")) return splitTextPages(new TextDecoder().decode(bytes));
  return [];
}

const STOP_WORDS = new Set("the and for are but not you your with this that what when where which who how why was were has have had its it's from they them then than there their about into onto over under just also very can could would should will what's does did doing done any all out off our only some more most other such same too get got been being check checked whats dont don't isnt isn't".split(" "));

function words(text: string) {
  return text.toLowerCase().replace(/[^a-z0-9°.\-/ ]+/g, " ").split(/\s+/).map(word => word.replace(/^[.\-/]+|[.\-/]+$/g, "")).filter(word => word.length >= 3 && !STOP_WORDS.has(word));
}

/**
 * Picks the pages most related to the question with a simple word-match score that favors rarer words.
 * No AI is used here, so it works the same with any AI provider and costs nothing.
 */
export function pickRelevantPages(pages: DocumentPage[], question: string, options: { max?: number; maxChars?: number } = {}) {
  const max = options.max ?? 4, maxChars = options.maxChars ?? 7000;
  const readable = pages.filter(page => page.text);
  const terms = [...new Set(words(question))];
  if (!terms.length || !readable.length) return [];
  const pageWords = readable.map(page => new Set(words(page.text)));
  const weight = new Map(terms.map(term => [term, Math.log(1 + readable.length / (1 + pageWords.filter(set => set.has(term)).length))]));
  const scored = readable
    .map((page, index) => ({ page, score: terms.reduce((sum, term) => sum + (pageWords[index].has(term) ? weight.get(term)! : 0), 0) }))
    .filter(row => row.score > 0)
    .sort((a, b) => b.score - a.score || a.page.pageNumber - b.page.pageNumber);
  const picked: DocumentPage[] = [];
  let used = 0;
  for (const { page } of scored) {
    if (picked.length >= max) break;
    const text = page.text.slice(0, Math.max(0, maxChars - used));
    if (text.length < 200 && picked.length) break;
    picked.push({ ...page, text });
    used += text.length;
  }
  return picked;
}

/** Saves a document's pages once. A second save of the same document is ignored. */
export async function saveDocumentPages(repository: OpsRepository, organizationId: string, documentId: string, pages: Omit<DocumentPage, "documentId">[], now: string) {
  if ((await repository.listDocumentPages(organizationId, [documentId])).length) return;
  const rows = pages.length ? pages : [{ pageNumber: 0, pageLabel: "No readable text", text: "" }];
  try {
    await repository.atomicWrite(rows.map(page => ({
      sql: "INSERT INTO ops_equipment_document_pages (id, organization_id, document_id, page_number, page_label, text, created_at) VALUES (?, ?, ?, ?, ?, ?, ?)",
      params: [`document-page-${crypto.randomUUID()}`, organizationId, documentId, page.pageNumber, page.pageLabel, page.text, now],
    })));
  } catch (error) {
    // Another request read the same document at the same moment; its pages are already saved.
    if ((await repository.listDocumentPages(organizationId, [documentId])).length) return;
    throw error;
  }
}

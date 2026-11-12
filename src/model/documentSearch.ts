import type { DocumentRef } from "./source";

/** What a document is called in lists: its name and queue position, which also
 * tells apart documents that share a name. */
export const documentLabel = (d: DocumentRef): string => `${d.name} (#${d.order})`;

/**
 * The documents matching a search, in queue order. Every whitespace-separated
 * word of `query` must appear (any case) in the document's name or queue
 * position, in any order, so "ruling 3" finds "ruling-a.html (#3)". An empty
 * query matches everything.
 */
export function searchDocuments(documents: DocumentRef[], query: string): DocumentRef[] {
  const words = query.toLowerCase().split(/\s+/).filter(Boolean);
  if (!words.length) return documents;
  return documents.filter((d) => {
    const haystack = `${d.name} #${d.order}`.toLowerCase();
    return words.every((w) => haystack.includes(w));
  });
}

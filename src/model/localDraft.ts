import type { Annotation, DocumentAnnotation } from "../types";

export interface DocumentDraft {
  annotations: Annotation[];
  documentAnnotations: DocumentAnnotation[];
  confidence: number;
}

/**
 * A localStorage-backed buffer for the CURRENT document's in-progress edits —
 * protects against a crash or reload before the annotator has clicked
 * Save/Next/Back at all. Scoped to one document at a time, unlike the
 * queue-wide cache in bulkSource.ts.
 */
export function loadDraft(key: string): DocumentDraft | null {
  const raw = localStorage.getItem(key);
  return raw ? JSON.parse(raw) : null;
}

export function saveDraft(key: string, draft: DocumentDraft): void {
  localStorage.setItem(key, JSON.stringify(draft));
}

export function clearDraft(key: string): void {
  localStorage.removeItem(key);
}

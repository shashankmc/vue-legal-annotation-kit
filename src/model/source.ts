import type { Assignment, AnnotationDocument, TaskData } from "../types";

export interface AssignmentBundle {
  document: AnnotationDocument;
  assignment: Assignment;
}

/** A lightweight identifier for one document in the annotator's queue — enough
 * to populate the document-relation target picker without loading any
 * document's full text or annotations. */
export interface DocumentRef {
  name: string;
  order: number;
}

/** One other document's relation pointing at the document being asked about —
 * for the read-only "Linked by" display, not stored anywhere itself. */
export interface IncomingRelation {
  /** Name of the document that created the relation. */
  from: string;
  labels: string[];
}

/**
 * The host's data-access contract. The package only ever asks for "the
 * assignment at this position" and "persist this assignment" — whether that
 * resolves via a network call per document or an instant in-memory lookup
 * (because the host bulk-loaded everything upfront) is entirely up to the
 * implementation. See createBulkSource for the bulk case.
 */
export interface AnnotationSource {
  /** Total documents in this annotator's queue. */
  total: number;
  /** Load the assignment + its document at this 1-based queue position. */
  load(position: number): Promise<AssignmentBundle>;
  /** Persist the given assignment's annotations, confidence and status. */
  save(assignment: Assignment): Promise<void>;
  /**
   * List the annotator's queue (in queue order) as lightweight name/order
   * refs — used only to populate the document-relation target picker, so it
   * loads no full text or annotations. Optional: hosts that omit it simply
   * won't surface the document-relations UI.
   */
  listDocuments?(): Promise<DocumentRef[]> | DocumentRef[];
  /**
   * List other documents whose own `document_relations` point at `toName` —
   * purely for the read-only "Linked by" display; nothing is written to
   * `toName`'s own assignment for these. Optional: hosts that omit it simply
   * won't show a "Linked by" section.
   */
  listIncomingRelations?(toName: string): Promise<IncomingRelation[]> | IncomingRelation[];
  /**
   * Called once the annotator advances past the last document. Optional —
   * sources that buffer locally (e.g. an offline cache) can use this to flush
   * or clear their state; sources backed by a real save-per-document backend
   * have nothing to do here and can omit it.
   */
  finish?(): Promise<void> | void;
}

/** Flatten a task file into one annotator's ordered queue of bundles. */
export function flattenAssignments(task: TaskData, annotatorId: number): AssignmentBundle[] {
  const bundles: AssignmentBundle[] = [];
  for (const doc of task.documents) {
    for (const assignment of doc.assignments) {
      if (assignment.annotator === annotatorId) {
        bundles.push({
          document: { name: doc.name, full_text: doc.full_text },
          assignment,
        });
      }
    }
  }
  return bundles.sort((a, b) => a.assignment.order - b.assignment.order);
}

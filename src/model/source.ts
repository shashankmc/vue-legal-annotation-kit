import type { Assignment, AnnotationDocument } from "../types";

export interface AssignmentBundle {
  document: AnnotationDocument;
  assignment: Assignment;
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
}

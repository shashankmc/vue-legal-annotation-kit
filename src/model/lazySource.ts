import type { Assignment } from "../types";
import type {
  AnnotationSource,
  AssignmentBundle,
  DocumentRef,
  IncomingRelation,
} from "./source";

/**
 * The functions a host supplies to back an AnnotationSource with an external
 * backend — one network call per document, nothing bulk-loaded upfront.
 * Mirrors AnnotationSource; `total` is a function here because a real backend
 * needs a round-trip to answer it, resolved once by createLazySource.
 */
export interface LazySourceDelegate {
  total(): Promise<number>;
  load(position: number): Promise<AssignmentBundle>;
  save(assignment: Assignment): Promise<void>;
  listDocuments?(): Promise<DocumentRef[]>;
  listIncomingRelations?(toName: string): Promise<IncomingRelation[]>;
  finish?(): Promise<void>;
}

/**
 * An AnnotationSource backed by a delegate talking to an external backend
 * (e.g. Supabase) — every call is a network round-trip; nothing is cached or
 * bulk-loaded, unlike createBulkSource. Resolves `total` once up front since
 * AnnotatorQueue reads it synchronously at setup.
 */
export async function createLazySource(delegate: LazySourceDelegate): Promise<AnnotationSource> {
  const total = await delegate.total();
  return { ...delegate, total };
}

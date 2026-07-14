import type { TaskData } from "../types";
import type { AnnotationSource } from "./source";
import { flattenAssignments } from "./source";

/**
 * An AnnotationSource backed entirely by an already-loaded task file — no
 * network calls. For a host that would rather fetch the whole task once and
 * let the annotator move through it locally, saving only updates the in-memory
 * copy; flushing it to a backend (once, or per-save) is the host's choice.
 * Note: this keeps state in a JS closure only — a page refresh loses it. For a
 * host with no backend at all, see createOfflineSource instead.
 */
export function createBulkSource(task: TaskData, annotatorId: number): AnnotationSource {
  const queue = flattenAssignments(task, annotatorId);

  return {
    total: queue.length,
    async load(position) {
      const bundle = queue[position - 1];
      if (!bundle) throw new Error(`No assignment at position ${position}`);
      return bundle;
    },
    async save(assignment) {
      const bundle = queue.find((b) => b.assignment.order === assignment.order);
      if (bundle) bundle.assignment = assignment;
    },
  };
}

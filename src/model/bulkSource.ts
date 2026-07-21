import type { TaskData } from "../types";
import type { AnnotationSource, AssignmentBundle, IncomingRelation } from "./source";
import { flattenAssignments } from "./source";

/**
 * An AnnotationSource backed entirely by an already-loaded task file — for
 * hosts with no backend to save to. Every save mirrors to localStorage so work
 * survives a page refresh; construction resumes from that cache if present.
 * On completion, `finish()` prints everything accumulated and clears the
 * cache. Browser-only (reads localStorage at creation time).
 */
export function createBulkSource(
  task: TaskData,
  annotatorId: number,
  storageKey = `lak:bulk:${task.name}:${annotatorId}`,
): AnnotationSource {
  const cached = localStorage.getItem(storageKey);
  const bundles: AssignmentBundle[] = cached
    ? JSON.parse(cached)
    : flattenAssignments(task, annotatorId);

  const persist = () => localStorage.setItem(storageKey, JSON.stringify(bundles));
  if (!cached) persist();

  return {
    total: bundles.length,
    async load(position) {
      const bundle = bundles[position - 1];
      if (!bundle) throw new Error(`No assignment at position ${position}`);
      return bundle;
    },
    async save(assignment) {
      const bundle = bundles.find((b) => b.assignment.order === assignment.order);
      if (bundle) {
        bundle.assignment = assignment;
        persist();
      }
    },
    listDocuments() {
      // Already in queue order (flattenAssignments sorts by order).
      return bundles.map((b) => ({
        name: b.document.name,
        order: b.assignment.order,
      }));
    },
    listIncomingRelations(toName) {
      const incoming: IncomingRelation[] = [];
      for (const b of bundles) {
        for (const r of b.assignment.document_relations) {
          if (r.to === toName) incoming.push({ from: b.document.name, labels: r.labels });
        }
      }
      return incoming;
    },
    finish() {
      console.log(JSON.parse(localStorage.getItem(storageKey) ?? "null"));
      localStorage.removeItem(storageKey);
    },
  };
}

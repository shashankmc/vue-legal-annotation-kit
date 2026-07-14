import type { TaskData } from "../types";
import type { AnnotationSource, AssignmentBundle } from "./source";
import { flattenAssignments } from "./source";

/**
 * A bulk AnnotationSource that mirrors every save to localStorage, so work
 * survives a page refresh even with no backend behind it — for hosts working
 * fully offline. Resumes from the cache if present; on completion, `finish()`
 * prints everything accumulated and clears the cache. Browser-only (reads
 * localStorage at creation time).
 */
export function createOfflineSource(
  task: TaskData,
  annotatorId: number,
  storageKey = `lak:offline:${task.name}:${annotatorId}`,
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
    finish() {
      console.log(JSON.parse(localStorage.getItem(storageKey) ?? "null"));
      localStorage.removeItem(storageKey);
    },
  };
}

import { ref } from "vue";
import type { Assignment } from "../types";
import type { AnnotationSource, AssignmentBundle } from "./source";

/**
 * Drives navigation through an annotator's assignment queue via an
 * AnnotationSource. Owns position/loading state only — it has no idea whether
 * the source resolves from memory or the network, and doesn't need to.
 */
export function useAssignmentQueue(source: AnnotationSource, startPosition = 1) {
  const position = ref(startPosition);
  const bundle = ref<AssignmentBundle | null>(null);
  const loading = ref(false);
  const error = ref<unknown>(null);

  async function goTo(pos: number) {
    if (pos < 1 || pos > source.total) return;
    loading.value = true;
    error.value = null;
    try {
      bundle.value = await source.load(pos);
      position.value = pos;
    } catch (e) {
      error.value = e;
    } finally {
      loading.value = false;
    }
  }

  async function save(assignment: Assignment) {
    await source.save(assignment);
  }

  return { position, total: source.total, bundle, loading, error, goTo, save };
}

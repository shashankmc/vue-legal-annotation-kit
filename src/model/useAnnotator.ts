import { ref } from "vue";
import type { Annotation, Label } from "../types";
import { isDuplicate, nextTempId } from "./spans";

/**
 * Annotation state for one document. Holds the working copy of the annotations,
 * the label currently armed for the next selection, and which region is
 * selected. Rendering and DOM concerns live elsewhere.
 */
export function useAnnotator(initial: Annotation[]) {
  const annotations = ref<Annotation[]>([...initial]);
  const activeLabel = ref<Label | null>(null);
  const selectedId = ref<number | null>(null);
  const dirty = ref(false);

  /** Create a span with the active label. Returns the new annotation, or null
   * if there is no active label or the exact range is already labelled. */
  function createSpan(start: number, end: number, text: string): Annotation | null {
    const label = activeLabel.value;
    if (!label) return null;
    if (isDuplicate(annotations.value, label.name, start, end)) return null;

    const annotation: Annotation = {
      id: nextTempId(annotations.value),
      start,
      end,
      label: label.name,
      text,
      relations: [],
      confidence: 0,
      metadata: null,
    };
    annotations.value.push(annotation);
    selectedId.value = annotation.id;
    dirty.value = true;
    return annotation;
  }

  function remove(id: number) {
    annotations.value = annotations.value.filter((a) => a.id !== id);
    if (selectedId.value === id) selectedId.value = null;
    dirty.value = true;
  }

  function select(id: number | null) {
    selectedId.value = id;
  }

  return { annotations, activeLabel, selectedId, dirty, createSpan, remove, select };
}

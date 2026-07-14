import { ref } from "vue";
import type { Annotation, Label, RelationDirection } from "../types";
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
  /** Source annotation while the user is drawing a relation, else null. */
  const linkingFrom = ref<number | null>(null);

  const find = (id: number) => annotations.value.find((a) => a.id === id);

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
    // Drop relations that pointed at the removed annotation.
    for (const a of annotations.value)
      a.relations = a.relations.filter((r) => r.to !== id);
    if (selectedId.value === id) selectedId.value = null;
    if (linkingFrom.value === id) linkingFrom.value = null;
    dirty.value = true;
  }

  function select(id: number | null) {
    selectedId.value = id;
  }

  /** Begin drawing a relation from `id`. */
  function startLinking(id: number) {
    linkingFrom.value = id;
  }

  /** Finish a relation at `targetId` (no self-links, no duplicates). */
  function linkTo(targetId: number) {
    const from = linkingFrom.value;
    linkingFrom.value = null;
    if (from === null || from === targetId) return;
    const source = find(from);
    if (!source || source.relations.some((r) => r.to === targetId)) return;
    source.relations.push({ to: targetId, direction: "right", labels: [] });
    dirty.value = true;
  }

  function removeRelation(fromId: number, toId: number) {
    const source = find(fromId);
    if (!source) return;
    source.relations = source.relations.filter((r) => r.to !== toId);
    dirty.value = true;
  }

  function setRelationDirection(
    fromId: number,
    toId: number,
    direction: RelationDirection,
  ) {
    const rel = find(fromId)?.relations.find((r) => r.to === toId);
    if (rel) {
      rel.direction = direction;
      dirty.value = true;
    }
  }

  function setRelationLabels(fromId: number, toId: number, labels: string[]) {
    const rel = find(fromId)?.relations.find((r) => r.to === toId);
    if (rel) {
      rel.labels = labels;
      dirty.value = true;
    }
  }

  return {
    annotations,
    activeLabel,
    selectedId,
    dirty,
    linkingFrom,
    createSpan,
    remove,
    select,
    startLinking,
    linkTo,
    removeRelation,
    setRelationDirection,
    setRelationLabels,
  };
}

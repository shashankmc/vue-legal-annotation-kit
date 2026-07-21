import { ref } from "vue";
import type {
  Annotation,
  DocumentAnnotation,
  DocumentRelation,
  Label,
  RelationDirection,
} from "../types";
import { isDuplicate, nextTempId } from "./spans";

/**
 * Annotation state for one document. Holds the working copy of the annotations,
 * the label currently armed for the next selection, and which region is
 * selected. Rendering and DOM concerns live elsewhere.
 */
export function useAnnotator(
  initial: Annotation[],
  initialDocumentAnnotations: DocumentAnnotation[] = [],
  initialDocumentRelations: DocumentRelation[] = [],
) {
  const annotations = ref<Annotation[]>([...initial]);
  const documentAnnotations = ref<DocumentAnnotation[]>([...initialDocumentAnnotations]);
  const documentRelations = ref<DocumentRelation[]>([...initialDocumentRelations]);
  const activeLabel = ref<Label | null>(null);
  const selectedId = ref<number | null>(null);
  const selectedDocumentAnnotationId = ref<number | null>(null);
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

  /** Toggle a whole-document label: adds it if absent, removes it if already
   * applied. Document-level tags carry no offsets, so there is no "same range"
   * duplicate rule — just one entry per label. */
  function toggleDocumentLabel(label: Label) {
    const existing = documentAnnotations.value.find((d) => d.label === label.name);
    if (existing) {
      documentAnnotations.value = documentAnnotations.value.filter((d) => d.id !== existing.id);
      if (selectedDocumentAnnotationId.value === existing.id) selectedDocumentAnnotationId.value = null;
    } else {
      const tag: DocumentAnnotation = {
        id: nextTempId(documentAnnotations.value),
        label: label.name,
        confidence: 0,
      };
      documentAnnotations.value.push(tag);
      selectedDocumentAnnotationId.value = tag.id;
    }
    dirty.value = true;
  }

  function removeDocumentAnnotation(id: number) {
    documentAnnotations.value = documentAnnotations.value.filter((d) => d.id !== id);
    if (selectedDocumentAnnotationId.value === id) selectedDocumentAnnotationId.value = null;
    dirty.value = true;
  }

  function selectDocumentAnnotation(id: number | null) {
    selectedDocumentAnnotationId.value = id;
  }

  /** Set the confidence rating (0–5) of one document-level tag. */
  function setDocumentAnnotationConfidence(id: number, value: number) {
    const d = documentAnnotations.value.find((d) => d.id === id);
    if (d) {
      d.confidence = value;
      dirty.value = true;
    }
  }

  // --- Document-to-document relations (keyed by target document name, one
  // entry per target). Always "this document links to the target" — stored
  // only here, never on the target. --------------------------------------
  const findDocRelation = (toName: string) =>
    documentRelations.value.find((r) => r.to === toName);

  /** Point the current document at another (no duplicate targets). */
  function addDocumentRelation(toName: string) {
    if (!toName || findDocRelation(toName)) return;
    documentRelations.value.push({ to: toName, labels: [] });
    dirty.value = true;
  }

  function removeDocumentRelation(toName: string) {
    documentRelations.value = documentRelations.value.filter((r) => r.to !== toName);
    dirty.value = true;
  }

  function setDocumentRelationLabels(toName: string, labels: string[]) {
    const rel = findDocRelation(toName);
    if (rel) {
      rel.labels = labels;
      dirty.value = true;
    }
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

  /** Clear the dirty flag once the current state has been handed off to save. */
  function markSaved() {
    dirty.value = false;
  }

  /** Set the confidence rating (0–5) of one annotation. */
  function setConfidence(id: number, value: number) {
    const a = find(id);
    if (a) {
      a.confidence = value;
      dirty.value = true;
    }
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
    documentAnnotations,
    documentRelations,
    activeLabel,
    selectedId,
    selectedDocumentAnnotationId,
    dirty,
    linkingFrom,
    createSpan,
    remove,
    select,
    markSaved,
    setConfidence,
    startLinking,
    linkTo,
    removeRelation,
    setRelationDirection,
    setRelationLabels,
    toggleDocumentLabel,
    removeDocumentAnnotation,
    setDocumentAnnotationConfidence,
    selectDocumentAnnotation,
    addDocumentRelation,
    removeDocumentRelation,
    setDocumentRelationLabels,
  };
}

<script setup lang="ts">
import { computed, onBeforeUnmount, onMounted, ref, watch } from "vue";
import type {
  AnnotationDocument,
  AnnotationLevel,
  Assignment,
  Label,
  Labelset,
  QueuePosition,
} from "../types";
import type { DocumentRef, IncomingRelation } from "../model/source";
import AnnotatorHeader from "./AnnotatorHeader.vue";
import LabelSidebar from "./LabelSidebar.vue";
import DocumentPane from "./DocumentPane.vue";
import DocumentTextView from "./DocumentTextView.vue";
import InspectorPane from "./InspectorPane.vue";
import ConfirmModal from "./ConfirmModal.vue";
import { useAnnotator } from "../model/useAnnotator";
import { snapToLevel } from "../model/spans";
import { loadDraft, saveDraft, clearDraft } from "../model/localDraft";

// The annotator's workspace. Annotators move through their assigned documents
// in sequence (no free navigation); "next" means the current one is finished.
const props = defineProps<{
  document: AnnotationDocument;
  labelset: Labelset;
  annotationLevel: AnnotationLevel;
  assignment: Assignment;
  position: QueuePosition;
  /** Other queue documents this one can point at (document-relation targets). */
  otherDocuments?: DocumentRef[];
  /** Other documents' relations pointing at this one — read-only display. */
  incomingRelations?: IncomingRelation[];
  guidelinesUrl?: string;
}>();

// A task is either span-level or document-level, never both — this decides
// which half of the workspace (span tools vs. whole-document tags) renders.
const isDocumentLevel = computed(() => props.annotationLevel === "document");

const emit = defineEmits<{
  save: [assignment: Assignment];
  next: [assignment: Assignment];
  previous: [assignment: Assignment];
}>();

// A per-document local buffer: protects in-progress edits against a crash or
// reload before the annotator has clicked Save/Next/Back at all — separate
// from whatever the host's AnnotationSource does once that click happens.
const draftKey = `lak:draft:${props.document.name}:${props.assignment.annotator}:${props.assignment.order}`;
const existingDraft = loadDraft(draftKey);
// A resumed draft is itself unsaved work, even before useAnnotator's own
// dirty tracking sees any new edit.
const resumedUnsaved = ref(existingDraft !== null);

const {
  annotations,
  documentAnnotations,
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
  documentRelations,
  addDocumentRelation,
  removeDocumentRelation,
  setDocumentRelationLabels,
} = useAnnotator(
  existingDraft?.annotations ?? props.assignment.annotations,
  existingDraft?.documentAnnotations ?? props.assignment.document_annotations,
  existingDraft?.documentRelations ?? props.assignment.document_relations,
);

const selectedAnnotation = computed(
  () => annotations.value.find((a) => a.id === selectedId.value) ?? null,
);

const selectedDocumentAnnotation = computed(
  () => documentAnnotations.value.find((d) => d.id === selectedDocumentAnnotationId.value) ?? null,
);

// The sidebar's single "Annotation Confidence" widget rates whichever kind of
// annotation this task's mode selects — a span, or a document tag.
const hasSelection = computed(() =>
  isDocumentLevel.value ? selectedDocumentAnnotationId.value !== null : selectedId.value !== null,
);
const selectionConfidence = computed(() =>
  isDocumentLevel.value ? (selectedDocumentAnnotation.value?.confidence ?? 0) : (selectedAnnotation.value?.confidence ?? 0),
);
const setSelectionConfidence = (value: number) => {
  if (isDocumentLevel.value) {
    if (selectedDocumentAnnotationId.value !== null)
      setDocumentAnnotationConfidence(selectedDocumentAnnotationId.value, value);
  } else if (selectedId.value !== null) {
    setConfidence(selectedId.value, value);
  }
};

// Snap the raw browser selection to the task's declared granularity — e.g. a
// word-level task captures the whole word even if only part of it was
// dragged over — before it becomes the stored annotation.
const onCreate = (payload: { start: number; end: number; text: string }) => {
  const range = snapToLevel(props.document.full_text, props.annotationLevel, payload.start, payload.end);
  createSpan(range.start, range.end, props.document.full_text.slice(range.start, range.end));
};

const setActiveLabel = (label: Label) => {
  activeLabel.value = label;
};

// A region click completes a relation when one is being drawn, otherwise it
// just selects the region.
const onActivate = (id: number) =>
  linkingFrom.value !== null ? linkTo(id) : select(id);

// Document confidence is assignment-level.
const documentConfidence = ref(existingDraft?.confidence ?? props.assignment.confidence);
// The confidence value as of the last save — NOT the same as props, which
// stay frozen at mount and never refresh after a plain Save (only Next/Back
// remount this component). Synced in clearLocalState.
const savedConfidence = ref(props.assignment.confidence);

// Buffer every edit locally so a crash/reload can resume from here.
watch(
  [annotations, documentAnnotations, documentRelations, documentConfidence],
  () =>
    saveDraft(draftKey, {
      annotations: annotations.value,
      documentAnnotations: documentAnnotations.value,
      documentRelations: documentRelations.value,
      confidence: documentConfidence.value,
    }),
  { deep: true },
);

// True whenever there's something not yet handed off to save/next/previous —
// a resumed draft counts, as does any edit since (spans or confidence).
const hasUnsavedChanges = computed(
  () =>
    resumedUnsaved.value ||
    dirty.value ||
    documentConfidence.value !== savedConfidence.value,
);

// The assignment as it stands right now — the source of truth for
// save/next/previous, since the live edits live in useAnnotator, not in props.
const snapshot = computed<Assignment>(() => ({
  ...props.assignment,
  annotations: annotations.value,
  document_annotations: documentAnnotations.value,
  document_relations: documentRelations.value,
  confidence: documentConfidence.value,
}));

// A task is either span-level or document-level (see isDocumentLevel above),
// so only that half's data should count toward "has this been annotated".
const hasAnnotations = computed(() =>
  isDocumentLevel.value
    ? documentAnnotations.value.length > 0 || documentRelations.value.length > 0
    : annotations.value.length > 0,
);

const labelColors = computed(() =>
  Object.fromEntries(props.labelset.labels.map((l) => [l.name, l.color])),
);

// Save/Next/Back all hand the snapshot off to the host's AnnotationSource, so
// the local crash-recovery buffer is no longer needed once any of them fires.
const clearLocalState = () => {
  clearDraft(draftKey);
  markSaved();
  resumedUnsaved.value = false;
  savedConfidence.value = documentConfidence.value;
};

// Back/Next never lose work — they always save first, so there's nothing to
// confirm on the way out.
const onSaveClick = () => {
  clearLocalState();
  emit("save", snapshot.value);
  flashSaved();
};

const onPrevious = () => {
  clearLocalState();
  emit("previous", snapshot.value);
};

// Advancing marks the document done — gate on a genuinely empty document
// with the HTML modal instead of window.confirm. Only the first time
// (assignment still "pending"): once it's already "done" the annotator has
// already seen and accepted this, so re-visiting shouldn't nag again.
const showEmptyDocModal = ref(false);
const wasPending = props.assignment.status !== "done";

const advanceNext = () => {
  clearLocalState();
  emit("next", snapshot.value);
};

const onNext = () => {
  if (wasPending && !hasAnnotations.value) {
    showEmptyDocModal.value = true;
    return;
  }
  advanceNext();
};

const confirmEmptyNext = () => {
  showEmptyDocModal.value = false;
  advanceNext();
};

const cancelEmptyNext = () => {
  showEmptyDocModal.value = false;
};

// Brief "Saved ✓" state on the Save button after a manual save, as visual
// confirmation in place of any dialog.
const justSaved = ref(false);
let savedTimer: ReturnType<typeof setTimeout> | undefined;
const flashSaved = () => {
  justSaved.value = true;
  clearTimeout(savedTimer);
  savedTimer = setTimeout(() => {
    justSaved.value = false;
  }, 1400);
};

// Number keys arm a label: 1–9 for the first nine, 0 for the tenth. Only
// meaningful for span tasks — document-level tags have nothing to arm.
const onKey = (e: KeyboardEvent) => {
  if (isDocumentLevel.value) return;
  const el = e.target as HTMLElement | null;
  if (
    e.ctrlKey ||
    e.metaKey ||
    e.altKey ||
    el?.isContentEditable ||
    ["INPUT", "TEXTAREA", "SELECT"].includes(el?.tagName ?? "")
  )
    return;
  if (!/^[0-9]$/.test(e.key)) return;
  const index = e.key === "0" ? 9 : Number(e.key) - 1;
  const label = props.labelset.labels[index];
  if (label) {
    activeLabel.value = label;
    e.preventDefault();
  }
};

// Remind the annotator that unsaved work will be lost when leaving the page.
const warnIfUnsaved = (e: BeforeUnloadEvent) => {
  if (hasUnsavedChanges.value) e.preventDefault();
};
onMounted(() => {
  window.addEventListener("beforeunload", warnIfUnsaved);
  window.addEventListener("keydown", onKey);
});
onBeforeUnmount(() => {
  window.removeEventListener("beforeunload", warnIfUnsaved);
  window.removeEventListener("keydown", onKey);
  clearTimeout(savedTimer);
});
</script>

<template>
  <div class="lak-annotator">
    <AnnotatorHeader
      :status="assignment.status"
      :position="position"
      :annotation-level="annotationLevel"
      :document-name="document.name"
      :unsaved="hasUnsavedChanges"
      :just-saved="justSaved"
      @previous="onPrevious"
      @save="onSaveClick"
      @next="onNext"
    />

    <div class="lak-annotator__body">
      <LabelSidebar
        :labels="labelset.labels"
        :document-level="isDocumentLevel"
        :active-label="activeLabel"
        :has-selection="hasSelection"
        :annotation-confidence="selectionConfidence"
        :document-annotations="documentAnnotations"
        :guidelines-url="guidelinesUrl"
        v-model:document-confidence="documentConfidence"
        @select="setActiveLabel"
        @update:annotation-confidence="setSelectionConfidence"
        @toggle-document-label="toggleDocumentLabel"
      />
      <DocumentTextView v-if="isDocumentLevel" :text="document.full_text" />
      <DocumentPane
        v-else
        :text="document.full_text"
        :annotations="annotations"
        :colors="labelColors"
        :selected-id="selectedId"
        :linking="linkingFrom !== null"
        @create="onCreate"
        @select="onActivate"
      />
      <InspectorPane
        :document-level="isDocumentLevel"
        :annotations="annotations"
        :document-annotations="documentAnnotations"
        :document-relations="documentRelations"
        :incoming-relations="incomingRelations ?? []"
        :other-documents="otherDocuments ?? []"
        :colors="labelColors"
        :selected-id="selectedId"
        :selected-document-annotation-id="selectedDocumentAnnotationId"
        :linking-from="linkingFrom"
        @select="onActivate"
        @remove="remove"
        @select-document-annotation="selectDocumentAnnotation"
        @remove-document-annotation="removeDocumentAnnotation"
        @add-document-relation="addDocumentRelation"
        @remove-document-relation="removeDocumentRelation"
        @set-document-relation-labels="setDocumentRelationLabels"
        @link="startLinking"
        @remove-relation="removeRelation"
        @set-relation-direction="setRelationDirection"
        @set-relation-labels="setRelationLabels"
      />
    </div>

    <ConfirmModal
      v-if="showEmptyDocModal"
      title="No annotations yet"
      :message="'No annotations were made in this document.\nAre you sure you want to continue?'"
      confirm-label="Continue"
      cancel-label="Cancel"
      @confirm="confirmEmptyNext"
      @cancel="cancelEmptyNext"
    />
  </div>
</template>

<style scoped>
.lak-annotator {
  /* Self-contained theme — no global styles required by consumers. */
  --lak-accent: #1e4e79;
  --lak-success: #16a34a;
  --lak-danger: #dc2626;
  --lak-border: rgba(0, 0, 0, 0.12);
  --lak-sidebar-bg: #f1f1f1;
  --lak-progress-track: #e2e8f0;
  --lak-muted: #6b7280;
  --lak-star-empty: #d2cece;
  --lak-star-on: #f5b301;

  display: flex;
  flex-direction: column;
  height: 100%;
  min-height: 0;
  background: var(--lak-bg, #fff);
  color: #111;
  font-family: system-ui, sans-serif;
}
.lak-annotator__body {
  display: grid;
  grid-template-columns: 220px 1fr 320px;
  flex: 1;
  min-height: 0;
}
</style>

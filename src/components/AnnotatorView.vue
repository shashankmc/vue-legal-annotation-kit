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
import AnnotatorHeader from "./AnnotatorHeader.vue";
import LabelSidebar from "./LabelSidebar.vue";
import DocumentPane from "./DocumentPane.vue";
import DocumentTextView from "./DocumentTextView.vue";
import InspectorPane from "./InspectorPane.vue";
import { useAnnotator } from "../model/useAnnotator";
import { loadDraft, saveDraft, clearDraft } from "../model/localDraft";

// The annotator's workspace. Annotators move through their assigned documents
// in sequence (no free navigation); "next" means the current one is finished.
const props = defineProps<{
  document: AnnotationDocument;
  labelset: Labelset;
  annotationLevel: AnnotationLevel;
  assignment: Assignment;
  position: QueuePosition;
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
} = useAnnotator(
  existingDraft?.annotations ?? props.assignment.annotations,
  existingDraft?.documentAnnotations ?? props.assignment.document_annotations,
);

const selectedAnnotation = computed(
  () => annotations.value.find((a) => a.id === selectedId.value) ?? null,
);

const setAnnotationConfidence = (value: number) => {
  if (selectedId.value !== null) setConfidence(selectedId.value, value);
};

const onCreate = (payload: { start: number; end: number; text: string }) =>
  createSpan(payload.start, payload.end, payload.text);

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
  [annotations, documentAnnotations, documentConfidence],
  () =>
    saveDraft(draftKey, {
      annotations: annotations.value,
      documentAnnotations: documentAnnotations.value,
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
  confidence: documentConfidence.value,
}));

const hasAnnotations = computed(
  () => annotations.value.length > 0 || documentAnnotations.value.length > 0,
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

// Back/Next move away from this document — confirm first if there's anything
// not yet handed off to a save (Save itself needs no such prompt).
const confirmUnsavedChanges = () =>
  !hasUnsavedChanges.value ||
  window.confirm("You have unsaved changes in this document.\nAre you sure you want to continue?");

const onSaveClick = () => {
  clearLocalState();
  emit("save", snapshot.value);
};

const onPrevious = () => {
  if (!confirmUnsavedChanges()) return;
  clearLocalState();
  emit("previous", snapshot.value);
};

const onNext = () => {
  if (!confirmUnsavedChanges()) return;
  // Advancing marks the document done — warn if nothing was annotated.
  if (
    !hasAnnotations.value &&
    !window.confirm(
      "No annotations were made in this document.\nAre you sure you want to continue?",
    )
  ) {
    return;
  }
  clearLocalState();
  emit("next", snapshot.value);
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
});
</script>

<template>
  <div class="lak-annotator">
    <AnnotatorHeader
      :status="assignment.status"
      :position="position"
      :guidelines-url="guidelinesUrl"
      @previous="onPrevious"
      @save="onSaveClick"
      @next="onNext"
    />

    <div class="lak-annotator__body">
      <LabelSidebar
        :labels="labelset.labels"
        :document-level="isDocumentLevel"
        :active-label="activeLabel"
        :has-selection="selectedId !== null"
        :annotation-confidence="selectedAnnotation?.confidence ?? 0"
        :document-annotations="documentAnnotations"
        v-model:document-confidence="documentConfidence"
        @select="setActiveLabel"
        @update:annotation-confidence="setAnnotationConfidence"
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
        :colors="labelColors"
        :selected-id="selectedId"
        :linking-from="linkingFrom"
        @select="onActivate"
        @remove="remove"
        @remove-document-annotation="removeDocumentAnnotation"
        @link="startLinking"
        @remove-relation="removeRelation"
        @set-relation-direction="setRelationDirection"
        @set-relation-labels="setRelationLabels"
      />
    </div>
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

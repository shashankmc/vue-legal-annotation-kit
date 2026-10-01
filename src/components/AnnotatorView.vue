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

/** Hands the assignment to the host. May return a promise: the view waits
 * for it, and keeps the work (local draft included) if it rejects. */
type AssignmentHandler = (assignment: Assignment) => Promise<void> | void;

// The annotator's workspace. Annotators move through their assigned documents
// in sequence (no free navigation); "next" means the current one is finished.
const props = withDefaults(
  defineProps<{
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
    /** Show progress and Back/Next. Off for one document outside a queue. */
    navigation?: boolean;
    /** Look, don't touch: no creating, editing, deleting or saving. */
    readonly?: boolean;
    // Declared as props rather than emits so the view can await what the host
    // returns — `@save="…"` in a parent template still binds to these.
    onSave?: AssignmentHandler;
    onNext?: AssignmentHandler;
    onPrevious?: AssignmentHandler;
  }>(),
  { navigation: true, readonly: false },
);

// A task is either span-level or document-level, never both — this decides
// which half of the workspace (span tools vs. whole-document tags) renders.
const isDocumentLevel = computed(() => props.annotationLevel === "document");

const emit = defineEmits<{
  /** A save/next/previous handler rejected. The work is still here. */
  "save-error": [error: unknown];
  /** Whether there is work not yet handed off — for a host's route guard. */
  unsaved: [value: boolean];
}>();

// A per-document local buffer: protects in-progress edits against a crash or
// reload before the annotator has clicked Save/Next/Back at all — separate
// from whatever the host's AnnotationSource does once that click happens.
const draftKey =
  props.assignment.id !== undefined
    ? `lak:draft:assignment:${props.assignment.id}`
    : `lak:draft:${props.document.name}:${props.assignment.annotator}:${props.assignment.order}`;
// Read-only views edit nothing, so they neither resume nor write a draft.
const existingDraft = props.readonly ? null : loadDraft(draftKey);
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
  setMetadata,
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
  if (props.readonly) return;
  const range = snapToLevel(props.document.full_text, props.annotationLevel, payload.start, payload.end);
  createSpan(range.start, range.end, props.document.full_text.slice(range.start, range.end));
};

const setActiveLabel = (label: Label) => {
  activeLabel.value = label;
};

// A region click completes a relation when one is being drawn, otherwise it
// just selects the region.
const onActivate = (id: number) =>
  linkingFrom.value !== null && !props.readonly ? linkTo(id) : select(id);

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
    !props.readonly &&
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

watch(hasUnsavedChanges, (value) => emit("unsaved", value), { immediate: true });

// Once the host has stored the snapshot, the local crash-recovery buffer is no
// longer needed. Not before: a save that fails must leave the work recoverable.
const clearLocalState = () => {
  clearDraft(draftKey);
  markSaved();
  resumedUnsaved.value = false;
  savedConfidence.value = documentConfidence.value;
};

const saving = ref(false);
const saveError = ref<string | null>(null);

/**
 * Hands a snapshot to the host and waits for it. Returns whether it was
 * stored. On failure nothing is cleared — the edits stay on screen and in the
 * local draft — and the reason is shown until the next attempt.
 */
const persist = async (handler: AssignmentHandler | undefined): Promise<boolean> => {
  if (props.readonly || saving.value) return false;
  const sent = snapshot.value;
  const sentAs = JSON.stringify(sent);
  saving.value = true;
  saveError.value = null;
  try {
    await handler?.(sent);
  } catch (e) {
    saveError.value = e instanceof Error && e.message ? e.message : "Saving failed.";
    emit("save-error", e);
    return false;
  } finally {
    saving.value = false;
  }
  // Only what was sent is saved. An edit made while the request was in
  // flight is still unsaved, so it keeps its draft and dirty flag.
  if (JSON.stringify(snapshot.value) === sentAs) clearLocalState();
  return true;
};

// Back/Next never lose work — they always save first, so there's nothing to
// confirm on the way out.
const onSaveClick = async () => {
  if (await persist(props.onSave)) flashSaved();
};

const onPrevious = () => persist(props.onPrevious);

// Advancing marks the document done — gate on a genuinely empty document
// with the HTML modal instead of window.confirm. Only the first time
// (assignment still "pending"): once it's already "done" the annotator has
// already seen and accepted this, so re-visiting shouldn't nag again.
const showEmptyDocModal = ref(false);
const wasPending = props.assignment.status !== "done";

const advanceNext = () => persist(props.onNext);

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
  if (isDocumentLevel.value || props.readonly) return;
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
  if (hasUnsavedChanges.value || saving.value) e.preventDefault();
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
      :navigation="navigation"
      :readonly="readonly"
      :saving="saving"
      @previous="onPrevious"
      @save="onSaveClick"
      @next="onNext"
    />

    <p v-if="saveError" class="lak-annotator__error" role="alert">
      <span>
        Your changes could not be saved: {{ saveError }} They are kept on this
        device, so you can try again or reload without losing them.
      </span>
      <button type="button" class="lak-annotator__error-close" aria-label="Dismiss" @click="saveError = null">
        ×
      </button>
    </p>

    <div class="lak-annotator__body">
      <LabelSidebar
        :labels="labelset.labels"
        :document-level="isDocumentLevel"
        :active-label="activeLabel"
        :has-selection="hasSelection"
        :annotation-confidence="selectionConfidence"
        :document-annotations="documentAnnotations"
        :guidelines-url="guidelinesUrl"
        :readonly="readonly"
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
        :readonly="readonly"
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
        :readonly="readonly"
        @select="onActivate"
        @set-metadata="setMetadata"
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
.lak-annotator__error {
  display: flex;
  align-items: flex-start;
  gap: 0.6rem;
  margin: 0 0.75rem 0.5rem;
  padding: 0.5rem 0.7rem;
  border: 1px solid #fecaca;
  border-radius: 6px;
  background: #fef2f2;
  color: #991b1b;
  font-size: 0.85rem;
}
.lak-annotator__error-close {
  margin-left: auto;
  background: none;
  border: none;
  font-size: 1.1rem;
  line-height: 1;
  color: inherit;
  cursor: pointer;
}
.lak-annotator__body {
  display: grid;
  grid-template-columns: 220px 1fr 320px;
  flex: 1;
  min-height: 0;
}
</style>

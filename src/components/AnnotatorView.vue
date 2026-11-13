<script setup lang="ts">
import { computed, onBeforeUnmount, onMounted, ref, watch } from "vue";
import type {
  Annotation,
  AnnotationDocument,
  AnnotationLevel,
  Assignment,
  DocumentAnnotation,
  DocumentLabelMode,
  Label,
  Labelset,
  Proposal,
  QueuePosition,
  SpanProposal,
} from "../types";
import type { DocumentRef, IncomingRelation, RelationGraphRequest } from "../model/source";
import AnnotatorHeader from "./AnnotatorHeader.vue";
import LabelSidebar from "./LabelSidebar.vue";
import DocumentPane from "./DocumentPane.vue";
import DocumentTextView from "./DocumentTextView.vue";
import InspectorPane from "./InspectorPane.vue";
import ConfirmModal from "./ConfirmModal.vue";
import ProposalList from "./ProposalList.vue";
import { useAnnotator } from "../model/useAnnotator";
import { snapToLevel } from "../model/spans";
import { hotkeyTarget } from "../model/labelHotkeys";
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
    /** Hybrid tasks: labels for whole-document tags, next to the span `labelset`. */
    documentLabelset?: Labelset;
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
    /** Labels relations can be given; defaults to the built-in set. */
    relationLabels?: string[];
    /** Labels *document* relations can be given, when they differ from the span
     * relations' (a hybrid task's document labelset may have its own). Falls
     * back to `relationLabels`. */
    documentRelationLabels?: string[];
    /** Offer "Read more" on documents in the document-relation picker and list.
     * The view only emits `view-document`; showing the text is up to the host. */
    previewDocuments?: boolean;
    /** Offer a "View as graph" button on the document relations. The view only
     * emits `view-relation-graph`; drawing it is up to the host. */
    relationGraph?: boolean;
    /** Whether confidence (star) ratings are shown at all: on the selection
     * card, and on the assignment as Document Confidence. When hidden the
     * stored confidence values are left exactly as the task carried them. */
    showConfidence?: boolean;
    /** Whether relations can be seen and drawn: span relations, their arrows,
     * and document relations. When hidden, stored relations are left as the
     * task carried them. */
    showRelations?: boolean;
    /** Whether the free-text metadata field shows on the selection card. When
     * hidden, stored metadata is left as the task carried it. */
    showMetadata?: boolean;
    /** `single`: one document tag at a time; choosing another replaces it. */
    documentLabelMode?: DocumentLabelMode;
    /** `false`: a span that overlaps another is refused, with a notice. */
    allowOverlap?: boolean;
    /** Keep a crash-recovery copy of unsaved edits in localStorage. Off for a
     * host that must not leave document text on the device. */
    draft?: boolean;
    /** Annotations offered for the annotator to accept, reject or correct.
     * Shown apart from the assignment and never part of it until accepted. */
    proposals?: Proposal[];
    // Declared as props rather than emits so the view can await what the host
    // returns — `@save="…"` in a parent template still binds to these.
    onSave?: AssignmentHandler;
    onNext?: AssignmentHandler;
    onPrevious?: AssignmentHandler;
  }>(),
  {
    navigation: true,
    readonly: false,
    showConfidence: true,
    showRelations: true,
    showMetadata: true,
    documentLabelMode: "multi",
    allowOverlap: true,
    draft: true,
    proposals: () => [],
  },
);

// A task is span-level, document-level, or hybrid (span-level plus a separate
// document labelset). This decides which parts of the workspace render: span
// tools, whole-document tags, or both.
const isDocumentLevel = computed(() => props.annotationLevel === "document");
const isHybrid = computed(
  () => !isDocumentLevel.value && (props.documentLabelset?.labels.length ?? 0) > 0,
);

const emit = defineEmits<{
  /** A save/next/previous handler rejected. The work is still here. */
  "save-error": [error: unknown];
  /** Whether there is work not yet handed off — for a host's route guard. */
  unsaved: [value: boolean];
  /** The annotator asked to read this document (a relation target). */
  "view-document": [document: DocumentRef];
  /** The annotator asked to see the document relations as a graph. */
  "view-relation-graph": [request: RelationGraphRequest];
  /** A proposal was accepted; `annotation` is now in the assignment. */
  "proposal-accepted": [event: { proposal: Proposal; annotation: Annotation | DocumentAnnotation }];
  /** A proposal was rejected; the assignment is unchanged. */
  "proposal-rejected": [event: { proposal: Proposal }];
  /** A proposal was accepted with another label; `annotation` carries it. */
  "proposal-corrected": [event: { proposal: Proposal; annotation: Annotation | DocumentAnnotation }];
}>();

defineSlots<{
  /** Host controls in the header, before Back/Save/Next. */
  "header-actions"?: () => unknown;
  /** Host content at the top of the label column. */
  "sidebar-top"?: () => unknown;
  /** Host content at the bottom of the inspector. */
  "inspector-bottom"?: () => unknown;
}>();

// A per-document local buffer: protects in-progress edits against a crash or
// reload before the annotator has clicked Save/Next/Back at all — separate
// from whatever the host's AnnotationSource does once that click happens.
const draftKey =
  props.assignment.id !== undefined
    ? `lak:draft:assignment:${props.assignment.id}`
    : `lak:draft:${props.document.name}:${props.assignment.annotator}:${props.assignment.order}`;
// Read-only views edit nothing, so they neither resume nor write a draft; nor
// does a view whose host turned drafts off.
const keepsDraft = !props.readonly && props.draft;
const existingDraft = keepsDraft ? loadDraft(draftKey) : null;
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
  refusal,
  createSpan,
  addSpan,
  addDocumentLabel,
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
  setDocumentAnnotationMetadata,
  selectDocumentAnnotation,
  documentRelations,
  addDocumentRelation,
  removeDocumentRelation,
  setDocumentRelationLabels,
} = useAnnotator(
  existingDraft?.annotations ?? props.assignment.annotations,
  existingDraft?.documentAnnotations ?? props.assignment.document_annotations,
  existingDraft?.documentRelations ?? props.assignment.document_relations,
  () => ({ documentLabelMode: props.documentLabelMode, allowOverlap: props.allowOverlap }),
);

// Why the last selection made no span, in words; dismissable, and gone by
// itself once the next span is made.
const refusalMessage = computed(() =>
  refusal.value === "overlap"
    ? "That selection overlaps an annotation. Spans may not overlap in this task."
    : null,
);

// Snap the raw browser selection to the task's declared granularity — e.g. a
// word-level task captures the whole word even if only part of it was
// dragged over — before it becomes the stored annotation.
const onCreate = (payload: { start: number; end: number; text: string }) => {
  if (props.readonly) return;
  const range = snapToLevel(props.document.full_text, props.annotationLevel, payload.start, payload.end);
  createSpan(range.start, range.end, props.document.full_text.slice(range.start, range.end));
};

// --- Proposals ---------------------------------------------------------------
// Answered proposals are hidden here at once, whatever the host does with the
// event; one the annotator could not accept (an overlap) stays, with a notice.
const answered = ref(new Set<Proposal["id"]>());
const openProposals = computed(() =>
  props.readonly ? props.proposals : props.proposals.filter((p) => !answered.value.has(p.id)),
);
const spanProposals = computed(() =>
  isDocumentLevel.value ? [] : openProposals.value.filter((p): p is SpanProposal => p.kind === "span"),
);
const focusedProposalId = ref<Proposal["id"] | null>(null);

const applyProposal = (proposal: Proposal, label: string) =>
  proposal.kind === "span"
    ? addSpan(proposal.start, proposal.end, props.document.full_text.slice(proposal.start, proposal.end), label)
    : addDocumentLabel(label);

const answer = (proposal: Proposal) => {
  answered.value = new Set(answered.value).add(proposal.id);
  if (focusedProposalId.value === proposal.id) focusedProposalId.value = null;
};

const acceptProposal = (proposal: Proposal) => {
  if (props.readonly) return;
  const annotation = applyProposal(proposal, proposal.label);
  if (!annotation) return;
  answer(proposal);
  emit("proposal-accepted", { proposal, annotation });
};

const correctProposal = (proposal: Proposal, label: string) => {
  if (props.readonly) return;
  const annotation = applyProposal(proposal, label);
  if (!annotation) return;
  answer(proposal);
  emit("proposal-corrected", { proposal, annotation });
};

const rejectProposal = (proposal: Proposal) => {
  if (props.readonly) return;
  answer(proposal);
  emit("proposal-rejected", { proposal });
};

// Picking the active label again puts it down.
const toggleActiveLabel = (label: Label) => {
  activeLabel.value = activeLabel.value?.name === label.name ? null : label;
};

// A region click completes a relation when one is being drawn, otherwise it
// just selects the region.
const onActivate = (id: number) =>
  linkingFrom.value !== null && !props.readonly ? linkTo(id) : select(id);

// Picked from the inspector list: also bring it into view in the text.
const documentPane = ref<InstanceType<typeof DocumentPane>>();
const onInspectorSelect = (id: number) => {
  const linking = linkingFrom.value !== null && !props.readonly;
  onActivate(id);
  if (!linking) documentPane.value?.reveal(id);
};

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
    keepsDraft &&
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

// Only the halves this task uses count toward "has this been annotated".
const hasAnnotations = computed(() => {
  const tags = documentAnnotations.value.length > 0 || documentRelations.value.length > 0;
  if (isDocumentLevel.value) return tags;
  return annotations.value.length > 0 || (isHybrid.value && tags);
});

const labelColors = computed(() =>
  Object.fromEntries(props.labelset.labels.map((l) => [l.name, l.color])),
);
// Kept apart from labelColors: the two labelsets may share a name.
const documentLabelColors = computed(() =>
  Object.fromEntries((props.documentLabelset?.labels ?? []).map((l) => [l.name, l.color])),
);

watch(hasUnsavedChanges, (value) => emit("unsaved", value), { immediate: true });

// Once the host has stored the snapshot, the local crash-recovery buffer is no
// longer needed. Not before: a save that fails must leave the work recoverable.
const clearLocalState = () => {
  if (keepsDraft) clearDraft(draftKey);
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

// A label's key (shown beside it) arms it; in a hybrid task the document tags'
// keys continue where the span labels' end, and pressing one toggles that tag.
// Document-level tasks have nothing to arm, so no keys.
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
  const target = hotkeyTarget(
    e.key,
    props.labelset.labels.length,
    isHybrid.value ? (props.documentLabelset?.labels.length ?? 0) : 0,
  );
  if (!target) return;
  if (target.kind === "span") toggleActiveLabel(props.labelset.labels[target.index]);
  else toggleDocumentLabel(props.documentLabelset!.labels[target.index]);
  e.preventDefault();
};

// The graph request carries what is on screen — including relations not saved
// yet — and leaves loading and drawing the rest to the host.
const requestRelationGraph = () =>
  emit("view-relation-graph", {
    document: {
      name: props.document.name,
      order: props.assignment.order,
      key: props.document.key,
    },
    relations: documentRelations.value,
    incomingRelations: props.incomingRelations ?? [],
  });

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
      :hybrid="isHybrid"
      :document-name="document.name"
      :unsaved="hasUnsavedChanges"
      :just-saved="justSaved"
      :navigation="navigation"
      :readonly="readonly"
      :saving="saving"
      @previous="onPrevious"
      @save="onSaveClick"
      @next="onNext"
    >
      <template v-if="$slots['header-actions']" #actions><slot name="header-actions" /></template>
    </AnnotatorHeader>

    <p v-if="saveError" class="lak-annotator__error" role="alert">
      <span v-if="keepsDraft">
        Your changes could not be saved: {{ saveError }} They are kept on this
        device, so you can try again or reload without losing them.
      </span>
      <span v-else>
        Your changes could not be saved: {{ saveError }} They are still here, so
        you can try again; reloading will lose them.
      </span>
      <button type="button" class="lak-annotator__error-close" aria-label="Dismiss" @click="saveError = null">
        ×
      </button>
    </p>

    <p v-if="refusalMessage" class="lak-annotator__notice" role="status">
      <span>{{ refusalMessage }}</span>
      <button type="button" class="lak-annotator__error-close" aria-label="Dismiss" @click="refusal = null">
        ×
      </button>
    </p>

    <div class="lak-annotator__body">
      <LabelSidebar
        :labels="labelset.labels"
        :document-level="isDocumentLevel"
        :active-label="activeLabel"
        :document-annotations="documentAnnotations"
        :document-labels="isHybrid ? documentLabelset?.labels : undefined"
        :guidelines-url="guidelinesUrl"
        :show-confidence="showConfidence"
        :readonly="readonly"
        v-model:document-confidence="documentConfidence"
        @select="toggleActiveLabel"
        @toggle-document-label="toggleDocumentLabel"
      >
        <template #top><slot name="sidebar-top" /></template>
      </LabelSidebar>
      <DocumentTextView v-if="isDocumentLevel" :text="document.full_text" />
      <DocumentPane
        v-else
        ref="documentPane"
        :text="document.full_text"
        :annotations="annotations"
        :colors="labelColors"
        :selected-id="selectedId"
        :linking="linkingFrom !== null"
        :show-relations="showRelations"
        :proposals="spanProposals"
        :readonly="readonly"
        @create="onCreate"
        @select="onActivate"
        @select-proposal="focusedProposalId = $event"
      />
      <InspectorPane
        :document-level="isDocumentLevel"
        :hybrid="isHybrid"
        :annotations="annotations"
        :document-annotations="documentAnnotations"
        :document-relations="documentRelations"
        :incoming-relations="incomingRelations ?? []"
        :other-documents="otherDocuments ?? []"
        :colors="labelColors"
        :document-colors="isHybrid ? documentLabelColors : undefined"
        :selected-id="selectedId"
        :selected-document-annotation-id="selectedDocumentAnnotationId"
        :linking-from="linkingFrom"
        :show-confidence="showConfidence"
        :show-relations="showRelations"
        :show-metadata="showMetadata"
        :readonly="readonly"
        :relation-labels="relationLabels"
        :document-relation-labels="documentRelationLabels"
        :preview-documents="previewDocuments"
        :relation-graph="relationGraph"
        @view-document="emit('view-document', $event)"
        @view-relation-graph="requestRelationGraph"
        @select="onInspectorSelect"
        @set-metadata="setMetadata"
        @set-confidence="setConfidence"
        @set-document-annotation-confidence="setDocumentAnnotationConfidence"
        @set-document-annotation-metadata="setDocumentAnnotationMetadata"
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
      >
        <template #top>
          <ProposalList
            :proposals="openProposals"
            :span-labels="labelset.labels"
            :document-labels="isDocumentLevel ? labelset.labels : (documentLabelset?.labels ?? [])"
            :span-colors="labelColors"
            :document-colors="isHybrid ? documentLabelColors : labelColors"
            :text="document.full_text"
            :focused-id="focusedProposalId"
            :readonly="readonly"
            @accept="acceptProposal"
            @reject="rejectProposal"
            @correct="correctProposal"
          />
        </template>
        <template #bottom><slot name="inspector-bottom" /></template>
      </InspectorPane>
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
  /* Theme: every colour and radius reads a --lak-* variable with its default
     inline, so a host sets any of them on this element or an ancestor. See
     README, "Theming". */
  display: flex;
  flex-direction: column;
  height: 100%;
  min-height: 0;
  background: var(--lak-bg, #fff);
  color: var(--lak-fg, #111);
  font-family: system-ui, sans-serif;
}
.lak-annotator__error {
  display: flex;
  align-items: flex-start;
  gap: 0.6rem;
  margin: 0 0.75rem 0.5rem;
  padding: 0.5rem 0.7rem;
  border: 1px solid var(--lak-danger-border, #fecaca);
  border-radius: var(--lak-radius, 6px);
  background: var(--lak-danger-bg, #fef2f2);
  color: var(--lak-danger-fg, #991b1b);
  font-size: 0.85rem;
}
.lak-annotator__notice {
  display: flex;
  align-items: flex-start;
  gap: 0.6rem;
  margin: 0 0.75rem 0.5rem;
  padding: 0.5rem 0.7rem;
  border: 1px solid var(--lak-warning, #d97706);
  border-radius: var(--lak-radius, 6px);
  background: var(--lak-warning-bg, #fffbeb);
  color: var(--lak-warning-fg, #92400e);
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

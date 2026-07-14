<script setup lang="ts">
import { computed, onBeforeUnmount, onMounted, ref } from "vue";
import type {
  AnnotationDocument,
  Assignment,
  Label,
  Labelset,
  QueuePosition,
} from "../types";
import AnnotatorHeader from "./AnnotatorHeader.vue";
import LabelSidebar from "./LabelSidebar.vue";
import DocumentPane from "./DocumentPane.vue";
import InspectorPane from "./InspectorPane.vue";
import { useAnnotator } from "../model/useAnnotator";

// The annotator's workspace. Annotators move through their assigned documents
// in sequence (no free navigation); "next" means the current one is finished.
const props = defineProps<{
  document: AnnotationDocument;
  labelset: Labelset;
  assignment: Assignment;
  position: QueuePosition;
  guidelinesUrl?: string;
  /** Set once the annotation layer reports unsaved edits. */
  unsaved?: boolean;
}>();

const emit = defineEmits<{
  save: [assignment: Assignment];
  next: [assignment: Assignment];
  previous: [assignment: Assignment];
}>();

const {
  annotations,
  activeLabel,
  selectedId,
  dirty,
  linkingFrom,
  createSpan,
  remove,
  select,
  setConfidence,
  startLinking,
  linkTo,
  removeRelation,
  setRelationDirection,
  setRelationLabels,
} = useAnnotator(props.assignment.annotations);

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
const documentConfidence = ref(props.assignment.confidence);

// The assignment as it stands right now — the source of truth for
// save/next/previous, since the live edits live in useAnnotator, not in props.
const snapshot = computed<Assignment>(() => ({
  ...props.assignment,
  annotations: annotations.value,
  confidence: documentConfidence.value,
}));

const hasAnnotations = computed(() => annotations.value.length > 0);

const labelColors = computed(() =>
  Object.fromEntries(props.labelset.labels.map((l) => [l.name, l.color])),
);

const onNext = () => {
  // Advancing marks the document done — warn if nothing was annotated.
  if (
    !hasAnnotations.value &&
    !window.confirm(
      "No annotations were made in this document.\nAre you sure you want to continue?",
    )
  ) {
    return;
  }
  emit("next", snapshot.value);
};

// Number keys arm a label: 1–9 for the first nine, 0 for the tenth.
const onKey = (e: KeyboardEvent) => {
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
  if (props.unsaved || dirty.value) e.preventDefault();
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
      @previous="$emit('previous', snapshot)"
      @save="$emit('save', snapshot)"
      @next="onNext"
    />

    <div class="lak-annotator__body">
      <LabelSidebar
        :labels="labelset.labels"
        :active-label="activeLabel"
        :has-selection="selectedId !== null"
        :annotation-confidence="selectedAnnotation?.confidence ?? 0"
        v-model:document-confidence="documentConfidence"
        @select="setActiveLabel"
        @update:annotation-confidence="setAnnotationConfidence"
      />
      <DocumentPane
        :text="document.full_text"
        :annotations="annotations"
        :colors="labelColors"
        :selected-id="selectedId"
        :linking="linkingFrom !== null"
        @create="onCreate"
        @select="onActivate"
      />
      <InspectorPane
        :annotations="annotations"
        :colors="labelColors"
        :selected-id="selectedId"
        :linking-from="linkingFrom"
        @select="onActivate"
        @remove="remove"
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

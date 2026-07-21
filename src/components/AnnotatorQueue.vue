<script setup lang="ts">
import { computed, onMounted, ref } from "vue";
import type { AnnotationSource, DocumentRef } from "../model/source";
import type { AnnotationLevel, Assignment, DocumentRelation, Labelset } from "../types";
import { useAssignmentQueue } from "../model/useAssignmentQueue";
import AnnotatorView from "./AnnotatorView.vue";

// Top-level entry point for hosts: drives Back/Save/Next through the given
// AnnotationSource so AnnotatorView never needs to know whether documents were
// bulk-loaded upfront or are being fetched lazily.
const props = defineProps<{
  source: AnnotationSource;
  labelset: Labelset;
  annotationLevel: AnnotationLevel;
  guidelinesUrl?: string;
  startPosition?: number;
}>();

const emit = defineEmits<{
  /** Fired once the annotator advances past the last document in the queue. */
  complete: [];
}>();

const { position, total, bundle, loading, error, goTo, save } = useAssignmentQueue(
  props.source,
  props.startPosition ?? 1,
);

// The queue's document names, for the document-relation target picker. Fetched
// once — names/order are stable for the session. Left empty if the source
// doesn't implement listDocuments (the relations UI then stays hidden).
const docRefs = ref<DocumentRef[]>([]);

onMounted(async () => {
  docRefs.value = (await props.source.listDocuments?.()) ?? [];
  await goTo(position.value);
});

const queuePosition = computed(() => ({ current: position.value, total }));

// Every queue document except the one currently open — the valid targets a
// document can point at.
const otherDocuments = computed(() =>
  docRefs.value.filter((d) => d.name !== bundle.value?.document.name),
);

const onSave = (assignment: Assignment) => save(assignment);

const onPrevious = async (assignment: Assignment) => {
  await save(assignment);
  await goTo(position.value - 1);
};

// Advancing means the document is finished.
const onNext = async (assignment: Assignment) => {
  await save({ ...assignment, status: "done" });
  if (position.value >= total) {
    await props.source.finish?.();
    emit("complete");
    return;
  }
  await goTo(position.value + 1);
};

// An outgoing relation the annotator creates on the current document gets a
// matching `incoming` backlink written directly to the target document's own
// record — it isn't open in any editor right now, so there's no live state to
// update, just plain load+save. Only ever touches `incoming` entries on the
// target; an outgoing relation the target's own annotator created is a
// separate record and untouched by this.
const mutateIncoming = async (
  toName: string,
  mutate: (relations: DocumentRelation[], fromName: string) => DocumentRelation[],
) => {
  const fromName = bundle.value?.document.name;
  const docRef = docRefs.value.find((d) => d.name === toName);
  if (!fromName || !docRef) return;
  const target = await props.source.load(docRef.order);
  target.assignment.document_relations = mutate(target.assignment.document_relations, fromName);
  await props.source.save(target.assignment);
};

const onLinkDocument = (toName: string) =>
  mutateIncoming(toName, (relations, fromName) =>
    relations.some((r) => r.to === fromName && r.direction === "incoming")
      ? relations
      : [...relations, { to: fromName, direction: "incoming", labels: [] }],
  );

const onUnlinkDocument = (toName: string) =>
  mutateIncoming(toName, (relations, fromName) =>
    relations.filter((r) => !(r.to === fromName && r.direction === "incoming")),
  );

const onRelabelDocumentRelation = (toName: string, labels: string[]) =>
  mutateIncoming(toName, (relations, fromName) =>
    relations.map((r) => (r.to === fromName && r.direction === "incoming" ? { ...r, labels } : r)),
  );
</script>

<template>
  <AnnotatorView
    v-if="bundle"
    :key="position"
    :document="bundle.document"
    :assignment="bundle.assignment"
    :labelset="labelset"
    :annotation-level="annotationLevel"
    :other-documents="otherDocuments"
    :position="queuePosition"
    :guidelines-url="guidelinesUrl"
    @save="onSave"
    @next="onNext"
    @previous="onPrevious"
    @link-document="onLinkDocument"
    @unlink-document="onUnlinkDocument"
    @relabel-document-relation="onRelabelDocumentRelation"
  />
  <div v-else-if="loading" class="lak-queue-status">Loading…</div>
  <div v-else-if="error" class="lak-queue-status lak-queue-status--error">
    Could not load this document.
  </div>
</template>

<style scoped>
.lak-queue-status {
  padding: 2rem;
  text-align: center;
  color: #6b7280;
  font-family: system-ui, sans-serif;
}
.lak-queue-status--error {
  color: #dc2626;
}
</style>

<script setup lang="ts">
import { computed, onMounted, ref, watch } from "vue";
import type { AnnotationSource, DocumentRef, IncomingRelation } from "../model/source";
import type { AnnotationLevel, Assignment, Labelset } from "../types";
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

// The current position round-trips through the URL's `seq` query param, so a
// reload or a shared link resumes at the same document — takes priority over
// startPosition, which only matters on a first visit with no `seq` yet.
const SEQ_PARAM = "seq";

function readSeqFromUrl(): number | null {
  if (typeof window === "undefined") return null;
  const raw = new URLSearchParams(window.location.search).get(SEQ_PARAM);
  const n = raw ? Number(raw) : NaN;
  return Number.isInteger(n) && n >= 1 ? n : null;
}

function writeSeqToUrl(pos: number) {
  if (typeof window === "undefined") return;
  const url = new URL(window.location.href);
  url.searchParams.set(SEQ_PARAM, String(pos));
  window.history.replaceState(window.history.state, "", url);
}

const clampPosition = (n: number) => Math.min(Math.max(n, 1), props.source.total || 1);
const initialPosition = clampPosition(readSeqFromUrl() ?? props.startPosition ?? 1);

const { position, total, bundle, loading, error, goTo, save } = useAssignmentQueue(
  props.source,
  initialPosition,
);

watch(position, (pos) => writeSeqToUrl(pos), { immediate: true });

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

// Other documents' relations pointing at whichever one is open now — a
// read-only "Linked by" view, refetched on every navigation since it depends
// on the current document.
const incomingRelations = ref<IncomingRelation[]>([]);
watch(
  bundle,
  async (b) => {
    incomingRelations.value = b
      ? ((await props.source.listIncomingRelations?.(b.document.name)) ?? [])
      : [];
  },
  { immediate: true },
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
    :incoming-relations="incomingRelations"
    :position="queuePosition"
    :guidelines-url="guidelinesUrl"
    @save="onSave"
    @next="onNext"
    @previous="onPrevious"
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

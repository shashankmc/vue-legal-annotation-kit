<script setup lang="ts">
import { computed, onMounted, ref, watch } from "vue";
import type { AnnotationSource, DocumentRef, IncomingRelation } from "../model/source";
import { documentKey } from "../model/source";
import type { AnnotationLevel, Assignment, Labelset } from "../types";
import { useAssignmentQueue } from "../model/useAssignmentQueue";
import AnnotatorView from "./AnnotatorView.vue";

// Top-level entry point for hosts: drives Back/Save/Next through the given
// AnnotationSource so AnnotatorView never needs to know whether documents were
// bulk-loaded upfront or are being fetched lazily.
const props = withDefaults(
  defineProps<{
    source: AnnotationSource;
    labelset: Labelset;
    annotationLevel: AnnotationLevel;
    guidelinesUrl?: string;
    startPosition?: number;
    /**
     * Query param the current position round-trips through, or `false` for a
     * host whose router owns the URL and already means something else by it.
     */
    urlParam?: string | false;
    /** Labels offered in the relation pickers; defaults to the built-in set. */
    relationLabels?: string[];
  }>(),
  { urlParam: "seq" },
);

const emit = defineEmits<{
  /** Fired once the annotator advances past the last document in the queue. */
  complete: [];
  /** Saving failed; the annotator is still on the same document, work intact. */
  "save-error": [error: unknown];
  /** Whether the open document has work not yet saved — for a route guard. */
  unsaved: [value: boolean];
}>();

// The current position round-trips through the URL (`seq` by default), so a
// reload or a shared link resumes at the same document — takes priority over
// startPosition, which only matters on a first visit with no param yet.
function readSeqFromUrl(): number | null {
  if (typeof window === "undefined" || !props.urlParam) return null;
  const raw = new URLSearchParams(window.location.search).get(props.urlParam);
  const n = raw ? Number(raw) : NaN;
  return Number.isInteger(n) && n >= 1 ? n : null;
}

function writeSeqToUrl(pos: number) {
  if (typeof window === "undefined" || !props.urlParam) return;
  const url = new URL(window.location.href);
  url.searchParams.set(props.urlParam, String(pos));
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
  docRefs.value.filter((d) => !bundle.value || documentKey(d) !== documentKey(bundle.value.document)),
);

// Other documents' relations pointing at whichever one is open now — a
// read-only "Linked by" view, refetched on every navigation since it depends
// on the current document.
const incomingRelations = ref<IncomingRelation[]>([]);
watch(
  bundle,
  async (b) => {
    incomingRelations.value = b
      ? ((await props.source.listIncomingRelations?.(documentKey(b.document))) ?? [])
      : [];
  },
  { immediate: true },
);

// True while Back/Next is saving before it moves — the overlay covers the
// document so nothing is edited after the snapshot was taken.
const saving = ref(false);
const savingThen = async (work: () => Promise<void>) => {
  saving.value = true;
  try {
    await work();
  } finally {
    saving.value = false;
  }
};

// Each of these rejects when the save does, which AnnotatorView reports and
// recovers from — so a failed save never moves the annotator on.
const onSave = (assignment: Assignment) => save(assignment);

const onPrevious = (assignment: Assignment) =>
  savingThen(async () => {
    await save(assignment);
    await goTo(position.value - 1);
  });

// Advancing means the document is finished.
const onNext = (assignment: Assignment) =>
  savingThen(async () => {
    await save({ ...assignment, status: "done" });
    if (position.value >= total) {
      await props.source.finish?.();
      emit("complete");
      return;
    }
    await goTo(position.value + 1);
  });

</script>

<template>
  <div class="lak-queue">
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
      :relation-labels="relationLabels"
      @save="onSave"
      @next="onNext"
      @previous="onPrevious"
      @save-error="emit('save-error', $event)"
      @unsaved="emit('unsaved', $event)"
    />
    <div v-else-if="loading" class="lak-queue-status">
      <span class="lak-spinner" aria-hidden="true" />
      Loading…
    </div>
    <div v-else-if="error" class="lak-queue-status lak-queue-status--error">
      Could not load this document.
    </div>

    <!-- goTo doesn't clear `bundle` while a later document loads, so the
         previous one stays on screen — this overlay is the only sign a lazy
         source's load/save is in flight, and blocks stale interaction with
         the document underneath until it resolves. -->
    <div v-if="bundle && (loading || saving)" class="lak-queue-overlay" role="status" aria-live="polite">
      <span class="lak-spinner" aria-hidden="true" />
      {{ saving && !loading ? "Saving…" : "Loading…" }}
    </div>
  </div>
</template>

<style scoped>
.lak-queue {
  position: relative;
  height: 100%;
}
.lak-queue-status {
  display: flex;
  align-items: center;
  justify-content: center;
  gap: 0.6rem;
  padding: 2rem;
  text-align: center;
  color: #6b7280;
  font-family: system-ui, sans-serif;
}
.lak-queue-status--error {
  color: #dc2626;
}
.lak-queue-overlay {
  position: absolute;
  inset: 0;
  display: flex;
  align-items: center;
  justify-content: center;
  gap: 0.6rem;
  background: rgba(255, 255, 255, 0.7);
  font-family: system-ui, sans-serif;
  font-size: 0.9rem;
  color: #374151;
}
.lak-spinner {
  width: 1.1rem;
  height: 1.1rem;
  border: 2px solid rgba(0, 0, 0, 0.15);
  border-top-color: #1e4e79;
  border-radius: 50%;
  animation: lak-queue-spin 0.7s linear infinite;
}
@keyframes lak-queue-spin {
  to {
    transform: rotate(360deg);
  }
}
</style>

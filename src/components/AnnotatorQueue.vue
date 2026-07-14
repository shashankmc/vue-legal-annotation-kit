<script setup lang="ts">
import { computed, onMounted } from "vue";
import type { AnnotationSource } from "../model/source";
import type { Assignment, Labelset } from "../types";
import { useAssignmentQueue } from "../model/useAssignmentQueue";
import AnnotatorView from "./AnnotatorView.vue";

// Top-level entry point for hosts: drives Back/Save/Next through the given
// AnnotationSource so AnnotatorView never needs to know whether documents were
// bulk-loaded upfront or are being fetched lazily.
const props = defineProps<{
  source: AnnotationSource;
  labelset: Labelset;
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

onMounted(() => goTo(position.value));

const queuePosition = computed(() => ({ current: position.value, total }));

const onSave = (assignment: Assignment) => save(assignment);

const onPrevious = async (assignment: Assignment) => {
  await save(assignment);
  await goTo(position.value - 1);
};

// Advancing means the document is finished.
const onNext = async (assignment: Assignment) => {
  await save({ ...assignment, status: "done" });
  if (position.value >= total) {
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

<script setup lang="ts">
import { computed, ref } from "vue";
import type { Label } from "../types";
import StarRating from "./StarRating.vue";

// Left column: label picker + confidence ratings.
// Purely presentational for now — selecting a label does not annotate yet.
const props = defineProps<{
  labels: Label[];
  activeLabel: Label | null;
  documentConfidence: number;
  annotationConfidence: number;
  /** Annotation confidence only applies to a selected region. */
  hasSelection?: boolean;
}>();

defineEmits<{
  select: [label: Label];
  "update:documentConfidence": [value: number];
  "update:annotationConfidence": [value: number];
}>();

const filter = ref("");

const visible = computed(() =>
  props.labels.filter((l) =>
    l.name.toLowerCase().includes(filter.value.toLowerCase()),
  ),
);

// Hotkeys mirror the current tool: 1–9 then 0 for the tenth label.
const hotkey = (index: number) => (index < 9 ? String(index + 1) : index === 9 ? "0" : "");
</script>

<template>
  <aside class="sidebar">
    <input v-model="filter" class="sidebar__filter" type="text" placeholder="Quick Filter" />

    <ul class="labels">
      <li
        v-for="(label, i) in visible"
        :key="label.name"
        class="label"
        :class="{ 'is-active': label.name === activeLabel?.name }"
        @click="$emit('select', label)"
      >
        <span class="label__swatch" :style="{ background: label.color }" />
        <span class="label__name">{{ label.name }}</span>
        <span v-if="hotkey(i)" class="label__key">{{ hotkey(i) }}</span>
      </li>
    </ul>

    <div class="sidebar__confidence">
      <StarRating
        label="Annotation Confidence"
        :model-value="annotationConfidence"
        :disabled="!hasSelection"
        @update:model-value="$emit('update:annotationConfidence', $event)"
      />
      <StarRating
        label="Document Confidence"
        :model-value="documentConfidence"
        @update:model-value="$emit('update:documentConfidence', $event)"
      />
    </div>
  </aside>
</template>

<style scoped>
.sidebar {
  display: flex;
  flex-direction: column;
  background: var(--lak-sidebar-bg);
  padding: 0.5rem;
  overflow-y: auto;
}
.sidebar__filter {
  font: inherit;
  padding: 0.35rem 0.5rem;
  border: 1px solid var(--lak-border);
  border-radius: 6px;
  margin-bottom: 0.6rem;
}
.labels {
  list-style: none;
  margin: 0;
  padding: 0;
  display: flex;
  flex-direction: column;
  gap: 0.25rem;
}
.label {
  display: flex;
  align-items: center;
  gap: 0.4rem;
  padding: 0.3rem 0.4rem;
  border-radius: 6px;
  cursor: pointer;
  font-size: 0.85rem;
}
.label:hover {
  background: rgba(0, 0, 0, 0.05);
}
.label.is-active {
  background: var(--lak-accent);
  color: #fff;
}
.label.is-active .label__key {
  background: rgba(255, 255, 255, 0.25);
  color: #fff;
}
.label__swatch {
  width: 0.85rem;
  height: 0.85rem;
  border-radius: 3px;
  flex-shrink: 0;
}
.label__name {
  flex: 1;
}
.label__key {
  font-size: 0.75rem;
  color: var(--lak-muted);
  background: rgba(0, 0, 0, 0.08);
  border-radius: 4px;
  padding: 0 0.35rem;
}
.sidebar__confidence {
  margin-top: auto;
  padding-top: 0.75rem;
  border-top: 1px solid var(--lak-border);
  display: flex;
  flex-direction: column;
  gap: 0.6rem;
}
</style>

<script setup lang="ts">
import { computed, ref } from "vue";
import type { DocumentAnnotation, Label } from "../types";
import StarRating from "./StarRating.vue";

// Left column: label picker + confidence ratings.
// Purely presentational for now — selecting a label does not annotate yet.
const props = defineProps<{
  labels: Label[];
  /** Document-level tasks show tag chips instead of the span-arming label list. */
  documentLevel: boolean;
  activeLabel: Label | null;
  documentConfidence: number;
  annotationConfidence: number;
  documentAnnotations: DocumentAnnotation[];
  /** Confidence only applies once a span or document tag is selected. */
  hasSelection?: boolean;
}>();

defineEmits<{
  select: [label: Label];
  "update:documentConfidence": [value: number];
  "update:annotationConfidence": [value: number];
  "toggle-document-label": [label: Label];
}>();

const filter = ref("");

const visible = computed(() =>
  props.labels.filter((l) =>
    l.name.toLowerCase().includes(filter.value.toLowerCase()),
  ),
);

const isDocumentTagged = (label: Label) =>
  props.documentAnnotations.some((d) => d.label === label.name);

// Hotkeys mirror the current tool: 1–9 then 0 for the tenth label.
const hotkey = (index: number) => (index < 9 ? String(index + 1) : index === 9 ? "0" : "");
</script>

<template>
  <aside class="sidebar">
    <input v-model="filter" class="sidebar__filter" type="text" placeholder="Quick Filter" />

    <ul v-if="!documentLevel" class="labels">
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

    <div v-else class="sidebar__doc-tags">
      <h4 class="sidebar__doc-tags-title">Document Tags</h4>
      <ul class="doc-tags">
        <li
          v-for="label in visible"
          :key="label.name"
          class="doc-tag"
          :class="{ 'is-tagged': isDocumentTagged(label) }"
          @click="$emit('toggle-document-label', label)"
        >
          <span class="doc-tag__swatch" :style="{ background: label.color }" />
          <span class="doc-tag__name">{{ label.name }}</span>
        </li>
      </ul>
    </div>

    <div class="sidebar__confidence">
      <StarRating
        :label="documentLevel ? 'Tag Confidence' : 'Annotation Confidence'"
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
.sidebar__doc-tags-title {
  margin: 0 0 0.4rem;
  font-size: 0.8rem;
  color: var(--lak-muted);
}
.doc-tags {
  list-style: none;
  margin: 0;
  padding: 0;
  display: flex;
  flex-wrap: wrap;
  gap: 0.3rem;
}
.doc-tag {
  display: flex;
  align-items: center;
  gap: 0.3rem;
  padding: 0.2rem 0.5rem;
  border: 1px solid var(--lak-border);
  border-radius: 999px;
  cursor: pointer;
  font-size: 0.78rem;
  background: #fff;
}
.doc-tag:hover {
  background: rgba(0, 0, 0, 0.05);
}
.doc-tag.is-tagged {
  background: var(--lak-accent);
  border-color: var(--lak-accent);
  color: #fff;
}
.doc-tag__swatch {
  width: 0.7rem;
  height: 0.7rem;
  border-radius: 3px;
  flex-shrink: 0;
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

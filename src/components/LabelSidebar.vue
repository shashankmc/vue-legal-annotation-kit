<script setup lang="ts">
import { computed } from "vue";
import type { DocumentAnnotation, Label } from "../types";
import StarRating from "./StarRating.vue";
import { labelHotkey } from "../model/labelHotkeys";

// Left column: label picker + confidence ratings.
// Purely presentational for now — selecting a label does not annotate yet.
const props = defineProps<{
  labels: Label[];
  /** Document-level tasks show tag chips instead of the span-arming label list. */
  documentLevel: boolean;
  activeLabel: Label | null;
  documentConfidence: number;
  documentAnnotations: DocumentAnnotation[];
  /** Hybrid tasks: the document-tag labels, shown right after the span labels. */
  documentLabels?: Label[];
  guidelinesUrl?: string;
  /** Show the labels and ratings without letting anything change. */
  readonly?: boolean;
  /** Whether the confidence rating shows at all; off hides it entirely. */
  showConfidence?: boolean;
}>();

defineEmits<{
  select: [label: Label];
  "update:documentConfidence": [value: number];
  "toggle-document-label": [label: Label];
}>();

// Which labels the tag chips offer: the task's labels for a document-level
// task, the separate document labelset for a hybrid one.
const tagLabels = computed(() => (props.documentLevel ? props.labels : (props.documentLabels ?? [])));
const hybrid = computed(() => !props.documentLevel && tagLabels.value.length > 0);

// In a hybrid task the tags' keys carry on where the span labels' end, so one
// key press never means two things (see hotkeyTarget in model/labelHotkeys).
const tagKey = (index: number) => (hybrid.value ? labelHotkey(props.labels.length + index) : "");

const isDocumentTagged = (label: Label) =>
  props.documentAnnotations.some((d) => d.label === label.name);
</script>

<template>
  <aside class="sidebar">
    <slot name="top" />
    <template v-if="guidelinesUrl">
      <a class="guidelines-link" :href="guidelinesUrl" target="_blank" rel="noopener">
        See Annotation Guidelines
        <span class="guidelines-link__icon" aria-hidden="true">↗</span>
      </a>
      <hr class="sidebar__divider" />
    </template>

    <!-- Everything label-related scrolls together, span labels and then the
         tags under them, so nothing is squeezed however many there are. -->
    <div class="sidebar__scroll">
      <h4 v-if="hybrid" class="sidebar__section-title">Span Labels</h4>
      <ul v-if="!documentLevel" class="labels">
        <li
          v-for="(label, i) in labels"
          :key="label.name"
          class="label"
          :class="{ 'is-active': label.name === activeLabel?.name, 'is-readonly': readonly }"
          @click="!readonly && $emit('select', label)"
        >
          <span class="label__swatch" :style="{ background: label.color }" />
          <span class="label__name">{{ label.name }}</span>
          <span v-if="labelHotkey(i)" class="label__key">{{ labelHotkey(i).toUpperCase() }}</span>
        </li>
      </ul>

      <section
        v-if="documentLevel || hybrid"
        class="sidebar__doc-tags"
        :class="{ 'sidebar__doc-tags--hybrid': hybrid }"
      >
        <h4 class="sidebar__section-title">Document Tags</h4>
        <ul class="doc-tags">
          <li
            v-for="(label, i) in tagLabels"
            :key="label.name"
            class="doc-tag"
            :class="{ 'is-tagged': isDocumentTagged(label), 'is-readonly': readonly }"
            @click="!readonly && $emit('toggle-document-label', label)"
          >
            <span class="doc-tag__swatch" :style="{ background: label.color }" />
            <span class="doc-tag__name">{{ label.name }}</span>
            <span v-if="tagKey(i)" class="doc-tag__key">{{ tagKey(i).toUpperCase() }}</span>
          </li>
        </ul>
      </section>
    </div>

    <div v-if="showConfidence" class="sidebar__confidence">
      <StarRating
        label="Document Confidence"
        :model-value="documentConfidence"
        :disabled="readonly"
        @update:model-value="$emit('update:documentConfidence', $event)"
      />
    </div>
  </aside>
</template>

<style scoped>
/* The guidelines link above and the document confidence below stay in view; the
   labels between them scroll as one. */
.sidebar {
  display: flex;
  flex-direction: column;
  background: var(--lak-sidebar-bg, #f1f1f1);
  padding: 0.5rem;
  min-height: 0;
  overflow: hidden;
}
.sidebar__scroll {
  flex: 1 1 auto;
  min-height: 0;
  overflow-y: auto;
  /* Air under the last label, so that however far it is scrolled the last pill
     never touches the confidence divider below. */
  padding-bottom: 0.75rem;
}
.sidebar__doc-tags--hybrid {
  /* The delimiter between the span labels and the tags under them. */
  margin-top: 0.75rem;
  padding-top: 0.75rem;
  border-top: 1px solid var(--lak-border, rgba(0, 0, 0, 0.12));
}
.guidelines-link {
  display: flex;
  align-items: center;
  gap: 0.3rem;
  font-size: var(--lak-font-size-xs, 0.8rem);
  color: var(--lak-accent, #1e4e79);
  text-decoration: none;
  margin-bottom: 0.6rem;
}
.guidelines-link:hover {
  text-decoration: underline;
}
.guidelines-link__icon {
  font-size: var(--lak-font-size-sm, 0.85rem);
}
.sidebar__divider {
  border: none;
  border-top: 1px solid var(--lak-border, rgba(0, 0, 0, 0.12));
  margin: 0 0 0.6rem;
}
.sidebar__section-title {
  margin: 0 0 0.4rem;
  font-size: var(--lak-font-size-xs, 0.8rem);
  color: var(--lak-muted, #6b7280);
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
  border-radius: var(--lak-radius, 6px);
  cursor: pointer;
  font-size: var(--lak-font-size-sm, 0.85rem);
}
.label.is-readonly,
.doc-tag.is-readonly {
  cursor: default;
}
.label:hover {
  background: var(--lak-hover, rgba(0, 0, 0, 0.05));
}
.label.is-active {
  background: var(--lak-accent, #1e4e79);
  color: var(--lak-on-accent, #fff);
}
.label.is-active .label__key {
  background: var(--lak-on-accent-soft, rgba(255, 255, 255, 0.25));
  color: var(--lak-on-accent, #fff);
}
.label__swatch {
  width: 0.85rem;
  height: 0.85rem;
  border-radius: var(--lak-radius-sm, 3px);
  flex-shrink: 0;
}
.label__name {
  flex: 1;
}
.label__key,
.doc-tag__key {
  font-size: var(--lak-font-size-2xs, 0.75rem);
  color: var(--lak-muted, #6b7280);
  background: var(--lak-hover, rgba(0, 0, 0, 0.08));
  border-radius: var(--lak-radius-sm, 4px);
  padding: 0 0.35rem;
}
.doc-tags {
  list-style: none;
  margin: 0;
  padding: 0;
  display: flex;
  flex-direction: column;
  align-items: flex-start;
  gap: 0.3rem;
}
.doc-tag {
  display: flex;
  align-items: center;
  gap: 0.3rem;
  padding: 0.2rem 0.5rem;
  border: 1px solid var(--lak-border, rgba(0, 0, 0, 0.12));
  border-radius: 999px;
  cursor: pointer;
  font-size: var(--lak-font-size-xs, 0.78rem);
  background: var(--lak-surface, #fff);
}
.doc-tag:hover {
  background: var(--lak-hover, rgba(0, 0, 0, 0.05));
}
.doc-tag.is-tagged {
  background: var(--lak-accent, #1e4e79);
  border-color: var(--lak-accent, #1e4e79);
  color: var(--lak-on-accent, #fff);
}
.doc-tag.is-tagged .doc-tag__key {
  background: var(--lak-on-accent-soft, rgba(255, 255, 255, 0.25));
  color: var(--lak-on-accent, #fff);
}
.doc-tag__swatch {
  width: 0.7rem;
  height: 0.7rem;
  border-radius: var(--lak-radius-sm, 3px);
  flex-shrink: 0;
}
.doc-tag__key {
  font-size: var(--lak-font-size-2xs, 0.7rem);
}
.sidebar__confidence {
  flex-shrink: 0;
  padding-top: 0.75rem;
  border-top: 1px solid var(--lak-border, rgba(0, 0, 0, 0.12));
  display: flex;
  flex-direction: column;
  gap: 0.6rem;
}
</style>

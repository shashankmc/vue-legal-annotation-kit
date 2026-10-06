<script setup lang="ts">
import { computed } from "vue";
import type { Annotation, DocumentAnnotation, DocumentRelation, RelationDirection } from "../types";
import type { DocumentRef, IncomingRelation } from "../model/source";
import RelationList from "./RelationList.vue";
import StarRating from "./StarRating.vue";
import DocumentRelationList from "./DocumentRelationList.vue";

// Right column: inspector. Lists the current annotations (regions) and lets the
// annotator select, delete or link them.
const props = defineProps<{
  documentLevel: boolean;
  annotations: Annotation[];
  documentAnnotations: DocumentAnnotation[];
  documentRelations: DocumentRelation[];
  incomingRelations: IncomingRelation[];
  otherDocuments: DocumentRef[];
  colors: Record<string, string>;
  selectedId: number | null;
  selectedDocumentAnnotationId: number | null;
  linkingFrom: number | null;
  readonly?: boolean;
  /** Labels offered in the relation pickers; forwarded to both lists. */
  relationLabels?: string[];
}>();

const emit = defineEmits<{
  select: [id: number];
  remove: [id: number];
  "select-document-annotation": [id: number];
  "remove-document-annotation": [id: number];
  "add-document-relation": [toName: string];
  "remove-document-relation": [toName: string];
  "set-document-relation-labels": [toName: string, labels: string[]];
  link: [id: number];
  "remove-relation": [from: number, to: number];
  "set-relation-direction": [from: number, to: number, direction: RelationDirection];
  "set-relation-labels": [from: number, to: number, labels: string[]];
  "set-metadata": [id: number, value: string];
  "set-document-annotation-metadata": [id: number, value: string];
  "set-confidence": [id: number, value: number];
  "set-document-annotation-confidence": [id: number, value: number];
}>();

// Whatever is selected — a span, or a document tag — shown at the top of the
// pane with its metadata field, so the notes are in view the moment something
// is picked rather than below a long list of annotations.
const selectedSpan = computed(() =>
  props.documentLevel || props.selectedId === null
    ? null
    : (props.annotations.find((a) => a.id === props.selectedId) ?? null),
);
const selectedTag = computed(() =>
  !props.documentLevel || props.selectedDocumentAnnotationId === null
    ? null
    : (props.documentAnnotations.find((d) => d.id === props.selectedDocumentAnnotationId) ?? null),
);
const selection = computed(() => selectedSpan.value ?? selectedTag.value);

const setSelectionConfidence = (value: number) => {
  if (selectedSpan.value) emit("set-confidence", selectedSpan.value.id, value);
  else if (selectedTag.value) emit("set-document-annotation-confidence", selectedTag.value.id, value);
};

const setSelectionMetadata = (value: string) => {
  if (selectedSpan.value) emit("set-metadata", selectedSpan.value.id, value);
  else if (selectedTag.value) emit("set-document-annotation-metadata", selectedTag.value.id, value);
};
</script>

<template>
  <aside class="inspector">
    <section v-if="selection" class="selection" :style="{ '--region-color': colors[selection.label] }">
      <div class="selection__head">
        <span class="region__swatch" :style="{ background: colors[selection.label] }" />
        <span class="region__label">{{ selection.label }}</span>
        <span v-if="selectedSpan" class="selection__text" :title="selectedSpan.text">{{ selectedSpan.text }}</span>
      </div>
      <StarRating
        label="Confidence"
        :model-value="selection.confidence"
        :disabled="readonly"
        @update:model-value="setSelectionConfidence"
      />
      <label class="metadata">
        <span class="metadata__title">Metadata</span>
        <textarea
          class="metadata__input"
          rows="3"
          :placeholder="readonly ? 'No metadata' : 'Notes about this annotation'"
          :value="selection.metadata ?? ''"
          :readonly="readonly"
          @input="setSelectionMetadata(($event.target as HTMLTextAreaElement).value)"
        />
      </label>
    </section>
    <p v-else-if="!readonly && (documentLevel ? documentAnnotations.length : annotations.length)" class="selection__hint">
      Select {{ documentLevel ? "a tag" : "an annotation" }} to rate it or add metadata.
    </p>

    <template v-if="documentLevel">
      <h4 class="inspector__title">Document Tags ({{ documentAnnotations.length }})</h4>
      <ul class="regions">
        <li
          v-for="d in documentAnnotations"
          :key="d.id"
          class="region"
          :class="{ 'is-selected': d.id === selectedDocumentAnnotationId }"
          :style="{ '--region-color': colors[d.label] }"
          @click="emit('select-document-annotation', d.id)"
        >
          <span class="region__swatch" :style="{ background: colors[d.label] }" />
          <span class="region__label">{{ d.label }}</span>
          <button
            v-if="!readonly"
            class="region__act"
            title="Remove"
            @click.stop="emit('remove-document-annotation', d.id)"
          >
            🗑
          </button>
        </li>
        <li v-if="!documentAnnotations.length" class="regions__empty">No document tags yet.</li>
      </ul>

      <DocumentRelationList
        v-if="(!readonly && otherDocuments.length) || documentRelations.length || incomingRelations.length"
        :readonly="readonly"
        :relations="documentRelations"
        :incoming-relations="incomingRelations"
        :other-documents="otherDocuments"
        :relation-labels="relationLabels"
        @add="emit('add-document-relation', $event)"
        @remove="emit('remove-document-relation', $event)"
        @set-labels="(to, labels) => emit('set-document-relation-labels', to, labels)"
      />
    </template>

    <template v-else>
      <h4 class="inspector__title">Annotations ({{ annotations.length }})</h4>

      <ul class="regions">
        <li
          v-for="(a, i) in annotations"
          :key="a.id"
          class="region"
          :class="{ 'is-selected': a.id === selectedId }"
          :style="{ '--region-color': colors[a.label] }"
          @click="emit('select', a.id)"
        >
          <span class="region__index">{{ i + 1 }}</span>
          <span class="region__swatch" :style="{ background: colors[a.label] }" />
          <span class="region__label">{{ a.label }}</span>
          <span class="region__text">{{ a.text }}</span>
          <button
            v-if="a.id === selectedId && !readonly"
            class="region__act"
            title="Draw a relation from this region"
            @click.stop="emit('link', a.id)"
          >
            🔗
          </button>
          <button
            v-if="!readonly"
            class="region__act"
            title="Delete"
            @click.stop="emit('remove', a.id)"
          >
            🗑
          </button>
        </li>
        <li v-if="!annotations.length" class="regions__empty">No annotations yet.</li>
      </ul>

      <p v-if="linkingFrom !== null" class="linking-hint">
        Click a target region to link it.
      </p>

      <RelationList
        :annotations="annotations"
        :colors="colors"
        :readonly="readonly"
        :relation-labels="relationLabels"
        @remove="(from, to) => emit('remove-relation', from, to)"
        @set-direction="(from, to, dir) => emit('set-relation-direction', from, to, dir)"
        @set-labels="(from, to, labels) => emit('set-relation-labels', from, to, labels)"
      />
    </template>
  </aside>
</template>

<style scoped>
.inspector {
  border-left: 1px solid var(--lak-border);
  padding: 0.75rem;
  overflow-y: auto;
  display: flex;
  flex-direction: column;
}
.inspector__title {
  margin: 0 0 0.6rem;
  font-size: 0.9rem;
}
.regions {
  list-style: none;
  margin: 0;
  padding: 0;
  display: flex;
  flex-direction: column;
  gap: 0.35rem;
}
.region {
  display: flex;
  align-items: center;
  gap: 0.4rem;
  padding: 0.4rem 0.5rem;
  border: 1px solid var(--lak-border);
  border-left: 4px solid var(--region-color, var(--lak-border));
  border-radius: 6px;
  font-size: 0.85rem;
  cursor: pointer;
}
.region__swatch {
  width: 0.8rem;
  height: 0.8rem;
  border-radius: 3px;
  flex-shrink: 0;
}
.region:hover {
  background: rgba(0, 0, 0, 0.03);
}
.region.is-selected {
  border-color: var(--lak-accent);
  box-shadow: inset 0 0 0 1px var(--lak-accent);
}
.region__act {
  background: none;
  border: none;
  cursor: pointer;
  font-size: 0.9rem;
  opacity: 0.6;
}
.region__act:first-of-type {
  margin-left: auto;
}
.region__act:hover {
  opacity: 1;
}
.linking-hint {
  margin: 0.5rem 0 0;
  padding: 0.4rem 0.5rem;
  background: color-mix(in srgb, var(--lak-accent) 12%, transparent);
  border-radius: 6px;
  font-size: 0.8rem;
  color: var(--lak-accent);
}
.region__index {
  color: var(--lak-muted);
}
.region__label {
  font-weight: 600;
}
.region__text {
  color: var(--lak-muted);
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
}
.selection {
  margin-bottom: 0.75rem;
  padding: 0.5rem;
  border: 1px solid var(--lak-border);
  border-left: 4px solid var(--region-color, var(--lak-accent));
  border-radius: 6px;
  display: flex;
  flex-direction: column;
  gap: 0.45rem;
}
.selection__head {
  display: flex;
  align-items: center;
  gap: 0.4rem;
  font-size: 0.85rem;
  min-width: 0;
}
.selection__text {
  color: var(--lak-muted);
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
}
.selection__hint {
  margin: 0 0 0.75rem;
  font-size: 0.8rem;
  color: var(--lak-muted);
}
.metadata {
  display: flex;
  flex-direction: column;
  gap: 0.3rem;
}
.metadata__title {
  font-size: 0.8rem;
  color: var(--lak-muted);
}
.metadata__input {
  font: inherit;
  font-size: 0.85rem;
  resize: vertical;
  padding: 0.35rem 0.45rem;
  border: 1px solid var(--lak-border);
  border-radius: 6px;
}
.regions__empty {
  color: var(--lak-muted);
  font-size: 0.85rem;
}
</style>

<script setup lang="ts">
import { ref } from "vue";
import type { Annotation, RelationDirection } from "../types";
import RelationList from "./RelationList.vue";

// Right column: inspector. Lists the current annotations (Regions / Relations),
// lets the annotator select or delete a region. Linking comes later.
defineProps<{
  annotations: Annotation[];
  colors: Record<string, string>;
  selectedId: number | null;
  linkingFrom: number | null;
}>();

const emit = defineEmits<{
  select: [id: number];
  remove: [id: number];
  link: [id: number];
  "remove-relation": [from: number, to: number];
  "set-relation-direction": [from: number, to: number, direction: RelationDirection];
  "set-relation-labels": [from: number, to: number, labels: string[]];
}>();

const tab = ref<"regions" | "labels">("regions");
</script>

<template>
  <aside class="inspector">
    <div class="tabs">
      <button :class="{ active: tab === 'regions' }" @click="tab = 'regions'">
        Regions {{ annotations.length }}
      </button>
      <button :class="{ active: tab === 'labels' }" @click="tab = 'labels'">Labels</button>
    </div>

    <ul v-if="tab === 'regions'" class="regions">
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
          v-if="a.id === selectedId"
          class="region__act"
          title="Draw a relation from this region"
          @click.stop="emit('link', a.id)"
        >
          🔗
        </button>
        <button class="region__act" title="Delete" @click.stop="emit('remove', a.id)">
          🗑
        </button>
      </li>
      <li v-if="!annotations.length" class="regions__empty">No annotations yet.</li>
    </ul>

    <p v-if="linkingFrom !== null" class="linking-hint">
      Click a target region to link it.
    </p>

    <div v-if="tab === 'labels'" class="labels-tab">Labels view — coming soon.</div>

    <RelationList
      :annotations="annotations"
      :colors="colors"
      @remove="(from, to) => emit('remove-relation', from, to)"
      @set-direction="(from, to, dir) => emit('set-relation-direction', from, to, dir)"
      @set-labels="(from, to, labels) => emit('set-relation-labels', from, to, labels)"
    />
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
.tabs {
  display: flex;
  gap: 0.25rem;
  margin-bottom: 0.75rem;
}
.tabs button {
  flex: 1;
  font: inherit;
  cursor: pointer;
  padding: 0.35rem;
  border: 1px solid var(--lak-border);
  background: transparent;
  border-radius: 6px;
}
.tabs button.active {
  background: var(--lak-accent);
  color: #fff;
  border-color: var(--lak-accent);
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
.regions__empty,
.labels-tab {
  color: var(--lak-muted);
  font-size: 0.85rem;
}
</style>

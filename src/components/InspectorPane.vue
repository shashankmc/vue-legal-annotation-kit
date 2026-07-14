<script setup lang="ts">
import { ref } from "vue";
import type { Annotation } from "../types";

// Right column: inspector. Lists the current annotations (Regions / Relations),
// lets the annotator select or delete a region. Linking comes later.
defineProps<{
  annotations: Annotation[];
  colors: Record<string, string>;
  selectedId: number | null;
}>();

const emit = defineEmits<{ select: [id: number]; remove: [id: number] }>();

const tab = ref<"regions" | "labels">("regions");

const relationCount = (anns: Annotation[]) =>
  anns.reduce((sum, a) => sum + a.relations.length, 0);
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
        <button class="region__del" title="Delete" @click.stop="emit('remove', a.id)">
          🗑
        </button>
      </li>
      <li v-if="!annotations.length" class="regions__empty">No annotations yet.</li>
    </ul>

    <div v-else class="labels-tab">Labels view — coming soon.</div>

    <div class="relations">
      <h4 class="relations__title">Relations ({{ relationCount(annotations) }})</h4>
    </div>
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
.region__del {
  margin-left: auto;
  background: none;
  border: none;
  cursor: pointer;
  font-size: 0.9rem;
  opacity: 0.6;
}
.region__del:hover {
  opacity: 1;
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
.relations {
  margin-top: 1rem;
  padding-top: 0.75rem;
  border-top: 1px solid var(--lak-border);
}
.relations__title {
  margin: 0;
  font-size: 0.9rem;
}
</style>

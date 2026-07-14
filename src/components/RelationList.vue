<script setup lang="ts">
import { computed } from "vue";
import type { Annotation, RelationDirection } from "../types";
import { RELATION_LABELS } from "../types";

// Flat, editable view of every relation across the annotations: direction,
// labels and deletion. Reads annotations to resolve region numbers/colours.
const props = defineProps<{
  annotations: Annotation[];
  colors: Record<string, string>;
}>();

const emit = defineEmits<{
  remove: [from: number, to: number];
  "set-direction": [from: number, to: number, direction: RelationDirection];
  "set-labels": [from: number, to: number, labels: string[]];
}>();

interface Row {
  from: number;
  to: number;
  direction: RelationDirection;
  labels: string[];
}

const meta = computed(() => {
  const map = new Map<number, { number: number; color: string }>();
  props.annotations.forEach((a, i) =>
    map.set(a.id, { number: i + 1, color: props.colors[a.label] }),
  );
  return map;
});

const rows = computed<Row[]>(() =>
  props.annotations.flatMap((a) =>
    a.relations.map((r) => ({
      from: a.id,
      to: r.to,
      direction: r.direction,
      labels: r.labels,
    })),
  ),
);

const ARROWS: Record<RelationDirection, string> = {
  right: "→",
  left: "←",
  bi: "↔",
};
const nextDirection = (d: RelationDirection): RelationDirection =>
  d === "right" ? "left" : d === "left" ? "bi" : "right";

const available = (labels: string[]) =>
  RELATION_LABELS.filter((l) => !labels.includes(l));

const addLabel = (row: Row, label: string) => {
  if (label) emit("set-labels", row.from, row.to, [...row.labels, label]);
};
const removeLabel = (row: Row, label: string) =>
  emit(
    "set-labels",
    row.from,
    row.to,
    row.labels.filter((l) => l !== label),
  );
</script>

<template>
  <div class="relations">
    <h4 class="relations__title">Relations ({{ rows.length }})</h4>

    <ul class="rel-list">
      <li v-for="(row, i) in rows" :key="i" class="rel">
        <div class="rel__ends">
          <span class="rel__end">
            <span class="rel__swatch" :style="{ background: meta.get(row.from)?.color }" />
            {{ meta.get(row.from)?.number }}
          </span>
          <button
            class="rel__dir"
            title="Change direction"
            @click="emit('set-direction', row.from, row.to, nextDirection(row.direction))"
          >
            {{ ARROWS[row.direction] }}
          </button>
          <span class="rel__end">
            <span class="rel__swatch" :style="{ background: meta.get(row.to)?.color }" />
            {{ meta.get(row.to)?.number }}
          </span>
          <button class="rel__del" title="Delete relation" @click="emit('remove', row.from, row.to)">
            🗑
          </button>
        </div>

        <div class="rel__labels">
          <span v-for="l in row.labels" :key="l" class="chip">
            {{ l }}
            <button class="chip__x" @click="removeLabel(row, l)">×</button>
          </span>
          <select
            class="rel__add"
            value=""
            @change="addLabel(row, ($event.target as HTMLSelectElement).value)"
          >
            <option value="">+ label</option>
            <option v-for="l in available(row.labels)" :key="l" :value="l">{{ l }}</option>
          </select>
        </div>
      </li>
      <li v-if="!rows.length" class="rel-list__empty">No relations yet.</li>
    </ul>
  </div>
</template>

<style scoped>
.relations {
  margin-top: 1rem;
  padding-top: 0.75rem;
  border-top: 1px solid var(--lak-border);
}
.relations__title {
  margin: 0 0 0.5rem;
  font-size: 0.9rem;
}
.rel-list {
  list-style: none;
  margin: 0;
  padding: 0;
  display: flex;
  flex-direction: column;
  gap: 0.5rem;
}
.rel {
  border: 1px solid var(--lak-border);
  border-radius: 6px;
  padding: 0.4rem 0.5rem;
  font-size: 0.85rem;
}
.rel__ends {
  display: flex;
  align-items: center;
  gap: 0.5rem;
}
.rel__end {
  display: inline-flex;
  align-items: center;
  gap: 0.3rem;
  font-weight: 600;
}
.rel__swatch {
  width: 0.7rem;
  height: 0.7rem;
  border-radius: 2px;
}
.rel__dir {
  font: inherit;
  cursor: pointer;
  border: 1px solid var(--lak-border);
  background: transparent;
  border-radius: 4px;
  padding: 0 0.4rem;
}
.rel__del {
  margin-left: auto;
  background: none;
  border: none;
  cursor: pointer;
  opacity: 0.6;
}
.rel__del:hover {
  opacity: 1;
}
.rel__labels {
  display: flex;
  flex-wrap: wrap;
  gap: 0.3rem;
  margin-top: 0.4rem;
}
.chip {
  display: inline-flex;
  align-items: center;
  gap: 0.2rem;
  background: rgba(0, 0, 0, 0.07);
  border-radius: 999px;
  padding: 0.05rem 0.5rem;
  font-size: 0.78rem;
}
.chip__x {
  background: none;
  border: none;
  cursor: pointer;
  font-size: 0.9rem;
  line-height: 1;
  padding: 0;
}
.rel__add {
  font: inherit;
  font-size: 0.78rem;
  border: 1px dashed var(--lak-border);
  border-radius: 999px;
  background: transparent;
  cursor: pointer;
}
.rel-list__empty {
  color: var(--lak-muted);
  font-size: 0.85rem;
}
</style>

<script setup lang="ts">
import { ref } from "vue";
import type { DocumentRelation, DocumentRelationDirection } from "../types";
import type { DocumentRef } from "../model/source";
import { RELATION_LABELS } from "../types";

// Document-level counterpart to RelationList: the current document's
// relations to other whole documents. Keyed by target document name (no
// annotation ids, no colours). Creating one also seeds the mirror-image entry
// on the target document — after that, every row here (auto-seeded or not)
// is a normal, independent, fully editable relation.
const props = defineProps<{
  relations: DocumentRelation[];
  /** Queue documents this one may point at, minus itself. */
  otherDocuments: DocumentRef[];
}>();

const emit = defineEmits<{
  add: [toName: string, direction: DocumentRelationDirection];
  remove: [toName: string];
  "set-direction": [toName: string, direction: DocumentRelationDirection];
  "set-labels": [toName: string, labels: string[]];
}>();

const ARROWS: Record<DocumentRelationDirection, string> = { right: "→", left: "←" };
const nextDirection = (d: DocumentRelationDirection): DocumentRelationDirection =>
  d === "right" ? "left" : "right";

const available = (labels: string[]) =>
  RELATION_LABELS.filter((l) => !labels.includes(l));

// Only documents not already related to (either direction) can be added.
const addable = () => {
  const taken = new Set(props.relations.map((r) => r.to));
  return props.otherDocuments.filter((d) => !taken.has(d.name));
};

// Direction for the next relation to be created — chosen before picking a
// target, so the mirror seeded on the target starts out correct.
const pendingDirection = ref<DocumentRelationDirection>("right");

const addRelation = (name: string) => {
  if (name) emit("add", name, pendingDirection.value);
};
const addLabel = (rel: DocumentRelation, label: string) => {
  if (label) emit("set-labels", rel.to, [...rel.labels, label]);
};
const removeLabel = (rel: DocumentRelation, label: string) =>
  emit("set-labels", rel.to, rel.labels.filter((l) => l !== label));
</script>

<template>
  <div class="doc-relations">
    <h4 class="doc-relations__title">Document Relations ({{ relations.length }})</h4>

    <ul class="rel-list">
      <li v-for="rel in relations" :key="rel.to" class="rel">
        <div class="rel__ends">
          <button
            class="rel__dir"
            title="Change direction"
            @click="emit('set-direction', rel.to, nextDirection(rel.direction))"
          >
            {{ ARROWS[rel.direction] }}
          </button>
          <span class="rel__end" :title="rel.to">{{ rel.to }}</span>
          <button class="rel__del" title="Remove relation" @click="emit('remove', rel.to)">
            🗑
          </button>
        </div>

        <div class="rel__labels">
          <span v-for="l in rel.labels" :key="l" class="chip">
            {{ l }}
            <button class="chip__x" @click="removeLabel(rel, l)">×</button>
          </span>
          <select
            class="rel__add-label"
            value=""
            @change="addLabel(rel, ($event.target as HTMLSelectElement).value)"
          >
            <option value="">+ label</option>
            <option v-for="l in available(rel.labels)" :key="l" :value="l">{{ l }}</option>
          </select>
        </div>
      </li>
      <li v-if="!relations.length" class="rel-list__empty">No document relations yet.</li>
    </ul>

    <div v-if="addable().length" class="doc-relations__new">
      <button
        class="rel__dir"
        title="Direction for the new relation"
        @click="pendingDirection = nextDirection(pendingDirection)"
      >
        {{ ARROWS[pendingDirection] }}
      </button>
      <select
        class="doc-relations__add"
        value=""
        @change="addRelation(($event.target as HTMLSelectElement).value)"
      >
        <option value="">+ link to a document…</option>
        <option v-for="d in addable()" :key="d.name" :value="d.name">{{ d.name }}</option>
      </select>
    </div>
  </div>
</template>

<style scoped>
.doc-relations {
  margin-top: 1rem;
  padding-top: 0.75rem;
  border-top: 1px solid var(--lak-border);
}
.doc-relations__title {
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
  font-weight: 600;
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
}
.rel__dir {
  font: inherit;
  cursor: pointer;
  border: 1px solid var(--lak-border);
  background: transparent;
  border-radius: 4px;
  padding: 0 0.4rem;
  flex-shrink: 0;
}
.rel__del {
  margin-left: auto;
  background: none;
  border: none;
  cursor: pointer;
  opacity: 0.6;
  flex-shrink: 0;
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
.rel__add-label {
  font: inherit;
  font-size: 0.78rem;
  border: 1px dashed var(--lak-border);
  border-radius: 999px;
  background: transparent;
  cursor: pointer;
}
.doc-relations__new {
  margin-top: 0.6rem;
  display: flex;
  gap: 0.4rem;
}
.doc-relations__add {
  flex: 1;
  font: inherit;
  font-size: 0.8rem;
  padding: 0.3rem 0.4rem;
  border: 1px dashed var(--lak-border);
  border-radius: 6px;
  background: transparent;
  cursor: pointer;
}
.rel-list__empty {
  color: var(--lak-muted);
  font-size: 0.85rem;
}
</style>

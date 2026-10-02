<script setup lang="ts">
import type { DocumentRelation } from "../types";
import type { DocumentRef, IncomingRelation } from "../model/source";
import { documentKey } from "../model/source";
import { RELATION_LABELS } from "../types";

// Document-level counterpart to RelationList: the current document's own
// outgoing relations to other whole documents, plus a read-only "Linked by"
// list of other documents' relations that point here. A relation is always
// "this document links to the target" and is stored only on the document
// that created it — "Linked by" is computed for display, not real data of
// this document's own; edit it from the other document instead.
const props = defineProps<{
  relations: DocumentRelation[];
  incomingRelations: IncomingRelation[];
  /** Queue documents this one may point at, minus itself. */
  otherDocuments: DocumentRef[];
  /** Show the relations without letting anything change. */
  readonly?: boolean;
}>();

const emit = defineEmits<{
  add: [toName: string];
  remove: [toName: string];
  "set-labels": [toName: string, labels: string[]];
}>();

const available = (labels: string[]) =>
  RELATION_LABELS.filter((l) => !labels.includes(l));

// Only documents not already related to can be added as a new target.
const addable = () => {
  const taken = new Set(props.relations.map((r) => r.to));
  return props.otherDocuments.filter((d) => !taken.has(documentKey(d)));
};

// What a document is called in this list: its name and queue position, which
// also tells apart documents that share a name — including one that shares
// the open document's name. A relation whose target is not among
// otherDocuments shows what it stores.
const label = (d: DocumentRef) => `${d.name} (#${d.order})`;
const targetLabel = (to: string) => {
  const d = props.otherDocuments.find((o) => documentKey(o) === to);
  return d ? label(d) : to;
};

const addRelation = (name: string) => {
  if (name) emit("add", name);
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
          <span class="rel__arrow" aria-hidden="true">→</span>
          <span class="rel__end" :title="targetLabel(rel.to)">{{ targetLabel(rel.to) }}</span>
          <button v-if="!readonly" class="rel__del" title="Remove relation" @click="emit('remove', rel.to)">
            🗑
          </button>
        </div>

        <div class="rel__labels">
          <span v-for="l in rel.labels" :key="l" class="chip">
            {{ l }}
            <button v-if="!readonly" class="chip__x" @click="removeLabel(rel, l)">×</button>
          </span>
          <select
            v-if="!readonly"
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

    <select
      v-if="!readonly && addable().length"
      class="doc-relations__add"
      value=""
      @change="addRelation(($event.target as HTMLSelectElement).value)"
    >
      <option value="">+ link to a document…</option>
      <option v-for="d in addable()" :key="documentKey(d)" :value="documentKey(d)">{{ label(d) }}</option>
    </select>

    <template v-if="incomingRelations.length">
      <h4 class="doc-relations__title doc-relations__title--incoming">
        Linked by ({{ incomingRelations.length }})
      </h4>
      <ul class="rel-list">
        <li v-for="(rel, i) in incomingRelations" :key="i" class="rel rel--incoming">
          <div class="rel__ends">
            <span class="rel__arrow" aria-hidden="true">←</span>
            <span
              class="rel__end"
              :title="`Created on ${rel.from} — edit it there`"
            >
              {{ rel.from }}
            </span>
          </div>
          <div v-if="rel.labels.length" class="rel__labels">
            <span v-for="l in rel.labels" :key="l" class="chip chip--readonly">{{ l }}</span>
          </div>
        </li>
      </ul>
    </template>
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
.doc-relations__title--incoming {
  margin-top: 1rem;
  color: var(--lak-muted);
  font-size: 0.8rem;
  text-transform: uppercase;
  letter-spacing: 0.03em;
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
.rel--incoming {
  background: rgba(0, 0, 0, 0.03);
}
.rel__ends {
  display: flex;
  align-items: center;
  gap: 0.5rem;
}
.rel__arrow {
  color: var(--lak-muted);
  flex-shrink: 0;
}
.rel__end {
  font-weight: 600;
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
}
.rel--incoming .rel__end {
  font-weight: 400;
  color: var(--lak-muted);
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
.chip--readonly {
  color: var(--lak-muted);
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
.doc-relations__add {
  margin-top: 0.6rem;
  font: inherit;
  font-size: 0.8rem;
  padding: 0.3rem 0.4rem;
  border: 1px dashed var(--lak-border);
  border-radius: 6px;
  background: transparent;
  cursor: pointer;
  width: 100%;
}
.rel-list__empty {
  color: var(--lak-muted);
  font-size: 0.85rem;
}
</style>

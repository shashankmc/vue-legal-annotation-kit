<script setup lang="ts">
import { computed, nextTick, onBeforeUnmount, onMounted, ref, watch } from "vue";
import type { DocumentRef } from "../model/source";
import { documentKey } from "../model/source";
import { documentLabel, searchDocuments } from "../model/documentSearch";

// A searchable dropdown for choosing the document a relation points at: type
// to narrow a long queue down by name or position, move with the arrow keys,
// pick with Enter or a click. Purely presentational — it reports the choice
// and, when the host wants to offer it, a request to read a document first.
const props = defineProps<{
  /** The documents that can be picked. */
  options: DocumentRef[];
  /** Offer a "Read more" button on each option (the host decides what it does). */
  previewable?: boolean;
  placeholder?: string;
}>();

const emit = defineEmits<{
  /** A document was chosen; `key` is what a relation stores. */
  select: [key: string];
  /** The annotator asked to read this document before choosing. */
  preview: [document: DocumentRef];
}>();

const open = ref(false);
const query = ref("");
const active = ref(0);
const root = ref<HTMLElement | null>(null);
const search = ref<HTMLInputElement | null>(null);
const list = ref<HTMLElement | null>(null);

const results = computed(() => searchDocuments(props.options, query.value));
const optionId = (i: number) => `lak-doc-option-${i}`;

// Whatever the search changes, the first match is the one Enter picks.
watch(results, () => (active.value = 0));

const openPanel = async () => {
  open.value = true;
  query.value = "";
  active.value = 0;
  await nextTick();
  search.value?.focus();
};
const closePanel = () => {
  open.value = false;
};
const toggle = () => (open.value ? closePanel() : openPanel());

const choose = (d: DocumentRef) => {
  emit("select", documentKey(d));
  closePanel();
};

const move = (step: number) => {
  if (!results.value.length) return;
  active.value = (active.value + step + results.value.length) % results.value.length;
  nextTick(() => list.value?.children[active.value]?.scrollIntoView({ block: "nearest" }));
};

const onKeydown = (e: KeyboardEvent) => {
  if (e.key === "ArrowDown") move(1);
  else if (e.key === "ArrowUp") move(-1);
  else if (e.key === "Enter") {
    const d = results.value[active.value];
    if (d) choose(d);
  } else if (e.key === "Escape") closePanel();
  else return;
  e.preventDefault();
};

const onClickOutside = (e: MouseEvent) => {
  if (open.value && root.value && !root.value.contains(e.target as Node)) closePanel();
};
onMounted(() => document.addEventListener("click", onClickOutside));
onBeforeUnmount(() => document.removeEventListener("click", onClickOutside));
</script>

<template>
  <div ref="root" class="picker">
    <button
      type="button"
      class="picker__toggle"
      aria-haspopup="listbox"
      :aria-expanded="open"
      @click="toggle"
    >
      {{ placeholder ?? "+ link to a document…" }}
    </button>

    <div v-if="open" class="picker__panel">
      <input
        ref="search"
        v-model="query"
        class="picker__search"
        type="text"
        role="combobox"
        aria-controls="lak-doc-listbox"
        aria-autocomplete="list"
        :aria-activedescendant="results.length ? optionId(active) : undefined"
        placeholder="Search by name or position…"
        @keydown="onKeydown"
      />
      <ul id="lak-doc-listbox" ref="list" class="picker__list" role="listbox">
        <li
          v-for="(d, i) in results"
          :id="optionId(i)"
          :key="documentKey(d)"
          class="picker__option"
          :class="{ 'is-active': i === active }"
          role="option"
          :aria-selected="i === active"
          @mouseenter="active = i"
          @click="choose(d)"
        >
          <span class="picker__name" :title="documentLabel(d)">{{ documentLabel(d) }}</span>
          <button
            v-if="previewable"
            type="button"
            class="picker__read"
            title="Read this document before choosing"
            @click.stop="emit('preview', d)"
          >
            Read more
          </button>
        </li>
        <li v-if="!results.length" class="picker__empty">No document matches “{{ query }}”.</li>
      </ul>
    </div>
  </div>
</template>

<style scoped>
.picker {
  position: relative;
  margin-top: 0.6rem;
}
.picker__toggle {
  width: 100%;
  font: inherit;
  font-size: 0.8rem;
  text-align: left;
  padding: 0.3rem 0.4rem;
  border: 1px dashed var(--lak-border, rgba(0, 0, 0, 0.12));
  border-radius: var(--lak-radius, 6px);
  background: transparent;
  cursor: pointer;
}
.picker__panel {
  position: absolute;
  z-index: 20;
  left: 0;
  right: 0;
  top: calc(100% + 0.2rem);
  display: flex;
  flex-direction: column;
  max-height: 16rem;
  background: var(--lak-surface, #fff);
  border: 1px solid var(--lak-border, rgba(0, 0, 0, 0.12));
  border-radius: var(--lak-radius, 6px);
  box-shadow: 0 6px 20px var(--lak-shadow, rgba(0, 0, 0, 0.15));
}
.picker__search {
  font: inherit;
  font-size: 0.82rem;
  padding: 0.4rem 0.55rem;
  border: none;
  border-bottom: 1px solid var(--lak-border, rgba(0, 0, 0, 0.12));
  border-radius: var(--lak-radius, 6px) var(--lak-radius, 6px) 0 0;
}
.picker__search:focus {
  outline: none;
}
.picker__list {
  list-style: none;
  margin: 0;
  padding: 0.25rem;
  overflow-y: auto;
}
.picker__option {
  display: flex;
  align-items: center;
  gap: 0.4rem;
  padding: 0.3rem 0.4rem;
  border-radius: var(--lak-radius-sm, 4px);
  font-size: 0.82rem;
  cursor: pointer;
}
.picker__option.is-active {
  background: var(--lak-hover, rgba(0, 0, 0, 0.06));
}
.picker__name {
  flex: 1;
  min-width: 0;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}
.picker__read {
  flex-shrink: 0;
  font: inherit;
  font-size: 0.72rem;
  padding: 0.1rem 0.45rem;
  border: 1px solid var(--lak-border, rgba(0, 0, 0, 0.12));
  border-radius: 999px;
  background: var(--lak-surface, #fff);
  color: var(--lak-accent, #1e4e79);
  cursor: pointer;
}
.picker__read:hover {
  background: var(--lak-accent, #1e4e79);
  color: var(--lak-on-accent, #fff);
}
.picker__empty {
  padding: 0.5rem;
  font-size: 0.8rem;
  color: var(--lak-muted, #6b7280);
}
</style>

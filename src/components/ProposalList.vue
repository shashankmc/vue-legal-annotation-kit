<script setup lang="ts">
import { nextTick, ref, watch } from "vue";
import type { Label, Proposal } from "../types";

// Proposed annotations, kept apart from the annotator's own: each says what it
// suggests and why, and offers Accept, Reject or a different label. Nothing
// here changes the assignment by itself; the view acts on what is emitted.
const props = defineProps<{
  proposals: Proposal[];
  /** Labels a span proposal can be changed to. */
  spanLabels: Label[];
  /** Labels a document proposal can be changed to. */
  documentLabels: Label[];
  spanColors: Record<string, string>;
  documentColors: Record<string, string>;
  /** The text a span proposal covers, for showing it. */
  text: string;
  /** Proposal to bring into view and focus (picked in the text). */
  focusedId?: Proposal["id"] | null;
  readonly?: boolean;
}>();

const emit = defineEmits<{
  accept: [proposal: Proposal];
  reject: [proposal: Proposal];
  correct: [proposal: Proposal, label: string];
}>();

const colorOf = (p: Proposal) =>
  (p.kind === "span" ? props.spanColors : props.documentColors)[p.label];
const otherLabels = (p: Proposal) =>
  (p.kind === "span" ? props.spanLabels : props.documentLabels).filter((l) => l.name !== p.label);
const excerpt = (p: Proposal) => (p.kind === "span" ? props.text.slice(p.start, p.end) : "");

const items = ref<HTMLElement[]>([]);
watch(
  () => props.focusedId,
  async (id) => {
    if (id === null || id === undefined) return;
    await nextTick();
    const i = props.proposals.findIndex((p) => p.id === id);
    items.value[i]?.focus();
    items.value[i]?.scrollIntoView?.({ block: "nearest" });
  },
);

// Keys act on the focused proposal only, so they never collide with the label
// hotkeys: Enter accepts, Delete or Backspace rejects.
const onKeydown = (e: KeyboardEvent, p: Proposal) => {
  if (props.readonly || e.target !== e.currentTarget) return;
  if (e.key === "Enter") emit("accept", p);
  else if (e.key === "Delete" || e.key === "Backspace") emit("reject", p);
  else return;
  e.preventDefault();
  e.stopPropagation();
};

const onCorrect = (p: Proposal, event: Event) => {
  const select = event.target as HTMLSelectElement;
  if (select.value) emit("correct", p, select.value);
  select.value = "";
};
</script>

<template>
  <section v-if="proposals.length" class="proposals" aria-label="Suggestions">
    <h4 class="proposals__title">Suggestions ({{ proposals.length }})</h4>
    <ul class="proposals__list">
      <li
        v-for="p in proposals"
        :key="p.id"
        ref="items"
        class="proposal"
        :class="{ 'is-focused': p.id === focusedId }"
        :style="{ '--proposal-color': colorOf(p) }"
        tabindex="0"
        :aria-label="`Suggested ${p.kind === 'span' ? 'annotation' : 'tag'}: ${p.label}`"
        @keydown="onKeydown($event, p)"
      >
        <div class="proposal__head">
          <span class="proposal__swatch" :style="{ background: colorOf(p) }" />
          <span class="proposal__label">{{ p.label }}</span>
          <span class="proposal__badge">Suggested</span>
        </div>
        <p v-if="excerpt(p)" class="proposal__text" :title="excerpt(p)">“{{ excerpt(p) }}”</p>
        <p v-if="p.rationale" class="proposal__rationale" :title="p.rationale">{{ p.rationale }}</p>
        <p v-if="p.source" class="proposal__source">{{ p.source }}</p>
        <div v-if="!readonly" class="proposal__actions">
          <button type="button" class="proposal__btn proposal__btn--accept" @click="emit('accept', p)">
            Accept
          </button>
          <button type="button" class="proposal__btn" @click="emit('reject', p)">Reject</button>
          <select
            v-if="otherLabels(p).length"
            class="proposal__correct"
            aria-label="Change the label to"
            @change="onCorrect(p, $event)"
          >
            <option value="">Change to…</option>
            <option v-for="l in otherLabels(p)" :key="l.name" :value="l.name">{{ l.name }}</option>
          </select>
        </div>
      </li>
    </ul>
  </section>
</template>

<style scoped>
.proposals {
  margin-bottom: 0.9rem;
}
.proposals__title {
  margin: 0 0 0.6rem;
  font-size: 0.9rem;
}
.proposals__list {
  list-style: none;
  margin: 0;
  padding: 0;
  display: flex;
  flex-direction: column;
  gap: 0.45rem;
}
.proposal {
  padding: 0.45rem 0.55rem;
  border: 1px dashed var(--proposal-color, var(--lak-border, rgba(0, 0, 0, 0.12)));
  border-left: 4px dashed var(--proposal-color, var(--lak-border, rgba(0, 0, 0, 0.12)));
  border-radius: var(--lak-radius, 6px);
  background: var(--lak-surface, #fff);
  font-size: 0.85rem;
  outline: none;
}
.proposal:focus-visible,
.proposal.is-focused {
  box-shadow: 0 0 0 2px var(--lak-accent, #1e4e79);
}
.proposal__head {
  display: flex;
  align-items: center;
  gap: 0.4rem;
}
.proposal__swatch {
  width: 0.8rem;
  height: 0.8rem;
  border-radius: var(--lak-radius-sm, 3px);
  flex-shrink: 0;
}
.proposal__label {
  font-weight: 600;
}
.proposal__badge {
  margin-left: auto;
  padding: 0 0.4rem;
  border: 1px dashed var(--lak-muted, #6b7280);
  border-radius: 999px;
  color: var(--lak-muted, #6b7280);
  font-size: 0.7rem;
}
.proposal__text,
.proposal__rationale {
  margin: 0.3rem 0 0;
  display: -webkit-box;
  -webkit-line-clamp: 3;
  -webkit-box-orient: vertical;
  overflow: hidden;
}
.proposal__text {
  font-style: italic;
}
.proposal__rationale {
  color: var(--lak-fg-soft, #374151);
}
.proposal__source {
  margin: 0.25rem 0 0;
  color: var(--lak-muted, #6b7280);
  font-size: 0.72rem;
}
.proposal__actions {
  display: flex;
  flex-wrap: wrap;
  gap: 0.35rem;
  margin-top: 0.45rem;
}
.proposal__btn,
.proposal__correct {
  padding: 0.2rem 0.55rem;
  border: 1px solid var(--lak-border-strong, #d1d5db);
  border-radius: var(--lak-radius, 6px);
  background: var(--lak-surface, #fff);
  color: var(--lak-fg-soft, #374151);
  font: inherit;
  font-size: 0.8rem;
  cursor: pointer;
}
.proposal__btn--accept {
  border-color: var(--lak-accent, #1e4e79);
  background: var(--lak-accent, #1e4e79);
  color: var(--lak-on-accent, #fff);
}
.proposal__btn:hover,
.proposal__correct:hover {
  background: var(--lak-hover, rgba(0, 0, 0, 0.05));
}
.proposal__btn--accept:hover {
  background: var(--lak-accent, #1e4e79);
  filter: brightness(1.1);
}
</style>

<script setup lang="ts">
import type { AnnotationLevel, AssignmentStatus, QueuePosition } from "../types";

// Top bar: document name, level, status, progress, and sequence navigation.
// Emits raw intents; the parent decides what saving/advancing means.
const props = defineProps<{
  status: AssignmentStatus;
  position: QueuePosition;
  annotationLevel: AnnotationLevel;
  documentName: string;
  /** Whether there's anything the Save button hasn't captured yet. */
  unsaved?: boolean;
  /** Briefly true right after a manual save, for a "Saved ✓" confirmation. */
  justSaved?: boolean;
}>();

defineEmits<{ previous: []; save: []; next: [] }>();

const LEVEL_LABELS: Record<AnnotationLevel, string> = {
  character: "Character-level",
  word: "Word-level",
  sentence: "Sentence-level",
  paragraph: "Paragraph-level",
  document: "Document-level",
};

const isFirst = () => props.position.current <= 1;
const isLast = () => props.position.current >= props.position.total;
const percent = () =>
  props.position.total
    ? Math.round((props.position.current / props.position.total) * 100)
    : 0;
</script>

<template>
  <header class="header">
    <div class="header__left">
      <span class="header__doc-name" :title="documentName">{{ documentName }}</span>
      <span class="badge badge--level">{{ LEVEL_LABELS[annotationLevel] }}</span>
      <span class="badge" :class="status === 'done' ? 'badge--done' : 'badge--pending'">
        {{ status }}
      </span>
    </div>

    <div class="header__progress">
      <span class="header__count">{{ position.current }}/{{ position.total }}</span>
      <div class="progress">
        <div class="progress__bar" :style="{ width: percent() + '%' }">{{ percent() }}%</div>
      </div>
    </div>

    <div class="header__nav">
      <button class="btn btn--outline" :disabled="isFirst()" @click="$emit('previous')">
        ← Back
      </button>
      <button
        class="btn btn--outline btn--save"
        :class="{ 'btn--unsaved': unsaved && !justSaved, 'btn--saved': justSaved }"
        @click="$emit('save')"
      >
        <span class="btn__icon" aria-hidden="true">
          <svg
            v-if="!justSaved"
            viewBox="0 0 16 16"
            width="13"
            height="13"
            fill="none"
            stroke="currentColor"
            stroke-width="1.3"
            stroke-linecap="round"
            stroke-linejoin="round"
          >
            <path d="M2.5 2.5h8l2.5 2.5v8.5h-10.5z" />
            <path d="M4.5 2.5v4h5v-4" />
            <path d="M4.5 13.5v-4h6.5v4" />
          </svg>
          <svg
            v-else
            viewBox="0 0 16 16"
            width="13"
            height="13"
            fill="none"
            stroke="currentColor"
            stroke-width="1.8"
            stroke-linecap="round"
            stroke-linejoin="round"
          >
            <path d="M3 8.4l3.1 3.1L13 4.6" />
          </svg>
        </span>
        Save
      </button>
      <button class="btn btn--primary" @click="$emit('next')">
        {{ isLast() ? "Finish" : "Next →" }}
      </button>
    </div>
  </header>
</template>

<style scoped>
.header {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 0.6rem;
  padding: 0.5rem 0.75rem;
}
.header__left,
.header__nav {
  display: flex;
  align-items: center;
  gap: 0.4rem;
  min-width: 0;
}
.header__doc-name {
  font-size: 0.78rem;
  font-weight: 600;
  color: var(--lak-muted);
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
  min-width: 0;
  flex-shrink: 1;
}
.header__progress {
  display: flex;
  align-items: center;
  gap: 0.4rem;
  flex: 1;
  max-width: 28%;
}
.header__count {
  font-weight: 600;
  font-size: 0.85rem;
  white-space: nowrap;
}
.progress {
  flex: 1;
  background: var(--lak-progress-track);
  border-radius: 999px;
  overflow: hidden;
}
.progress__bar {
  background: var(--lak-accent);
  color: #fff;
  font-size: 0.7rem;
  text-align: center;
  padding: 0.1rem 0;
  min-width: 2rem;
}
.badge {
  text-transform: capitalize;
  font-size: 0.72rem;
  font-weight: 600;
  padding: 0.1rem 0.45rem;
  border-radius: 999px;
  color: #fff;
  white-space: nowrap;
  flex-shrink: 0;
}
.badge--done {
  background: var(--lak-success);
}
.badge--pending {
  background: var(--lak-danger);
}
.badge--level {
  background: rgba(0, 0, 0, 0.08);
  color: var(--lak-muted);
}
.btn {
  font: inherit;
  font-size: 0.85rem;
  cursor: pointer;
  border-radius: 6px;
  padding: 0.3rem 0.65rem;
  border: 1px solid transparent;
  transition: background 0.2s ease, color 0.2s ease, border-color 0.2s ease;
}
.btn:disabled {
  opacity: 0.5;
  cursor: default;
}
.btn--outline {
  background: transparent;
  border-color: var(--lak-accent);
  color: var(--lak-accent);
  text-decoration: none;
}
.btn--primary {
  background: var(--lak-accent);
  color: #fff;
}
.btn--save {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  gap: 0.3rem;
  /* Fixed width so the icon swap on save never reflows the rest of the header. */
  min-width: 5.5rem;
}
.btn__icon {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  width: 13px;
  height: 13px;
  flex-shrink: 0;
}
.btn--unsaved {
  border-color: #d97706;
  color: #d97706;
}
.btn--saved {
  border-color: var(--lak-success);
  color: var(--lak-success);
  background: color-mix(in srgb, var(--lak-success) 14%, transparent);
}
</style>

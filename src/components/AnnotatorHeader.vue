<script setup lang="ts">
import type { AnnotationLevel, AssignmentStatus, QueuePosition } from "../types";

// Top bar: document name, level, status, progress, and sequence navigation.
// Emits raw intents; the parent decides what saving/advancing means.
const props = defineProps<{
  status: AssignmentStatus;
  position: QueuePosition;
  annotationLevel: AnnotationLevel;
  documentName: string;
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
      <button class="btn btn--outline" @click="$emit('save')">Save</button>
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
</style>

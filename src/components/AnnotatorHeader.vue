<script setup lang="ts">
import type { AnnotationLevel, AssignmentStatus, QueuePosition } from "../types";

// Top bar: guidelines link, level, status, progress, and sequence navigation.
// Emits raw intents; the parent decides what saving/advancing means.
const props = defineProps<{
  status: AssignmentStatus;
  position: QueuePosition;
  annotationLevel: AnnotationLevel;
  guidelinesUrl?: string;
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
      <a
        v-if="guidelinesUrl"
        class="guidelines-link"
        :href="guidelinesUrl"
        target="_blank"
        rel="noopener"
      >
        📖 See Annotation Guidelines
      </a>
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
      <button class="btn btn--outline btn--icon" title="Save" @click="$emit('save')">💾</button>
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
  gap: 1rem;
  padding: 0.6rem 1rem;
}
.header__left,
.header__nav {
  display: flex;
  align-items: center;
  gap: 0.5rem;
}
.header__progress {
  display: flex;
  align-items: center;
  gap: 0.5rem;
  flex: 1;
  max-width: 32%;
}
.header__count {
  font-weight: 600;
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
  font-size: 0.75rem;
  text-align: center;
  padding: 0.15rem 0;
  min-width: 2rem;
}
.badge {
  text-transform: capitalize;
  font-size: 0.8rem;
  font-weight: 600;
  padding: 0.15rem 0.6rem;
  border-radius: 999px;
  color: #fff;
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
.guidelines-link {
  font-size: 0.8rem;
  color: var(--lak-accent);
  text-decoration: none;
}
.guidelines-link:hover {
  text-decoration: underline;
}
.btn {
  font: inherit;
  cursor: pointer;
  border-radius: 6px;
  padding: 0.4rem 0.8rem;
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
.btn--icon {
  padding: 0.4rem 0.55rem;
}
</style>

<script setup lang="ts">
import { computed, ref } from "vue";
import type { Annotation } from "../types";
import { selectionOffsets } from "../model/selection";
import { segmentText } from "../model/spans";

// Center column: the document text with annotations rendered as highlights.
// On mouse-up, a non-empty selection is reported as character offsets; clicking
// a highlight selects the (most specific) annotation under it.
const props = defineProps<{
  text: string;
  annotations: Annotation[];
  colors: Record<string, string>;
  selectedId: number | null;
}>();

const emit = defineEmits<{
  create: [payload: { start: number; end: number; text: string }];
  select: [id: number];
}>();

const root = ref<HTMLElement>();

const byId = computed(
  () => new Map(props.annotations.map((a) => [a.id, a] as const)),
);

const segments = computed(() => segmentText(props.text, props.annotations));

// The most specific (smallest) annotation covering a segment drives its colour
// and click target; that's the one a user most likely means to act on.
const primary = (ids: number[]): Annotation | undefined => {
  let best: Annotation | undefined;
  for (const id of ids) {
    const a = byId.value.get(id);
    if (a && (!best || a.end - a.start < best.end - best.start)) best = a;
  }
  return best;
};

const onMouseUp = () => {
  if (!root.value) return;
  const range = selectionOffsets(root.value);
  if (!range) return;
  emit("create", { ...range, text: props.text.slice(range.start, range.end) });
  window.getSelection()?.removeAllRanges();
};
</script>

<template>
  <section ref="root" class="document" @mouseup="onMouseUp">
    <p class="document__text">
      <template v-for="(seg, i) in segments" :key="i">
        <mark
          v-if="seg.annotationIds.length && primary(seg.annotationIds)"
          class="mark"
          :class="{
            'is-selected': seg.annotationIds.includes(selectedId ?? NaN),
            'is-overlap': seg.annotationIds.length > 1,
          }"
          :style="{ '--mark-color': colors[primary(seg.annotationIds)!.label] }"
          :title="seg.annotationIds.map((id) => byId.get(id)?.label).join(', ')"
          @click.stop="emit('select', primary(seg.annotationIds)!.id)"
          >{{ seg.text }}</mark
        >
        <template v-else>{{ seg.text }}</template>
      </template>
    </p>
  </section>
</template>

<style scoped>
.document {
  overflow-y: auto;
  padding: 1.2rem 1.5rem;
}
.document__text {
  margin: 0;
  line-height: 1.9;
  white-space: pre-wrap;
}
.mark {
  background: color-mix(in srgb, var(--mark-color) 40%, transparent);
  border-bottom: 2px solid var(--mark-color);
  border-radius: 2px;
  padding: 0.05em 0;
  cursor: pointer;
}
.mark.is-overlap {
  border-bottom-style: double;
  border-bottom-width: 3px;
}
.mark.is-selected {
  outline: 2px solid var(--mark-color);
  outline-offset: 1px;
}
</style>

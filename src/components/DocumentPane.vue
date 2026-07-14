<script setup lang="ts">
import { ref } from "vue";
import { selectionOffsets } from "../model/selection";

// Center column: the document text. On mouse-up, a non-empty selection is
// reported as character offsets; the parent decides whether to make a span.
const props = defineProps<{ text: string }>();

const emit = defineEmits<{
  create: [payload: { start: number; end: number; text: string }];
}>();

const root = ref<HTMLElement>();

const onMouseUp = () => {
  if (!root.value) return;
  const range = selectionOffsets(root.value);
  if (!range) return;
  emit("create", {
    ...range,
    text: props.text.slice(range.start, range.end),
  });
  window.getSelection()?.removeAllRanges();
};
</script>

<template>
  <section ref="root" class="document" @mouseup="onMouseUp">
    <p class="document__text">{{ text }}</p>
  </section>
</template>

<style scoped>
.document {
  overflow-y: auto;
  padding: 1.2rem 1.5rem;
}
.document__text {
  margin: 0;
  line-height: 1.7;
  white-space: pre-wrap;
}
</style>

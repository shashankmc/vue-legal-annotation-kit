<script setup lang="ts">
// Center column for document-level tasks: plain reference text, no selection,
// no highlights, no relation arcs — tagging happens entirely via the sidebar
// chips / inspector list, not by interacting with the text.
defineProps<{
  text: string;
}>();
</script>

<template>
  <section class="document-text">
    <p class="document-text__body">{{ text }}</p>
  </section>
</template>

<style scoped>
.document-text {
  overflow-y: auto;
  padding: 2.6rem 1.5rem 1.2rem;
}
.document-text__body {
  margin: 0;
  line-height: 2.1;
  white-space: pre-wrap;
}
</style>

<script setup lang="ts">
// Center column: the document text. No highlighting/selection logic yet —
// this is where span rendering will live once the annotation layer exists.
defineProps<{ text: string }>();
</script>

<template>
  <section class="document">
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

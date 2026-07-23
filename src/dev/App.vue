<script setup lang="ts">
// TEMP: verifying createLazySource against a simulated slow backend.
// import { ref } from "vue";
import AnnotatorQueue from "../components/AnnotatorQueue.vue";
import { createBulkSource } from "../model/bulkSource";
// import { createLazySource } from "../model/lazySource";
// import { flattenAssignments } from "../model/source";
// import type { Assignment } from "../types";
import { toTaskData } from "./legacyAdapter";
import rawTask from "./input/Small Task.json";

const task = toTaskData(rawTask as any);

const source = createBulkSource(task, 1);

// const bundles = flattenAssignments(task, 1);
// const delay = (ms: number) => new Promise((r) => setTimeout(r, ms));
// const saveLog: Assignment[] = [];
// (window as any).__saveLog = saveLog;
// (window as any).__loadLog = [];

// const source = ref<Awaited<ReturnType<typeof createLazySource>> | null>(null);

// createLazySource({
//   total: async () => {
//     await delay(400);
//     return bundles.length;
//   },
//   load: async (position) => {
//     await delay(400);
//     (window as any).__loadLog.push(position);
//     const bundle = bundles[position - 1];
//     if (!bundle) throw new Error(`No assignment at position ${position}`);
//     return bundle;
//   },
//   save: async (assignment) => {
//     await delay(200);
//     const b = bundles.find((x) => x.assignment.order === assignment.order);
//     if (b) b.assignment = assignment;
//     saveLog.push(assignment);
//   },
//   listDocuments: async () => {
//     await delay(150);
//     return bundles.map((b) => ({ name: b.document.name, order: b.assignment.order }));
//   },
//   listIncomingRelations: async (toName) => {
//     await delay(150);
//     const incoming: { from: string; labels: string[] }[] = [];
//     for (const b of bundles) {
//       for (const r of b.assignment.document_relations) {
//         if (r.to === toName) incoming.push({ from: b.document.name, labels: r.labels });
//       }
//     }
//     return incoming;
//   },
// }).then((s) => (source.value = s));

const onComplete = () => console.log("complete!");
</script>

<template>
  <AnnotatorQueue
    v-if="source"
    :source="source"
    :labelset="task.labelset"
    :annotation-level="task.annotation_level"
    :guidelines-url="task.ann_guidelines"
    @complete="onComplete"
  />
  <div v-else style="padding: 2rem; font-family: system-ui;">Resolving source…</div>
</template>

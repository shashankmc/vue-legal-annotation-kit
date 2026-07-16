<script setup lang="ts">
// Local dev harness — verifies AnnotatorQueue + createBulkSource end to end
// against the original Small Task.json export (annotator 1's 3 assignments).
import AnnotatorQueue from "../components/AnnotatorQueue.vue";
import { createBulkSource } from "../model/bulkSource";
import { toTaskData } from "./legacyAdapter";
import rawTask from "./input/Small Task.json";

const task = toTaskData(rawTask as any);

const source = createBulkSource(task, 1);

const onComplete = () => console.log("complete!");
</script>

<template>
  <AnnotatorQueue
    :source="source"
    :labelset="task.labelset"
    :annotation-level="task.annotation_level"
    :guidelines-url="task.ann_guidelines"
    @complete="onComplete"
  />
</template>

<script setup lang="ts">
// Local dev harness — feeds sample data (from the Small Task export) into the
// annotator view. Not part of the published package.
import AnnotatorView from "../components/AnnotatorView.vue";
import type { Assignment, Labelset } from "../types";

const labelset: Labelset = {
  name: "All Attributes (Amm)",
  desc: "MaRBLe Annotations",
  labels: [
    { name: "Postcondition", color: "#9fd1be" },
    { name: "Precondition", color: "#493b69" },
    { name: "Actors", color: "#71c345" },
    { name: "Acts", color: "#4435ba" },
    { name: "Legal Relations", color: "#9d68e2" },
    { name: "Geographical - Physical Domains", color: "#4d865d" },
    { name: "Temporal", color: "#434f65" },
    { name: "Explicit References", color: "#48dc7a" },
    { name: "Hierarchies", color: "#69a0b0" },
    { name: "Residual", color: "#b7bb37" },
  ],
};

const document = {
  name: "10_A2_A3_provision_42 (2).txt",
  full_text:
    "The participation of Denmark in the adoption of measures constituting a development of the Schengen acquis, as well as the implementation of these measures and their application to Den-mark, shall be governed by the relevant provisions of the Protocol on the position of Denmark.",
};

const assignment: Assignment = {
  annotator: 1,
  order: 1,
  status: "pending",
  confidence: 4,
  annotations: [
    {
      id: 1,
      start: 0,
      end: 44,
      label: "Postcondition",
      text: "The participation of Denmark in the adoption",
      relations: [{ to: 2, direction: "right", labels: ["Has a"] }],
      confidence: 2,
      metadata: null,
    },
    {
      id: 2,
      start: 209,
      end: 278,
      label: "Temporal",
      text: "by the relevant provisions of the Protocol on the position of Denmark",
      relations: [],
      confidence: 4,
      metadata: null,
    },
  ],
};
</script>

<template>
  <AnnotatorView
    :document="document"
    :labelset="labelset"
    :assignment="assignment"
    :position="{ current: 1, total: 3 }"
    guidelines-url="http://www.examples.com"
    @save="() => console.log('save')"
    @next="() => console.log('next')"
    @previous="() => console.log('previous')"
  />
</template>

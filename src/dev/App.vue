<script setup lang="ts">
// TEMP: verifying createLazySource against a simulated slow backend.
// import { ref } from "vue";
import { ref } from "vue";
import AnnotatorQueue from "../components/AnnotatorQueue.vue";
import AnnotatorView from "../components/AnnotatorView.vue";
import { flattenAssignments } from "../model/source";
import type { Proposal } from "../types";
import type { DocumentRef, RelationGraphRequest } from "../model/source";
import { createBulkSource } from "../model/bulkSource";
// import { createLazySource } from "../model/lazySource";
// import { flattenAssignments } from "../model/source";
// import type { Assignment } from "../types";
import { toTaskData } from "./legacyAdapter";
import rawTask from "./input/Small Task.json";

const task = toTaskData(rawTask as any);

// `?hybrid` in the URL turns the demo into a hybrid task: span labels from the
// file plus a separate set of document tags.
// `?hybrid&many` adds enough tags to make the label list scroll.
const params = new URLSearchParams(window.location.search);
const hybrid = params.has("hybrid");
const tagLabels = [
  { name: "Relevant", color: "#0ea5e9" },
  { name: "Needs review", color: "#f97316" },
  ...(params.has("many")
    ? Array.from({ length: 14 }, (_, i) => ({ name: `Extra tag ${i + 1}`, color: `hsl(${i * 25}, 60%, 50%)` }))
    : []),
];
const documentLabelset = hybrid ? { name: "Document tags", desc: "", labels: tagLabels } : undefined;

const source = createBulkSource(task, 1, hybrid ? `lak:bulk:dev-hybrid${params.has("many") ? "-many" : ""}` : undefined);

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

// `?proposals` shows the first document alone in AnnotatorView, as a host with
// its own queue would, with proposals to accept, reject or correct and the
// host slots filled in. Answers are logged in the bar at the top.
const proposalMode = params.has("proposals");
const firstBundle = flattenAssignments(task, 1)[0];
const firstText = firstBundle.document.full_text;
const proposalAt = (word: string) => Math.max(0, firstText.indexOf(word));
const sampleProposals: Proposal[] = [
  // Two words the sample file leaves unannotated, so the dashed proposal
  // underline shows on its own.
  ...["Schengen", "implementation"].map((word, i) => {
    const start = proposalAt(word);
    const label = task.labelset.labels[i].name;
    return {
      id: `span-${i}`,
      kind: "span" as const,
      start,
      end: start + word.length,
      label,
      rationale: `The model read "${word}" as ${label}.`,
      source: "demo-model · prompt v1",
    };
  }),
  ...(documentLabelset
    ? [{ id: "doc-0", kind: "document" as const, label: tagLabels[0].name, rationale: "The text is on point.", source: "demo-model · prompt v1" }]
    : []),
];
const answered = (kind: string) => (e: { proposal: Proposal; annotation?: unknown }) =>
  (lastRequest.value = `${kind}: ${JSON.stringify(e)}`);

// Host options, switchable live. `draft` is read when a document opens, so it
// applies from the next document on.
const options = ref({
  showConfidence: true,
  showRelations: true,
  showMetadata: true,
  allowOverlap: true,
  draft: true,
  documentLabelMode: "multi" as "multi" | "single",
});

// The kit only emits these two requests; a real host decides what they open.
// Here the harness just shows what it was given.
const lastRequest = ref("");
const onViewDocument = (d: DocumentRef) => (lastRequest.value = `view-document: ${JSON.stringify(d)}`);
const onViewGraph = (r: RelationGraphRequest) => (lastRequest.value = `view-relation-graph: ${JSON.stringify(r)}`);
</script>

<template>
  <div v-if="lastRequest" data-test="last-request" style="padding: 0.4rem 0.8rem; font: 12px monospace; background: #fffbe6; border-bottom: 1px solid #ddd">
    {{ lastRequest }}
  </div>
  <div data-test="options" style="display: flex; gap: 1rem; flex-wrap: wrap; padding: 0.4rem 0.8rem; font: 12px system-ui; border-bottom: 1px solid #ddd">
    <label><input v-model="options.showConfidence" type="checkbox" /> showConfidence</label>
    <label><input v-model="options.showRelations" type="checkbox" /> showRelations</label>
    <label><input v-model="options.showMetadata" type="checkbox" /> showMetadata</label>
    <label><input v-model="options.allowOverlap" type="checkbox" /> allowOverlap</label>
    <label><input v-model="options.draft" type="checkbox" /> draft</label>
    <label>
      documentLabelMode
      <select v-model="options.documentLabelMode">
        <option value="multi">multi</option>
        <option value="single">single</option>
      </select>
    </label>
  </div>
  <div v-if="proposalMode" style="height: calc(100vh - 4rem)">
    <AnnotatorView
      :document="firstBundle.document"
      :assignment="firstBundle.assignment"
      :labelset="task.labelset"
      :document-labelset="documentLabelset"
      :annotation-level="task.annotation_level"
      :position="{ current: 1, total: 1 }"
      :navigation="false"
      :proposals="sampleProposals"
      v-bind="options"
      @proposal-accepted="answered('proposal-accepted')($event)"
      @proposal-rejected="answered('proposal-rejected')($event)"
      @proposal-corrected="answered('proposal-corrected')($event)"
    >
      <template #header-actions><button type="button">Skip (host)</button></template>
      <template #sidebar-top><div style="font: 12px system-ui; padding: 0.3rem 0">sidebar-top slot</div></template>
      <template #inspector-bottom><div style="font: 12px system-ui; padding-top: 0.6rem">inspector-bottom slot</div></template>
    </AnnotatorView>
  </div>
  <AnnotatorQueue
    v-else-if="source"
    v-bind="options"
    :source="source"
    :labelset="task.labelset"
    :document-labelset="documentLabelset"
    :annotation-level="task.annotation_level"
    :guidelines-url="task.ann_guidelines"
    preview-documents
    relation-graph
    @view-document="onViewDocument"
    @view-relation-graph="onViewGraph"
    @complete="onComplete"
  />
  <div v-else style="padding: 2rem; font-family: system-ui;">Resolving source…</div>
</template>

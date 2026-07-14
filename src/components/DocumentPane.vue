<script setup lang="ts">
import { computed, onBeforeUnmount, onMounted, ref, watch } from "vue";
import type { Annotation } from "../types";
import { selectionOffsets } from "../model/selection";
import { segmentText } from "../model/spans";
import { arc } from "../model/arrows";

// Center column: the document text with annotations rendered as highlights and
// relations drawn as arcs over the text. On mouse-up, a non-empty selection is
// reported as offsets; clicking a highlight selects the annotation under it.
const props = defineProps<{
  text: string;
  annotations: Annotation[];
  colors: Record<string, string>;
  selectedId: number | null;
  /** True while a relation is being drawn — clicking a mark links it. */
  linking?: boolean;
}>();

const emit = defineEmits<{
  create: [payload: { start: number; end: number; text: string }];
  select: [id: number];
}>();

const root = ref<HTMLElement>();
const canvas = ref<HTMLElement>();
const textEl = ref<HTMLElement>();

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

// --- Relation arrows -------------------------------------------------------
interface Arrow {
  key: string;
  d: string;
  color: string;
  text: string;
  labelX: number;
  labelY: number;
  markerStart: boolean;
  markerEnd: boolean;
}

const arrows = ref<Arrow[]>([]);

// Top-centre anchor of an annotation, relative to the canvas — measured from
// the union of its highlight rects so multi-segment spans still resolve.
const anchorOf = (id: number, canvasRect: DOMRect) => {
  let left = Infinity,
    right = -Infinity,
    top = Infinity;
  let found = false;
  textEl.value?.querySelectorAll<HTMLElement>(".mark").forEach((mark) => {
    if (!mark.dataset.ids?.split(",").includes(String(id))) return;
    const r = mark.getBoundingClientRect();
    found = true;
    left = Math.min(left, r.left);
    right = Math.max(right, r.right);
    top = Math.min(top, r.top);
  });
  if (!found) return null;
  return { cx: (left + right) / 2 - canvasRect.left, top: top - canvasRect.top };
};

const redraw = () => {
  if (!canvas.value) return;
  const canvasRect = canvas.value.getBoundingClientRect();
  const list: Arrow[] = [];
  for (const a of props.annotations) {
    for (const rel of a.relations) {
      const from = anchorOf(a.id, canvasRect);
      const to = anchorOf(rel.to, canvasRect);
      if (!from || !to) continue;
      const { d, labelX, labelY } = arc(from.cx, from.top, to.cx, to.top);
      list.push({
        key: `${a.id}-${rel.to}`,
        d,
        color: props.colors[a.label] ?? "#666",
        text: rel.labels.join(", "),
        labelX,
        labelY,
        markerStart: rel.direction !== "right",
        markerEnd: rel.direction !== "left",
      });
    }
  }
  arrows.value = list;
};

// Recompute after the DOM settles (flush: post) whenever the data changes, and
// whenever the text reflows (resize / font load).
watch(() => props.annotations, redraw, { deep: true, flush: "post" });

let observer: ResizeObserver | undefined;
onMounted(() => {
  redraw();
  observer = new ResizeObserver(redraw);
  if (textEl.value) observer.observe(textEl.value);
});
onBeforeUnmount(() => observer?.disconnect());
</script>

<template>
  <section ref="root" class="document" :class="{ 'is-linking': linking }" @mouseup="onMouseUp">
    <div ref="canvas" class="document__canvas">
      <p ref="textEl" class="document__text">
        <template v-for="(seg, i) in segments" :key="i">
          <mark
            v-if="seg.annotationIds.length && primary(seg.annotationIds)"
            class="mark"
            :data-ids="seg.annotationIds.join(',')"
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

      <svg class="rel-overlay" aria-hidden="true">
        <defs>
          <marker
            id="lak-arrowhead"
            viewBox="0 0 10 10"
            refX="9"
            refY="5"
            markerWidth="7"
            markerHeight="7"
            orient="auto-start-reverse"
          >
            <path d="M0,0 L10,5 L0,10 z" fill="context-stroke" />
          </marker>
        </defs>
        <g v-for="a in arrows" :key="a.key">
          <path
            :d="a.d"
            :stroke="a.color"
            fill="none"
            stroke-width="1.5"
            :marker-start="a.markerStart ? 'url(#lak-arrowhead)' : undefined"
            :marker-end="a.markerEnd ? 'url(#lak-arrowhead)' : undefined"
          />
          <text v-if="a.text" :x="a.labelX" :y="a.labelY" class="rel-label" :fill="a.color">
            {{ a.text }}
          </text>
        </g>
      </svg>
    </div>
  </section>
</template>

<style scoped>
.document {
  overflow-y: auto;
  /* Extra top room so arcs above the first line stay visible. */
  padding: 2.6rem 1.5rem 1.2rem;
}
.document__canvas {
  position: relative;
}
.document__text {
  margin: 0;
  line-height: 2.1;
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
.document.is-linking .mark {
  cursor: crosshair;
}
.rel-overlay {
  position: absolute;
  inset: 0;
  width: 100%;
  height: 100%;
  overflow: visible;
  pointer-events: none;
}
.rel-label {
  font-size: 11px;
  font-weight: 600;
  text-anchor: middle;
  paint-order: stroke;
  stroke: #fff;
  stroke-width: 3px;
  stroke-linejoin: round;
}
</style>

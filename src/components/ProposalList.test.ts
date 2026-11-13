// @vitest-environment jsdom
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { mount } from "@vue/test-utils";
import AnnotatorView from "./AnnotatorView.vue";
import type { Annotation, AnnotationLevel, Assignment, Proposal } from "../types";
import { segmentText } from "../model/spans";

class NoopResizeObserver {
  observe() {}
  disconnect() {}
}

const text = "The court held that the contract was void.";
const span = (id: number, start: number, end: number, label = "Party"): Annotation => ({
  id,
  start,
  end,
  label,
  text: text.slice(start, end),
  relations: [],
  confidence: 0,
  metadata: null,
});
const assignment = (over: Partial<Assignment> = {}): Assignment => ({
  id: 9,
  annotator: 1,
  order: 1,
  status: "pending",
  confidence: 0,
  annotations: [],
  document_annotations: [],
  document_relations: [],
  ...over,
});
const labelset = {
  name: "Labels",
  desc: "",
  labels: [
    { name: "Party", color: "#0ea5e9" },
    { name: "Outcome", color: "#f97316" },
  ],
};

const docProposal: Proposal = {
  id: "s1",
  kind: "document",
  label: "Outcome",
  rationale: "The court rules on the contract.",
  source: "haiku · prompt v3",
};
const spanProposal: Proposal = { id: 42, kind: "span", start: 4, end: 9, label: "Party", rationale: "Names a body." };

const mountView = (props: Record<string, unknown> = {}, level: AnnotationLevel = "document", slots = {}) =>
  mount(AnnotatorView, {
    props: {
      document: { name: "doc.txt", full_text: text },
      labelset,
      annotationLevel: level,
      assignment: assignment(),
      position: { current: 1, total: 1 },
      navigation: false,
      draft: false,
      ...props,
    },
    slots,
  });

beforeEach(() => vi.stubGlobal("ResizeObserver", NoopResizeObserver));
afterEach(() => vi.unstubAllGlobals());

describe("segmentText with proposals", () => {
  it("marks the segments a proposal covers, apart from annotations", () => {
    const segs = segmentText(text, [span(1, 0, 3)], [{ start: 4, end: 9 }]);
    const court = segs.find((s) => s.text === "court")!;
    expect(court.annotationIds).toEqual([]);
    expect(court.proposalIndexes).toEqual([0]);
    expect(segs.find((s) => s.text === "The")!.proposalIndexes).toEqual([]);
  });
});

describe("proposals in AnnotatorView", () => {
  it("lists proposals apart from annotations, with rationale and source", () => {
    const w = mountView({ proposals: [docProposal] });
    const card = w.find(".proposal");
    expect(card.text()).toContain("Outcome");
    expect(card.text()).toContain("Suggested");
    expect(card.text()).toContain("The court rules on the contract.");
    expect(card.text()).toContain("haiku · prompt v3");
    // Not a tag until accepted.
    expect(w.findAll(".doc-tag.is-tagged")).toHaveLength(0);
  });

  it("accepting a document proposal tags the document and says so", async () => {
    const w = mountView({ proposals: [docProposal] });
    await w.find(".proposal__btn--accept").trigger("click");
    expect(w.findAll(".doc-tag.is-tagged").map((t) => t.text())).toEqual(["Outcome"]);
    expect(w.find(".proposal").exists()).toBe(false);
    const [event] = w.emitted("proposal-accepted")![0] as [{ proposal: Proposal; annotation: { label: string } }];
    expect(event.proposal.id).toBe("s1");
    expect(event.annotation.label).toBe("Outcome");
  });

  it("rejecting leaves the assignment alone", async () => {
    const onSave = vi.fn();
    const w = mountView({ proposals: [docProposal], onSave });
    await w.findAll(".proposal__btn")[1].trigger("click");
    expect(w.emitted("proposal-rejected")![0]).toEqual([{ proposal: docProposal }]);
    expect(w.find(".proposal").exists()).toBe(false);
    expect(w.findAll(".doc-tag.is-tagged")).toHaveLength(0);
    expect(w.emitted("unsaved")!.at(-1)).toEqual([false]);
  });

  it("correcting applies the other label", async () => {
    const w = mountView({ proposals: [docProposal] });
    await w.find(".proposal__correct").setValue("Party");
    expect(w.findAll(".doc-tag.is-tagged").map((t) => t.text())).toEqual(["Party"]);
    const [event] = w.emitted("proposal-corrected")![0] as [{ annotation: { label: string } }];
    expect(event.annotation.label).toBe("Party");
  });

  it("accepting follows single mode, replacing the tag already there", async () => {
    const w = mountView({
      proposals: [docProposal],
      documentLabelMode: "single",
      assignment: assignment({ document_annotations: [{ id: 1, label: "Party", confidence: 0, metadata: null }] }),
    });
    await w.find(".proposal__btn--accept").trigger("click");
    expect(w.findAll(".doc-tag.is-tagged").map((t) => t.text())).toEqual(["Outcome"]);
  });

  it("draws a span proposal dashed in the text, and accepting makes it an annotation", async () => {
    const w = mountView({ proposals: [spanProposal] }, "word");
    const mark = w.find(".mark--proposal");
    expect(mark.text()).toBe("court");
    expect(w.findAll(".region")).toHaveLength(0);
    await w.find(".proposal__btn--accept").trigger("click");
    expect(w.find(".mark--proposal").exists()).toBe(false);
    expect(w.findAll(".region")).toHaveLength(1);
    const [event] = w.emitted("proposal-accepted")![0] as [{ annotation: Annotation }];
    expect(event.annotation).toMatchObject({ start: 4, end: 9, label: "Party", text: "court" });
  });

  it("keeps a span proposal that would overlap when overlaps are off, with a notice", async () => {
    const w = mountView(
      { proposals: [spanProposal], allowOverlap: false, assignment: assignment({ annotations: [span(1, 0, 6, "Outcome")] }) },
      "word",
    );
    await w.find(".proposal__btn--accept").trigger("click");
    expect(w.find(".lak-annotator__notice").exists()).toBe(true);
    expect(w.find(".proposal").exists()).toBe(true);
    expect(w.emitted("proposal-accepted")).toBeUndefined();
  });

  it("clicking a proposal in the text focuses its card", async () => {
    const w = mountView({ proposals: [spanProposal] }, "word");
    await w.find(".mark--proposal").trigger("click");
    expect(w.find(".proposal").classes()).toContain("is-focused");
  });

  it("Enter on a focused card accepts, Delete rejects", async () => {
    const w = mountView({ proposals: [docProposal, { ...docProposal, id: "s2", label: "Party" }] });
    const cards = w.findAll(".proposal");
    await cards[0].trigger("keydown", { key: "Enter" });
    expect(w.emitted("proposal-accepted")).toHaveLength(1);
    await w.find(".proposal").trigger("keydown", { key: "Delete" });
    expect(w.emitted("proposal-rejected")).toHaveLength(1);
    expect(w.find(".proposal").exists()).toBe(false);
  });

  it("offers no actions when read-only", () => {
    const w = mountView({ proposals: [docProposal], readonly: true });
    expect(w.find(".proposal").exists()).toBe(true);
    expect(w.find(".proposal__actions").exists()).toBe(false);
  });

  it("renders the host slots", () => {
    const w = mountView({}, "document", {
      "header-actions": '<button class="host-btn">Skip</button>',
      "sidebar-top": '<div class="host-top">AL</div>',
      "inspector-bottom": '<div class="host-bottom">LLM</div>',
    });
    expect(w.find(".header__actions .host-btn").exists()).toBe(true);
    expect(w.find(".sidebar .host-top").exists()).toBe(true);
    expect(w.find(".inspector .host-bottom").exists()).toBe(true);
  });
});

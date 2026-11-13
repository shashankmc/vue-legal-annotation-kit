// @vitest-environment jsdom
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { mount } from "@vue/test-utils";
import AnnotatorView from "./AnnotatorView.vue";
import DocumentPane from "./DocumentPane.vue";
import type { Annotation, AnnotationLevel, Assignment } from "../types";

// jsdom has no layout; the view only needs these to exist.
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
  id: 7,
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

const mountView = (props: Record<string, unknown> = {}, level: AnnotationLevel = "character") =>
  mount(AnnotatorView, {
    props: {
      document: { name: "doc.txt", full_text: text },
      labelset,
      annotationLevel: level,
      assignment: assignment(),
      position: { current: 1, total: 1 },
      navigation: false,
      ...props,
    },
  });

beforeEach(() => {
  vi.stubGlobal("ResizeObserver", NoopResizeObserver);
  localStorage.clear();
});
afterEach(() => vi.unstubAllGlobals());

describe("AnnotatorView host options", () => {
  it("shows relations and metadata by default", async () => {
    const w = mountView({ assignment: assignment({ annotations: [span(1, 4, 9)] }) });
    await w.find(".region").trigger("click");
    expect(w.find(".metadata").exists()).toBe(true);
    expect(w.find('[title="Draw a relation from this region"]').exists()).toBe(true);
  });

  it("hides the metadata field with showMetadata off, and keeps stored metadata", async () => {
    const stored = { ...span(1, 4, 9), metadata: "kept" };
    const onSave = vi.fn();
    const w = mountView({ assignment: assignment({ annotations: [stored] }), showMetadata: false, onSave });
    await w.find(".region").trigger("click");
    expect(w.find(".metadata").exists()).toBe(false);
    await w.findComponent({ name: "AnnotatorHeader" }).vm.$emit("save");
    await vi.waitFor(() => expect(onSave).toHaveBeenCalled());
    expect(onSave.mock.calls[0][0].annotations[0].metadata).toBe("kept");
  });

  it("hides every relation control with showRelations off", async () => {
    const related = { ...span(1, 4, 9), relations: [{ to: 2, direction: "right" as const, labels: [] }] };
    const w = mountView({
      assignment: assignment({ annotations: [related, span(2, 20, 28)] }),
      showRelations: false,
    });
    await w.find(".region").trigger("click");
    expect(w.find('[title="Draw a relation from this region"]').exists()).toBe(false);
    expect(w.findComponent({ name: "RelationList" }).exists()).toBe(false);
  });

  it("explains a refused overlapping span when overlaps are off", async () => {
    const w = mountView({ assignment: assignment({ annotations: [span(1, 4, 9)] }), allowOverlap: false });
    await w.find(".label").trigger("click"); // arm "Party"
    w.findComponent(DocumentPane).vm.$emit("create", { start: 6, end: 12, text: "" });
    await w.vm.$nextTick();
    expect(w.find(".lak-annotator__notice").text()).toContain("overlaps");
    expect(w.findAll(".region")).toHaveLength(1);
    await w.find(".lak-annotator__notice button").trigger("click");
    expect(w.find(".lak-annotator__notice").exists()).toBe(false);
  });

  it("creates the overlapping span when overlaps are allowed", async () => {
    const w = mountView({ assignment: assignment({ annotations: [span(1, 4, 9)] }) });
    await w.find(".label").trigger("click");
    w.findComponent(DocumentPane).vm.$emit("create", { start: 6, end: 12, text: "" });
    await w.vm.$nextTick();
    expect(w.find(".lak-annotator__notice").exists()).toBe(false);
    expect(w.findAll(".region")).toHaveLength(2);
  });

  it("keeps one document tag at a time in single mode", async () => {
    const w = mountView({ documentLabelMode: "single" }, "document");
    const tags = w.findAll(".doc-tag");
    await tags[0].trigger("click");
    await tags[1].trigger("click");
    expect(w.findAll(".doc-tag.is-tagged").map((t) => t.text())).toEqual(["Outcome"]);
  });

  it("writes a draft to localStorage by default", async () => {
    const w = mountView({}, "document");
    await w.findAll(".doc-tag")[0].trigger("click");
    await w.vm.$nextTick();
    expect(localStorage.getItem("lak:draft:assignment:7")).not.toBeNull();
  });

  it("never touches localStorage with draft off", async () => {
    localStorage.setItem("lak:draft:assignment:7", JSON.stringify({
      annotations: [],
      documentAnnotations: [{ id: -1, label: "Outcome", confidence: 0, metadata: null }],
      documentRelations: [],
      confidence: 0,
    }));
    const get = vi.spyOn(Storage.prototype, "getItem");
    const set = vi.spyOn(Storage.prototype, "setItem");
    const w = mountView({ draft: false }, "document");
    // The stale draft is not resumed...
    expect(w.findAll(".doc-tag.is-tagged")).toHaveLength(0);
    await w.findAll(".doc-tag")[0].trigger("click");
    await w.vm.$nextTick();
    // ...and nothing is read or written.
    expect(get).not.toHaveBeenCalled();
    expect(set).not.toHaveBeenCalled();
  });
});

describe("a failed save", () => {
  const failingSave = () => Promise.reject(new Error("Server down."));
  const failSave = async (props: Record<string, unknown>) => {
    const w = mountView({ onSave: failingSave, ...props }, "document");
    await w.findAll(".doc-tag")[0].trigger("click");
    await w.findComponent({ name: "AnnotatorHeader" }).vm.$emit("save");
    await vi.waitFor(() => expect(w.find(".lak-annotator__error").exists()).toBe(true));
    return w.find(".lak-annotator__error").text();
  };

  it("says the work is kept on this device when drafts are on", async () => {
    expect(await failSave({})).toContain("kept on this device");
  });

  it("does not promise a copy on the device when drafts are off", async () => {
    const message = await failSave({ draft: false });
    expect(message).toContain("Server down.");
    expect(message).not.toContain("device");
    expect(message).toContain("reloading will lose them");
  });
});

import { describe, expect, it } from "vitest";
import type { Annotation, Label } from "../types";
import { useAnnotator, type AnnotatorRules } from "./useAnnotator";
import { overlapsAny } from "./spans";

const label = (name: string): Label => ({ name, color: "#000" });
const span = (id: number, start: number, end: number, name = "A"): Annotation => ({
  id,
  start,
  end,
  label: name,
  text: "",
  relations: [],
  confidence: 0,
  metadata: null,
});

describe("overlapsAny", () => {
  const existing = [span(1, 5, 10)];

  it("finds a range sharing a character", () => {
    expect(overlapsAny(existing, 8, 12)).toBe(true);
    expect(overlapsAny(existing, 0, 6)).toBe(true);
    expect(overlapsAny(existing, 6, 8)).toBe(true);
    expect(overlapsAny(existing, 0, 20)).toBe(true);
  });

  it("lets ranges touch end to start", () => {
    expect(overlapsAny(existing, 0, 5)).toBe(false);
    expect(overlapsAny(existing, 10, 15)).toBe(false);
  });
});

describe("useAnnotator rules", () => {
  const withRules = (rules: AnnotatorRules, initial: Annotation[] = []) =>
    useAnnotator(initial, [], [], () => rules);

  it("allows overlapping spans by default", () => {
    const a = useAnnotator([span(1, 0, 10)]);
    a.activeLabel.value = label("B");
    expect(a.createSpan(5, 15, "")).not.toBeNull();
    expect(a.annotations.value).toHaveLength(2);
    expect(a.refusal.value).toBeNull();
  });

  it("refuses an overlapping span when overlaps are off, and says why", () => {
    const a = withRules({ allowOverlap: false }, [span(1, 0, 10)]);
    a.activeLabel.value = label("B");
    expect(a.createSpan(5, 15, "")).toBeNull();
    expect(a.annotations.value).toHaveLength(1);
    expect(a.refusal.value).toBe("overlap");
    expect(a.dirty.value).toBe(false);
  });

  it("clears the refusal once a span is made", () => {
    const a = withRules({ allowOverlap: false }, [span(1, 0, 10)]);
    a.activeLabel.value = label("B");
    a.createSpan(5, 15, "");
    expect(a.createSpan(10, 15, "")).not.toBeNull();
    expect(a.refusal.value).toBeNull();
  });

  it("reads the rules on every edit, so a host can change them", () => {
    const rules: AnnotatorRules = { allowOverlap: false };
    const a = useAnnotator([span(1, 0, 10)], [], [], () => rules);
    a.activeLabel.value = label("B");
    expect(a.createSpan(5, 15, "")).toBeNull();
    rules.allowOverlap = true;
    expect(a.createSpan(5, 15, "")).not.toBeNull();
  });

  it("keeps several document tags by default", () => {
    const a = useAnnotator([]);
    a.toggleDocumentLabel(label("A"));
    a.toggleDocumentLabel(label("B"));
    expect(a.documentAnnotations.value.map((d) => d.label)).toEqual(["A", "B"]);
  });

  it("replaces the tag in single mode", () => {
    const a = withRules({ documentLabelMode: "single" });
    a.toggleDocumentLabel(label("A"));
    a.toggleDocumentLabel(label("B"));
    expect(a.documentAnnotations.value.map((d) => d.label)).toEqual(["B"]);
    expect(a.selectedDocumentAnnotationId.value).toBe(a.documentAnnotations.value[0].id);
  });

  it("removes the tag when it is chosen again in single mode", () => {
    const a = withRules({ documentLabelMode: "single" });
    a.toggleDocumentLabel(label("A"));
    a.toggleDocumentLabel(label("A"));
    expect(a.documentAnnotations.value).toEqual([]);
  });
});

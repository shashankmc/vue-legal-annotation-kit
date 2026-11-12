import { describe, expect, it } from "vitest";
import type { DocumentRef } from "./source";
import { documentLabel, searchDocuments } from "./documentSearch";

const docs: DocumentRef[] = [
  { name: "ruling-a.html", order: 1 },
  { name: "ruling-b.html", order: 2 },
  { name: "Contract 2021.txt", order: 3 },
  { name: "ruling-a.html", order: 12, key: "42" }, // same name as the first
];

const orders = (list: DocumentRef[]) => list.map((d) => d.order);

describe("searchDocuments", () => {
  it("returns every document, in queue order, for an empty or blank query", () => {
    expect(orders(searchDocuments(docs, ""))).toEqual([1, 2, 3, 12]);
    expect(orders(searchDocuments(docs, "   "))).toEqual([1, 2, 3, 12]);
  });

  it("matches a name without regard to case", () => {
    expect(orders(searchDocuments(docs, "CONTRACT"))).toEqual([3]);
  });

  it("matches the queue position, which tells apart documents sharing a name", () => {
    expect(orders(searchDocuments(docs, "ruling-a #12"))).toEqual([12]);
  });

  it("needs every word, in any order", () => {
    expect(orders(searchDocuments(docs, "html ruling"))).toEqual([1, 2, 12]);
    expect(orders(searchDocuments(docs, "2021 contract"))).toEqual([3]);
    expect(searchDocuments(docs, "ruling contract")).toEqual([]);
  });

  it("returns nothing when nothing matches", () => {
    expect(searchDocuments(docs, "zzz")).toEqual([]);
  });
});

describe("documentLabel", () => {
  it("combines name and position", () => {
    expect(documentLabel(docs[2])).toBe("Contract 2021.txt (#3)");
  });
});

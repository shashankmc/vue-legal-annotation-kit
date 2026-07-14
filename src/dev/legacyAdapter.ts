// Adapts the original pre-format task export (no annotation `id`, relations by
// array index, `difficulty_rating`/`confidence_rating` instead of `confidence`,
// `symbol` instead of `character`) into the current TaskData contract. This
// predates our format decisions — see README §4 — so it needs translating
// before AnnotatorQueue/createBulkSource can use it. Dev-only.
import type {
  TaskData,
  Assignment,
  Annotation,
  AnnotationLevel,
  RelationDirection,
} from "../types";

interface LegacyAnnotation {
  start: number;
  end: number;
  label: string;
  text: string;
  relations: { to: number; direction: RelationDirection; labels: string[] }[];
  confidence_rating: number;
}

interface LegacyAssignment {
  annotator: number;
  order: number;
  status: string;
  difficulty_rating: number;
  annotations: LegacyAnnotation[];
}

interface LegacyDocument {
  name: string;
  full_text: string;
  assignments: LegacyAssignment[];
}

interface LegacyTask {
  name: string;
  desc: string;
  labelset: TaskData["labelset"];
  ann_guidelines: string;
  documents: LegacyDocument[];
  annotation_level: string;
}

function toAnnotations(legacy: LegacyAnnotation[]): Annotation[] {
  return legacy.map((a, i) => ({
    id: i + 1,
    start: a.start,
    end: a.end,
    label: a.label,
    text: a.text,
    confidence: a.confidence_rating,
    metadata: null,
    // legacy `to` was a 0-based index into this same array
    relations: a.relations.map((r) => ({
      to: r.to + 1,
      direction: r.direction,
      labels: r.labels,
    })),
  }));
}

function toAssignment(legacy: LegacyAssignment): Assignment {
  return {
    annotator: legacy.annotator,
    order: legacy.order,
    status: legacy.status,
    confidence: legacy.difficulty_rating,
    annotations: toAnnotations(legacy.annotations),
  };
}

export function toTaskData(legacy: LegacyTask): TaskData {
  return {
    name: legacy.name,
    desc: legacy.desc,
    labelset: legacy.labelset,
    ann_guidelines: legacy.ann_guidelines,
    annotation_level: (legacy.annotation_level === "symbol"
      ? "character"
      : legacy.annotation_level) as AnnotationLevel,
    documents: legacy.documents.map((doc) => ({
      name: doc.name,
      full_text: doc.full_text,
      assignments: doc.assignments.map(toAssignment),
    })),
  };
}

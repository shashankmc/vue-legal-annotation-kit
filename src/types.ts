// Data model for the annotation format. Mirrors the JSON contract in README §4.
// Pure types only — no framework, no logic.

// "document" means the whole task is document-level tagging: documents carry
// only `document_annotations`, never span `annotations`. The others describe
// span granularity for span-level tasks.
export type AnnotationLevel = "character" | "word" | "sentence" | "paragraph" | "document";

export type RelationDirection = "bi" | "left" | "right";

export type RelationLabel =
  | "Is a"
  | "Has a"
  | "Belongs to"
  | "Implies"
  | "Depends on"
  | "Related to"
  | "Is not"
  | "Part of";

/** The relation labels offered in the UI (order matches the current tool). */
export const RELATION_LABELS: RelationLabel[] = [
  "Is a",
  "Has a",
  "Belongs to",
  "Implies",
  "Depends on",
  "Related to",
  "Is not",
  "Part of",
];

export type AssignmentStatus = "pending" | "done" | (string & {});

export interface Label {
  name: string;
  color: string;
}

export interface Labelset {
  name: string;
  desc: string;
  labels: Label[];
}

export interface Relation {
  /** `id` of the target annotation. */
  to: number;
  direction: RelationDirection;
  labels: string[];
}

export interface Annotation {
  id: number;
  start: number;
  end: number;
  label: string;
  text: string;
  relations: Relation[];
  /** 0–5 stars; 0 = unrated. */
  confidence: number;
  metadata?: string | null;
}

/** A categorical tag applied to a whole document, not a text span. */
export interface DocumentAnnotation {
  id: number;
  /** Must match a `labelset` label name. */
  label: string;
  /** 0–5 stars; 0 = unrated. */
  confidence: number;
  /** Free-text notes on this tag, like a span's metadata. */
  metadata?: string | null;
}

/** A relation from this document to another — always "this document links to
 * the target", stored **only** on the document that created it. Nothing gets
 * written to the target: on its own document, the "Linked by" list is a
 * read-only view computed from other documents' relations, not real data of
 * its own. Keeps counting/processing relations after annotation simple —
 * every relation exists exactly once, no de-duplication needed. */
export interface DocumentRelation {
  /** Target document's key — its `name` unless the host gave it a `key`. */
  to: string;
  labels: string[];
  /** Free-form host data carried with the relation, like a span's metadata.
   * BlueLab stores a link's `strength`, `explicit_cross_reference`,
   * `sub_field` and `cue_span` here (see docs/annotation-upstream-requests.md,
   * Gap 2) so the plain label can stay the link type. */
  metadata?: Record<string, unknown> | null;
}

export interface Assignment {
  /** The host's own id for this assignment, when it has one. Scopes the local
   * crash-recovery draft, which would otherwise be keyed on document name +
   * annotator + order — not unique across tasks that reuse a document. */
  id?: number | string;
  annotator: number | string;
  /** Position in the annotator's queue (1-based when displayed). */
  order: number;
  status: AssignmentStatus;
  /** Document-level confidence, 0–5 stars; 0 = unrated. */
  confidence: number;
  annotations: Annotation[];
  document_annotations: DocumentAnnotation[];
  document_relations: DocumentRelation[];
}

export interface AnnotationDocument {
  name: string;
  full_text: string;
  /** How relations refer to this document; defaults to `name`. Set it when
   * names are not unique (see DocumentRef.key). */
  key?: string;
}

/** Where the annotator sits in their sequence of assigned documents. */
export interface QueuePosition {
  /** 1-based index of the current document. */
  current: number;
  /** Total documents assigned to this annotator for the task. */
  total: number;
}

/** A document as it appears in the raw task file, with its assignments. */
export interface RawDocument extends AnnotationDocument {
  assignments: Assignment[];
}

/** The shape of a whole exported task file (see README §4 Data format). */
export interface TaskData {
  name: string;
  desc: string;
  labelset: Labelset;
  ann_guidelines: string;
  documents: RawDocument[];
  annotation_level: AnnotationLevel;
}

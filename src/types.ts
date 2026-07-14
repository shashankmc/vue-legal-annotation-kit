// Data model for the annotation format. Mirrors the JSON contract in README §4.
// Pure types only — no framework, no logic.

export type AnnotationLevel = "character" | "word" | "sentence" | "paragraph";

export type RelationDirection = "bi" | "left" | "right";

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

export interface Assignment {
  annotator: number;
  /** Position in the annotator's queue (1-based when displayed). */
  order: number;
  status: AssignmentStatus;
  /** Document-level confidence, 0–5 stars; 0 = unrated. */
  confidence: number;
  annotations: Annotation[];
}

export interface AnnotationDocument {
  name: string;
  full_text: string;
}

/** Where the annotator sits in their sequence of assigned documents. */
export interface QueuePosition {
  /** 1-based index of the current document. */
  current: number;
  /** Total documents assigned to this annotator for the task. */
  total: number;
}

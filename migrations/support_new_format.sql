-- =============================================================================
-- Migration: adapt the Lawnotation DB to the new annotation format
-- Target: PostgreSQL (Supabase) — lawnotation-ui/supabase
-- Schema verified against supabase/migrations (tables: public.annotations,
-- public.annotation_relations, public.assignments).
--
-- Good news from the audit:
--   * Relations ALREADY reference annotations by numeric id
--     (annotation_relations.from_id / .to_id). No relation remap needed —
--     the old index-based `to` in exported JSON was only a serialization detail.
--   * The Label Studio string ids (ls_id, ls_to, ls_from) are not referenced by
--     any FK or index, so they drop cleanly.
-- =============================================================================

BEGIN;

-- -----------------------------------------------------------------------------
-- Part 1 — REQUIRED: remove the Label Studio artifacts we no longer need.
-- -----------------------------------------------------------------------------

-- Relations keep numeric from_id/to_id; the ls_* string mirrors go away.
ALTER TABLE public.annotation_relations DROP COLUMN IF EXISTS ls_to;
ALTER TABLE public.annotation_relations DROP COLUMN IF EXISTS ls_from;

-- Annotations no longer need the Label Studio region id.
ALTER TABLE public.annotations DROP COLUMN IF EXISTS ls_id;

-- -----------------------------------------------------------------------------
-- Part 2 — OPTIONAL / DEFERRED: rename the rating columns to `confidence`.
--
-- The new format calls both ratings `confidence`
--   assignments.difficulty_rating  -> confidence   (UI: "Document Confidence")
--   annotations.confidence_rating  -> confidence   (UI: "Annotation Confidence")
--
-- ⚠ These renames are BREAKING for the current app: existing code, tRPC
--   routers, and the LS serializer still reference the old names. Only run this
--   once the codebase (or the new package) has been switched over. Until then,
--   the serializer can map difficulty_rating/confidence_rating -> confidence
--   without touching the DB. Leave commented until ready:
--
-- ALTER TABLE public.assignments  RENAME COLUMN difficulty_rating TO confidence;
-- ALTER TABLE public.annotations  RENAME COLUMN confidence_rating TO confidence;

COMMIT;

-- =============================================================================
-- Difficulty: LOW.
--   Part 1 is three trivial DROP COLUMN statements, safe to run now.
--   Part 2 is two RENAMEs, trivial mechanically but breaking for current code —
--   sequence it with the app cutover, not before.
--
-- Not addressed here (schema is already fine, only serialization differs):
--   * relations by id            -> already the case (from_id/to_id)
--   * per-span metadata string   -> stored as annotations.metadata (NOT
--                                   html_metadata, which is an offsets object)
-- =============================================================================

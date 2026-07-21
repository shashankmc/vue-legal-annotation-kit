# Legal Annotation Kit

A **Vue component library, distributed as an npm package**, for annotating legal
documents. It is being built to **replace the Label Studio–based annotation core**
of our current platform with code we own and control, so we can ship the features
our users demand without fighting a heavyweight third-party dependency.

---

## 1. Why this project exists

Our legal annotation platform currently renders its annotation surface on top of
[Label Studio](https://labelstud.io/). Label Studio is powerful but:

- It is **third-party code that is hard to maintain and extend**.
- Every new feature we need tends to fight the framework rather than fit into it.
- We do not own the annotation logic, so our roadmap is gated by someone else's.

**Goal:** build a self-contained **Vue npm package** that reproduces the current
annotation experience and can be dropped into our platform (and used by others) in
place of the Label Studio integration — while we retain full ownership of the code
and the freedom to add new capabilities on demand.

### Guiding principles

- **Feature parity first, improvements second.** Reproduce today's behaviour so we
  don't confuse existing annotators, then improve deliberately.
- **Keep the data format.** The package consumes and produces the **same JSON
  structure** described below (see [Data format](#4-data-format)). This is the
  contract with the rest of the platform.
- **Keep the UI familiar.** Match the current layout closely (see
  [UI overview](#3-ui-overview)); UI/UX improvements are welcome as long as they
  don't disorient current users.
- **Own the core.** No hidden dependency on Label Studio internals. Anything that
  was previously a Label Studio artifact should be abstracted so we can evolve it.

---

## 2. Functional scope (feature parity target)

The package must support everything the current tool does:

### Annotation types
- **Span annotations** — a labelled range over the document text, with selectable
  **granularity**: `character`, `word`, `sentence`, `paragraph`.
- **Document annotations** — labels applied to the document as a whole rather than
  to a range.

### Labels
- A shared **label set** (`labelset`) defines the available labels, each with a
  `name` and a `color`.
- Labels are assigned **hotkeys** in list order (`1`–`9`, then `0` — 10 labels in
  the sample set).
- **Overlap rules:** labels **may overlap** freely, with one exception — the **same
  label may not be applied to the exact same `start`+`end` range twice**. The
  uniqueness key for a span is effectively `(label, start, end)`.

### Relations
- Directed **relations between two annotations**.
- Each relation has a **direction** and one or more **labels** on the relation
  itself (e.g. `"Has a"`).

### Confidence
- **Assignment confidence** — a 1–5 star rating for the whole document/assignment
  (`confidence`; `0` means unrated). Shown in the UI as *Document Confidence*.
- **Span confidence** — a 1–5 star rating per span annotation
  (`confidence`; `0` means unrated). Shown in the UI as *Annotation Confidence*.

### Per-span metadata
- A free-text **metadata string** attached to each span annotation (`metadata`).
- Separately, `html_metadata` holds HTML **offset positions** (`startOffset`,
  `endOffset`, `globalOffsets`) — only relevant for HTML documents, not
  user-facing text.

### Navigation & persistence
- **Next / Back** to move between the documents assigned to the current annotator.
- **Save** the current annotations.
- **Unsaved-changes guard:** if the user navigates away (Next/Back/leaving the
  page) with unsaved changes, **warn them** before losing work.
- A **progress indicator** (e.g. `1/3`, `33%`) reflecting position in the
  annotator's queue.

---

## 3. UI overview

The current layout (to be closely reproduced) has three regions:

**Header**
- `See Annotation Guidelines` button → opens `ann_guidelines` URL.
- Assignment **status badge** (e.g. `Pending`, `Done`).
- **Progress** (`1/3`) and a progress bar (`33%`).
- `Back`, `Save` (disk icon), `Next`.

**Left panel — labels & confidence**
- `Quick Filter` search box to filter the label list.
- The **label list**, each entry showing its colour and hotkey number.
- **Annotation Confidence** star rating (selected span).
- **Document Confidence** star rating (whole document).

**Center — the text**
- The document `full_text` with highlighted spans and superscript label tags.
- **Relation arrows** drawn between spans, labelled (e.g. `Has a`).

**Right panel — inspector**
- Selected region details: its label(s) and its confidence `Rating`.
- Actions: create relation (link), add, collapse, **delete**.
- Tabs: **Regions** (list of all annotations) / **Labels**.
- Sort/visibility controls for the region list.
- **Relations** list, each showing source → target, its label(s), and delete.

> The `HTML` region type is a Label Studio carry-over. Preserve the behaviour, but
> **abstract the naming** in our own model.

---

## 4. Data format

The package's input/output is a single JSON document. **Preserve this structure.**

### Top level
| Field | Type | Notes |
|---|---|---|
| `name` | string | Project/task name. |
| `desc` | string | Description. |
| `labelset` | object | The shared label set (below). |
| `ann_guidelines` | string (URL) | Linked by the *See Annotation Guidelines* button. |
| `documents` | array | The documents to annotate (below). |
| `counts` | object | **Derived** summary — see [Counts](#counts). |
| `annotation_level` | string | `character` \| `word` \| `sentence` \| `paragraph` \| `document`. The first four are span granularities; `document` means the whole task is document-level tagging — see below. A task is one or the other, never both. For `word`/`sentence`/`paragraph`, a selection is snapped to cover the whole unit it touches — a partial drag over one word still captures (and stores) the entire word, sentence, or paragraph, not just what was dragged. Shown to the annotator as a badge in the header. |

### `labelset`
| Field | Type | Notes |
|---|---|---|
| `name` | string | |
| `desc` | string | |
| `labels` | array of `{ name, color }` | `color` is a hex string. List order defines hotkeys. |

### `documents[]`
| Field | Type | Notes |
|---|---|---|
| `name` | string | Source filename. |
| `full_text` | string | Raw text (may include `\r\n`). Offsets index into this string. |
| `assignments` | array | One per annotator working this document. |

### `documents[].assignments[]`
| Field | Type | Notes |
|---|---|---|
| `annotator` | number | Annotator ID. A document may have several assignments. |
| `order` | number | Position in that annotator's queue (drives Next/Back + progress). |
| `status` | string | `done` \| `pending`. Shown as the header badge. |
| `confidence` | number (0–5) | **Assignment-level confidence** stars (*Document Confidence* in the UI); `0` = unrated. |
| `annotations` | array | The span annotations. Populated only when the task's `annotation_level` is a span granularity; always empty for `document`-level tasks. |
| `document_annotations` | array | Whole-document tags (below). Populated only when `annotation_level` is `document`; always empty for span-level tasks. |
| `document_relations` | array | Relations from this whole document to other whole documents (below). Document-level tasks only. |

### `documents[].assignments[].annotations[]`
| Field | Type | Notes |
|---|---|---|
| `id` | number | Stable unique annotation ID (assigned by our database). Relations reference it. |
| `start` | number | Start offset into `full_text`. |
| `end` | number | End offset (exclusive). |
| `label` | string | Must match a `labelset` label name. |
| `text` | string | The selected substring (cached copy of `full_text[start:end]`). |
| `relations` | array | Outgoing relations (below). |
| `confidence` | number (0–5) | **Span-level confidence** stars; `0` = unrated. |
| `metadata` | string \| null | Free-text per-span metadata (user-facing). |
| `html_metadata` | object \| null | HTML offset positions (`start`, `end`, `startOffset`, `endOffset`, `globalOffsets`); HTML docs only. |

### `documents[].assignments[].document_annotations[]`
| Field | Type | Notes |
|---|---|---|
| `id` | number | Stable unique document-annotation ID (assigned by our database). |
| `label` | string | Must match a `labelset` label name. No `start`/`end`/`text` — it tags the whole document, not a span. At most one entry per label; toggled on/off in the UI. |
| `confidence` | number (0–5) | **Per-tag confidence** stars; `0` = unrated. Distinct from the assignment-level `confidence` above, which rates the document as a whole. |

### `...annotations[].relations[]`
| Field | Type | Notes |
|---|---|---|
| `to` | number | **`id` of the target annotation** it relates to. |
| `direction` | string | `left` \| `right` (relation arrow direction). |
| `labels` | array of string | One or more relation labels (e.g. `["Has a"]`). |

### `documents[].assignments[].document_relations[]`
Relations between whole documents (document-level tasks). No `left`/`right`/`bi`
cycling like span relations — instead each entry is attributed to whoever
created it. Creating "A links to B" adds an `outgoing` entry on A **and**
auto-adds a read-only `incoming` backlink on B, so B's annotator can see they're
pointed at without that counting as B linking back. A genuine two-way pair only
exists if B's annotator separately creates their own `outgoing` entry to A.
Populating the target picker needs the optional `AnnotationSource.listDocuments()`
(lightweight name/order refs); without it the UI hides.

| Field | Type | Notes |
|---|---|---|
| `to` | string | **`name` of the target document** it relates to. |
| `direction` | string | `outgoing` (this document created it) \| `incoming` (auto-mirrored backlink; read-only from this side). |
| `labels` | array of string | Relation labels, same vocabulary as span relations. |

### `counts`
Derived/denormalized summary — recompute rather than trust blindly:
`documents`, `assignments`, `annotators`, `annotations`, `relations`.

### Minimal example
```json
{
  "id": 1,
  "start": 0,
  "end": 44,
  "label": "Postcondition",
  "text": "The participation of Denmark in the adoption",
  "relations": [{ "to": 2, "direction": "right", "labels": ["Has a"] }],
  "confidence": 2,
  "metadata": null,
  "html_metadata": null
}
```
_(`to: 2` points at the annotation whose `id` is `2`.)_

---

## 5. Architecture direction

> Detailed design lands as we implement. These are the constraints.

- **Decoupled by design.** Separate concerns cleanly:
  - a **data/model layer** (parse, validate, mutate, serialize the JSON — no UI),
  - **rendering/interaction components** (text + spans + relations),
  - **panels/controls** (labels, inspector, confidence, navigation),
  - **host integration** (props in, events out).
- **Framework-agnostic core where possible.** Keep annotation logic (offsets,
  overlap rules, relation graph, granularity snapping) in plain, testable TS that
  doesn't depend on Vue.
- **No leaky Label Studio abstractions.** Map `HTML` region types and similar
  carry-overs into our own vocabulary at the boundary.
- **The JSON is the contract.** Round-tripping input → edit → output must be
  lossless and stable.
- **Emit, don't own side effects.** Save/next/back are surfaced as events/callbacks
  the host wires up; the package doesn't assume a backend.

---

## 6. Distribution

- Ships as a **Vue component published to npm**.
- Consumed by our platform and by third-party users as a drop-in annotation core.
- We retain ownership to add proprietary features on demand.

---

## 7. Open questions (to resolve)

- **`status` enum.** Sample shows `done` / `pending`; are there others (e.g.
  `in_progress`, `skipped`)?
- **Relation `direction` enum.** Sample shows `right`; confirm the full set
  (`left`/`right`/bidirectional/none?).
- **Multi-annotator view.** How does the current user's identity select which
  `assignment` queue is shown, and can annotators see each other's work?

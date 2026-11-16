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
- Labels are assigned **hotkeys** in list order: `1`–`9`, then `0`, then `A`–`Z`
  (36 in all). Pressing the active label's key, or clicking it, puts it down. In a
  [hybrid task](#hybrid-tasks) the document tags' keys continue the same
  sequence, right after the span labels'.
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

### Per-annotation metadata
- A free-text **metadata string** attached to each span annotation and each document tag (`metadata`), edited in the inspector once the annotation is selected.
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
- The **label list**, each entry showing its colour and hotkey. Only this list
  scrolls; Document Confidence stays at the bottom.
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
| `labelset` | object | The shared label set (below). For a hybrid task, the *span* labels. |
| `document_labelset` | object | Optional. Same shape as `labelset`. When present on a span-level task, the task is **hybrid** and these are the labels for whole-document tags. |
| `ann_guidelines` | string (URL) | Linked by the *See Annotation Guidelines* button. |
| `documents` | array | The documents to annotate (below). |
| `counts` | object | **Derived** summary — see [Counts](#counts). |
| `annotation_level` | string | `character` \| `word` \| `sentence` \| `paragraph` \| `document`. The first four are span granularities; `document` means the whole task is document-level tagging — see below. A task is span-level or document-level — unless it is a **hybrid** task (see below), which has span annotations *and* document tags. For `word`/`sentence`/`paragraph`, a selection is snapped to cover the whole unit it touches — a partial drag over one word still captures (and stores) the entire word, sentence, or paragraph, not just what was dragged. Shown to the annotator as a badge in the header. |

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
| `annotations` | array | The span annotations. Populated when the task's `annotation_level` is a span granularity; always empty for `document`-level tasks. |
| `document_annotations` | array | Whole-document tags (below). Populated when `annotation_level` is `document`, or for a hybrid task (labels from `document_labelset`); always empty for plain span-level tasks. |
| `document_relations` | array | Relations from this whole document to other whole documents (below). Document-level and hybrid tasks. |

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
| `metadata` | string \| null | Free-text notes on the tag, like a span's `metadata`. Optional. |

### Hybrid tasks
A span-level task with a `document_labelset` is hybrid: the annotator marks spans
with `labelset` labels (hotkeys, relations, as usual) and tags the whole document
with `document_labelset` labels (click to toggle). Both lists are
filled on the same assignment, both labelsets may share label names (even be the
same labelset), and span relations and `document_relations` both work. Pass the
second labelset as the `documentLabelset` prop of `AnnotatorQueue` / `AnnotatorView`.
Label colours are looked up per labelset, so a shared name can have two colours.

Span relations and document relations can be given different relation labels:
pass the span labelset's as `relationLabels` and the document labelset's as
`documentRelationLabels` (see the host options below). Without
`documentRelationLabels`, both use `relationLabels`.

In the left column the **Document Tags** come right after the **Span Labels**,
under a divider, and everything label-related scrolls as one list above the
document confidence (which stays in view). The tags have **hotkeys too, starting
where the span labels' end**: with 10 span labels (`1`–`0`) the first tag is `A`,
the next `B`, and so on up to `Z`. Pressing a tag's key toggles that tag (it has
nothing to arm, unlike a span label), and each key is shown on its tag. Keys run
out after 36 labels and tags together; beyond that a tag is click-only. (A
document-level task has no hotkeys.) The mapping is the pure function
`hotkeyTarget` in `model/labelHotkeys.ts`.

### `...annotations[].relations[]`
| Field | Type | Notes |
|---|---|---|
| `to` | number | **`id` of the target annotation** it relates to. |
| `direction` | string | `left` \| `right` (relation arrow direction). |
| `labels` | array of string | One or more relation labels (e.g. `["Has a"]`). |

### `documents[].assignments[].document_relations[]`
Relations between whole documents (document-level tasks). Always one-directional
— "this document links to the target" — and stored **only** on the document
that created it; nothing is ever written to the target. That keeps
counting/processing relations after annotation simple: every relation exists
exactly once, no de-duplication needed. Populating the target picker needs the
optional `AnnotationSource.listDocuments()` (lightweight name/order refs);
without it the UI hides.

| Field | Type | Notes |
|---|---|---|
| `to` | string | **Key of the target document**: its `name`, unless the host gives documents a `key` (`DocumentRef.key` / `AnnotationDocument.key`) — do that when names are not unique, e.g. two uploads of `ruling.html`. |
| `labels` | array of string | Relation labels, same vocabulary as span relations. |

**"Linked by" (not part of the stored format).** The UI also shows, read-only,
which other documents point at the one currently open — so an annotator who
reaches document B can see "linked by A" and remember the connection A's
annotator made. This is computed on the fly, not real data of B's own: it comes
from the optional `AnnotationSource.listIncomingRelations(name)`, which returns
other documents' relations targeting `name`. Editing that relation still has to
happen on A — B has no stored copy to edit. Hosts that omit this method simply
don't get a "Linked by" section.

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

### Data sources

`<AnnotatorQueue>` takes an `AnnotationSource` ([source.ts](src/model/source.ts)) —
the package never talks to a backend directly. Two factories ship:

- **`createBulkSource(task, annotatorId)`** — everything already loaded in memory
  (host has no backend, or bulk-fetched the whole task upfront). Mirrors to
  `localStorage` so work survives a refresh.
- **`createLazySource(delegate)`** — one network call per document, for a real
  backend. `delegate` is a small set of async functions (`total`, `load`, `save`,
  plus the same optional `listDocuments`/`listIncomingRelations`/`finish` as
  `AnnotationSource`) that the host implements against its own backend, e.g.:

  ```ts
  const source = await createLazySource({
    total: () => api.countAssignments(annotatorId),
    load: (position) => api.getAssignment(annotatorId, position),
    save: (assignment) => api.saveAssignment(assignment),
  });
  ```

  `createLazySource` is `async` — it resolves `total` once before returning, since
  `AnnotatorQueue` reads it synchronously at setup. **Authorization belongs in the
  delegate/backend** (e.g. Supabase Row Level Security scoped to the authenticated
  user), not in this package — it only ever calls whatever `delegate` it's given.

### Document-relation actions

Where document relations exist (document-level and hybrid tasks, with
`listDocuments` provided), the annotator can ask for two things the package
cannot do on its own. It does not do them: it **emits a request** and the host
decides what to show, so each host can use its own modal, drawer or page, and
load the data however it likes. Both are off until the host opts in with the
props above.

| Event (on `AnnotatorQueue` and `AnnotatorView`) | Payload | When |
|---|---|---|
| `view-document` | `DocumentRef` (`{ name, order, key? }`) | **Read more** was clicked on a document, in the picker (to see what a target is *before* relating to it) or on an existing relation. The host typically shows the full text, fetching it by `key` (or `name`). |
| `view-relation-graph` | `RelationGraphRequest` | **View as graph** was clicked. |

```ts
interface RelationGraphRequest {
  document: DocumentRef;                  // the document being annotated
  relations: DocumentRelation[];          // its outgoing relations right now, unsaved edits included
  incomingRelations: IncomingRelation[];  // other documents' relations pointing at it
}
```

The request carries only what is on screen. Relations among the *other*
documents are stored on those documents, so a host that wants the whole graph
loads them itself; the request tells it which document is open and what has
been edited but not saved yet, so it can draw that over what it loaded.

```vue
<AnnotatorQueue
  :source="source"
  :labelset="labelset"
  :document-labelset="documentLabelset"
  annotation-level="word"
  preview-documents
  relation-graph
  @view-document="(doc) => openTextModal(doc.key ?? doc.name)"
  @view-relation-graph="(request) => openGraphModal(request)"
/>
```

### Choosing a relation target

The "link to a document…" control is a searchable dropdown: type to narrow a
long queue down. Every word typed must appear in the document's name or queue
position (any case, any order), so `ruling 12` finds `ruling-a.html (#12)`. Use
the arrow keys and Enter, or the mouse. The matching is exported as
`searchDocuments(documents, query)` for hosts that want the same behaviour
elsewhere.

### Saving and failures

`save` (and Back/Next, which save first) is awaited. Until it resolves, the
annotator's local crash-recovery draft is kept; if it rejects, nothing is
cleared, the annotator stays on the document, and the reason is shown above it.
Both components emit `save-error` with the error, and `unsaved` (a boolean)
whenever there is work not yet saved — enough for a host router's
leave-the-page guard, which `beforeunload` alone does not cover.

Give each assignment an `id` when the host has one: the draft is keyed on it,
which keeps two tasks that reuse a document name from sharing a draft.

### Other host options

| Component | Prop | Default | |
|---|---|---|---|
| `AnnotatorQueue` | `urlParam` | `"seq"` | Query param the position is kept in; `false` when the host's router owns the URL. |
| `AnnotatorView` | `navigation` | `true` | Progress and Back/Next. Off to show one document with just Save. |
| `AnnotatorView` | `readonly` | `false` | Show annotations without letting anything change; no Save, no draft. |
| `AnnotatorQueue` / `AnnotatorView` | `relationLabels` | the built-in eight (`RELATION_LABELS`) | Labels a relation (span or document) can be given. Labels already on a relation stay shown even if not in the list. |
| `AnnotatorQueue` / `AnnotatorView` | `documentRelationLabels` | `relationLabels` | Labels **document** relations can be given, when they should differ from the span relations'. A host with a separate document labelset (a hybrid task) can pass that labelset's own list here, or `RELATION_LABELS` for the built-in eight. |
| `AnnotatorQueue` / `AnnotatorView` | `previewDocuments` | `false` | Adds a **Read more** button to documents in the document-relation picker and list. See [Document-relation actions](#document-relation-actions). |
| `AnnotatorQueue` / `AnnotatorView` | `relationGraph` | `false` | Adds a **View as graph** button to the document relations. See [Document-relation actions](#document-relation-actions). |
| `AnnotatorQueue` / `AnnotatorView` | `showConfidence` | `true` | Confidence (star) ratings on, off. `false` hides every rating — per-span, per-tag and the assignment-level *Document Confidence* — and leaves the stored `confidence` values exactly as they were. For a host that does not need confidence values. |
| `AnnotatorQueue` / `AnnotatorView` | `showRelations` | `true` | Relations on, off. `false` hides the link button, the relation list, the arrows over the text and the document relations, and leaves stored relations exactly as they were. |
| `AnnotatorQueue` / `AnnotatorView` | `showMetadata` | `true` | The metadata field on the selected annotation or tag. `false` hides it and leaves stored `metadata` exactly as it was. |
| `AnnotatorQueue` / `AnnotatorView` | `documentLabelMode` | `"multi"` | `"single"` keeps at most one document tag: choosing another replaces it, choosing it again removes it. Hotkeys follow the same rule. For a host labelling each document with one class. |
| `AnnotatorQueue` / `AnnotatorView` | `allowOverlap` | `true` | `false` refuses a span that shares a character with another (checked after snapping to the task's level) and says so above the document. Spans may still touch end to start. |
| `AnnotatorQueue` / `AnnotatorView` | `draft` | `true` | The crash-recovery draft in `localStorage`. `false` never reads or writes it, so no document text is left on the device; unsaved work is then lost on a reload. Read when a document opens. |

### Proposed annotations

`AnnotatorView` takes `proposals`: annotations a host offers — from an LLM, a
model or a rule — for the annotator to accept, reject or correct. They are never
part of the assignment until accepted.

```ts
type Proposal =
  | { id: string | number; kind: "document"; label: string; rationale?: string; source?: string }
  | { id: string | number; kind: "span"; start: number; end: number; label: string; rationale?: string; source?: string };
```

- They are listed under **Suggestions** at the top of the inspector, each with
  its label, a *Suggested* badge, the rationale and the source. Span proposals are
  also drawn in the text with a dashed underline in their label's colour (a dashed
  outline when they sit on an annotation); clicking one focuses its card.
- **Accept** adds the annotation and emits `proposal-accepted` `{ proposal, annotation }`.
  **Reject** emits `proposal-rejected` `{ proposal }` and changes nothing.
  **Change to…** adds it with another label and emits `proposal-corrected`
  `{ proposal, annotation }`. Accepting is an edit like any other: the host still
  saves the assignment.
- `documentLabelMode` and `allowOverlap` apply. A span proposal that would overlap
  while overlaps are off stays in the list, and the notice says why.
- An answered proposal is hidden at once, by its `id`, even if the host passes it
  again. Read-only views list proposals without the buttons.
- Keys act on the focused card only, so they never clash with label hotkeys:
  **Enter** accepts, **Delete** or **Backspace** rejects. Cards are reachable with Tab.

`AnnotatorQueue` does not take proposals; a host with its own queue renders
`AnnotatorView` per document (`navigation: false`) and passes them there.

### Host slots

`AnnotatorView` has three slots for a host's own controls:

| Slot | Where |
|---|---|
| `header-actions` | In the header, before Back / Save / Next |
| `sidebar-top` | At the top of the label column |
| `inspector-bottom` | At the bottom of the inspector |

### Theming

Every colour and radius reads a `--lak-*` CSS variable, with the default written
next to it. Set any of them on `.lak-annotator` or on any element above it:

```css
.my-host {
  --lak-accent: #7c3aed;
  --lak-radius: 10px;
}
```

| Variable | Default | Used for |
|---|---|---|
| `--lak-accent` | `#1e4e79` | Buttons, the active label, links |
| `--lak-on-accent` | `#fff` | Text on the accent and on label colours |
| `--lak-on-accent-soft` | `rgba(255,255,255,.25)` | Hotkey badge on an active label |
| `--lak-bg` | `#fff` | The annotator's background |
| `--lak-fg` | `#111` | Text |
| `--lak-fg-soft` | `#374151` | Secondary text |
| `--lak-muted` | `#6b7280` | Hints, counts, empty states |
| `--lak-surface` | `#fff` | Cards, chips, menus |
| `--lak-sidebar-bg` | `#f1f1f1` | The label column |
| `--lak-border` | `rgba(0,0,0,.12)` | Borders and dividers |
| `--lak-border-strong` | `#d1d5db` | Secondary button borders |
| `--lak-hover` | `rgba(0,0,0,.03)`–`.08` | Hover and pressed backgrounds |
| `--lak-success` | `#16a34a` | Done status, "Saved" |
| `--lak-warning` | `#d97706` | Unsaved changes, refusal notices |
| `--lak-warning-bg` / `--lak-warning-fg` | `#fffbeb` / `#92400e` | Refusal notices |
| `--lak-danger` | `#dc2626` | Delete, load errors |
| `--lak-danger-bg` / `--lak-danger-border` / `--lak-danger-fg` | `#fef2f2` / `#fecaca` / `#991b1b` | Save errors |
| `--lak-progress-track` | `#e2e8f0` | Progress bar track, spinner |
| `--lak-star-on` / `--lak-star-empty` | `#f5b301` / `#d2cece` | Confidence stars |
| `--lak-overlay` | `rgba(0,0,0,.45)` | Behind the confirm dialog |
| `--lak-scrim` | `rgba(255,255,255,.7)` | Over a document while it loads |
| `--lak-shadow` | `rgba(0,0,0,.15)`–`.25` | Menu and dialog shadows |
| `--lak-radius` | `6px` | Cards, buttons, inputs |
| `--lak-radius-sm` | `2px`–`4px` | Swatches, badges |
| `--lak-radius-lg` | `10px` | The confirm dialog |

Pills (`999px`) and the spinner (`50%`) keep their shape. Label colours come from
the labelset, not from variables.

Text sizes read five steps. Each use keeps its own default, so a host that sets
none sees no change; a host that sets one step sets every use of it.

| Variable | Defaults | Used for |
|---|---|---|
| `--lak-font-size-2xs` | `0.7rem`–`0.75rem`, `11px` | Badges, hotkey hints, relation labels on the document |
| `--lak-font-size-xs` | `0.78rem`–`0.82rem` | Counts, metadata, small buttons |
| `--lak-font-size-sm` | `0.85rem`–`0.88rem` | Body text in the panels, buttons |
| `--lak-font-size-md` | `0.9rem` | Panel and section titles |
| `--lak-font-size-base` | `1rem` | The confirm dialog's title |
| `--lak-label-case` / `--lak-label-tracking` | `uppercase` / `0.03em` | Small section labels |

The error banner's close "×" and the confidence stars are icons and keep their size.

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

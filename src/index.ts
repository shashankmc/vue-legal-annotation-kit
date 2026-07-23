// Public entry point for the package.
export { default as AnnotatorView } from "./components/AnnotatorView.vue";
export { default as AnnotatorQueue } from "./components/AnnotatorQueue.vue";
export { default as StarRating } from "./components/StarRating.vue";
export * from "./types";
export * from "./model/source";
export { useAssignmentQueue } from "./model/useAssignmentQueue";
export { createBulkSource } from "./model/bulkSource";
export { createLazySource } from "./model/lazySource";
export type { LazySourceDelegate } from "./model/lazySource";

<script setup lang="ts">
import { onMounted, onBeforeUnmount } from "vue";

// In-app confirm dialog — replaces window.confirm so it can be styled and
// doesn't block on the browser's own modal chrome.
defineProps<{
  title: string;
  message: string;
  confirmLabel?: string;
  cancelLabel?: string;
}>();

const emit = defineEmits<{ confirm: []; cancel: [] }>();

const onKeydown = (e: KeyboardEvent) => {
  if (e.key === "Escape") emit("cancel");
};
onMounted(() => window.addEventListener("keydown", onKeydown));
onBeforeUnmount(() => window.removeEventListener("keydown", onKeydown));
</script>

<template>
  <div class="confirm-modal__overlay" @click.self="emit('cancel')">
    <div class="confirm-modal" role="alertdialog" aria-modal="true" :aria-label="title">
      <h3 class="confirm-modal__title">{{ title }}</h3>
      <p class="confirm-modal__message">{{ message }}</p>
      <div class="confirm-modal__actions">
        <button class="confirm-modal__btn confirm-modal__btn--cancel" @click="emit('cancel')">
          {{ cancelLabel ?? "Cancel" }}
        </button>
        <button class="confirm-modal__btn confirm-modal__btn--confirm" autofocus @click="emit('confirm')">
          {{ confirmLabel ?? "Continue" }}
        </button>
      </div>
    </div>
  </div>
</template>

<style scoped>
.confirm-modal__overlay {
  position: fixed;
  inset: 0;
  background: rgba(0, 0, 0, 0.45);
  display: flex;
  align-items: center;
  justify-content: center;
  z-index: 1000;
  font-family: system-ui, sans-serif;
}
.confirm-modal {
  background: #fff;
  border-radius: 10px;
  padding: 1.25rem 1.5rem;
  max-width: 22rem;
  width: calc(100% - 2rem);
  box-shadow: 0 10px 40px rgba(0, 0, 0, 0.25);
}
.confirm-modal__title {
  margin: 0 0 0.5rem;
  font-size: 1rem;
  color: #111;
}
.confirm-modal__message {
  margin: 0 0 1.25rem;
  font-size: 0.88rem;
  color: #4b5563;
  line-height: 1.4;
  white-space: pre-line;
}
.confirm-modal__actions {
  display: flex;
  justify-content: flex-end;
  gap: 0.5rem;
}
.confirm-modal__btn {
  font: inherit;
  font-size: 0.85rem;
  cursor: pointer;
  border-radius: 6px;
  padding: 0.4rem 0.9rem;
  border: 1px solid transparent;
}
.confirm-modal__btn--cancel {
  background: transparent;
  border-color: #d1d5db;
  color: #374151;
}
.confirm-modal__btn--confirm {
  background: var(--lak-accent, #1e4e79);
  color: #fff;
}
</style>

<script setup lang="ts">
// Presentational 0–5 star rating. Emits changes; holds no domain logic.
const props = withDefaults(
  defineProps<{
    modelValue: number;
    label?: string;
    max?: number;
    disabled?: boolean;
  }>(),
  { max: 5, disabled: false },
);

const emit = defineEmits<{ "update:modelValue": [value: number] }>();

const set = (value: number) => {
  if (props.disabled) return;
  emit("update:modelValue", value === props.modelValue ? 0 : value);
};
</script>

<template>
  <div class="rating" :class="{ disabled }">
    <span v-if="label" class="rating__label">{{ label }}</span>
    <div class="rating__stars">
      <button
        v-for="n in max"
        :key="n"
        type="button"
        class="rating__star"
        :class="{ 'is-on': n <= modelValue }"
        :disabled="disabled"
        @click="set(n)"
      >
        ★
      </button>
    </div>
  </div>
</template>

<style scoped>
.rating__label {
  display: block;
  font-weight: 600;
  font-size: 0.85rem;
  margin-bottom: 0.15rem;
}
.rating__stars {
  display: flex;
  gap: 0.1rem;
}
.rating__star {
  background: none;
  border: none;
  cursor: pointer;
  padding: 0;
  font-size: 1.4rem;
  line-height: 1;
  color: var(--lak-star-empty);
}
.rating__star.is-on {
  color: var(--lak-star-on);
}
.rating.disabled .rating__star {
  cursor: default;
}
</style>

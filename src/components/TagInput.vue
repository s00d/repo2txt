<template>
  <div class="w-full">
    <label v-if="label" class="block text-xs font-semibold text-slate-500 dark:text-slate-400 uppercase tracking-wider mb-2">
      {{ label }}
    </label>
    <div 
      class="flex flex-wrap gap-2 p-2 bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-lg focus-within:ring-2 focus-within:ring-blue-500/20 focus-within:border-blue-500 transition-all min-h-[42px]"
      @click="focusInput"
    >
      <span 
        v-for="(tag, index) in modelValue" 
        :key="tag"
        class="flex items-center gap-1 px-2 py-1 bg-slate-100 dark:bg-slate-700 text-slate-700 dark:text-slate-200 text-xs rounded-md border border-slate-200 dark:border-slate-600 group animate-zoom-in"
      >
        {{ tag }}
        <button 
          @click.stop="removeTag(index)"
          class="text-slate-400 hover:text-red-500 transition-colors focus:outline-none"
        >
          <X :size="12" />
        </button>
      </span>
      
      <input
        ref="inputRef"
        type="text"
        v-model="inputValue"
        class="flex-1 min-w-[100px] bg-transparent border-none outline-none text-sm text-slate-700 dark:text-slate-200 placeholder-slate-400 dark:placeholder-slate-500 h-6"
        :placeholder="modelValue.length ? '' : placeholder"
        @keydown.enter.prevent="addTag"
        @keydown.backspace="handleBackspace"
        @blur="addTag"
      />
    </div>
    <p class="mt-1.5 text-[11px] text-slate-400 dark:text-slate-500">{{ description }}</p>
  </div>
</template>

<script setup lang="ts">
import { ref } from 'vue';
import { X } from 'lucide-vue-next';

const props = defineProps<{
  modelValue: string[];
  label: string;
  placeholder?: string;
  description?: string;
}>();

const emit = defineEmits<{
  'update:modelValue': [value: string[]];
}>();

const inputValue = ref('');
const inputRef = ref<HTMLInputElement | null>(null);

const focusInput = () => inputRef.value?.focus();

const addTag = () => {
  const val = inputValue.value.trim();
  if (val && !props.modelValue.includes(val)) {
    emit('update:modelValue', [...props.modelValue, val]);
  }
  inputValue.value = '';
};

const removeTag = (index: number) => {
  const newTags = [...props.modelValue];
  newTags.splice(index, 1);
  emit('update:modelValue', newTags);
};

const handleBackspace = () => {
  if (inputValue.value === '' && props.modelValue.length > 0) {
    removeTag(props.modelValue.length - 1);
  }
};
</script>


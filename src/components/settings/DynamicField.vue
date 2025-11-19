<template>
  <div class="group">
    <div class="flex flex-col gap-2">
      <!-- Label & Description -->
      <div class="flex justify-between items-start">
        <div>
          <label class="text-sm font-medium text-slate-900 dark:text-slate-200 block">
            {{ field.label }}
          </label>
          <p v-if="field.description && field.component.type !== 'Tags'" class="text-xs text-slate-500 dark:text-slate-400 mt-1 max-w-md leading-relaxed">
            {{ field.description }}
          </p>
        </div>
        
        <!-- Инпуты Number справа для компактности -->
        <div v-if="field.component.type === 'Number'" class="shrink-0">
          <div class="relative">
            <input 
              type="number"
              :value="modelValue"
              @input="$emit('update:modelValue', Number(($event.target as HTMLInputElement).value))"
              class="w-32 px-3 py-2 text-right bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-lg text-sm focus:ring-2 focus:ring-blue-500/50 focus:border-blue-500 outline-none transition-all dark:text-white"
              :min="getNumberOptions()?.min"
              :max="getNumberOptions()?.max"
            />
            <div v-if="getNumberOptions()?.suffix" class="absolute inset-y-0 right-8 pr-2 flex items-center pointer-events-none">
              <span class="text-xs text-slate-400">{{ getNumberOptions()?.suffix }}</span>
            </div>
          </div>
        </div>

        <!-- Select справа -->
        <div v-else-if="field.component.type === 'Select'" class="shrink-0">
          <div class="flex gap-1 p-1 bg-slate-100 dark:bg-slate-700 rounded-lg inline-flex">
            <button 
              v-for="opt in getSelectOptions()?.options || []" 
              :key="opt"
              @click="$emit('update:modelValue', opt)"
              class="px-3 py-1.5 text-xs font-medium rounded-md transition-all capitalize"
              :class="modelValue === opt 
                ? 'bg-white dark:bg-slate-600 shadow-sm text-slate-900 dark:text-white' 
                : 'text-slate-500 dark:text-slate-400 hover:text-slate-700'"
            >
              {{ opt }}
            </button>
          </div>
        </div>
      </div>
      
      <!-- Поля ввода во всю ширину -->
      <div v-if="field.component.type === 'Text'" class="mt-1">
        <input 
          type="text"
          :value="modelValue"
          @input="$emit('update:modelValue', ($event.target as HTMLInputElement).value)"
          class="w-full px-3 py-2 bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-lg text-sm focus:ring-2 focus:ring-blue-500/50 focus:border-blue-500 outline-none transition-all dark:text-white"
        />
      </div>

      <div v-else-if="field.component.type === 'Textarea'" class="mt-2">
        <textarea 
          :value="modelValue as string"
          @input="$emit('update:modelValue', ($event.target as HTMLTextAreaElement).value)"
          class="w-full px-4 py-3 bg-slate-50 dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded-xl text-xs font-mono leading-relaxed focus:ring-2 focus:ring-blue-500/50 focus:border-blue-500 outline-none resize-y dark:text-slate-300 shadow-inner min-h-[120px]"
          :rows="getTextareaOptions()?.rows || 4"
          spellcheck="false"
        ></textarea>
      </div>

      <div v-else-if="field.component.type === 'Tags'" class="mt-2">
        <TagInput 
          :model-value="modelValue as string[]"
          @update:modelValue="$emit('update:modelValue', $event)"
          :label="''" 
          placeholder="Add item..."
          :description="field.description"
        />
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
import { type SettingField } from '../../api/commands';
import TagInput from '../TagInput.vue';

const props = defineProps<{ 
  field: SettingField; 
  modelValue: any;
}>();

defineEmits(['update:modelValue']);

const getNumberOptions = () => {
  if (props.field.component.type === 'Number') return props.field.component.options;
  return undefined;
};

const getTextareaOptions = () => {
  if (props.field.component.type === 'Textarea') return props.field.component.options;
  return undefined;
};

const getSelectOptions = () => {
  if (props.field.component.type === 'Select') return props.field.component.options;
  return undefined;
};
</script>

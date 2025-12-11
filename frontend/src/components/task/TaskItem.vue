<template>
  <tr 
    :class="{ 
      'task-item': true,
      'is-dragging': isDragging,
      'is-first': isFirst,
      'is-last': isLast 
    }"
    draggable="true"
    @dragstart="handleDragStart"
    @dragend="handleDragEnd"
    @dragover.prevent="handleDragOver"
    @dragenter.prevent="handleDragEnter"
    @dragleave="handleDragLeave"
    @drop="handleDrop"
  >
    <td class="handle-cell">
      <div 
        class="drag-handle"
        draggable="true"
        @dragstart="handleDragStart"
        @dragend="handleDragEnd"
        @drag="handleDrag"
        title="Drag to reorder"
      >
        <svg viewBox="0 0 24 24" width="16" height="16">
          <path fill="currentColor" d="M3,15H21V13H3V15M3,19H21V17H3V19M3,11H21V9H3V11M3,5V7H21V5H3Z" />
        </svg>
      </div>
    </td>
    <td class="control-cell">
      <button @click="$emit('moveUp')" :disabled="isFirst">▲</button>
    </td>
    <td class="control-cell">
      <button @click="$emit('moveDown')" :disabled="isLast">▼</button>
    </td>
    <td class="time-cell">
      <template v-if="isFirst">
        <input
          v-model="localStartTime"
          type="text"
          pattern="[0-9]{2}:[0-9]{2}"
          :class="{ 'invalid': !isValidStartTime }"
          @input="handleStartTimeInput"
          @blur="handleStartTimeBlur"
        />
        <span v-if="!isValidStartTime" class="error-tooltip">
          Enter time in format HH:MM (00:00 to 23:59)
        </span>
      </template>
      <template v-else>
        {{ task.startTime }}
      </template>
    </td>
    <td class="time-cell">{{ task.endTime }}</td>
    <td>
      <input 
        :value="sanitizedName"
        type="text" 
        @input="handleNameInput"
        @blur="handleNameBlur"
      />
    </td>
    <td>
      <input
        v-model="localDuration"
        type="text"
        pattern="[0-9]{2}:[0-9]{2}"
        :class="{ 'invalid': !isValidInput }"
        @input="handleDurationInput"
        @blur="handleDurationBlur"
      />
      <span v-if="!isValidInput" class="error-tooltip">
        Enter duration in format HH:MM (00:01 to 23:59)
      </span>
    </td>
    <td class="control-cell">
      <button @click="$emit('addTask')">+</button>
    </td>
    <td class="control-cell">
      <button @click="$emit('delete-task', props.task.id)">🗑</button>
    </td>
  </tr>
</template>

<script setup lang="ts">
import type { Task } from '@/types'
import { ref, watch, computed } from 'vue'
import { isValidDuration, sanitizeDuration } from '@/utils/timeUtils'

const props = defineProps<{
  task: Task
  isFirst: boolean
  isLast: boolean
}>()

const emit = defineEmits<{
  'update:task': [task: Task],
  'delete-task': [id: string],
  'moveUp': [],
  'moveDown': [],
  'addTask': [],
  'reorder': [draggedId: string, targetId: string],
  'dragstart': [e: DragEvent]
}>()

const localDuration = ref(props.task.duration)
const localStartTime = ref(props.task.startTime)
const isValidInput = ref(true)
const isValidStartTime = ref(true)
const isDragOver = ref(false)
const isDragging = ref(false)
const isDragOverTop = ref(false)
const isDragOverBottom = ref(false)

watch(() => props.task.duration, (newDuration) => {
  localDuration.value = newDuration
})

watch(() => props.task.startTime, (newStartTime) => {
  localStartTime.value = newStartTime
})

function isValidTimeFormat(time: string): boolean {
  return /^([0-9]{2}):([0-9]{2})$/.test(time)
}

function isValidTime(time: string): boolean {
  if (!isValidTimeFormat(time)) return false
  const [hours, minutes] = time.split(':').map(Number)
  return hours >= 0 && hours <= 23 && minutes >= 0 && minutes <= 59
}

function sanitizeTime(time: string): string {
  if (!isValidTimeFormat(time)) return '08:00'
  if (!isValidTime(time)) return '08:00'
  return time
}

function handleStartTimeInput(event: Event) {
  const input = event.target as HTMLInputElement
  const value = input.value
  
  if (value.length <= 5) {
    localStartTime.value = value
    isValidStartTime.value = value.length === 5 ? isValidTime(value) : true
  }
}

function handleStartTimeBlur() {
  if (!isValidTime(localStartTime.value)) {
    localStartTime.value = props.task.startTime
    isValidStartTime.value = true
    return
  }
  
  emit('update:task', {
    ...props.task,
    startTime: localStartTime.value
  })
}

function handleDurationInput(event: Event) {
  const input = event.target as HTMLInputElement
  const value = input.value
  
  if (value.length <= 5) {
    localDuration.value = value
    isValidInput.value = value.length === 5 ? isValidDuration(value) : true
  }
}

function handleDurationBlur() {
  const sanitized = sanitizeDuration(localDuration.value)
  localDuration.value = sanitized
  isValidInput.value = true
  
  emit('update:task', {
    ...props.task,
    duration: sanitized
  })
}

function handleDragStart(e: DragEvent) {
  isDragging.value = true
  emit('dragstart', e)
}

function handleDragOver(event: DragEvent) {
  const rect = (event.target as HTMLElement).closest('tr')?.getBoundingClientRect()
  if (rect) {
    const mouseY = event.clientY
    const threshold = rect.height / 2
    const relativeY = mouseY - rect.top
    
    isDragOverTop.value = relativeY < threshold
    isDragOverBottom.value = relativeY >= threshold
  }
}

function handleDragEnter() {
  isDragOver.value = true
}

function handleDragLeave(event: DragEvent) {
  const target = event.currentTarget as HTMLElement
  if (!event.relatedTarget) return
  const related = event.relatedTarget as HTMLElement
  if (!target.contains(related)) {
    isDragOver.value = false
    isDragOverTop.value = false
    isDragOverBottom.value = false
  }
}

function handleDragEnd() {
  isDragging.value = false
  isDragOver.value = false
  isDragOverTop.value = false
  isDragOverBottom.value = false
}

function handleDrop(event: DragEvent) {
  event.preventDefault()
  if (!event.dataTransfer) return
  
  const draggedTaskId = event.dataTransfer.getData('text/plain')
  emit('reorder', draggedTaskId, props.task.id)
  
  document.querySelectorAll('.task-item').forEach(el => {
    el.classList.remove('dragging')
  })
}

function handleDrag(event: DragEvent) {
  if (!event.target) return
  const target = event.target as HTMLElement
  const row = target.closest('tr')
  if (!row) return

  isDragging.value = true
}

// Sanitize task name by removing only control characters
function sanitizeTaskName(name: string): string {
  // Only remove control characters, preserve spaces
  return name
    .replace(/[\u0000-\u001F\u007F-\u009F]/g, '')  // Remove control characters
    .replace(/[\r\n\t]/g, ' ')                      // Replace newlines/tabs with space
}

const sanitizedName = computed(() => sanitizeTaskName(props.task.name))

function handleNameInput(event: Event) {
  const input = event.target as HTMLInputElement
  const sanitized = sanitizeTaskName(input.value)
  emit('update:task', {
    ...props.task,
    name: sanitized
  })
}

function handleNameBlur(event: Event) {
  const input = event.target as HTMLInputElement
  const sanitized = sanitizeTaskName(input.value)
  if (sanitized !== input.value) {
    input.value = sanitized
  }
  emit('update:task', {
    ...props.task,
    name: sanitized
  })
}
</script>

<style scoped>
.task-item {
  height: 40px;
  cursor: move;
  transition: transform 0.2s ease, background-color 0.2s ease;
}

.task-item input {
  width: 100%;
  box-sizing: border-box;
  padding: 4px;
}

.task-item button {
  cursor: pointer;
}

.task-item button:disabled {
  cursor: not-allowed;
  opacity: 0.5;
}

.invalid {
  border-color: red;
  background-color: #fff0f0;
}

.error-tooltip {
  position: absolute;
  background: #ff4444;
  color: white;
  padding: 4px 8px;
  border-radius: 4px;
  font-size: 12px;
  z-index: 1;
}

input[type="text"] {
  width: 100%;
  box-sizing: border-box;
  padding: 4px;
}

.task-item.dragging {
  opacity: 0.5;
  background-color: #f5f5f5;
}

.task-item.drag-over {
  background-color: #f8f8f8;
}

.task-item.drag-over-top {
  border-top: 2px solid #4CAF50;
}

.task-item.drag-over-bottom {
  border-bottom: 2px solid #4CAF50;
}

tr.task-item:not(:last-child) {
  border-bottom: 1px solid #eee;
}

.drag-handle {
  cursor: grab;
  padding: 4px;
  display: flex;
  align-items: center;
  justify-content: center;
  background: #f0f0f0;
  border-radius: 4px;
  width: 24px;
  height: 24px;
  transition: all 0.2s ease;
}

.drag-handle:hover {
  background: #e0e0e0;
  transform: scale(1.1);
}

.drag-handle:active {
  cursor: grabbing;
  background: #d0d0d0;
  transform: scale(0.95);
}

.is-dragging .drag-handle {
  cursor: grabbing;
}

.task-item.is-dragging {
  box-shadow: 0 2px 8px rgba(0,0,0,0.1);
}

.task-item {
  -webkit-user-select: none;
  -moz-user-select: none;
  -ms-user-select: none;
  user-select: none;
}

.handle-cell {
  width: 24px;
  padding: 4px !important;
}

td:not(.handle-cell) {
  pointer-events: auto;
}

input, button {
  pointer-events: auto;
}

.time-cell input {
  width: 100%;
  box-sizing: border-box;
  padding: 4px;
}

.time-cell {
  min-width: 80px;
}
</style> 
<template>
  <div 
    class="task-list"
    @dragend="handleDragEnd"
  >
    <table>
      <thead>
        <tr>
          <th>Up</th>
          <th>Dn</th>
          <th>Start</th>
          <th>Finish</th>
          <th>Job</th>
          <th>Duration</th>
          <th>+</th>
          <th>Del</th>
        </tr>
      </thead>
      <tbody>
        <TaskItem
          v-for="(task, index) in tasks"
          :key="task.id"
          :task="task"
          :is-first="index === 0"
          :is-last="index === tasks.length - 1"
          draggable="true"
          @dragstart="handleDragStart($event, task.id)"
          @dragover="handleDragOver"
          @drop="handleDrop($event, task.id)"
          @move-up="moveTask(index, -1)"
          @move-down="moveTask(index, 1)"
          @add-task="addTask(index + 1)"
          @delete-task="deleteTask(index)"
          @update:task="updateTask(index, $event)"
          @reorder="handleReorder"
        />
      </tbody>
    </table>
    <div class="task-list-footer">
      <div class="footer-left">
        <button @click="addTask(tasks.length)">ADD LINE</button>
      </div>
      <div class="footer-right">
        <button 
          class="export-button" 
          @click="exportToCSV"
          :disabled="tasks.length === 0"
        >
          <span class="export-icon">📊</span>
          Export to CSV
        </button>
        <span class="total-time">Time sum: {{ totalDuration }}</span>
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
import { ref, computed, watch } from 'vue'
import { v4 as uuidv4 } from 'uuid'
import TaskItem from './TaskItem.vue'
import type { Task } from '@/types'
import { addMinutesToTime, parseDuration, formatDuration } from '@/utils/timeUtils'
import { tasksToCSV, downloadCSV } from '@/utils/csvUtils'

const props = defineProps<{
  initialStartTime: string
  tasks: Task[]
}>()

const emit = defineEmits<{
  'update:tasks': [tasks: Task[]]
}>()

// Initialize tasks with proper reactivity
const tasks = ref<Task[]>([])

// Watch for prop changes
watch(() => props.tasks, (newTasks) => {
  tasks.value = [...newTasks]
}, { immediate: true })

// Add createTask function
function createTask(index: number): Task {
  const startTime = index === 0 ? props.initialStartTime : tasks.value[index - 1]?.endTime || props.initialStartTime
  const duration = '00:30' // Default 30 minutes
  return {
    id: uuidv4(),
    name: `Task ${index + 1}`,
    startTime,
    duration,
    endTime: addMinutesToTime(startTime, parseDuration(duration))
  }
}

// Update addTask to handle task creation properly
function addTask(index: number) {
  const newTask = createTask(index)
  tasks.value.splice(index, 0, newTask)
  recalculateTimes()
}

// Delete task at specified index
function deleteTask(index: number) {
  tasks.value = tasks.value.filter((_, i) => i !== index)
  recalculateTimes()
}

// Update moveTask to maintain task order
function moveTask(index: number, direction: number) {
  const newIndex = index + direction
  if (newIndex >= 0 && newIndex < tasks.value.length) {
    const task = tasks.value.splice(index, 1)[0]
    tasks.value.splice(newIndex, 0, task)
    recalculateTimes()
  }
}

// Update task and recalculate times
function updateTask(index: number, updatedTask: Task) {
  tasks.value[index] = updatedTask
  recalculateTimes()
}

// Recalculate all task times based on first task and durations
function recalculateTimes() {
  if (tasks.value.length === 0) return

  // First task starts at initialStartTime if it's not set
  if (!tasks.value[0].startTime) {
    tasks.value[0].startTime = props.initialStartTime
  }

  // Calculate end time for first task
  tasks.value[0].endTime = addMinutesToTime(
    tasks.value[0].startTime,
    parseDuration(tasks.value[0].duration)
  )

  // Calculate times for subsequent tasks
  for (let i = 1; i < tasks.value.length; i++) {
    const prevTask = tasks.value[i - 1]
    const currentTask = tasks.value[i]
    
    currentTask.startTime = prevTask.endTime
    currentTask.endTime = addMinutesToTime(
      currentTask.startTime,
      parseDuration(currentTask.duration)
    )
  }

  emit('update:tasks', tasks.value)
}

// Calculate total duration
const totalDuration = computed(() => {
  const total = tasks.value.reduce((sum, task) => sum + parseDuration(task.duration), 0)
  return formatDuration(total)
})

// Update handleReorder to maintain task order
function handleReorder(draggedId: string, targetId: string) {
  const draggedIndex = tasks.value.findIndex(t => t.id === draggedId)
  const targetIndex = tasks.value.findIndex(t => t.id === targetId)
  
  if (draggedIndex !== -1 && targetIndex !== -1) {
    const [task] = tasks.value.splice(draggedIndex, 1)
    tasks.value.splice(targetIndex, 0, task)
    recalculateTimes()
  }
}

function handleDragEnd() {
  // Remove any lingering drag-related classes
  document.querySelectorAll('.task-item').forEach(el => {
    el.classList.remove('dragging')
    el.classList.remove('drag-over')
  })
}

function handleDragStart(e: DragEvent, taskId: string) {
  e.stopPropagation() // Prevent table drag
  if (e.dataTransfer) {
    e.dataTransfer.setData('text/plain', taskId)
    e.dataTransfer.effectAllowed = 'move'
  }
}

function handleDragOver(e: DragEvent) {
  e.preventDefault()
  e.stopPropagation()
  if (e.dataTransfer) {
    e.dataTransfer.dropEffect = 'move'
  }
}

function handleDrop(e: DragEvent, targetId: string) {
  e.preventDefault()
  e.stopPropagation()
  
  const draggedId = e.dataTransfer?.getData('text/plain')
  if (!draggedId) return
  
  const draggedIndex = tasks.value.findIndex(t => t.id === draggedId)
  const targetIndex = tasks.value.findIndex(t => t.id === targetId)
  
  if (draggedIndex > -1 && targetIndex > -1) {
    const updatedTasks = [...tasks.value]
    const [removed] = updatedTasks.splice(draggedIndex, 1)
    updatedTasks.splice(targetIndex, 0, removed)
    emit('update:tasks', updatedTasks)
  }
}

function exportToCSV() {
  if (tasks.value.length === 0) return
  
  try {
    const timestamp = new Date().toISOString().split('T')[0]
    const filename = `tasks-${timestamp}.csv`
    const csvContent = tasksToCSV(tasks.value)
    downloadCSV(csvContent, filename)
  } catch (error) {
    console.error('Error exporting CSV:', error)
    // You might want to add proper error handling/user notification here
  }
}
</script>

<style scoped>
.task-list {
  width: 100%;
  background: white;
  border-radius: 4px;
  padding: 1rem;
  pointer-events: auto;
}

table {
  width: 100%;
  border-collapse: collapse;
}

th, td {
  padding: 0.5rem;
  text-align: left;
  border-bottom: 1px solid #eee;
}

.task-item {
  cursor: grab;
}

.task-item.dragging {
  opacity: 0.5;
}

.task-item.drag-over {
  border-top: 2px solid #4CAF50;
}

.invalid {
  border-color: #ff4444;
}

.error-tooltip {
  position: absolute;
  background: #ff4444;
  color: white;
  padding: 4px 8px;
  border-radius: 4px;
  font-size: 12px;
  z-index: 1000;
}
</style> 
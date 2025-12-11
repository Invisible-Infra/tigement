<template>
  <div 
    class="table-component"
    :style="{
      position: 'absolute',
      left: `${table.position.x}px`,
      top: `${table.position.y}px`,
      zIndex: table.zIndex
    }"
    :class="{ 'dragging': isDragging }"
    @mousedown="startDrag"
    @click="bringToFront"
  >
    <div class="table-header" @mousedown.stop="startDrag">
      <div class="drag-handle">
        <svg viewBox="0 0 24 24" width="16" height="16">
          <path fill="currentColor" d="M3,15H21V13H3V15M3,19H21V17H3V19M3,11H21V9H3V11M3,5V7H21V5H3Z" />
        </svg>
      </div>
      <input 
        v-model="tableName"
        type="text"
        placeholder="Table Name"
        @input="updateTable"
        @mousedown.stop
      />
    </div>
    
    <TaskList 
      :initial-start-time="initialStartTime"
      :tasks="tableData[table.id] || []"
      @update:tasks="handleTasksUpdate"
    />
    
    <div class="table-footer">
      <button @click="$emit('deleteTable')" class="delete-button">
        Delete Table
      </button>
    </div>
  </div>
</template>

<script setup lang="ts">
import { ref, onMounted, onUnmounted } from 'vue'
import TaskList from '../task/TaskList.vue'
import type { Table, Task } from '@/types'

const props = withDefaults(defineProps<{
  table: Table
  initialStartTime?: string
  tableData: Record<number, Task[]>
  tables: Table[]
}>(), {
  initialStartTime: '08:00'
})

const emit = defineEmits<{
  'update:table': [table: Table]
  'deleteTable': []
  'update:tasks': [tableId: number, tasks: Task[]]
}>()

const tableName = ref(props.table.name)

const isDragging = ref(false)
const dragOffset = ref({ x: 0, y: 0 })
const containerBounds = ref({ width: 0, height: 0 })

function updateTable() {
  emit('update:table', {
    ...props.table,
    name: tableName.value,
  })
}

function handleTasksUpdate(tasks: Task[]) {
  emit('update:tasks', props.table.id, tasks)
}

function startDrag(e: MouseEvent) {
  if (!(e.target as HTMLElement).closest('.task-item')) {
    isDragging.value = true
    const element = e.currentTarget as HTMLElement
    const rect = element.getBoundingClientRect()
    dragOffset.value = {
      x: e.clientX - rect.left,
      y: e.clientY - rect.top
    }
    
    // Bring to front when starting drag
    bringToFront(e)
    
    document.addEventListener('mousemove', handleDrag)
    document.addEventListener('mouseup', stopDrag)
  }
}

function handleDrag(e: MouseEvent) {
  if (!isDragging.value) return

  const container = document.querySelector('.tables-container')
  if (!container) return

  const containerRect = container.getBoundingClientRect()

  // Calculate new position accounting for scroll
  const newX = e.clientX - dragOffset.value.x - containerRect.left + container.scrollLeft
  const newY = e.clientY - dragOffset.value.y - containerRect.top + container.scrollTop

  // Update table position
  emit('update:table', {
    ...props.table,
    position: { x: newX, y: newY }
  })
}

function stopDrag() {
  isDragging.value = false
  document.removeEventListener('mousemove', handleDrag)
  document.removeEventListener('mouseup', stopDrag)
}

// Update bringToFront function
function bringToFront(e: MouseEvent) {
  // Don't bring to front if clicking on task items
  if ((e.target as HTMLElement).closest('.task-item')) return
  
  // Get the highest z-index from all tables
  const newZIndex = Math.max(
    props.table.zIndex,
    ...props.tables.map(t => t.zIndex)
  ) + 1

  emit('update:table', {
    ...props.table,
    zIndex: newZIndex
  })
}

onUnmounted(() => {
  document.removeEventListener('mousemove', handleDrag)
  document.removeEventListener('mouseup', stopDrag)
})
</script>

<style scoped>
.table-component {
  position: absolute;
  background: white;
  border-radius: 8px;
  box-shadow: 0 2px 8px rgba(0,0,0,0.1);
  min-width: 800px;
  user-select: none;
  transition: box-shadow 0.2s ease;
}

.table-component:hover {
  box-shadow: 0 4px 12px rgba(0,0,0,0.2);
}

.table-header {
  display: flex;
  align-items: center;
  padding: 0.5rem;
  background: #f8f8f8;
  border-bottom: 1px solid #eee;
  border-radius: 8px 8px 0 0;
}

.drag-handle {
  cursor: move;
  padding: 0.5rem;
  margin-right: 0.5rem;
}

.table-header input {
  flex: 1;
  padding: 0.25rem 0.5rem;
  border: 1px solid #ddd;
  border-radius: 4px;
}

.table-footer {
  padding: 0.5rem;
  background: #f8f8f8;
  border-top: 1px solid #eee;
  border-radius: 0 0 8px 8px;
}

.dragging {
  opacity: 0.8;
  cursor: grabbing;
}

.task-list {
  pointer-events: auto; /* Enable task interactions */
}

.delete-button {
  background-color: #ff4444;
  color: white;
  border: none;
  border-radius: 4px;
  padding: 0.5rem 1rem;
  cursor: pointer;
}

.delete-button:hover {
  background-color: #ff0000;
}
</style> 
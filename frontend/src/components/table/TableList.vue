<template>
  <div class="table-list">
    <div class="tables-header">
      <h2>Tables</h2>
      <button @click="addTable" class="add-button">
        Add Table
      </button>
    </div>

    <div 
      class="tables-container"
      ref="containerRef"
    >
      <TableComponent
        v-for="table in tables"
        :key="table.id"
        :table="table"
        :tables="tables"
        :initial-start-time="defaultStartTime"
        :tableData="tableData"
        @update:table="updateTable($event)"
        @delete-table="deleteTable(table.id)"
        @update:tasks="handleTasksUpdate"
      />
    </div>

    <div v-if="tables.length === 0" class="no-tables">
      No tables yet. Click "Add Table" to create one.
    </div>
  </div>
</template>

<script setup lang="ts">
import { ref } from 'vue'
import { v4 as uuidv4 } from 'uuid'
import TableComponent from './TableComponent.vue'
import type { Table, Task } from '@/types'

const defaultStartTime = '08:00'

// Add props to receive tables from parent
const props = defineProps<{
  tables: Table[]
  tableData: Record<number, Task[]>
}>()

const emit = defineEmits<{
  'add-table': [table: Table],
  'update-table': [table: Table],
  'delete-table': [id: number],
  'update:tasks': [tableId: number, tasks: Task[]]
}>()

function createTable(): Table {
  // Find the highest existing ID and add 1
  const maxId = props.tables.reduce((max, table) => 
    Math.max(max, table.id), 0)
  const newId = maxId + 1

  return {
    id: newId,
    name: `Table ${newId}`,
    position: { x: 20 * (props.tables.length), y: 20 * (props.tables.length) },
    zIndex: newId
  }
}

function addTable() {
  const newTable = createTable()
  emit('add-table', newTable)
}

function updateTable(updatedTable: Table) {
  emit('update-table', updatedTable)
}

function deleteTable(tableId: number) {
  emit('delete-table', tableId)
}

function handleTasksUpdate(tableId: number, tasks: Task[]) {
  emit('update:tasks', tableId, tasks)
}
</script>

<style scoped>
.table-list {
  width: 100%;
  height: 100%;
  position: relative;
  padding: 0;
  margin: 0;
}

.tables-header {
  position: fixed;
  top: 4rem;
  left: 0;
  right: 0;
  height: 60px;
  display: flex;
  justify-content: space-between;
  align-items: center;
  padding: 0 1rem;
  background: #1a1a1a;
  z-index: 2000;
}

.tables-container {
  position: relative;
  margin-top: 64px;
  padding: 1rem;
  width: 100%;
  height: calc(100vh - 8rem);
  overflow: visible;
}

.add-button {
  padding: 0.5rem 1rem;
  background: #4CAF50;
  color: white;
  border: none;
  border-radius: 4px;
  cursor: pointer;
}

h2 {
  color: white;
  margin: 0;
}

.no-tables {
  color: white;
  text-align: center;
  padding: 2rem;
}
</style> 
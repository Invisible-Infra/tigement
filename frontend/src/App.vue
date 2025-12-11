<script setup lang="ts">
import { RouterLink, RouterView, useRouter } from 'vue-router'
import { ref, reactive, computed, onMounted, watch } from 'vue'
import type { Task, Table } from '@/types'
import type { StorageData } from '@/utils/storageUtils'
import { tablesToCSV, parseCSVToTables, downloadCSV } from '@/utils/csvUtils'
import { LocalStorageStrategy, DatabaseStorageStrategy } from '@/utils/storageUtils'
import { getUser, logout } from '@/utils/auth'
import TableList from './components/table/TableList.vue'
import { v4 as uuidv4 } from 'uuid'

interface User {
  email: string
  // add other user properties if needed
}

interface Subscription {
  // Define the structure of the Subscription type
}

const router = useRouter()
const user = ref<User | null>(null)
const tables = ref<Table[]>([])
const tableData = ref<Record<number, Task[]>>({})
const maxZIndex = ref(1)
const dragOffset = ref({ x: 0, y: 0 })

const selectedTable = ref(1)
const isLargeScreen = ref(window.innerWidth >= 1024)

// Track window size
window.addEventListener('resize', () => {
  isLargeScreen.value = window.innerWidth >= 1024
})

const tablePositions = reactive<Record<number, { x: number, y: number }>>({
  1: { x: 0, y: 0 }
})

const editingTableId = ref<number | null>(null)
const editingTableName = ref('')

const userSubscription = ref<Subscription | null>(null)

// Update storage strategy based on authentication
const storageStrategy = computed(() => {
  return user.value ? new DatabaseStorageStrategy() : new LocalStorageStrategy()
})

// Add loading and error states
const isLoading = ref(false)
const errorMessage = ref('')
const isSaving = ref(false)

// Load saved state on mount
onMounted(() => {
  const savedUser = localStorage.getItem('user')
  if (savedUser) {
    user.value = JSON.parse(savedUser)
  }
  // Always load tables, whether using local storage or authenticated
  loadSavedTables()
})

// Watch for changes and save to appropriate storage
watch([tables, tableData], () => {
  saveTables()
}, { deep: true })

// Add function to handle storage transition
async function handleStorageTransition(previousUser: User | null, newUser: User | null) {
  try {
    if (!previousUser && newUser) {
      // Transitioning from local to cloud storage
      const localData = await new LocalStorageStrategy().load()
      if (localData) {
        await storageStrategy.value.save(localData)
        // Only clear local storage after successful save
        localStorage.removeItem('taskPlannerData')
      }
    } else if (previousUser && !newUser) {
      // Logging out - clear everything
      localStorage.removeItem('taskPlannerData')
      tables.value = []
      tableData.value = {}
      maxZIndex.value = 1
      initializeDefaultTable()
    }
  } catch (e) {
    const message = e instanceof Error ? e.message : 'Unknown error'
    errorMessage.value = `Error during storage transition: ${message}`
    console.error('Storage transition error:', e)
  }
}

// Update user watcher
watch(user, async (newUser, oldUser) => {
  if (newUser !== oldUser) {
    await handleStorageTransition(oldUser, newUser)
    await loadSavedTables() // Reload data from new storage
  }
})

async function loadSavedTables() {
  isLoading.value = true
  errorMessage.value = ''
  
  try {
    const data = await storageStrategy.value.load()
    if (data) {
      tables.value = data.tables || []
      tableData.value = data.tableData || {}
      maxZIndex.value = data.maxZIndex || 1
    } else {
      initializeDefaultTable()
    }
  } catch (e) {
    const message = e instanceof Error ? e.message : 'Unknown error'
    errorMessage.value = `Error loading tables: ${message}`
    console.error('Error loading tables:', e)
    initializeDefaultTable()
  } finally {
    isLoading.value = false
  }
}

async function saveTables() {
  if (isSaving.value) return // Prevent multiple simultaneous saves
  
  isSaving.value = true
  errorMessage.value = ''
  
  try {
    const data: StorageData = {
      tables: tables.value,
      tableData: tableData.value,
      maxZIndex: maxZIndex.value
    }
    await storageStrategy.value.save(data)
  } catch (e) {
    const message = e instanceof Error ? e.message : 'Unknown error'
    errorMessage.value = `Error saving tables: ${message}`
    console.error('Error saving tables:', e)
  } finally {
    isSaving.value = false
  }
}

function handleDragStart(e: DragEvent, tableId: number) {
  if (e.target instanceof HTMLElement) {
    const rect = e.target.getBoundingClientRect()
    dragOffset.value = {
      x: e.clientX - rect.left,
      y: e.clientY - rect.top
    }
  }
}

function updateTablePosition(tableId: number, e: DragEvent) {
  const table = tables.value.find(t => t.id === tableId)
  if (table && e.clientX && e.clientY) {
    table.position = {
      x: Math.max(0, e.clientX - dragOffset.value.x),
      y: Math.max(0, e.clientY - dragOffset.value.y)
    }
    saveTables()
  }
}

function handleAddTable(newTable: Table) {
  tables.value.push(newTable)
  tableData.value[newTable.id] = []
  maxZIndex.value = Math.max(maxZIndex.value, newTable.zIndex)
  saveTables()
}

function handleUpdateTable(updatedTable: Table) {
  const index = tables.value.findIndex(t => t.id === updatedTable.id)
  if (index !== -1) {
    tables.value[index] = updatedTable
    saveTables()
  }
}

function deleteTable(tableId: number) {
  tables.value = tables.value.filter(t => t.id !== tableId)
  delete tableData.value[tableId]
  saveTables()
}

function handleTasksUpdate(tableId: number, tasks: Task[]) {
  if (tableId in tableData.value) {
    tableData.value[tableId] = tasks.map(task => ({
      ...task,
      id: task.id || uuidv4() // Ensure all tasks have IDs
    }))
    saveTables()
  } else {
    console.error(`Table ID ${tableId} not found in tableData`)
  }
}

function bringTableToFront(tableId: number) {
  maxZIndex.value++
  const table = tables.value.find(t => t.id === tableId)
  if (table) {
    table.zIndex = maxZIndex.value
    saveTables()
  }
}

function exportAllTables() {
  const tablesData = tables.value.map(table => ({
    name: table.name,
    tasks: tableData.value[table.id]
  }));
  
  const csv = tablesToCSV(tablesData);
  downloadCSV(csv, 'all_tables.csv');
}

function handleImportClick() {
  const input = document.createElement('input')
  input.type = 'file'
  input.accept = '.csv'
  input.onchange = (e) => importTables(e)
  input.click()
}

function importTables(event: Event) {
  const input = event.target as HTMLInputElement;
  const file = input.files?.[0];
  
  if (!file) return;
  
  const reader = new FileReader();
  reader.onload = async (e) => {
    try {
      const csv = e.target?.result as string;
      const importedTables = parseCSVToTables(csv);
      
      // Find the highest existing ID
      const maxId = tables.value.reduce((max, table) => 
        Math.max(max, table.id), 0)
      
      // Create new tableData object
      const newTableData: Record<number, Task[]> = {};
      
      // Add imported tables with proper task initialization
      importedTables.forEach((importedTable, index) => {
        const newId = maxId + index + 1;
        tables.value.push({
          id: newId,
          name: importedTable.name,
          position: { x: 20 * index, y: 20 * index },
          zIndex: newId
        });
        
        newTableData[newId] = importedTable.tasks.map(task => ({
          ...task,
          id: task.id || uuidv4()
        }));
      });
      
      // Merge with existing tableData
      tableData.value = {
        ...tableData.value,
        ...newTableData
      };
      
      maxZIndex.value = Math.max(
        maxZIndex.value,
        ...tables.value.map(t => t.zIndex)
      );
      
      await saveTables();
      input.value = '';
    } catch (error: unknown) {
      const message = error instanceof Error ? error.message : 'Unknown error'
      alert(`Error importing tables: ${message}`)
    }
  };
  
  reader.onerror = () => {
    alert('Error reading file');
  };
  
  reader.readAsText(file);
}

// Add a function to reset all data
async function resetAllData() {
  if (confirm('Are you sure you want to reset all data?')) {
    await storageStrategy.value.clear()
    // Reset to initial state
    tables.value = [{
      id: 1,
      name: 'Default Table',
      position: { x: 0, y: 0 },
      zIndex: 1
    }]
    tableData.value = { 1: [] }
    maxZIndex.value = 1
    await saveTables() // Save the initial state
  }
}

async function handleLogout() {
  try {
    await fetch('/public/logout.php')
    localStorage.removeItem('user')
    localStorage.removeItem(`tableData_${user.value?.email}`)
    user.value = null
    router.push('/login')
  } catch (e) {
    console.error('Logout error:', e)
  }
}

function updateUser(userData: User) {
  user.value = userData
  loadSavedTables() // Load tables when user logs in
}

function useLocalStorage() {
  // Set a flag indicating local storage mode
  localStorage.setItem('useLocal', 'true')
  router.push('/')
}

async function checkSubscription() {
  if (!user.value) return;
  // Fetch subscription status from server
}

// Expose the function to other components
defineExpose({ updateUser })

// Extract default table initialization
function initializeDefaultTable() {
  const defaultTable = {
    id: 1,
    name: 'Default Table',
    position: { x: 0, y: 0 },
    zIndex: 1
  }
  tables.value = [defaultTable]
  tableData.value = { 1: [] }
  maxZIndex.value = 1
}

function createTable(): Table {
  // Find the highest existing ID and add 1
  const maxId = tables.value.reduce((max, table) => 
    Math.max(max, table.id), 0)
  const newId = maxId + 1

  return {
    id: newId,
    name: `Table ${newId}`,
    position: { x: 20 * (tables.value.length), y: 20 * (tables.value.length) },
    zIndex: newId
  }
}
</script>

<template>
  <div class="app-container">
    <div class="auth-menu">
      <template v-if="!user">
        <RouterLink to="/login" class="auth-button">Login</RouterLink>
        <RouterLink to="/register" class="auth-button">Register</RouterLink>
      </template>
      <template v-else>
        <span class="user-email">{{ user.email }}</span>
        <button @click="handleLogout" class="auth-button">Logout</button>
      </template>
      <button @click="() => handleAddTable(createTable())" class="auth-button">Add Table</button>
    </div>

    <!-- Add RouterView -->
    <RouterView v-if="$route.path === '/login' || $route.path === '/register'" />
    
    <!-- Show tables only on main route -->
    <div v-else class="tables-container">
      <TableList 
        :tables="tables"
        :tableData="tableData"
        @add-table="handleAddTable"
        @update-table="handleUpdateTable"
        @delete-table="deleteTable"
        @update:tasks="handleTasksUpdate"
      />
    </div>
  </div>
</template>

<style>
/* Global styles - put this in main.css */
* {
  margin: 0;
  padding: 0;
  box-sizing: border-box;
}

html, body {
  width: 100%;
  height: 100%;
  overflow: hidden;
  background: #1a1a1a; /* Ensure consistent dark background */
}

#app {
  width: 100%;
  height: 100%;
  background: #1a1a1a;
  position: fixed; /* Prevent any scrolling or overflow */
  top: 0;
  left: 0;
  right: 0;
  bottom: 0;
}
</style>

<style scoped>
.app-container {
  width: 100vw;
  height: 100vh;
  padding: 0;
  margin: 0;
  display: flex;
  flex-direction: column;
  overflow: hidden;
  position: absolute;
  left: 0;
  top: 0;
}

.auth-menu {
  position: fixed;
  top: 1rem;
  right: 1rem;
  display: flex;
  gap: 1rem;
  z-index: 3000;
}

.auth-button {
  padding: 0.5rem 1rem;
  border-radius: 4px;
  background: #4CAF50;
  color: white;
  text-decoration: none;
  border: none;
  cursor: pointer;
}

.user-email {
  padding: 0.5rem;
}

.tables-container {
  flex: 1;
  position: relative;
  margin: 4rem 0 0 0;
  padding: 0;
  overflow: auto;
  background: #1a1a1a;
  width: 100%;
  height: calc(100vh - 4rem);
}
</style>

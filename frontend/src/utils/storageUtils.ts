import type { Table, Task } from '@/types'

interface StoredTable {
  id: number
  name: string
  position: { x: number; y: number }
  zIndex: number
}

export interface StorageData {
  tables: Table[]
  tableData: Record<number, Task[]>
  maxZIndex: number
}

const STORAGE_KEY = 'taskPlannerData'

// Helper function to encode special characters
function encodeSpecialChars(obj: any): any {
  if (typeof obj !== 'object' || obj === null) {
    return obj
  }

  if (Array.isArray(obj)) {
    return obj.map(item => encodeSpecialChars(item))
  }

  const encoded: any = {}
  for (const [key, value] of Object.entries(obj)) {
    if (typeof value === 'string') {
      encoded[key] = value
        .replace(/\\/g, '\\\\')  // escape backslashes
        .replace(/"/g, '\\"')    // escape quotes
    } else if (typeof value === 'object') {
      encoded[key] = encodeSpecialChars(value)
    } else {
      encoded[key] = value
    }
  }
  return encoded
}

// Helper function to decode special characters
function decodeSpecialChars(obj: any): any {
  if (typeof obj !== 'object' || obj === null) {
    return obj
  }

  if (Array.isArray(obj)) {
    return obj.map(item => decodeSpecialChars(item))
  }

  const decoded: any = {}
  for (const [key, value] of Object.entries(obj)) {
    if (typeof value === 'string') {
      decoded[key] = value
        .replace(/\\"/g, '"')    // unescape quotes
        .replace(/\\\\/g, '\\')  // unescape backslashes
    } else if (typeof value === 'object') {
      decoded[key] = decodeSpecialChars(value)
    } else {
      decoded[key] = value
    }
  }
  return decoded
}

export interface StorageStrategy {
  save(data: StorageData): Promise<void>
  load(): Promise<StorageData | null>
  clear(): Promise<void>
}

export class LocalStorageStrategy implements StorageStrategy {
  private readonly KEY = 'taskPlannerData'

  async save(data: StorageData): Promise<void> {
    try {
      localStorage.setItem(this.KEY, JSON.stringify(data))
    } catch (e) {
      throw new Error('Failed to save to local storage')
    }
  }

  async load(): Promise<StorageData | null> {
    try {
      const data = localStorage.getItem(this.KEY)
      return data ? JSON.parse(data) : null
    } catch (e) {
      throw new Error('Failed to load from local storage')
    }
  }

  async clear(): Promise<void> {
    try {
      localStorage.removeItem(this.KEY)
    } catch (e) {
      throw new Error('Failed to clear local storage')
    }
  }
}

export class DatabaseStorageStrategy implements StorageStrategy {
  private readonly API_BASE = '/api/tables'

  async save(data: StorageData): Promise<void> {
    const response = await fetch(`${this.API_BASE}/save`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(data),
      credentials: 'include'
    })

    if (!response.ok) {
      throw new Error('Failed to save to database: ' + response.statusText)
    }
  }

  async load(): Promise<StorageData | null> {
    const response = await fetch(`${this.API_BASE}/load`, {
      credentials: 'include'
    })

    if (!response.ok) {
      if (response.status === 401) {
        return null // Not authenticated
      }
      throw new Error('Failed to load from database: ' + response.statusText)
    }

    return response.json()
  }

  async clear(): Promise<void> {
    const response = await fetch(`${this.API_BASE}/clear`, {
      method: 'POST',
      credentials: 'include'
    })

    if (!response.ok) {
      throw new Error('Failed to clear database data: ' + response.statusText)
    }
  }
}

export function saveToLocalStorage(data: StorageData): void {
  try {
    const encodedData = encodeSpecialChars(data)
    const serialized = JSON.stringify(encodedData)
    localStorage.setItem(STORAGE_KEY, serialized)
  } catch (error) {
    console.error('Error saving to localStorage:', error)
  }
}

export function loadFromLocalStorage(): StorageData | null {
  try {
    const serialized = localStorage.getItem(STORAGE_KEY)
    if (!serialized) return null
    
    const parsedData = JSON.parse(serialized)
    return decodeSpecialChars(parsedData)
  } catch (error) {
    console.error('Error loading from localStorage:', error)
    return null
  }
}

export function clearLocalStorage(): void {
  try {
    localStorage.removeItem(STORAGE_KEY)
  } catch (error) {
    console.error('Error clearing localStorage:', error)
  }
} 
export interface Task {
  id: string
  name: string
  startTime: string
  endTime: string
  duration: string
}

export interface Table {
  id: number
  name: string
  position: { x: number; y: number }
  zIndex: number
} 
/**
 * Demo dataset for onboarding tutorial.
 * Fixed IDs for targeting; does not modify user data.
 */

export interface DemoTask {
  id: string
  title: string
  duration: number
  selected: boolean
  group?: string
  notebook?: string
}

export interface DemoTable {
  id: string
  type: 'day' | 'todo'
  title: string
  date?: string
  startTime?: string
  tasks: DemoTask[]
  position: { x: number; y: number }
  size?: { width: number; height: number }
  spaceId?: string | null
}

export function getDemoTables(): DemoTable[] {
  const today = new Date().toISOString().split('T')[0]
  return [
    {
      id: 'demo-day',
      type: 'day',
      title: 'Demo Day',
      date: today,
      startTime: '08:00',
      tasks: [
        { id: 'demo-breakfast', title: 'Breakfast', duration: 45, selected: false },
        { id: 'demo-plan', title: 'Plan', duration: 10, selected: false },
        { id: 'demo-exercise', title: 'Exercise', duration: 60, selected: false },
        { id: 'demo-team-call', title: 'Team call', duration: 60, selected: false },
      ],
      position: { x: 20, y: 20 },
      size: { width: 400, height: 300 },
    },
    {
      id: 'demo-todo',
      type: 'todo',
      title: 'Demo TODO',
      tasks: [
        { id: 'demo-email-triage', title: 'Email triage', duration: 20, selected: false },
        { id: 'demo-groceries', title: 'Groceries', duration: 30, selected: false },
      ],
      position: { x: 460, y: 20 },
      size: { width: 350, height: 200 },
    },
  ]
}

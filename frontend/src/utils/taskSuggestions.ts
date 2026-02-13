export function getUniqueTaskTitles(tables: { tasks: { title?: string }[] }[]): string[] {
  const seen = new Set<string>()
  const result: string[] = []
  for (const table of tables) {
    for (const task of table.tasks || []) {
      const t = (task.title ?? '').trim()
      if (t && !seen.has(t)) {
        seen.add(t)
        result.push(t)
      }
    }
  }
  return result
}

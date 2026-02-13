/**
 * Conditional default tasks — evaluate rules when creating new tables.
 * Premium feature: rules add tasks based on table type and conditions.
 */

export interface ConditionPreset {
  field: string
  operator: 'eq' | 'in'
  value: string | string[]
}

export interface Condition {
  kind: 'preset' | 'expression'
  preset?: ConditionPreset
  expression?: string
}

export interface TaskTemplate {
  title: string
  duration?: number
  startTime?: string
  group?: string
  notebook?: string
  selected?: boolean
}

export interface ConditionalDefaultRule {
  id: string
  tableType: 'day' | 'list'
  conditions: Condition[]
  tasks: TaskTemplate[]
}

export interface EvaluationContext {
  date: string
  dayweek: string
  dayOfMonth: number
  weekOfMonth: number
  month: number
  year: number
  weekOfYear: number
  isWeekend: boolean
  tableType: 'day' | 'list'
  spaceId: string | null
}

const DAYS = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday']
const MONTHS = ['January', 'February', 'March', 'April', 'May', 'June', 'July', 'August', 'September', 'October', 'November', 'December']

function getDayOfWeek(dateStr: string): string {
  const d = new Date(dateStr + 'T12:00:00')
  return DAYS[d.getDay()]
}

function getDayOfMonth(dateStr: string): number {
  const d = new Date(dateStr + 'T12:00:00')
  return d.getDate()
}

function getWeekOfMonth(dateStr: string): number {
  const d = new Date(dateStr + 'T12:00:00')
  const day = d.getDate()
  return Math.ceil(day / 7)
}

function getWeekOfYear(dateStr: string): number {
  const d = new Date(dateStr + 'T12:00:00')
  const start = new Date(d.getFullYear(), 0, 1)
  const diff = d.getTime() - start.getTime()
  return Math.ceil((diff / 86400000 + start.getDay() + 1) / 7)
}

export function getEvaluationContext(table: { type: 'day' | 'list'; date?: string; spaceId?: string | null }): EvaluationContext {
  const date = table.date || ''
  const dayweek = date ? getDayOfWeek(date) : ''
  const dayOfMonth = date ? getDayOfMonth(date) : 0
  const weekOfMonth = date ? getWeekOfMonth(date) : 0
  const d = date ? new Date(date + 'T12:00:00') : new Date()
  const month = d.getMonth() + 1
  const year = d.getFullYear()
  const weekOfYear = date ? getWeekOfYear(date) : 0
  const isWeekend = dayweek === 'Saturday' || dayweek === 'Sunday'

  return {
    date,
    dayweek,
    dayOfMonth,
    weekOfMonth,
    month,
    year,
    weekOfYear,
    isWeekend,
    tableType: table.type,
    spaceId: table.spaceId ?? null
  }
}

function evaluatePresetCondition(ctx: EvaluationContext, preset: ConditionPreset): boolean {
  const { field, operator, value } = preset
  let actual: string | number | boolean

  switch (field) {
    case 'dayweek':
      actual = ctx.dayweek
      break
    case 'dayOfMonth':
      actual = ctx.dayOfMonth
      break
    case 'weekOfMonth':
      actual = ctx.weekOfMonth
      break
    case 'month':
      actual = ctx.month
      break
    case 'date':
      actual = ctx.date
      break
    case 'isWeekend':
      actual = ctx.isWeekend
      break
    case 'spaceId':
      actual = ctx.spaceId ?? ''
      break
    default:
      return false
  }

  if (operator === 'eq') {
    const v = typeof value === 'string' ? value : (Array.isArray(value) ? value[0] : String(value))
    if (typeof v === 'string' && (v === 'true' || v === 'false')) {
      return actual === (v === 'true')
    }
    if (typeof v === 'string' && /^\d+$/.test(v)) {
      return Number(actual) === Number(v)
    }
    return String(actual) === String(v)
  }

  if (operator === 'in') {
    const arr = Array.isArray(value) ? value : [value]
    return arr.some(v => {
      if (typeof v === 'string' && (v === 'true' || v === 'false')) {
        return actual === (v === 'true')
      }
      if (typeof v === 'string' && /^\d+$/.test(v)) {
        return Number(actual) === Number(v)
      }
      return String(actual) === String(v)
    })
  }

  return false
}

/**
 * Safe expression evaluation using a minimal parser.
 * Supports: ===, !==, <=, >=, <, >, &&, ||, !, ( ), and numeric/string/boolean literals.
 * No eval(), no Function(), no access to globals.
 */
function evaluateExpression(expr: string, ctx: EvaluationContext): boolean {
  const s = expr.trim()
  if (!s) return true

  try {
    return evaluateExpr(s, ctx)
  } catch {
    return false
  }
}

function evaluateExpr(s: string, ctx: EvaluationContext): boolean {
  s = s.trim()

  // Handle parentheses
  if (s.startsWith('(') && s.endsWith(')')) {
    const inner = s.slice(1, -1).trim()
    const depth = findMatchingParen(inner)
    if (depth === inner.length) return evaluateExpr(inner, ctx)
  }

  // Handle ! (not)
  if (s.startsWith('!')) {
    return !evaluateExpr(s.slice(1).trim(), ctx)
  }

  // Handle && (lowest precedence for binary)
  const andIdx = findBinaryOp(s, '&&')
  if (andIdx >= 0) {
    return evaluateExpr(s.slice(0, andIdx).trim(), ctx) && evaluateExpr(s.slice(andIdx + 2).trim(), ctx)
  }

  // Handle ||
  const orIdx = findBinaryOp(s, '||')
  if (orIdx >= 0) {
    return evaluateExpr(s.slice(0, orIdx).trim(), ctx) || evaluateExpr(s.slice(orIdx + 2).trim(), ctx)
  }

  // Handle % (modulo) in expressions like dayOfMonth % 3 === 0 (before comparison ops)
  const modIdx = s.indexOf('%')
  if (modIdx >= 0) {
    const eqIdx = s.indexOf('===', modIdx)
    if (eqIdx >= 0) {
      const left = s.slice(0, modIdx).trim()
      const modRight = s.slice(modIdx + 1, eqIdx).trim().split(/\s+/)[0]
      const right = s.slice(eqIdx + 3).trim()
      const l = resolveValue(left, ctx)
      const modVal = resolveValue(modRight, ctx)
      const result = Number(l) % Number(modVal)
      return result === Number(resolveValue(right, ctx))
    }
  }

  // Handle comparison operators
  const ops = ['===', '!==', '<=', '>=', '<', '>']
  for (const op of ops) {
    const idx = s.indexOf(op)
    if (idx >= 0) {
      const left = s.slice(0, idx).trim()
      const right = s.slice(idx + op.length).trim()
      const l = resolveValue(left, ctx)
      const r = resolveValue(right, ctx)
      switch (op) {
        case '===': return l === r
        case '!==': return l !== r
        case '<=': return Number(l) <= Number(r)
        case '>=': return Number(l) >= Number(r)
        case '<': return Number(l) < Number(r)
        case '>': return Number(l) > Number(r)
        default: return false
      }
    }
  }

  // Single value (truthy check)
  const v = resolveValue(s, ctx)
  return Boolean(v)
}

function findBinaryOp(s: string, op: string): number {
  let depth = 0
  for (let i = 0; i <= s.length - op.length; i++) {
    const c = s[i]
    if (c === '(') depth++
    else if (c === ')') depth--
    else if (depth === 0 && s.slice(i, i + op.length) === op) return i
  }
  return -1
}

function findMatchingParen(s: string): number {
  let depth = 0
  for (let i = 0; i < s.length; i++) {
    if (s[i] === '(') depth++
    else if (s[i] === ')') { depth--; if (depth < 0) return -1 }
  }
  return depth === 0 ? s.length : -1
}

function resolveValue(s: string, ctx: EvaluationContext): string | number | boolean {
  s = s.trim()

  // String literal '...' or "..."
  if ((s.startsWith("'") && s.endsWith("'")) || (s.startsWith('"') && s.endsWith('"'))) {
    return s.slice(1, -1)
  }

  // Boolean
  if (s === 'true') return true
  if (s === 'false') return false

  // Number
  if (/^-?\d+$/.test(s)) return parseInt(s, 10)
  if (/^-?\d+\.\d+$/.test(s)) return parseFloat(s)

  // Context property
  const key = s as keyof EvaluationContext
  if (key in ctx) {
    const v = (ctx as Record<string, unknown>)[key]
    return v as string | number | boolean
  }

  return ''
}

function ruleMatches(rule: ConditionalDefaultRule, tableType: 'day' | 'list', table: { type: 'day' | 'list'; date?: string; spaceId?: string | null }): boolean {
  if (rule.tableType !== tableType) return false

  const ctx = getEvaluationContext(table)

  for (const cond of rule.conditions) {
    if (cond.kind === 'preset' && cond.preset) {
      if (!evaluatePresetCondition(ctx, cond.preset)) return false
    } else if (cond.kind === 'expression' && cond.expression) {
      if (!evaluateExpression(cond.expression, ctx)) return false
    }
  }

  return true
}

function templateToTask(template: TaskTemplate, index: number, defaultDuration: number, defaultStartTime: string): {
  id: string
  title: string
  duration: number
  selected: boolean
  group?: string
  notebook?: string
  startTime?: string
} {
  const id = `task-${Date.now()}-cond-${index}`
  const task: {
    id: string
    title: string
    duration: number
    selected: boolean
    group?: string
    notebook?: string
    startTime?: string
  } = {
    id,
    title: template.title,
    duration: template.duration ?? defaultDuration,
    selected: template.selected ?? false,
  }
  if (template.group != null) task.group = template.group
  if (template.notebook != null) task.notebook = template.notebook
  if (template.startTime != null) task.startTime = template.startTime
  return task
}

export interface EvaluateRulesOptions {
  defaultDuration: number
  defaultStartTime: string
}

/**
 * Evaluate conditional default rules and return tasks to prepend to a new table.
 */
export function evaluateRules(
  tableType: 'day' | 'list',
  table: { type: 'day' | 'list'; date?: string; spaceId?: string | null },
  rules: ConditionalDefaultRule[] | undefined,
  options: EvaluateRulesOptions
): Array<{ id: string; title: string; duration: number; selected: boolean; group?: string; notebook?: string; startTime?: string }> {
  if (!rules || rules.length === 0) return []

  const { defaultDuration, defaultStartTime } = options
  const result: Array<{ id: string; title: string; duration: number; selected: boolean; group?: string; notebook?: string; startTime?: string }> = []
  let idx = 0

  for (const rule of rules) {
    if (!ruleMatches(rule, tableType, table)) continue

    for (const template of rule.tasks) {
      if (!template.title?.trim()) continue
      result.push(templateToTask(template, idx++, defaultDuration, defaultStartTime))
    }
  }

  return result
}

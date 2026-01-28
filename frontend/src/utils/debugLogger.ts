const MAX_LOGS = 500
const STORAGE_KEY = 'tigement_debug_logs'

interface DebugLog {
  timestamp: string
  level: 'log' | 'warn' | 'error' | 'info'
  message: string
  stack?: string
}

class DebugLogger {
  private logs: DebugLog[] = []
  
  constructor() {
    this.loadLogs()
    this.interceptConsole()
    this.captureVisibilityChanges()
    this.captureErrors()
  }
  
  private interceptConsole() {
    const original = {
      log: console.log,
      warn: console.warn,
      error: console.error,
      info: console.info
    }
    
    console.log = (...args) => {
      this.add('log', args.join(' '))
      original.log(...args)
    }
    
    console.warn = (...args) => {
      this.add('warn', args.join(' '))
      original.warn(...args)
    }
    
    console.error = (...args) => {
      this.add('error', args.join(' '), new Error().stack)
      original.error(...args)
    }
  }
  
  private captureVisibilityChanges() {
    document.addEventListener('visibilitychange', () => {
      this.add('info', `Visibility changed to: ${document.visibilityState}`)
    })
  }
  
  private captureErrors() {
    window.addEventListener('error', (event) => {
      this.add('error', `Uncaught error: ${event.message}`, event.error?.stack)
    })
    
    window.addEventListener('unhandledrejection', (event) => {
      this.add('error', `Unhandled promise rejection: ${event.reason}`)
    })
  }
  
  private add(level: DebugLog['level'], message: string, stack?: string) {
    const log: DebugLog = {
      timestamp: new Date().toISOString(),
      level,
      message,
      stack
    }
    
    this.logs.push(log)
    if (this.logs.length > MAX_LOGS) {
      this.logs.shift()
    }
    
    this.saveLogs()
  }
  
  private loadLogs() {
    try {
      const saved = localStorage.getItem(STORAGE_KEY)
      if (saved) {
        this.logs = JSON.parse(saved)
      }
    } catch (e) {
      // ignore
    }
  }
  
  private saveLogs() {
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(this.logs))
    } catch (e) {
      // Storage full, remove old logs
      this.logs = this.logs.slice(-100)
      localStorage.setItem(STORAGE_KEY, JSON.stringify(this.logs))
    }
  }
  
  public exportLogs(): string {
    return this.logs.map(log => 
      `[${log.timestamp}] [${log.level.toUpperCase()}] ${log.message}${log.stack ? '\n' + log.stack : ''}`
    ).join('\n\n')
  }
  
  public clearLogs() {
    this.logs = []
    localStorage.removeItem(STORAGE_KEY)
  }
  
  public getLogs() {
    return this.logs
  }
}

export const debugLogger = new DebugLogger()

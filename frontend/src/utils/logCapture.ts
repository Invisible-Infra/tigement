class LogCapture {
  private logs: Array<{ level: string; message: string; timestamp: number }> = []
  private maxLogs = 100
  private originalConsole = {
    log: console.log,
    error: console.error,
    warn: console.warn
  }

  constructor() {
    try {
      this.interceptConsole()
      this.interceptGlobalErrors()
    } catch (error) {
      // If log capture fails to initialize, don't break the app
      // Just silently fail and the feature won't be available
    }
  }

  private interceptConsole() {
    const self = this
    
    console.log = (...args: any[]) => {
      try {
        self.captureLog('log', args)
      } catch (e) {
        // Ignore capture errors
      }
      self.originalConsole.log.apply(console, args)
    }

    console.error = (...args: any[]) => {
      try {
        self.captureLog('error', args)
      } catch (e) {
        // Ignore capture errors
      }
      self.originalConsole.error.apply(console, args)
    }

    console.warn = (...args: any[]) => {
      try {
        self.captureLog('warn', args)
      } catch (e) {
        // Ignore capture errors
      }
      self.originalConsole.warn.apply(console, args)
    }
  }

  private interceptGlobalErrors() {
    // Capture unhandled errors
    window.addEventListener('error', (event) => {
      try {
        const message = `${event.message} at ${event.filename}:${event.lineno}:${event.colno}`
        this.logs.push({ level: 'error', message, timestamp: Date.now() })
        if (this.logs.length > this.maxLogs) {
          this.logs.shift()
        }
      } catch (e) {
        // Ignore capture errors
      }
    })

    // Capture unhandled promise rejections
    window.addEventListener('unhandledrejection', (event) => {
      try {
        const message = `Unhandled Promise Rejection: ${event.reason}`
        this.logs.push({ level: 'error', message, timestamp: Date.now() })
        if (this.logs.length > this.maxLogs) {
          this.logs.shift()
        }
      } catch (e) {
        // Ignore capture errors
      }
    })
  }

  private captureLog(level: string, args: any[]) {
    try {
      const message = args.map(arg => {
        try {
          return typeof arg === 'object' ? JSON.stringify(arg) : String(arg)
        } catch {
          return '[Object]'
        }
      }).join(' ')
      
      this.logs.push({ level, message, timestamp: Date.now() })
      if (this.logs.length > this.maxLogs) {
        this.logs.shift()
      }
    } catch (e) {
      // Silently fail if capture doesn't work
    }
  }

  getAnonymizedLogs(): string {
    try {
      const errorCount = this.logs.filter(l => l.level === 'error').length
      const warnCount = this.logs.filter(l => l.level === 'warn').length
      const logCount = this.logs.filter(l => l.level === 'log').length
      
      const summary = `=== Log Summary ===\nTotal: ${this.logs.length} entries | Errors: ${errorCount} | Warnings: ${warnCount} | Logs: ${logCount}\n\n`
      
      const logs = this.logs.map(log => {
        try {
          let msg = log.message
          // Anonymize emails
          msg = msg.replace(/[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}/g, '[EMAIL]')
          // Anonymize task titles (content between quotes if longer than 4 chars)
          msg = msg.replace(/"([^"]{5,})"/g, '"[TASK]"')
          // Anonymize table names/dates except format
          msg = msg.replace(/\b\d{2}\.\s?\d{2}\.\s?\d{4}\b/g, '[DATE]')
          // Anonymize long text content (preserve short technical strings)
          msg = msg.replace(/:\s*"([^"]{20,})"/g, ': "[CONTENT]"')
          
          // Add visual markers for errors and warnings
          const levelPrefix = log.level === 'error' ? '🔴 ERROR' : 
                              log.level === 'warn' ? '⚠️  WARN' : 
                              '📝 LOG'
          
          return `[${new Date(log.timestamp).toISOString()}] ${levelPrefix}: ${msg}`
        } catch {
          return '[Log entry could not be formatted]'
        }
      }).join('\n')
      
      return summary + logs
    } catch (e) {
      return 'Log capture unavailable or failed'
    }
  }

  clear() {
    this.logs = []
  }
}

export const logCapture = new LogCapture()


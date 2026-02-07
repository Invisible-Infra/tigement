import React, { Component, ErrorInfo, ReactNode } from 'react'

interface Props {
  children: ReactNode
}

interface State {
  hasError: boolean
  error: Error | null
}

/**
 * Catches React render errors and shows fallback UI instead of blank screen.
 * Helps debug crashes (e.g. when tab becomes visible while offline).
 */
export class ErrorBoundary extends Component<Props, State> {
  constructor(props: Props) {
    super(props)
    this.state = { hasError: false, error: null }
  }

  static getDerivedStateFromError(error: Error): State {
    return { hasError: true, error }
  }

  componentDidCatch(error: Error, errorInfo: ErrorInfo) {
    console.error('ErrorBoundary caught:', error, errorInfo)
  }

  handleReload = () => {
    window.location.reload()
  }

  render() {
    if (this.state.hasError && this.state.error) {
      return (
        <div
          style={{
            padding: 24,
            textAlign: 'center',
            fontFamily: 'system-ui, sans-serif',
            maxWidth: 400,
            margin: '40px auto',
          }}
        >
          <p style={{ marginBottom: 16 }}>Something went wrong.</p>
          <button
            onClick={this.handleReload}
            style={{
              padding: '10px 20px',
              fontSize: 16,
              cursor: 'pointer',
              backgroundColor: '#4fc3f7',
              border: 'none',
              borderRadius: 8,
              color: 'white',
            }}
          >
            Reload
          </button>
        </div>
      )
    }
    return this.props.children
  }
}

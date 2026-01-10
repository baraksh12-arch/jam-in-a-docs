import React from 'react';
import { captureError } from '@/lib/errorTracking';

/**
 * Error Boundary Component
 * Catches React errors and displays a user-friendly error message
 * Uses inline styles to avoid dependency on UI components that might fail
 */
export class ErrorBoundary extends React.Component {
  constructor(props) {
    super(props);
    this.state = { hasError: false, error: null, errorInfo: null };
  }

  static getDerivedStateFromError(error) {
    return { hasError: true };
  }

  componentDidCatch(error, errorInfo) {
    console.error('[ErrorBoundary] Caught error:', error, errorInfo);
    this.setState({
      error,
      errorInfo
    });
    
    // Send to error tracking service
    captureError(error, {
      errorInfo,
      componentStack: errorInfo?.componentStack,
      errorBoundary: true,
    });
  }

  handleReset = () => {
    this.setState({ hasError: false, error: null, errorInfo: null });
    window.location.reload();
  };

  render() {
    if (this.state.hasError) {
      // Use inline styles to avoid dependency on UI components
      const containerStyle = {
        minHeight: '100vh',
        background: 'linear-gradient(to bottom right, #0f172a, #581c87, #0f172a)',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        padding: '1rem',
        color: 'white'
      };

      const cardStyle = {
        maxWidth: '42rem',
        width: '100%',
        background: 'rgba(255, 255, 255, 0.1)',
        backdropFilter: 'blur(8px)',
        border: '1px solid rgba(239, 68, 68, 0.5)',
        borderRadius: '0.75rem',
        padding: '1.5rem'
      };

      const buttonStyle = {
        padding: '0.5rem 1rem',
        borderRadius: '0.375rem',
        border: 'none',
        cursor: 'pointer',
        fontSize: '0.875rem',
        fontWeight: '500',
        marginRight: '0.75rem'
      };

      return (
        <div style={containerStyle}>
          <div style={cardStyle}>
            <div style={{ marginBottom: '1rem' }}>
              <h2 style={{ fontSize: '1.5rem', fontWeight: 'bold', color: '#fca5a5', marginBottom: '0.5rem' }}>
                ⚠️ Something went wrong
              </h2>
              <p style={{ color: 'rgba(255, 255, 255, 0.8)', marginBottom: '1rem' }}>
                We encountered an unexpected error. This has been logged and we'll look into it.
              </p>
              
              {import.meta.env.DEV && this.state.error && (
                <details style={{ marginTop: '1rem' }}>
                  <summary style={{ color: 'rgba(255, 255, 255, 0.6)', cursor: 'pointer', fontSize: '0.875rem' }}>
                    Error details (development only)
                  </summary>
                  <pre style={{
                    marginTop: '0.5rem',
                    padding: '1rem',
                    background: 'rgba(0, 0, 0, 0.5)',
                    borderRadius: '0.375rem',
                    fontSize: '0.75rem',
                    color: '#fca5a5',
                    overflow: 'auto',
                    maxHeight: '16rem'
                  }}>
                    {this.state.error.toString()}
                    {this.state.errorInfo?.componentStack}
                  </pre>
                </details>
              )}

              <div style={{ display: 'flex', gap: '0.75rem', marginTop: '1rem' }}>
                <button
                  onClick={this.handleReset}
                  style={{
                    ...buttonStyle,
                    background: '#9333ea',
                    color: 'white'
                  }}
                  onMouseOver={(e) => e.target.style.background = '#7e22ce'}
                  onMouseOut={(e) => e.target.style.background = '#9333ea'}
                >
                  🔄 Reload App
                </button>
                <button
                  onClick={() => window.history.back()}
                  style={{
                    ...buttonStyle,
                    background: 'transparent',
                    color: 'white',
                    border: '1px solid rgba(255, 255, 255, 0.3)'
                  }}
                  onMouseOver={(e) => e.target.style.background = 'rgba(255, 255, 255, 0.1)'}
                  onMouseOut={(e) => e.target.style.background = 'transparent'}
                >
                  ← Go Back
                </button>
              </div>
            </div>
          </div>
        </div>
      );
    }

    return this.props.children;
  }
}

/**
 * Error Boundary Component
 * Catches rendering errors and displays a fallback UI
 */
import React from 'react';

class ErrorBoundaryClass extends React.Component {
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
  }

  handleReset = () => {
    this.setState({ hasError: false, error: null, errorInfo: null });
  };

  render() {
    if (this.state.hasError) {
      return (
        <ErrorFallback 
          error={this.state.error} 
          errorInfo={this.state.errorInfo}
          onReset={this.handleReset}
        />
      );
    }

    return this.props.children;
  }
}

function ErrorFallback({ error, errorInfo, onReset }) {
  const handleGoHome = () => {
    window.location.href = '/';
  };

  return (
    <div className="min-h-screen bg-slate-900 flex items-center justify-center">
      <div className="text-center max-w-2xl mx-auto px-4">
        <h1 className="text-3xl font-bold text-red-400 mb-4">Something went wrong</h1>
        <p className="text-gray-300 mb-6">
          The room failed to load. This might be due to a network issue or a bug.
        </p>
        
        {import.meta.env.DEV && error && (
          <div className="bg-black/50 rounded-lg p-4 mb-6 text-left overflow-auto max-h-64">
            <p className="text-red-300 font-mono text-sm mb-2">{error.toString()}</p>
            {errorInfo && (
              <pre className="text-xs text-gray-400 whitespace-pre-wrap">
                {errorInfo.componentStack}
              </pre>
            )}
          </div>
        )}

        <div className="flex gap-4 justify-center">
          <button
            onClick={onReset}
            className="px-4 py-2 bg-purple-600 text-white rounded hover:bg-purple-700"
          >
            Try Again
          </button>
          <button
            onClick={handleGoHome}
            className="px-4 py-2 bg-gray-600 text-white rounded hover:bg-gray-700"
          >
            Back to Home
          </button>
        </div>
      </div>
    </div>
  );
}

export default ErrorBoundaryClass;


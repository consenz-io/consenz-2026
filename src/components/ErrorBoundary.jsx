import React from 'react';
import { AlertCircle, RefreshCw } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert';

class ErrorBoundary extends React.Component {
  constructor(props) {
    super(props);
    this.state = { 
      hasError: false, 
      error: null, 
      errorInfo: null,
      errorCount: 0
    };
  }

  static getDerivedStateFromError(error) {
    return { hasError: true };
  }

  componentDidCatch(error, errorInfo) {
    const errorCount = this.state.errorCount + 1;
    
    // Log error details
    console.error('🔴 [ERROR BOUNDARY] Caught error:', {
      error: error?.message || error,
      stack: error?.stack,
      componentStack: errorInfo?.componentStack,
      timestamp: new Date().toISOString(),
      errorCount
    });

    // Update state with error details
    this.setState({
      error,
      errorInfo,
      errorCount
    });

    // Send to monitoring service (if available)
    if (typeof window !== 'undefined' && window.trackError) {
      window.trackError({
        message: error?.message,
        stack: error?.stack,
        componentStack: errorInfo?.componentStack
      });
    }
  }

  handleReset = () => {
    this.setState({
      hasError: false,
      error: null,
      errorInfo: null
    });
  };

  render() {
    if (this.state.hasError) {
      const isDev = process.env.NODE_ENV === 'development';

      return (
        <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-gray-50 to-blue-50 p-6">
          <div className="max-w-2xl w-full">
            <Alert variant="destructive" className="mb-4">
              <AlertCircle className="h-5 w-5" />
              <AlertTitle className="text-lg font-semibold">משהו השתבש</AlertTitle>
              <AlertDescription className="mt-2">
                <p className="mb-4">
                  אירעה שגיאה בלתי צפויה באפליקציה. אנחנו מתנצלים על אי הנוחות.
                </p>
                
                {isDev && this.state.error && (
                  <div className="mt-4 p-4 bg-gray-900 text-white rounded-lg overflow-auto max-h-60 text-sm font-mono">
                    <div className="font-bold mb-2">שגיאה:</div>
                    <div className="mb-3">{this.state.error.toString()}</div>
                    
                    {this.state.error.stack && (
                      <>
                        <div className="font-bold mb-2 mt-4">Stack Trace:</div>
                        <pre className="whitespace-pre-wrap text-xs">
                          {this.state.error.stack}
                        </pre>
                      </>
                    )}
                    
                    {this.state.errorInfo?.componentStack && (
                      <>
                        <div className="font-bold mb-2 mt-4">Component Stack:</div>
                        <pre className="whitespace-pre-wrap text-xs">
                          {this.state.errorInfo.componentStack}
                        </pre>
                      </>
                    )}
                  </div>
                )}

                <div className="flex gap-3 mt-6">
                  <Button onClick={this.handleReset} className="gap-2">
                    <RefreshCw className="w-4 h-4" />
                    נסה שוב
                  </Button>
                  
                  <Button
                    variant="outline"
                    onClick={() => window.location.href = '/'}
                  >
                    חזור לדף הבית
                  </Button>
                </div>

                {this.state.errorCount > 2 && (
                  <div className="mt-4 p-3 bg-yellow-50 border border-yellow-200 rounded text-sm">
                    ⚠️ השגיאה חוזרת על עצמה. אנא נסה לרענן את הדף או לחזור מאוחר יותר.
                  </div>
                )}
              </AlertDescription>
            </Alert>
          </div>
        </div>
      );
    }

    return this.props.children;
  }
}

export default ErrorBoundary;
import React from 'react';
import { Button } from '@/components/ui/button';
import { Card, CardHeader, CardTitle, CardContent } from '@/components/ui/card';
import { AlertTriangle, RefreshCw, Home } from 'lucide-react';
import { createPageUrl } from '@/utils';

class ErrorBoundary extends React.Component {
  constructor(props) {
    super(props);
    this.state = { 
      hasError: false, 
      error: null,
      errorInfo: null,
      errorCount: 0,
    };
  }

  static getDerivedStateFromError(error) {
    return { hasError: true, error };
  }

  componentDidCatch(error, errorInfo) {
    // Log error details
    console.error('[ERROR BOUNDARY]', {
      error: error.toString(),
      componentStack: errorInfo.componentStack,
      timestamp: new Date().toISOString(),
    });

    this.setState(prev => ({
      errorInfo,
      errorCount: prev.errorCount + 1,
    }));

    // Report to monitoring service (if configured)
    if (window.reportError) {
      window.reportError(error, errorInfo);
    }
  }

  handleReset = () => {
    this.setState({ 
      hasError: false, 
      error: null, 
      errorInfo: null 
    });
  };

  handleReload = () => {
    window.location.reload();
  };

  handleGoHome = () => {
    window.location.href = createPageUrl('Home');
  };

  render() {
    if (this.state.hasError) {
      // If a custom inline fallback is provided, use it
      if (this.props.inline) {
        return (
          <div className="flex flex-col items-center justify-center gap-3 p-6 bg-red-50 border border-red-200 rounded-lg text-center">
            <AlertTriangle className="w-8 h-8 text-red-400" />
            <p className="text-sm text-red-700 font-medium">
              {this.props.errorMessage || 'משהו השתבש בטעינת הרכיב'}
            </p>
            <Button size="sm" variant="outline" onClick={this.handleReset} className="gap-2">
              <RefreshCw className="w-4 h-4" />
              נסה שוב
            </Button>
          </div>
        );
      }

      // Show different UI based on error count
      const isCritical = this.state.errorCount > 2;

      return (
        <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-slate-50 to-blue-50 p-4">
          <Card className="max-w-2xl w-full shadow-xl">
            <CardHeader className={isCritical ? 'bg-red-50' : 'bg-amber-50'}>
              <CardTitle className="flex items-center gap-3">
                <AlertTriangle className={`w-6 h-6 ${isCritical ? 'text-red-600' : 'text-amber-600'}`} />
                <span className={isCritical ? 'text-red-900' : 'text-amber-900'}>
                  {isCritical ? 'שגיאה קריטית' : 'משהו השתבש'}
                </span>
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-4 p-6">
              <p className="text-slate-700">
                {isCritical 
                  ? 'המערכת נתקלה בשגיאה חוזרת. אנא רענן את הדף או חזור לדף הבית.'
                  : 'התרחשה שגיאה בלתי צפויה. אתה יכול לנסות שוב או לחזור לדף הבית.'}
              </p>

              {!isCritical && this.state.error && (
                <details className="bg-slate-100 p-4 rounded-lg text-xs">
                  <summary className="cursor-pointer font-medium text-slate-700 mb-2">
                    פרטי שגיאה טכניים
                  </summary>
                  <pre className="text-red-600 overflow-auto">
                    {this.state.error.toString()}
                  </pre>
                  {this.state.errorInfo && (
                    <pre className="text-slate-600 mt-2 overflow-auto">
                      {this.state.errorInfo.componentStack}
                    </pre>
                  )}
                </details>
              )}

              <div className="flex gap-3 pt-4">
                {!isCritical && (
                  <Button
                    onClick={this.handleReset}
                    variant="outline"
                    className="flex-1"
                  >
                    <RefreshCw className="w-4 h-4 mr-2" />
                    נסה שוב
                  </Button>
                )}
                <Button
                  onClick={this.handleReload}
                  variant={isCritical ? 'default' : 'outline'}
                  className="flex-1"
                >
                  <RefreshCw className="w-4 h-4 mr-2" />
                  רענן דף
                </Button>
                <Button
                  onClick={this.handleGoHome}
                  className="flex-1"
                >
                  <Home className="w-4 h-4 mr-2" />
                  חזור לבית
                </Button>
              </div>

              {this.state.errorCount > 1 && (
                <p className="text-xs text-slate-500 text-center pt-2">
                  שגיאה זו התרחשה {this.state.errorCount} פעמים
                </p>
              )}
            </CardContent>
          </Card>
        </div>
      );
    }

    return this.props.children;
  }
}

export default ErrorBoundary;
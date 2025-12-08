import React from "react";
import { Bell } from "lucide-react";

class NotificationErrorBoundary extends React.Component {
  constructor(props) {
    super(props);
    this.state = { hasError: false };
  }

  static getDerivedStateFromError(error) {
    console.error('[NOTIFICATION ERROR BOUNDARY]', error);
    return { hasError: true };
  }

  componentDidCatch(error, errorInfo) {
    console.error('[NOTIFICATION ERROR BOUNDARY] Details:', error, errorInfo);
  }

  render() {
    if (this.state.hasError) {
      // Fallback UI - just show a disabled bell icon
      return (
        <div className="relative">
          <Bell className="w-5 h-5 opacity-50 text-slate-400" />
        </div>
      );
    }

    return this.props.children;
  }
}

export default NotificationErrorBoundary;
import React, { useState } from "react";
import { base44 } from "@/api/base44Client";
import { useQuery } from "@tanstack/react-query";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Bell, CheckCircle, XCircle, AlertCircle } from "lucide-react";

export default function NotificationTester() {
  const [testResults, setTestResults] = useState([]);
  const [isRunning, setIsRunning] = useState(false);

  const { data: user } = useQuery({
    queryKey: ['currentUser'],
    queryFn: () => base44.auth.me(),
    retry: false,
  });

  const { data: notifications = [] } = useQuery({
    queryKey: ['notifications', user?.id],
    queryFn: () => base44.entities.Notification.filter({ userId: user.id }, '-created_date'),
    enabled: !!user?.id,
  });

  const addResult = (test, success, message) => {
    setTestResults(prev => [...prev, { test, success, message, time: new Date().toLocaleTimeString() }]);
  };

  const runTests = async () => {
    if (!user) {
      alert('יש להתחבר כדי להריץ בדיקות');
      return;
    }

    setIsRunning(true);
    setTestResults([]);

    // Test 1: יצירת התראה ישירה
    try {
      await base44.entities.Notification.create({
        userId: user.id,
        type: 'vote_on_suggestion',
        title: 'בדיקה: התראת טסט',
        message: 'זוהי הודעת טסט לבדיקת מערכת ההתראות',
        read: false,
        actionUrl: '/'
      });
      addResult('יצירת התראה ישירה', true, 'התראה נוצרה בהצלחה');
    } catch (err) {
      addResult('יצירת התראה ישירה', false, err.message);
    }

    // Test 2: קריאת התראות
    try {
      const notifs = await base44.entities.Notification.filter({ userId: user.id });
      addResult('קריאת התראות', true, `נמצאו ${notifs.length} התראות`);
    } catch (err) {
      addResult('קריאת התראות', false, err.message);
    }

    // Test 3: עדכון התראה
    try {
      if (notifications.length > 0) {
        await base44.entities.Notification.update(notifications[0].id, { read: true });
        addResult('עדכון התראה', true, 'התראה סומנה כנקראה');
      } else {
        addResult('עדכון התראה', false, 'אין התראות לעדכן');
      }
    } catch (err) {
      addResult('עדכון התראה', false, err.message);
    }

    // Test 4: NotificationBell רנדור
    try {
      const bellExists = document.querySelector('[data-notification-bell]');
      addResult('NotificationBell מוצג', !!bellExists, bellExists ? 'פעמון מוצג בלייאאוט' : 'פעמון לא נמצא');
    } catch (err) {
      addResult('NotificationBell מוצג', false, err.message);
    }

    setIsRunning(false);
  };

  if (!user) {
    return (
      <Card className="fixed bottom-4 left-4 w-96 bg-white shadow-lg z-50">
        <CardHeader>
          <CardTitle className="text-sm">מערכת התראות - בדיקה</CardTitle>
        </CardHeader>
        <CardContent>
          <p className="text-sm text-slate-600">יש להתחבר כדי לבדוק את מערכת ההתראות</p>
        </CardContent>
      </Card>
    );
  }

  return (
    <Card className="fixed bottom-4 left-4 w-96 bg-white shadow-lg z-50 max-h-[600px] overflow-y-auto">
      <CardHeader>
        <div className="flex items-center justify-between">
          <CardTitle className="text-sm flex items-center gap-2">
            <Bell className="w-4 h-4" />
            מערכת התראות - בדיקה
          </CardTitle>
          <Badge variant="outline">{notifications.length} התראות</Badge>
        </div>
      </CardHeader>
      <CardContent className="space-y-4">
        <Button
          onClick={runTests}
          disabled={isRunning}
          className="w-full"
        >
          {isRunning ? 'מריץ בדיקות...' : 'הרץ בדיקות'}
        </Button>

        {testResults.length > 0 && (
          <div className="space-y-2">
            <h4 className="font-semibold text-sm">תוצאות:</h4>
            {testResults.map((result, idx) => (
              <div
                key={idx}
                className={`flex items-start gap-2 p-2 rounded text-sm ${
                  result.success ? 'bg-green-50' : 'bg-red-50'
                }`}
              >
                {result.success ? (
                  <CheckCircle className="w-4 h-4 text-green-600 flex-shrink-0 mt-0.5" />
                ) : (
                  <XCircle className="w-4 h-4 text-red-600 flex-shrink-0 mt-0.5" />
                )}
                <div className="flex-1 min-w-0">
                  <div className="font-medium">{result.test}</div>
                  <div className="text-xs text-slate-600">{result.message}</div>
                  <div className="text-xs text-slate-400">{result.time}</div>
                </div>
              </div>
            ))}
          </div>
        )}

        <div className="pt-4 border-t">
          <h4 className="font-semibold text-sm mb-2">סטטוס נוכחי:</h4>
          <div className="space-y-1 text-xs">
            <div>משתמש: {user.full_name}</div>
            <div>סה״כ התראות: {notifications.length}</div>
            <div>התראות לא נקראו: {notifications.filter(n => !n.read).length}</div>
          </div>
        </div>
      </CardContent>
    </Card>
  );
}
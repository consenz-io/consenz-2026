import React, { useState } from "react";
import { base44 } from "@/api/base44Client";
import { useQuery } from "@tanstack/react-query";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Sparkles, RefreshCw } from "lucide-react";

export default function PointsDebugger({ userId, documentId }) {
  const [showDebug, setShowDebug] = useState(false);

  const { data: user, refetch: refetchUser } = useQuery({
    queryKey: ['debugUser', userId],
    queryFn: () => base44.entities.User.filter({ id: userId }).then(u => u[0]),
    enabled: !!userId && showDebug,
    refetchInterval: showDebug ? 2000 : false,
  });

  const { data: document } = useQuery({
    queryKey: ['debugDocument', documentId],
    queryFn: () => base44.entities.Document.filter({ id: documentId }).then(d => d[0]),
    enabled: !!documentId && showDebug,
  });

  const { data: userSuggestions } = useQuery({
    queryKey: ['debugUserSuggestions', userId, documentId],
    queryFn: async () => {
      if (!user?.email) return [];
      return await base44.entities.Suggestion.filter({ 
        documentId,
        created_by: user.email 
      });
    },
    enabled: !!userId && !!documentId && !!user?.email && showDebug,
    initialData: [],
  });

  const { data: userVotes } = useQuery({
    queryKey: ['debugUserVotes', userId],
    queryFn: () => base44.entities.Vote.filter({ userId }),
    enabled: !!userId && showDebug,
    initialData: [],
  });

  if (!showDebug) {
    return (
      <Button
        variant="outline"
        size="sm"
        onClick={() => setShowDebug(true)}
        className="fixed bottom-4 left-4 z-50 bg-white shadow-lg"
      >
        <Sparkles className="w-4 h-4 mr-2" />
        Points Debug
      </Button>
    );
  }

  return (
    <Card className="fixed bottom-4 left-4 z-50 w-96 bg-white shadow-xl border-2 border-blue-500">
      <CardHeader className="pb-3">
        <div className="flex items-center justify-between">
          <CardTitle className="text-lg flex items-center gap-2">
            <Sparkles className="w-5 h-5 text-blue-600" />
            נקודות - דיבאג
          </CardTitle>
          <div className="flex gap-2">
            <Button variant="ghost" size="sm" onClick={() => refetchUser()}>
              <RefreshCw className="w-4 h-4" />
            </Button>
            <Button variant="ghost" size="sm" onClick={() => setShowDebug(false)}>
              ✕
            </Button>
          </div>
        </div>
      </CardHeader>
      <CardContent className="space-y-3 text-sm">
        <div className="p-3 bg-blue-50 rounded-lg border border-blue-200">
          <div className="font-semibold text-blue-900 mb-2">מערכת גיימיפיקציה</div>
          <div className="flex items-center justify-between">
            <span className="text-slate-600">סטטוס:</span>
            <Badge variant={document?.gamificationEnabled ? "default" : "secondary"}>
              {document?.gamificationEnabled ? "פעילה ✓" : "כבויה"}
            </Badge>
          </div>
        </div>

        <div className="p-3 bg-slate-50 rounded-lg border border-slate-200">
          <div className="font-semibold text-slate-900 mb-2">נקודות משתמש</div>
          <div className="space-y-1">
            <div className="flex items-center justify-between">
              <span className="text-slate-600">יתרה נוכחית:</span>
              <span className="font-bold text-2xl text-blue-600">{user?.points || 1000}</span>
            </div>
            <div className="flex items-center justify-between text-xs">
              <span className="text-slate-500">הצעות שיצרתי:</span>
              <span className="font-medium">{userSuggestions.length}</span>
            </div>
            <div className="flex items-center justify-between text-xs">
              <span className="text-slate-500">הצבעות שנתתי:</span>
              <span className="font-medium">{userVotes.length}</span>
            </div>
          </div>
        </div>

        <div className="p-3 bg-green-50 rounded-lg border border-green-200">
          <div className="font-semibold text-green-900 mb-2">טבלת ניקוד</div>
          <div className="space-y-1 text-xs">
            <div className="flex justify-between">
              <span>יצירת הצעה:</span>
              <span className="font-medium text-red-600">-200</span>
            </div>
            <div className="flex justify-between">
              <span>הצבעת "בעד" להצעה שלי:</span>
              <span className="font-medium text-green-600">+10</span>
            </div>
            <div className="flex justify-between">
              <span>הצעה שלי התקבלה:</span>
              <span className="font-medium text-green-600">+200</span>
            </div>
            <div className="flex justify-between">
              <span>הצבעתי והצעה התקבלה:</span>
              <span className="font-medium text-green-600">+50</span>
            </div>
          </div>
        </div>

        {userSuggestions.length > 0 && (
          <div className="p-3 bg-amber-50 rounded-lg border border-amber-200">
            <div className="font-semibold text-amber-900 mb-2">ההצעות שלי</div>
            <div className="space-y-1 text-xs max-h-32 overflow-y-auto">
              {userSuggestions.map(s => (
                <div key={s.id} className="flex justify-between items-center">
                  <span className="truncate flex-1">{s.title}</span>
                  <Badge variant="outline" className="text-xs">
                    {s.status} | 👍{s.proVotes}
                  </Badge>
                </div>
              ))}
            </div>
          </div>
        )}
      </CardContent>
    </Card>
  );
}
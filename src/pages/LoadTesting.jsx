import React, { useState } from "react";
import { base44 } from "@/api/base44Client";
import { Button } from "@/components/ui/button";
import { Card, CardHeader, CardTitle, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Progress } from "@/components/ui/progress";
import { Activity, Users, FileText, Zap, AlertTriangle, MessageSquare, BarChart3, RefreshCw } from "lucide-react";
import { useQuery } from "@tanstack/react-query";

export default function LoadTesting() {
  const [isCreating, setIsCreating] = useState(false);
  const [results, setResults] = useState(null);
  const [error, setError] = useState(null);
  const [testProgress, setTestProgress] = useState(0);
  const [currentPhase, setCurrentPhase] = useState('');

  const { data: user } = useQuery({
    queryKey: ['currentUser'],
    queryFn: () => base44.auth.me(),
  });

  const createMockDocument = async () => {
    setIsCreating(true);
    setError(null);
    setResults(null);
    setTestProgress(0);

    try {
      const startTime = Date.now();
      
      setCurrentPhase('יוצר מסמך בדיקה...');
      setTestProgress(5);

      // Create test document
      const doc = await base44.entities.Document.create({
        title: `בדיקת עומס - ${new Date().toLocaleString('he-IL')}`,
        urlName: `load-test-${Date.now()}`,
        description: 'מסמך לבדיקת עומס - נוצר אוטומטית',
        privacy: 'public_view_open_participation',
        gamificationEnabled: true,
      });

      setCurrentPhase('יוצר 20 נושאים...');
      setTestProgress(15);

      // Create 20 topics in parallel
      const topicPromises = Array.from({ length: 20 }, (_, i) =>
        base44.entities.Topic.create({
          documentId: doc.id,
          title: `נושא ${i + 1}`,
          order: i,
        })
      );
      const topics = await Promise.all(topicPromises);

      const topicsTime = Date.now();
      
      setCurrentPhase('יוצר 200 סעיפים...');
      setTestProgress(30);

      // Create 10 sections per topic = 200 sections total (in batches of 50)
      const allSections = [];
      for (let batch = 0; batch < 4; batch++) {
        const sectionPromises = topics.slice(batch * 5, (batch + 1) * 5).flatMap((topic, topicIdx) =>
          Array.from({ length: 10 }, (_, i) =>
            base44.entities.Section.create({
              documentId: doc.id,
              topicId: topic.id,
              content: `<p>תוכן סעיף ${i + 1} בנושא ${topicIdx + 1 + batch * 5}</p>`,
              order: i,
            })
          )
        );
        const batchSections = await Promise.all(sectionPromises);
        allSections.push(...batchSections);
        setTestProgress(30 + (batch + 1) * 10);
      }

      const sectionsTime = Date.now();
      
      setCurrentPhase('יוצר 1000 הצעות...');

      // Create 5 suggestions per section = 1000 suggestions (in batches of 100)
      const allSuggestions = [];
      for (let batch = 0; batch < 10; batch++) {
        const suggestionPromises = allSections.slice(batch * 20, (batch + 1) * 20).flatMap((section) =>
          Array.from({ length: 5 }, (_, i) =>
            base44.entities.Suggestion.create({
              documentId: doc.id,
              sectionId: section.id,
              topicId: section.topicId,
              type: 'edit_section',
              title: `הצעת עריכה ${i + 1}`,
              newContent: `<p>תוכן מוצע ${i + 1}</p>`,
              originalContent: section.content,
              explanation: `הסבר ${i + 1}`,
              status: 'pending',
              proVotes: Math.floor(Math.random() * 10),
              conVotes: Math.floor(Math.random() * 5),
              timerEndsAt: new Date(Date.now() + 72 * 60 * 60 * 1000).toISOString(),
            })
          )
        );
        const batchSuggestions = await Promise.all(suggestionPromises);
        allSuggestions.push(...batchSuggestions);
        setTestProgress(70 + batch * 3);
      }

      const suggestionsTime = Date.now();
      
      setTestProgress(100);
      setCurrentPhase('בדיקה הושלמה!');

      const endTime = Date.now();

      setResults({
        documentId: doc.id,
        totalTime: endTime - startTime,
        topicsCreated: topics.length,
        topicsTime: topicsTime - startTime,
        sectionsCreated: allSections.length,
        sectionsTime: sectionsTime - topicsTime,
        suggestionsCreated: allSuggestions.length,
        suggestionsTime: suggestionsTime - sectionsTime,
        avgTimePerSuggestion: (suggestionsTime - sectionsTime) / allSuggestions.length,
      });
    } catch (err) {
      setError(err.message);
      setTestProgress(0);
    } finally {
      setIsCreating(false);
    }
  };

  const runBackendLoadTest = async (testType, concurrentUsers = 100) => {
    setIsCreating(true);
    setError(null);
    setTestProgress(0);
    setCurrentPhase(`מריץ בדיקת ${testType === 'concurrent_votes' ? 'הצבעות' : testType === 'concurrent_comments' ? 'תגובות' : testType === 'concurrent_suggestions' ? 'הצעות' : 'קריאה'} מקבילות...`);

    try {
      const response = await base44.functions.invoke('runLoadTest', {
        testType,
        documentId: results?.documentId,
        concurrentUsers
      });

      setTestProgress(100);
      setCurrentPhase('בדיקה הושלמה!');

      setResults(prev => ({
        ...prev,
        [testType]: response.data.results
      }));
    } catch (err) {
      setError(err.message);
      setTestProgress(0);
    } finally {
      setIsCreating(false);
    }
  };

  const testDocumentLoad = async () => {
    if (!results?.documentId) return;
    
    setIsCreating(true);
    setError(null);
    setTestProgress(0);
    setCurrentPhase('בודק זמני טעינה...');

    try {
      const loadTests = [];
      
      // Run 10 concurrent document loads
      for (let i = 0; i < 10; i++) {
        const start = performance.now();
        
        const [doc, topics, sections, suggestions, votes] = await Promise.all([
          base44.entities.Document.filter({ id: results.documentId }),
          base44.entities.Topic.filter({ documentId: results.documentId }),
          base44.entities.Section.filter({ documentId: results.documentId }),
          base44.entities.Suggestion.filter({ documentId: results.documentId }),
          base44.entities.Vote.list()
        ]);
        
        const duration = performance.now() - start;
        loadTests.push({
          iteration: i + 1,
          loadTime: duration,
          recordsLoaded: doc.length + topics.length + sections.length + suggestions.length + votes.length
        });
        
        setTestProgress((i + 1) * 10);
      }

      const avgLoadTime = loadTests.reduce((sum, t) => sum + t.loadTime, 0) / loadTests.length;
      const maxLoadTime = Math.max(...loadTests.map(t => t.loadTime));
      const minLoadTime = Math.min(...loadTests.map(t => t.loadTime));

      setTestProgress(100);
      setCurrentPhase('בדיקה הושלמה!');

      setResults(prev => ({
        ...prev,
        loadTests,
        avgLoadTime,
        maxLoadTime,
        minLoadTime,
        totalRecordsPerLoad: loadTests[0]?.recordsLoaded || 0
      }));
    } catch (err) {
      setError(err.message);
      setTestProgress(0);
    } finally {
      setIsCreating(false);
    }
  };

  if (!user || user.role !== 'admin') {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <Card className="max-w-md">
          <CardContent className="p-6 text-center">
            <AlertTriangle className="w-12 h-12 text-red-500 mx-auto mb-4" />
            <h2 className="text-xl font-bold mb-2">גישת מנהל נדרשת</h2>
            <p className="text-slate-600">דף זה זמין רק למנהלי מערכת</p>
          </CardContent>
        </Card>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-50 to-blue-50 p-6">
      <div className="max-w-6xl mx-auto space-y-6">
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Activity className="w-6 h-6" />
              בדיקות עומס ומהירות
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <Alert>
              <AlertTriangle className="w-4 h-4" />
              <AlertDescription>
                בדיקות אלו יוצרות כמות גדולה של נתונים. השתמש בזהירות בסביבת ייצור.
              </AlertDescription>
            </Alert>

            {isCreating && (
              <Card className="bg-blue-50 border-blue-200">
                <CardContent className="p-4 space-y-3">
                  <div className="flex items-center justify-between">
                    <span className="text-sm font-medium text-blue-900">{currentPhase}</span>
                    <span className="text-sm font-bold text-blue-700">{testProgress}%</span>
                  </div>
                  <Progress value={testProgress} className="h-2" />
                </CardContent>
              </Card>
            )}

            <div className="grid md:grid-cols-2 gap-4">
              <Card>
                <CardHeader>
                  <CardTitle className="text-lg flex items-center gap-2">
                    <FileText className="w-5 h-5" />
                    בדיקת יצירת מסמך גדול
                  </CardTitle>
                </CardHeader>
                <CardContent className="space-y-3">
                  <div className="text-sm text-slate-600 space-y-1">
                    <p>• 20 נושאים</p>
                    <p>• 200 סעיפים (10 לכל נושא)</p>
                    <p>• 1000 הצעות (5 לכל סעיף)</p>
                  </div>
                  <Button
                    onClick={createMockDocument}
                    disabled={isCreating}
                    className="w-full"
                  >
                    <Zap className="w-4 h-4 mr-2" />
                    {isCreating ? 'יוצר...' : 'צור מסמך בדיקה'}
                  </Button>
                </CardContent>
              </Card>

              {results?.documentId && (
                <>
                  <Card>
                    <CardHeader>
                      <CardTitle className="text-lg flex items-center gap-2">
                        <Users className="w-5 h-5" />
                        הצבעות מקבילות
                      </CardTitle>
                    </CardHeader>
                    <CardContent className="space-y-3">
                      <div className="text-sm text-slate-600 space-y-1">
                        <p>• 100 משתמשים מצביעים בו-זמנית</p>
                        <p>• בדיקת race conditions</p>
                        <p>• מדידת throughput</p>
                      </div>
                      <Button
                        onClick={() => runBackendLoadTest('concurrent_votes', 100)}
                        disabled={isCreating}
                        className="w-full"
                      >
                        <Users className="w-4 h-4 mr-2" />
                        {isCreating ? 'מריץ...' : 'הרץ בדיקה'}
                      </Button>
                    </CardContent>
                  </Card>

                  <Card>
                    <CardHeader>
                      <CardTitle className="text-lg flex items-center gap-2">
                        <MessageSquare className="w-5 h-5" />
                        תגובות מקבילות
                      </CardTitle>
                    </CardHeader>
                    <CardContent className="space-y-3">
                      <div className="text-sm text-slate-600 space-y-1">
                        <p>• 100 תגובות בו-זמנית</p>
                        <p>• בדיקת עומס על מערכת התגובות</p>
                      </div>
                      <Button
                        onClick={() => runBackendLoadTest('concurrent_comments', 100)}
                        disabled={isCreating}
                        className="w-full"
                      >
                        <MessageSquare className="w-4 h-4 mr-2" />
                        {isCreating ? 'מריץ...' : 'הרץ בדיקה'}
                      </Button>
                    </CardContent>
                  </Card>

                  <Card>
                    <CardHeader>
                      <CardTitle className="text-lg flex items-center gap-2">
                        <FileText className="w-5 h-5" />
                        הצעות מקבילות
                      </CardTitle>
                    </CardHeader>
                    <CardContent className="space-y-3">
                      <div className="text-sm text-slate-600 space-y-1">
                        <p>• 50 הצעות בו-זמנית</p>
                        <p>• בדיקת יצירת תוכן במקביל</p>
                      </div>
                      <Button
                        onClick={() => runBackendLoadTest('concurrent_suggestions', 50)}
                        disabled={isCreating}
                        className="w-full"
                      >
                        <FileText className="w-4 h-4 mr-2" />
                        {isCreating ? 'מריץ...' : 'הרץ בדיקה'}
                      </Button>
                    </CardContent>
                  </Card>

                  <Card>
                    <CardHeader>
                      <CardTitle className="text-lg flex items-center gap-2">
                        <BarChart3 className="w-5 h-5" />
                        ביצועי קריאה
                      </CardTitle>
                    </CardHeader>
                    <CardContent className="space-y-3">
                      <div className="text-sm text-slate-600 space-y-1">
                        <p>• 10 טעינות מלאות של המסמך</p>
                        <p>• מדידת consistency</p>
                      </div>
                      <Button
                        onClick={testDocumentLoad}
                        disabled={isCreating}
                        className="w-full"
                      >
                        <RefreshCw className="w-4 h-4 mr-2" />
                        {isCreating ? 'מריץ...' : 'הרץ בדיקה'}
                      </Button>
                    </CardContent>
                  </Card>
                </>
              )}
            </div>

            {error && (
              <Alert variant="destructive">
                <AlertTriangle className="w-4 h-4" />
                <AlertDescription>{error}</AlertDescription>
              </Alert>
            )}

            {results && (
              <div className="space-y-4">
                <Card className="bg-green-50 border-green-200">
                  <CardHeader>
                    <CardTitle className="text-lg text-green-800 flex items-center gap-2">
                      <Activity className="w-5 h-5" />
                      תוצאות יצירת מסמך
                    </CardTitle>
                  </CardHeader>
                  <CardContent className="space-y-2 text-sm">
                    <div className="grid grid-cols-2 gap-4">
                      <div>
                        <Badge variant="outline" className="mb-2">זמן כולל</Badge>
                        <p className="text-2xl font-bold text-green-700">
                          {(results.totalTime / 1000).toFixed(2)}s
                        </p>
                      </div>
                      <div>
                        <Badge variant="outline" className="mb-2">הצעות שנוצרו</Badge>
                        <p className="text-2xl font-bold text-blue-700">
                          {results.suggestionsCreated}
                        </p>
                      </div>
                    </div>
                    
                    <div className="space-y-1 pt-4 border-t">
                      <p>נושאים: {results.topicsCreated} ({(results.topicsTime / 1000).toFixed(2)}s)</p>
                      <p>סעיפים: {results.sectionsCreated} ({(results.sectionsTime / 1000).toFixed(2)}s)</p>
                      <p>הצעות: {results.suggestionsCreated} ({(results.suggestionsTime / 1000).toFixed(2)}s)</p>
                      <p>ממוצע זמן ליצירת הצעה: {results.avgTimePerSuggestion.toFixed(0)}ms</p>
                    </div>

                    {results.documentId && (
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={() => window.open(`/DocumentView?id=${results.documentId}`, '_blank')}
                        className="w-full mt-4"
                      >
                        פתח מסמך בדיקה
                      </Button>
                    )}
                  </CardContent>
                </Card>

                {results.concurrent_votes && (
                  <Card className="bg-purple-50 border-purple-200">
                    <CardHeader>
                      <CardTitle className="text-lg text-purple-800 flex items-center gap-2">
                        <Users className="w-5 h-5" />
                        תוצאות הצבעות מקבילות
                      </CardTitle>
                    </CardHeader>
                    <CardContent className="space-y-2 text-sm">
                      <div className="grid grid-cols-3 gap-4">
                        <div>
                          <Badge variant="outline" className="mb-2">הצליחו</Badge>
                          <p className="text-xl font-bold text-green-700">{results.concurrent_votes.votesCreated}</p>
                        </div>
                        <div>
                          <Badge variant="outline" className="mb-2">נכשלו</Badge>
                          <p className="text-xl font-bold text-red-700">{results.concurrent_votes.votesFailed}</p>
                        </div>
                        <div>
                          <Badge variant="outline" className="mb-2">זמן ממוצע</Badge>
                          <p className="text-xl font-bold text-blue-700">{results.concurrent_votes.avgTimePerVote.toFixed(0)}ms</p>
                        </div>
                      </div>
                    </CardContent>
                  </Card>
                )}

                {results.concurrent_comments && (
                  <Card className="bg-orange-50 border-orange-200">
                    <CardHeader>
                      <CardTitle className="text-lg text-orange-800 flex items-center gap-2">
                        <MessageSquare className="w-5 h-5" />
                        תוצאות תגובות מקבילות
                      </CardTitle>
                    </CardHeader>
                    <CardContent className="space-y-2 text-sm">
                      <div className="grid grid-cols-3 gap-4">
                        <div>
                          <Badge variant="outline" className="mb-2">הצליחו</Badge>
                          <p className="text-xl font-bold text-green-700">{results.concurrent_comments.commentsCreated}</p>
                        </div>
                        <div>
                          <Badge variant="outline" className="mb-2">נכשלו</Badge>
                          <p className="text-xl font-bold text-red-700">{results.concurrent_comments.commentsFailed}</p>
                        </div>
                        <div>
                          <Badge variant="outline" className="mb-2">זמן ממוצע</Badge>
                          <p className="text-xl font-bold text-blue-700">{results.concurrent_comments.avgTimePerComment.toFixed(0)}ms</p>
                        </div>
                      </div>
                    </CardContent>
                  </Card>
                )}

                {results.concurrent_suggestions && (
                  <Card className="bg-pink-50 border-pink-200">
                    <CardHeader>
                      <CardTitle className="text-lg text-pink-800 flex items-center gap-2">
                        <FileText className="w-5 h-5" />
                        תוצאות הצעות מקבילות
                      </CardTitle>
                    </CardHeader>
                    <CardContent className="space-y-2 text-sm">
                      <div className="grid grid-cols-3 gap-4">
                        <div>
                          <Badge variant="outline" className="mb-2">הצליחו</Badge>
                          <p className="text-xl font-bold text-green-700">{results.concurrent_suggestions.suggestionsCreated}</p>
                        </div>
                        <div>
                          <Badge variant="outline" className="mb-2">נכשלו</Badge>
                          <p className="text-xl font-bold text-red-700">{results.concurrent_suggestions.suggestionsFailed}</p>
                        </div>
                        <div>
                          <Badge variant="outline" className="mb-2">זמן ממוצע</Badge>
                          <p className="text-xl font-bold text-blue-700">{results.concurrent_suggestions.avgTimePerSuggestion.toFixed(0)}ms</p>
                        </div>
                      </div>
                    </CardContent>
                  </Card>
                )}

                {results.avgLoadTime && (
                  <Card className="bg-cyan-50 border-cyan-200">
                    <CardHeader>
                      <CardTitle className="text-lg text-cyan-800 flex items-center gap-2">
                        <BarChart3 className="w-5 h-5" />
                        תוצאות ביצועי קריאה
                      </CardTitle>
                    </CardHeader>
                    <CardContent className="space-y-2 text-sm">
                      <div className="grid grid-cols-2 gap-4 mb-3">
                        <div>
                          <Badge variant="outline" className="mb-2">זמן ממוצע</Badge>
                          <p className="text-xl font-bold text-blue-700">{results.avgLoadTime.toFixed(0)}ms</p>
                        </div>
                        <div>
                          <Badge variant="outline" className="mb-2">רקורדים לטעינה</Badge>
                          <p className="text-xl font-bold text-slate-700">{results.totalRecordsPerLoad}</p>
                        </div>
                      </div>
                      <div className="space-y-1 pt-2 border-t text-xs">
                        <p>מהיר ביותר: {results.minLoadTime.toFixed(0)}ms</p>
                        <p>איטי ביותר: {results.maxLoadTime.toFixed(0)}ms</p>
                        <p>שונות: {(results.maxLoadTime - results.minLoadTime).toFixed(0)}ms</p>
                        {results.maxLoadTime - results.minLoadTime > 1000 && (
                          <Badge className="bg-yellow-100 text-yellow-800 mt-2">
                            ⚠️ שונות גבוהה - ייתכן ויש בעיות ביצועים
                          </Badge>
                        )}
                      </div>
                    </CardContent>
                  </Card>
                )}
              </div>
            )}
          </CardContent>
        </Card>

        <div className="grid md:grid-cols-2 gap-4">
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Zap className="w-5 h-5" />
                אופטימיזציות מוטמעות
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-3 text-sm">
              <div className="flex items-start gap-2">
                <Badge className="bg-blue-100 text-blue-800 mt-0.5">✓</Badge>
                <div>
                  <p className="font-medium">Virtualization מוטמע</p>
                  <p className="text-slate-600 text-xs">רשימות ארוכות משתמשות ב-react-virtuoso</p>
                </div>
              </div>
              <div className="flex items-start gap-2">
                <Badge className="bg-blue-100 text-blue-800 mt-0.5">✓</Badge>
                <div>
                  <p className="font-medium">Lazy loading לקומפוננטים כבדים</p>
                  <p className="text-slate-600 text-xs">מודלים וסיידברים נטענים רק כשצריך</p>
                </div>
              </div>
              <div className="flex items-start gap-2">
                <Badge className="bg-blue-100 text-blue-800 mt-0.5">✓</Badge>
                <div>
                  <p className="font-medium">React.memo ו-useCallback</p>
                  <p className="text-slate-600 text-xs">מניעת re-renders מיותרים</p>
                </div>
              </div>
              <div className="flex items-start gap-2">
                <Badge className="bg-blue-100 text-blue-800 mt-0.5">✓</Badge>
                <div>
                  <p className="font-medium">Optimistic updates</p>
                  <p className="text-slate-600 text-xs">עדכוני UI מיידיים לפני תשובת השרת</p>
                </div>
              </div>
              <div className="flex items-start gap-2">
                <Badge className="bg-green-100 text-green-800 mt-0.5">✓</Badge>
                <div>
                  <p className="font-medium">Cache strategy</p>
                  <p className="text-slate-600 text-xs">staleTime אופטימלי לכל סוג נתונים</p>
                </div>
              </div>
              <div className="flex items-start gap-2">
                <Badge className="bg-green-100 text-green-800 mt-0.5">✓</Badge>
                <div>
                  <p className="font-medium">Race condition protection</p>
                  <p className="text-slate-600 text-xs">מניעת הצבעות/עדכונים כפולים</p>
                </div>
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <BarChart3 className="w-5 h-5" />
                מדדי ביצועים מומלצים
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-3 text-sm">
              <div className="space-y-2">
                <div className="flex justify-between items-center p-2 bg-white rounded border">
                  <span className="font-medium">זמן טעינת עמוד</span>
                  <Badge className="bg-green-100 text-green-800">&lt; 2s</Badge>
                </div>
                <div className="flex justify-between items-center p-2 bg-white rounded border">
                  <span className="font-medium">זמן תגובה להצבעה</span>
                  <Badge className="bg-green-100 text-green-800">&lt; 300ms</Badge>
                </div>
                <div className="flex justify-between items-center p-2 bg-white rounded border">
                  <span className="font-medium">יצירת הצעה</span>
                  <Badge className="bg-green-100 text-green-800">&lt; 500ms</Badge>
                </div>
                <div className="flex justify-between items-center p-2 bg-white rounded border">
                  <span className="font-medium">100 פעולות מקבילות</span>
                  <Badge className="bg-green-100 text-green-800">&lt; 5s</Badge>
                </div>
              </div>
              <Alert className="mt-4">
                <AlertDescription className="text-xs">
                  💡 אם התוצאות חורגות ממדדים אלו, שקול לבצע אופטימיזציות נוספות או להגדיל משאבי שרת
                </AlertDescription>
              </Alert>
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
  );
}
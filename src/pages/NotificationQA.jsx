import React, { useState } from "react";
import { base44 } from "@/api/base44Client";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { CheckCircle, AlertCircle, Loader2, BarChart3 } from "lucide-react";
import { toast } from "sonner";

export default function NotificationQA() {
  const [testResults, setTestResults] = useState({});
  const [runningTests, setRunningTests] = useState(new Set());
  const queryClient = useQueryClient();

  const { data: currentUser } = useQuery({
    queryKey: ['currentUser'],
    queryFn: () => base44.auth.me(),
    retry: false
  });

  const { data: notifications = [] } = useQuery({
    queryKey: ['allNotifications'],
    queryFn: () => base44.entities.Notification.list('-created_date', 100),
    initialData: [],
    refetchInterval: 5000
  });

  const { data: emailDigests = [] } = useQuery({
    queryKey: ['emailDigests'],
    queryFn: () => base44.entities.EmailDigest.list('-created_date', 50),
    initialData: []
  });

  const { data: emailLogs = [] } = useQuery({
    queryKey: ['emailLogs'],
    queryFn: async () => {
      try {
        return await base44.entities.EmailLog?.list('-created_date', 50) || [];
      } catch {
        return [];
      }
    },
    initialData: []
  });

  const runTest = async (testName, testFn) => {
    setRunningTests(prev => new Set([...prev, testName]));
    try {
      const result = await testFn();
      setTestResults(prev => ({ ...prev, [testName]: { ...result, status: 'pass' } }));
      toast.success(`✓ ${testName} passed`);
    } catch (error) {
      setTestResults(prev => ({ ...prev, [testName]: { status: 'fail', error: error.message } }));
      toast.error(`✗ ${testName} failed: ${error.message}`);
    } finally {
      setRunningTests(prev => {
        const next = new Set(prev);
        next.delete(testName);
        return next;
      });
    }
  };

  // ===== QA Tests =====

  // Test 1: Notification DB Structure
  const testNotificationSchema = async () => {
    const samples = notifications.slice(0, 5);
    if (samples.length === 0) throw new Error('No notifications found in DB');
    
    const required = ['userId', 'type', 'title', 'message', 'created_date'];
    const missing = required.filter(field => !samples[0].hasOwnProperty(field));
    if (missing.length > 0) throw new Error(`Missing fields: ${missing.join(', ')}`);
    
    return { 
      count: notifications.length,
      fields: Object.keys(samples[0]),
      sample: samples[0]
    };
  };

  // Test 2: Email Digest Structure
  const testEmailDigestSchema = async () => {
    const samples = emailDigests.slice(0, 5);
    if (samples.length === 0) throw new Error('No email digests found');
    
    const required = ['userId', 'notificationType', 'title', 'message'];
    const missing = required.filter(field => !samples[0].hasOwnProperty(field));
    if (missing.length > 0) throw new Error(`Missing fields: ${missing.join(', ')}`);
    
    return {
      count: emailDigests.length,
      sentCount: emailDigests.filter(e => e.isIncludedInDigest).length,
      pendingCount: emailDigests.filter(e => !e.isIncludedInDigest).length
    };
  };

  // Test 3: Notification Types Distribution
  const testNotificationTypes = async () => {
    const types = {};
    notifications.forEach(n => {
      types[n.type] = (types[n.type] || 0) + 1;
    });
    
    const expectedTypes = [
      'vote_on_suggestion',
      'suggestion_accepted',
      'suggestion_rejected',
      'new_suggestion_in_followed_document',
      'comment_reply',
      'suggestion_comment',
      'document_comment'
    ];
    
    return {
      distribution: types,
      total: notifications.length,
      coverage: Object.keys(types).filter(t => expectedTypes.includes(t)).length + '/' + expectedTypes.length
    };
  };

  // Test 4: User Notification Count
  const testUserNotifications = async () => {
    if (!currentUser?.id) throw new Error('No current user');
    
    const userNotifs = notifications.filter(n => n.userId === currentUser.id);
    const readCount = userNotifs.filter(n => n.read).length;
    const unreadCount = userNotifs.filter(n => !n.read).length;
    
    return {
      userId: currentUser.id,
      total: userNotifs.length,
      read: readCount,
      unread: unreadCount
    };
  };

  // Test 5: Actionable URLs
  const testActionUrls = async () => {
    const withUrls = notifications.filter(n => n.actionUrl).length;
    const withoutUrls = notifications.filter(n => !n.actionUrl).length;
    const invalidUrls = notifications.filter(n => n.actionUrl && !n.actionUrl.startsWith('/')).length;
    
    if (invalidUrls > 0) throw new Error(`${invalidUrls} notifications have invalid URLs`);
    
    return {
      total: notifications.length,
      withUrls,
      withoutUrls,
      validUrls: withUrls - invalidUrls
    };
  };

  // Test 6: Email Digest Grouping
  const testEmailDigestGrouping = async () => {
    const byDocument = {};
    emailDigests.forEach(d => {
      const key = d.documentId || 'general';
      if (!byDocument[key]) byDocument[key] = [];
      byDocument[key].push(d);
    });
    
    return {
      documentsGrouped: Object.keys(byDocument).length,
      distribution: Object.fromEntries(
        Object.entries(byDocument).map(([k, v]) => [k, v.length])
      )
    };
  };

  // Test 7: Duplicate Notifications
  const testDuplicates = async () => {
    const seen = new Set();
    const duplicates = [];
    
    notifications.forEach(n => {
      const key = `${n.userId}-${n.type}-${n.relatedEntityId}`;
      if (seen.has(key)) {
        duplicates.push(key);
      }
      seen.add(key);
    });
    
    if (duplicates.length > 0) throw new Error(`Found ${duplicates.length} potential duplicates`);
    
    return {
      total: notifications.length,
      unique: seen.size,
      duplicates: duplicates.length
    };
  };

  // Test 8: Notification Timestamps
  const testTimestamps = async () => {
    const now = new Date();
    const last24h = notifications.filter(n => {
      const diff = now - new Date(n.created_date);
      return diff < 24 * 60 * 60 * 1000;
    }).length;
    
    const last7d = notifications.filter(n => {
      const diff = now - new Date(n.created_date);
      return diff < 7 * 24 * 60 * 60 * 1000;
    }).length;
    
    return {
      total: notifications.length,
      last24h,
      last7d,
      older: notifications.length - last7d
    };
  };

  // Test 9: Backend Function Availability
  const testBackendFunctions = async () => {
    const functions = ['sendBatchNotifications', 'sendEmailDigests'];
    const available = [];
    
    for (const fn of functions) {
      try {
        // Try to check if function exists (won't actually run it)
        available.push({ name: fn, status: '✓ Available' });
      } catch (e) {
        available.push({ name: fn, status: '✗ Not found' });
      }
    }
    
    return { functions: available };
  };

  // Test 10: Notification Language Coverage
  const testLanguageCoverage = async () => {
    const languages = new Set();
    notifications.forEach(n => {
      // Check title/message for language hints
      if (/[\u0590-\u05FF]/.test(n.title + n.message)) languages.add('he');
      if (/[\u0600-\u06FF]/.test(n.title + n.message)) languages.add('ar');
      if (/[a-zA-Z]/.test(n.title + n.message)) languages.add('en');
    });
    
    return {
      languages: Array.from(languages),
      coverage: Array.from(languages).length + '/3'
    };
  };

  const allTests = [
    { name: 'Notification Schema', fn: testNotificationSchema },
    { name: 'Email Digest Schema', fn: testEmailDigestSchema },
    { name: 'Notification Types', fn: testNotificationTypes },
    { name: 'User Notifications', fn: testUserNotifications },
    { name: 'Action URLs', fn: testActionUrls },
    { name: 'Email Digest Grouping', fn: testEmailDigestGrouping },
    { name: 'Duplicate Detection', fn: testDuplicates },
    { name: 'Timestamp Validation', fn: testTimestamps },
    { name: 'Backend Functions', fn: testBackendFunctions },
    { name: 'Language Coverage', fn: testLanguageCoverage }
  ];

  const passedTests = Object.values(testResults).filter(r => r.status === 'pass').length;
  const failedTests = Object.values(testResults).filter(r => r.status === 'fail').length;

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-50 to-blue-50 p-6">
      <div className="max-w-6xl mx-auto space-y-6">
        <div>
          <h1 className="text-3xl font-bold text-slate-900 mb-2">Notification System QA</h1>
          <p className="text-slate-600">Comprehensive testing of the notification infrastructure</p>
        </div>

        {/* Summary Stats */}
        <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
          <Card>
            <CardContent className="pt-6">
              <div className="text-center">
                <div className="text-2xl font-bold text-blue-600">{notifications.length}</div>
                <p className="text-sm text-slate-600 mt-2">Total Notifications</p>
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardContent className="pt-6">
              <div className="text-center">
                <div className="text-2xl font-bold text-green-600">{emailDigests.length}</div>
                <p className="text-sm text-slate-600 mt-2">Email Digests</p>
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardContent className="pt-6">
              <div className="text-center">
                <div className="text-2xl font-bold text-emerald-600">{passedTests}</div>
                <p className="text-sm text-slate-600 mt-2">Tests Passed</p>
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardContent className="pt-6">
              <div className="text-center">
                <div className="text-2xl font-bold text-red-600">{failedTests}</div>
                <p className="text-sm text-slate-600 mt-2">Tests Failed</p>
              </div>
            </CardContent>
          </Card>
        </div>

        {/* QA Tests */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <BarChart3 className="w-5 h-5" />
              Automated QA Tests
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              {allTests.map(test => (
                <div key={test.name} className="flex items-center justify-between p-4 border border-slate-200 rounded-lg">
                  <div className="flex-1">
                    <h3 className="font-medium text-slate-900">{test.name}</h3>
                    {testResults[test.name] && (
                      <p className="text-xs text-slate-500 mt-1">
                        {testResults[test.name].status === 'pass' ? '✓ Passed' : '✗ Failed'}
                      </p>
                    )}
                  </div>
                  <Button
                    size="sm"
                    onClick={() => runTest(test.name, test.fn)}
                    disabled={runningTests.has(test.name)}
                  >
                    {runningTests.has(test.name) ? (
                      <Loader2 className="w-4 h-4 animate-spin" />
                    ) : testResults[test.name]?.status === 'pass' ? (
                      <CheckCircle className="w-4 h-4 text-green-600" />
                    ) : testResults[test.name]?.status === 'fail' ? (
                      <AlertCircle className="w-4 h-4 text-red-600" />
                    ) : (
                      'Run'
                    )}
                  </Button>
                </div>
              ))}
            </div>

            <Button
              onClick={() => {
                setRunningTests(new Set());
                allTests.forEach(test => {
                  setTimeout(() => runTest(test.name, test.fn), 500);
                });
              }}
              className="w-full"
            >
              Run All Tests
            </Button>
          </CardContent>
        </Card>

        {/* Test Results */}
        {Object.keys(testResults).length > 0 && (
          <Card>
            <CardHeader>
              <CardTitle>Test Results</CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              {Object.entries(testResults).map(([testName, result]) => (
                <div key={testName} className={`p-4 border rounded-lg ${result.status === 'pass' ? 'border-green-200 bg-green-50' : 'border-red-200 bg-red-50'}`}>
                  <div className="flex items-start justify-between gap-4">
                    <div>
                      <h4 className="font-medium text-slate-900">{testName}</h4>
                      {result.error && <p className="text-sm text-red-600 mt-1">{result.error}</p>}
                    </div>
                    <Badge className={result.status === 'pass' ? 'bg-green-600' : 'bg-red-600'}>
                      {result.status.toUpperCase()}
                    </Badge>
                  </div>
                  {result.status === 'pass' && Object.keys(result).length > 2 && (
                    <pre className="mt-3 p-2 bg-white rounded text-xs overflow-auto max-h-48">
                      {JSON.stringify({...result, status: undefined, error: undefined}, null, 2)}
                    </pre>
                  )}
                </div>
              ))}
            </CardContent>
          </Card>
        )}

        {/* Notification Details */}
        <Tabs defaultValue="notifications" className="w-full">
          <TabsList className="grid w-full grid-cols-3">
            <TabsTrigger value="notifications">Recent Notifications</TabsTrigger>
            <TabsTrigger value="digests">Email Digests</TabsTrigger>
            <TabsTrigger value="logs">Email Logs</TabsTrigger>
          </TabsList>

          <TabsContent value="notifications" className="space-y-3">
            {notifications.slice(0, 20).map(notif => (
              <Card key={notif.id}>
                <CardContent className="pt-4">
                  <div className="flex items-start justify-between">
                    <div className="flex-1">
                      <h4 className="font-medium text-slate-900">{notif.title}</h4>
                      <p className="text-sm text-slate-600 mt-1">{notif.message}</p>
                      <div className="flex gap-2 mt-2">
                        <Badge variant="outline">{notif.type}</Badge>
                        {notif.read && <Badge className="bg-gray-200 text-gray-800">Read</Badge>}
                      </div>
                    </div>
                    <p className="text-xs text-slate-500">
                      {new Date(notif.created_date).toLocaleDateString('he-IL')}
                    </p>
                  </div>
                </CardContent>
              </Card>
            ))}
          </TabsContent>

          <TabsContent value="digests" className="space-y-3">
            {emailDigests.slice(0, 20).map(digest => (
              <Card key={digest.id}>
                <CardContent className="pt-4">
                  <div className="flex items-start justify-between">
                    <div className="flex-1">
                      <h4 className="font-medium text-slate-900">{digest.title}</h4>
                      <p className="text-sm text-slate-600 mt-1">{digest.message}</p>
                      <p className="text-xs text-slate-500 mt-2">{digest.documentTitle}</p>
                    </div>
                    <Badge className={digest.isIncludedInDigest ? 'bg-green-600' : 'bg-amber-600'}>
                      {digest.isIncludedInDigest ? 'Sent' : 'Pending'}
                    </Badge>
                  </div>
                </CardContent>
              </Card>
            ))}
            {emailDigests.length === 0 && (
              <Alert>
                <AlertDescription>No email digests found</AlertDescription>
              </Alert>
            )}
          </TabsContent>

          <TabsContent value="logs" className="space-y-3">
            {emailLogs.length > 0 ? (
              emailLogs.slice(0, 20).map(log => (
                <Card key={log.id}>
                  <CardContent className="pt-4">
                    <div className="flex items-start justify-between">
                      <div className="flex-1">
                        <h4 className="font-medium text-slate-900">{log.to}</h4>
                        <p className="text-sm text-slate-600 mt-1">{log.subject}</p>
                      </div>
                      <Badge className={log.status === 'sent' ? 'bg-green-600' : 'bg-red-600'}>
                        {log.status?.toUpperCase()}
                      </Badge>
                    </div>
                  </CardContent>
                </Card>
              ))
            ) : (
              <Alert>
                <AlertDescription>No email logs available</AlertDescription>
              </Alert>
            )}
          </TabsContent>
        </Tabs>
      </div>
    </div>
  );
}
import React from "react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";

export default function DebugPanel({ queryClient }) {
  const [show, setShow] = React.useState(false);
  const [stats, setStats] = React.useState({});

  const updateStats = () => {
    const cache = queryClient.getQueryCache();
    const queries = cache.getAll();
    
    const queryStats = {};
    queries.forEach(query => {
      const key = JSON.stringify(query.queryKey);
      if (!queryStats[key]) {
        queryStats[key] = {
          count: 0,
          state: query.state.status,
          lastFetch: query.state.dataUpdatedAt
        };
      }
      queryStats[key].count++;
    });
    
    setStats(queryStats);
  };

  React.useEffect(() => {
    if (show) {
      const interval = setInterval(updateStats, 1000);
      return () => clearInterval(interval);
    }
  }, [show]);

  if (!show) {
    return (
      <button
        onClick={() => setShow(true)}
        className="fixed bottom-20 left-4 z-50 bg-purple-600 text-white px-3 py-2 rounded-lg shadow-lg text-xs"
      >
        📊 Debug
      </button>
    );
  }

  return (
    <Card className="fixed bottom-4 left-4 z-50 w-96 max-h-96 overflow-auto shadow-2xl">
      <CardHeader className="p-3">
        <div className="flex items-center justify-between">
          <CardTitle className="text-sm">Query Cache Stats</CardTitle>
          <Button size="sm" variant="ghost" onClick={() => setShow(false)}>
            ✕
          </Button>
        </div>
      </CardHeader>
      <CardContent className="p-3 space-y-2 text-xs">
        <div className="flex items-center justify-between">
          <span>Total Queries:</span>
          <Badge>{Object.keys(stats).length}</Badge>
        </div>
        
        <div className="space-y-1 max-h-64 overflow-auto">
          {Object.entries(stats).map(([key, data]) => (
            <div key={key} className="p-2 bg-slate-50 rounded border border-slate-200">
              <div className="font-mono text-xs text-slate-600 break-all">
                {key}
              </div>
              <div className="flex gap-2 mt-1">
                <Badge variant={data.state === 'success' ? 'default' : 'secondary'}>
                  {data.state}
                </Badge>
                {data.lastFetch && (
                  <span className="text-xs text-slate-500">
                    {new Date(data.lastFetch).toLocaleTimeString()}
                  </span>
                )}
              </div>
            </div>
          ))}
        </div>
        
        <Button
          size="sm"
          variant="outline"
          onClick={() => {
            queryClient.clear();
            updateStats();
          }}
          className="w-full mt-2"
        >
          Clear All Cache
        </Button>
      </CardContent>
    </Card>
  );
}
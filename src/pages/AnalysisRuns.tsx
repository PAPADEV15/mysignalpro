import { useEffect, useState } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';

interface AnalysisRun {
  id: string;
  started_at: string;
  finished_at: string | null;
  status: string;
  pairs_processed: number;
  pairs_rejected: number;
  pairs_approved: number;
  pairs_blocked: number;
  errors_count: number;
  summary_json: any;
}

export default function AnalysisRuns() {
  const [runs, setRuns] = useState<AnalysisRun[]>([]);
  const [loading, setLoading] = useState(true);
  const [selectedRun, setSelectedRun] = useState<string | null>(null);
  const [pairLogs, setPairLogs] = useState<any[]>([]);

  useEffect(() => {
    supabase.from('analysis_runs').select('*').order('started_at', { ascending: false }).limit(50)
      .then(({ data }) => { if (data) setRuns(data); setLoading(false); });
  }, []);

  const loadPairLogs = async (runId: string) => {
    setSelectedRun(runId);
    const { data } = await supabase.from('pair_analysis_log').select('*').eq('analysis_run_id', runId).order('created_at');
    if (data) setPairLogs(data);
  };

  return (
    <div className="p-6 space-y-6">
      <h1 className="text-2xl font-bold text-foreground">Analysis Runs</h1>

      {loading ? (
        <div className="text-muted-foreground animate-pulse">Loading...</div>
      ) : runs.length === 0 ? (
        <Card><CardContent className="p-8 text-center text-muted-foreground">No analysis runs yet. Runs will appear here once the analysis engine executes.</CardContent></Card>
      ) : (
        <div className="space-y-2">
          {runs.map(run => (
            <Card key={run.id} className={`cursor-pointer transition-colors ${selectedRun === run.id ? 'ring-1 ring-primary' : 'hover:bg-accent/50'}`} onClick={() => loadPairLogs(run.id)}>
              <CardContent className="p-4 flex items-center justify-between">
                <div className="flex items-center gap-4">
                  <Badge className={
                    run.status === 'COMPLETED' ? 'bg-success/20 text-success' :
                    run.status === 'RUNNING' ? 'bg-warning/20 text-warning' :
                    'bg-destructive/20 text-destructive'
                  }>{run.status}</Badge>
                  <span className="text-sm text-muted-foreground">{new Date(run.started_at).toLocaleString()}</span>
                  {run.finished_at && (
                    <span className="text-xs text-muted-foreground">
                      Duration: {Math.round((new Date(run.finished_at).getTime() - new Date(run.started_at).getTime()) / 1000)}s
                    </span>
                  )}
                </div>
                <div className="flex items-center gap-4 text-xs">
                  <span>Processed: <span className="text-foreground font-mono">{run.pairs_processed}</span></span>
                  <span className="text-long">Approved: {run.pairs_approved}</span>
                  <span className="text-muted-foreground">Rejected: {run.pairs_rejected}</span>
                  <span className="text-warning">Blocked: {run.pairs_blocked}</span>
                  {run.errors_count > 0 && <span className="text-short">Errors: {run.errors_count}</span>}
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      )}

      {selectedRun && pairLogs.length > 0 && (
        <Card>
          <CardHeader><CardTitle className="text-sm">Pair Details — Run {selectedRun.slice(0, 8)}</CardTitle></CardHeader>
          <CardContent className="space-y-2">
            {pairLogs.map(log => (
              <div key={log.id} className="flex items-center justify-between text-sm border-b border-border pb-2">
                <div className="flex items-center gap-3">
                  <span className="font-bold">{log.symbol}</span>
                  {log.classification && (
                    <Badge variant="outline" className={
                      log.classification === 'ELITE' ? 'text-elite' :
                      log.classification === 'APPROVED' ? 'text-long' : 'text-muted-foreground'
                    }>{log.classification}</Badge>
                  )}
                  {log.score != null && <span className="font-mono text-xs">{log.score}/100</span>}
                </div>
                <div className="flex items-center gap-3 text-xs text-muted-foreground">
                  <span>4H: {log.regime_4h || '—'}</span>
                  <span>1H: {log.alignment_1h || '—'}</span>
                  <span>15m: {log.setup_15m || '—'}</span>
                  {log.blocked_reason && <span className="text-warning">{log.blocked_reason}</span>}
                  {log.rejected_reason && <span>{log.rejected_reason}</span>}
                  {log.approved_reason && <span className="text-long">{log.approved_reason}</span>}
                </div>
              </div>
            ))}
          </CardContent>
        </Card>
      )}
    </div>
  );
}

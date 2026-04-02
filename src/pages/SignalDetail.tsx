import { useEffect, useState } from 'react';
import { useParams, Link } from 'react-router-dom';
import { supabase } from '@/integrations/supabase/client';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { ArrowLeft } from 'lucide-react';
import { Button } from '@/components/ui/button';

export default function SignalDetail() {
  const { id } = useParams();
  const [signal, setSignal] = useState<any>(null);
  const [reconciliations, setReconciliations] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!id) return;
    Promise.all([
      supabase.from('signals').select('*').eq('id', id).single(),
      supabase.from('signal_reconciliation_log').select('*').eq('signal_id', id).order('checked_at', { ascending: false }),
    ]).then(([sigRes, recRes]) => {
      if (sigRes.data) setSignal(sigRes.data);
      if (recRes.data) setReconciliations(recRes.data);
      setLoading(false);
    });
  }, [id]);

  if (loading) return <div className="p-6 text-muted-foreground animate-pulse">Loading...</div>;
  if (!signal) return <div className="p-6 text-muted-foreground">Signal not found</div>;

  const scoreDetails = signal.score_details as Record<string, number> | null;

  return (
    <div className="p-6 space-y-6 max-w-4xl">
      <Link to="/signals">
        <Button variant="ghost" size="sm"><ArrowLeft className="h-4 w-4 mr-2" />Back to Signals</Button>
      </Link>

      <div className="flex items-center gap-4">
        <h1 className="text-2xl font-bold">{signal.symbol}</h1>
        <Badge variant="outline" className={signal.direction === 'LONG' ? 'text-long border-long' : 'text-short border-short'}>
          {signal.direction}
        </Badge>
        <Badge className={
          signal.status === 'ACTIVE' ? 'bg-warning/20 text-warning' :
          signal.status === 'TAKE_PROFIT_HIT' ? 'bg-success/20 text-success' :
          signal.status === 'STOP_LOSS_HIT' ? 'bg-destructive/20 text-destructive' :
          'bg-muted text-muted-foreground'
        }>
          {signal.status}
        </Badge>
        <Badge variant="outline" className={
          signal.classification === 'ELITE' ? 'text-elite border-elite' : 
          signal.classification === 'APPROVED' ? 'text-long border-long' : ''
        }>
          {signal.classification}
        </Badge>
      </div>

      <div className="grid grid-cols-2 gap-4">
        <Card>
          <CardHeader className="pb-2"><CardTitle className="text-sm">Entry Details</CardTitle></CardHeader>
          <CardContent className="space-y-2 text-sm">
            <div className="flex justify-between"><span className="text-muted-foreground">Entry Price</span><span className="font-mono">{signal.entry_price}</span></div>
            <div className="flex justify-between"><span className="text-muted-foreground">Stop Loss</span><span className="font-mono text-short">{signal.stop_loss}</span></div>
            <div className="flex justify-between"><span className="text-muted-foreground">TP1</span><span className="font-mono text-long">{signal.take_profit_1}</span></div>
            <div className="flex justify-between"><span className="text-muted-foreground">TP2</span><span className="font-mono text-long">{signal.take_profit_2}</span></div>
            <div className="flex justify-between"><span className="text-muted-foreground">TP Final</span><span className="font-mono text-long">{signal.take_profit_final}</span></div>
            <div className="flex justify-between"><span className="text-muted-foreground">R:R Ratio</span><span className="font-mono">{signal.rr_ratio}</span></div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="pb-2"><CardTitle className="text-sm">Score Breakdown</CardTitle></CardHeader>
          <CardContent className="space-y-2 text-sm">
            <div className="flex justify-between"><span className="text-muted-foreground">Total Score</span><span className="font-mono text-lg font-bold">{signal.score}/100</span></div>
            {scoreDetails && Object.entries(scoreDetails).map(([key, val]) => (
              <div key={key} className="flex justify-between">
                <span className="text-muted-foreground capitalize">{key.replace(/_/g, ' ')}</span>
                <span className="font-mono">{val as number}</span>
              </div>
            ))}
          </CardContent>
        </Card>
      </div>

      {signal.justification && (
        <Card>
          <CardHeader className="pb-2"><CardTitle className="text-sm">Justification</CardTitle></CardHeader>
          <CardContent><p className="text-sm text-muted-foreground">{signal.justification}</p></CardContent>
        </Card>
      )}

      <Card>
        <CardHeader className="pb-2"><CardTitle className="text-sm">Metadata</CardTitle></CardHeader>
        <CardContent className="grid grid-cols-2 gap-2 text-sm">
          <div className="flex justify-between"><span className="text-muted-foreground">Strategy</span><span>{signal.strategy_version}</span></div>
          <div className="flex justify-between"><span className="text-muted-foreground">Created</span><span>{new Date(signal.created_at).toLocaleString()}</span></div>
          <div className="flex justify-between"><span className="text-muted-foreground">Expiry</span><span>{new Date(signal.expiry_time).toLocaleString()}</span></div>
          {signal.closed_time && <div className="flex justify-between"><span className="text-muted-foreground">Closed</span><span>{new Date(signal.closed_time).toLocaleString()}</span></div>}
          {signal.close_price && <div className="flex justify-between"><span className="text-muted-foreground">Close Price</span><span className="font-mono">{signal.close_price}</span></div>}
          {signal.close_reason && <div className="flex justify-between"><span className="text-muted-foreground">Close Reason</span><span>{signal.close_reason}</span></div>}
          {signal.mfe != null && <div className="flex justify-between"><span className="text-muted-foreground">MFE</span><span className="font-mono">{signal.mfe}</span></div>}
          {signal.mae != null && <div className="flex justify-between"><span className="text-muted-foreground">MAE</span><span className="font-mono">{signal.mae}</span></div>}
          {signal.invalidation_reason && <div className="col-span-2 flex justify-between"><span className="text-muted-foreground">Invalidation</span><span>{signal.invalidation_reason}</span></div>}
        </CardContent>
      </Card>

      <Card>
        <CardHeader className="pb-2"><CardTitle className="text-sm">Reconciliation History</CardTitle></CardHeader>
        <CardContent>
          {reconciliations.length === 0 ? (
            <p className="text-sm text-muted-foreground">No reconciliation events yet.</p>
          ) : (
            <div className="space-y-2">
              {reconciliations.map(r => (
                <div key={r.id} className="flex items-center gap-4 text-sm border-b border-border pb-2">
                  <span className="text-xs text-muted-foreground">{new Date(r.checked_at).toLocaleString()}</span>
                  <Badge variant="outline">{r.previous_status}</Badge>
                  <span className="text-muted-foreground">→</span>
                  <Badge variant="outline">{r.new_status}</Badge>
                  {r.resolution_reason && <span className="text-xs text-muted-foreground">{r.resolution_reason}</span>}
                </div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}

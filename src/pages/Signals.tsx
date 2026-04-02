import { useEffect, useState } from 'react';
import { Link, useSearchParams } from 'react-router-dom';
import { supabase } from '@/integrations/supabase/client';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Input } from '@/components/ui/input';

interface Signal {
  id: string;
  symbol: string;
  direction: 'LONG' | 'SHORT';
  entry_price: number;
  stop_loss: number;
  take_profit_final: number;
  rr_ratio: number;
  score: number;
  classification: string;
  status: string;
  created_at: string;
  justification: string | null;
}

export default function Signals() {
  const [signals, setSignals] = useState<Signal[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchParams, setSearchParams] = useSearchParams();

  const statusFilter = searchParams.get('status') || 'all';
  const symbolFilter = searchParams.get('symbol') || 'all';
  const directionFilter = searchParams.get('direction') || 'all';

  useEffect(() => {
    fetchSignals();
  }, []);

  const fetchSignals = async () => {
    const { data } = await supabase
      .from('signals')
      .select('*')
      .order('created_at', { ascending: false })
      .limit(200);
    if (data) setSignals(data as Signal[]);
    setLoading(false);
  };

  const filteredSignals = signals.filter(s => {
    if (statusFilter !== 'all' && s.status !== statusFilter) return false;
    if (symbolFilter !== 'all' && s.symbol !== symbolFilter) return false;
    if (directionFilter !== 'all' && s.direction !== directionFilter) return false;
    return true;
  });

  const uniqueSymbols = [...new Set(signals.map(s => s.symbol))];

  return (
    <div className="p-6 space-y-6">
      <h1 className="text-2xl font-bold text-foreground">Signals</h1>

      <div className="flex gap-3 flex-wrap">
        <Select value={statusFilter} onValueChange={v => setSearchParams(p => { p.set('status', v); return p; })}>
          <SelectTrigger className="w-40"><SelectValue placeholder="Status" /></SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All Status</SelectItem>
            <SelectItem value="ACTIVE">Active</SelectItem>
            <SelectItem value="TAKE_PROFIT_HIT">TP Hit</SelectItem>
            <SelectItem value="STOP_LOSS_HIT">SL Hit</SelectItem>
            <SelectItem value="EXPIRED">Expired</SelectItem>
            <SelectItem value="INVALIDATED">Invalidated</SelectItem>
            <SelectItem value="AMBIGUOUS">Ambiguous</SelectItem>
          </SelectContent>
        </Select>
        <Select value={symbolFilter} onValueChange={v => setSearchParams(p => { p.set('symbol', v); return p; })}>
          <SelectTrigger className="w-40"><SelectValue placeholder="Symbol" /></SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All Symbols</SelectItem>
            {uniqueSymbols.map(s => <SelectItem key={s} value={s}>{s}</SelectItem>)}
          </SelectContent>
        </Select>
        <Select value={directionFilter} onValueChange={v => setSearchParams(p => { p.set('direction', v); return p; })}>
          <SelectTrigger className="w-40"><SelectValue placeholder="Direction" /></SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All Directions</SelectItem>
            <SelectItem value="LONG">Long</SelectItem>
            <SelectItem value="SHORT">Short</SelectItem>
          </SelectContent>
        </Select>
      </div>

      {loading ? (
        <div className="text-muted-foreground animate-pulse">Loading signals...</div>
      ) : filteredSignals.length === 0 ? (
        <Card><CardContent className="p-8 text-center text-muted-foreground">No signals found. The analysis engine will generate signals when conditions are met.</CardContent></Card>
      ) : (
        <div className="space-y-2">
          {filteredSignals.map(signal => (
            <Link key={signal.id} to={`/signals/${signal.id}`}>
              <Card className="hover:bg-accent/50 transition-colors cursor-pointer">
                <CardContent className="p-4 flex items-center justify-between">
                  <div className="flex items-center gap-4">
                    <div className="font-bold text-sm">{signal.symbol}</div>
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
                  </div>
                  <div className="flex items-center gap-6 text-xs text-muted-foreground">
                    <div>Score: <span className="text-foreground font-mono">{signal.score}</span></div>
                    <div>R:R: <span className="text-foreground font-mono">{signal.rr_ratio.toFixed(1)}</span></div>
                    <div>Entry: <span className="text-foreground font-mono">{signal.entry_price}</span></div>
                    <Badge variant="outline" className={
                      signal.classification === 'ELITE' ? 'text-elite border-elite' :
                      signal.classification === 'APPROVED' ? 'text-long border-long' :
                      'text-muted-foreground'
                    }>
                      {signal.classification}
                    </Badge>
                    <div>{new Date(signal.created_at).toLocaleDateString()}</div>
                  </div>
                </CardContent>
              </Card>
            </Link>
          ))}
        </div>
      )}
    </div>
  );
}

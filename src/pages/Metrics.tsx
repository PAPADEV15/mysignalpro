import { useEffect, useState, useMemo } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { TrendingUp, TrendingDown, Target, XCircle, Clock, Award, BarChart3 } from 'lucide-react';

interface Signal {
  id: string;
  symbol: string;
  direction: 'LONG' | 'SHORT';
  status: string;
  score: number;
  classification: string;
  rr_ratio: number;
  entry_price: number;
  stop_loss: number;
  take_profit_final: number;
  close_price: number | null;
  created_at: string;
  closed_time: string | null;
  mfe: number | null;
  mae: number | null;
}

interface PairMetrics {
  symbol: string;
  total: number;
  wins: number;
  losses: number;
  expired: number;
  invalidated: number;
  winRate: number;
  avgScore: number;
  avgRR: number;
  totalR: number;
  avgWinScore: number;
  avgLossScore: number;
}

export default function Metrics() {
  const [signals, setSignals] = useState<Signal[]>([]);
  const [loading, setLoading] = useState(true);
  const [period, setPeriod] = useState<'all' | '7d' | '30d'>('all');

  useEffect(() => {
    let query = supabase.from('signals').select('*').neq('status', 'ACTIVE').order('created_at', { ascending: false });
    if (period === '7d') {
      const d = new Date(); d.setDate(d.getDate() - 7);
      query = query.gte('created_at', d.toISOString());
    } else if (period === '30d') {
      const d = new Date(); d.setDate(d.getDate() - 30);
      query = query.gte('created_at', d.toISOString());
    }
    query.limit(1000).then(({ data }) => {
      if (data) setSignals(data as Signal[]);
      setLoading(false);
    });
  }, [period]);

  const globalMetrics = useMemo(() => {
    const resolved = signals.filter(s => ['TAKE_PROFIT_HIT', 'STOP_LOSS_HIT', 'EXPIRED', 'INVALIDATED', 'AMBIGUOUS'].includes(s.status));
    const wins = resolved.filter(s => s.status === 'TAKE_PROFIT_HIT');
    const losses = resolved.filter(s => s.status === 'STOP_LOSS_HIT' || s.status === 'AMBIGUOUS');
    const expired = resolved.filter(s => s.status === 'EXPIRED');
    const invalidated = resolved.filter(s => s.status === 'INVALIDATED');

    const totalDecided = wins.length + losses.length;
    const winRate = totalDecided > 0 ? (wins.length / totalDecided) * 100 : 0;
    const lossRate = totalDecided > 0 ? (losses.length / totalDecided) * 100 : 0;
    const expiredRate = resolved.length > 0 ? (expired.length / resolved.length) * 100 : 0;
    const invalidatedRate = resolved.length > 0 ? (invalidated.length / resolved.length) * 100 : 0;

    // R calculation: wins get +RR, losses get -1R
    const totalR = wins.reduce((acc, s) => acc + s.rr_ratio, 0) - losses.length;
    const avgScore = resolved.length > 0 ? resolved.reduce((a, s) => a + s.score, 0) / resolved.length : 0;
    const avgWinScore = wins.length > 0 ? wins.reduce((a, s) => a + s.score, 0) / wins.length : 0;
    const avgLossScore = losses.length > 0 ? losses.reduce((a, s) => a + s.score, 0) / losses.length : 0;

    // Avg time to resolution
    const resolvedWithTime = resolved.filter(s => s.closed_time);
    const avgResolutionMin = resolvedWithTime.length > 0
      ? resolvedWithTime.reduce((a, s) => a + (new Date(s.closed_time!).getTime() - new Date(s.created_at).getTime()) / 60000, 0) / resolvedWithTime.length
      : 0;

    return {
      total: resolved.length,
      wins: wins.length, losses: losses.length, expired: expired.length, invalidated: invalidated.length,
      winRate, lossRate, expiredRate, invalidatedRate,
      totalR, avgScore, avgWinScore, avgLossScore, avgResolutionMin,
    };
  }, [signals]);

  const pairRanking = useMemo((): PairMetrics[] => {
    const bySymbol = new Map<string, Signal[]>();
    signals.forEach(s => {
      const arr = bySymbol.get(s.symbol) || [];
      arr.push(s);
      bySymbol.set(s.symbol, arr);
    });

    return Array.from(bySymbol.entries()).map(([symbol, sigs]) => {
      const wins = sigs.filter(s => s.status === 'TAKE_PROFIT_HIT');
      const losses = sigs.filter(s => s.status === 'STOP_LOSS_HIT' || s.status === 'AMBIGUOUS');
      const expired = sigs.filter(s => s.status === 'EXPIRED');
      const invalidated = sigs.filter(s => s.status === 'INVALIDATED');
      const decided = wins.length + losses.length;
      const totalR = wins.reduce((a, s) => a + s.rr_ratio, 0) - losses.length;

      return {
        symbol,
        total: sigs.length,
        wins: wins.length,
        losses: losses.length,
        expired: expired.length,
        invalidated: invalidated.length,
        winRate: decided > 0 ? (wins.length / decided) * 100 : 0,
        avgScore: sigs.length > 0 ? sigs.reduce((a, s) => a + s.score, 0) / sigs.length : 0,
        avgRR: sigs.length > 0 ? sigs.reduce((a, s) => a + s.rr_ratio, 0) / sigs.length : 0,
        totalR,
        avgWinScore: wins.length > 0 ? wins.reduce((a, s) => a + s.score, 0) / wins.length : 0,
        avgLossScore: losses.length > 0 ? losses.reduce((a, s) => a + s.score, 0) / losses.length : 0,
      };
    }).sort((a, b) => b.totalR - a.totalR);
  }, [signals]);

  // Score distribution
  const scoreDistribution = useMemo(() => {
    const buckets = [
      { label: '75-79', min: 75, max: 79, count: 0 },
      { label: '80-84', min: 80, max: 84, count: 0 },
      { label: '85-87', min: 85, max: 87, count: 0 },
      { label: '88-92', min: 88, max: 92, count: 0 },
      { label: '93-100', min: 93, max: 100, count: 0 },
    ];
    signals.forEach(s => {
      for (const b of buckets) { if (s.score >= b.min && s.score <= b.max) { b.count++; break; } }
    });
    const max = Math.max(...buckets.map(b => b.count), 1);
    return buckets.map(b => ({ ...b, pct: (b.count / max) * 100 }));
  }, [signals]);

  if (loading) return <div className="p-6 text-muted-foreground animate-pulse">Loading metrics...</div>;

  return (
    <div className="p-6 space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-foreground">Metrics</h1>
          <p className="text-sm text-muted-foreground">Signal quality and performance analytics</p>
        </div>
        <Select value={period} onValueChange={v => setPeriod(v as any)}>
          <SelectTrigger className="w-32"><SelectValue /></SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All Time</SelectItem>
            <SelectItem value="30d">Last 30d</SelectItem>
            <SelectItem value="7d">Last 7d</SelectItem>
          </SelectContent>
        </Select>
      </div>

      {signals.length === 0 ? (
        <Card><CardContent className="p-12 text-center text-muted-foreground">
          <BarChart3 className="h-12 w-12 mx-auto mb-4 opacity-30" />
          <p>No resolved signals yet. Metrics will appear once signals are resolved (TP hit, SL hit, expired, or invalidated).</p>
        </CardContent></Card>
      ) : (
        <>
          {/* Global KPIs */}
          <div className="grid grid-cols-2 md:grid-cols-4 lg:grid-cols-6 gap-3">
            <MetricCard label="Total Signals" value={globalMetrics.total} />
            <MetricCard label="Win Rate" value={`${globalMetrics.winRate.toFixed(1)}%`} color={globalMetrics.winRate >= 50 ? 'text-long' : 'text-short'} icon={<Target className="h-4 w-4" />} />
            <MetricCard label="Loss Rate" value={`${globalMetrics.lossRate.toFixed(1)}%`} color="text-short" icon={<XCircle className="h-4 w-4" />} />
            <MetricCard label="Total Return" value={`${globalMetrics.totalR >= 0 ? '+' : ''}${globalMetrics.totalR.toFixed(1)}R`} color={globalMetrics.totalR >= 0 ? 'text-long' : 'text-short'} icon={<TrendingUp className="h-4 w-4" />} />
            <MetricCard label="Expired Rate" value={`${globalMetrics.expiredRate.toFixed(1)}%`} color="text-muted-foreground" icon={<Clock className="h-4 w-4" />} />
            <MetricCard label="Avg Resolution" value={`${globalMetrics.avgResolutionMin.toFixed(0)}m`} icon={<Clock className="h-4 w-4" />} />
          </div>

          {/* Score Analysis */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <Card>
              <CardHeader className="pb-2"><CardTitle className="text-sm">Score Quality</CardTitle></CardHeader>
              <CardContent className="space-y-3 text-sm">
                <div className="flex justify-between"><span className="text-muted-foreground">Avg Score (all)</span><span className="font-mono">{globalMetrics.avgScore.toFixed(1)}</span></div>
                <div className="flex justify-between"><span className="text-muted-foreground">Avg Score (wins)</span><span className="font-mono text-long">{globalMetrics.avgWinScore.toFixed(1)}</span></div>
                <div className="flex justify-between"><span className="text-muted-foreground">Avg Score (losses)</span><span className="font-mono text-short">{globalMetrics.avgLossScore.toFixed(1)}</span></div>
                <div className="flex justify-between"><span className="text-muted-foreground">Wins</span><span className="font-mono">{globalMetrics.wins}</span></div>
                <div className="flex justify-between"><span className="text-muted-foreground">Losses</span><span className="font-mono">{globalMetrics.losses}</span></div>
                <div className="flex justify-between"><span className="text-muted-foreground">Invalidated</span><span className="font-mono">{globalMetrics.invalidated}</span></div>
              </CardContent>
            </Card>

            <Card>
              <CardHeader className="pb-2"><CardTitle className="text-sm">Score Distribution (Approved Signals)</CardTitle></CardHeader>
              <CardContent className="space-y-2">
                {scoreDistribution.map(b => (
                  <div key={b.label} className="flex items-center gap-3 text-sm">
                    <span className="w-14 text-muted-foreground text-xs">{b.label}</span>
                    <div className="flex-1 h-4 bg-muted rounded-sm overflow-hidden">
                      <div className="h-full bg-primary rounded-sm transition-all" style={{ width: `${b.pct}%` }} />
                    </div>
                    <span className="w-8 text-right font-mono text-xs">{b.count}</span>
                  </div>
                ))}
              </CardContent>
            </Card>
          </div>

          {/* Pair Ranking */}
          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="text-sm flex items-center gap-2"><Award className="h-4 w-4 text-elite" />Pair Ranking by R Return</CardTitle>
            </CardHeader>
            <CardContent>
              {pairRanking.length === 0 ? (
                <p className="text-sm text-muted-foreground">No pair data yet.</p>
              ) : (
                <div className="overflow-x-auto">
                  <table className="w-full text-sm">
                    <thead>
                      <tr className="text-xs text-muted-foreground border-b border-border">
                        <th className="text-left py-2 pr-4">#</th>
                        <th className="text-left py-2 pr-4">Symbol</th>
                        <th className="text-right py-2 pr-4">Total</th>
                        <th className="text-right py-2 pr-4">Wins</th>
                        <th className="text-right py-2 pr-4">Losses</th>
                        <th className="text-right py-2 pr-4">Win%</th>
                        <th className="text-right py-2 pr-4">Total R</th>
                        <th className="text-right py-2 pr-4">Avg Score</th>
                        <th className="text-right py-2">Expired</th>
                      </tr>
                    </thead>
                    <tbody>
                      {pairRanking.map((p, i) => (
                        <tr key={p.symbol} className="border-b border-border/50 last:border-0">
                          <td className="py-2 pr-4 text-muted-foreground">{i + 1}</td>
                          <td className="py-2 pr-4 font-bold">{p.symbol}</td>
                          <td className="py-2 pr-4 text-right font-mono">{p.total}</td>
                          <td className="py-2 pr-4 text-right font-mono text-long">{p.wins}</td>
                          <td className="py-2 pr-4 text-right font-mono text-short">{p.losses}</td>
                          <td className={`py-2 pr-4 text-right font-mono ${p.winRate >= 50 ? 'text-long' : 'text-short'}`}>{p.winRate.toFixed(0)}%</td>
                          <td className={`py-2 pr-4 text-right font-mono font-bold ${p.totalR >= 0 ? 'text-long' : 'text-short'}`}>{p.totalR >= 0 ? '+' : ''}{p.totalR.toFixed(1)}R</td>
                          <td className="py-2 pr-4 text-right font-mono">{p.avgScore.toFixed(0)}</td>
                          <td className="py-2 text-right font-mono text-muted-foreground">{p.expired}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
            </CardContent>
          </Card>
        </>
      )}
    </div>
  );
}

function MetricCard({ label, value, color, icon }: { label: string; value: string | number; color?: string; icon?: React.ReactNode }) {
  return (
    <Card>
      <CardContent className="p-4">
        <div className="flex items-center gap-1 text-xs text-muted-foreground mb-1">
          {icon}
          {label}
        </div>
        <div className={`text-xl font-bold font-mono ${color || 'text-foreground'}`}>{value}</div>
      </CardContent>
    </Card>
  );
}

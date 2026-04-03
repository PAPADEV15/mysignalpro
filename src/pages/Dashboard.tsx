import { useEffect, useState } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useBinanceTickers } from '@/hooks/useBinanceData';
import { invokeIngestMarketData, invokeRunAnalysis, invokeReconcileSignals, invokeInvalidateSignals } from '@/lib/api';
import { useAuth } from '@/contexts/AuthContext';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Activity, TrendingUp, TrendingDown, Clock, AlertTriangle, CheckCircle, RefreshCw, Play } from 'lucide-react';
import { toast } from 'sonner';

interface WatchlistPair {
  id: string;
  symbol: string;
  is_active: boolean;
  priority: number;
}

interface SignalRow {
  id: string;
  symbol: string;
  direction: 'LONG' | 'SHORT';
  status: string;
  entry_price: number;
  stop_loss: number;
  take_profit_final: number;
  rr_ratio: number;
  score: number;
  classification: string;
  expiry_time: string;
}

interface PairAnalysis {
  symbol: string;
  regime_4h: string | null;
  alignment_1h: string | null;
  setup_15m: string | null;
  score: number | null;
  classification: string | null;
  blocked_reason: string | null;
  rejected_reason: string | null;
}

function getStatusColor(status: string) {
  switch (status) {
    case 'ACTIVE': return 'bg-warning text-warning-foreground';
    case 'TAKE_PROFIT_HIT': return 'bg-success text-success-foreground';
    case 'STOP_LOSS_HIT': return 'bg-destructive text-destructive-foreground';
    case 'EXPIRED': return 'bg-muted text-muted-foreground';
    case 'INVALIDATED': return 'bg-muted text-muted-foreground';
    default: return 'bg-secondary text-secondary-foreground';
  }
}

function getPairStatus(activeSignal: SignalRow | null, analysis: PairAnalysis | null): { label: string; color: string } {
  if (activeSignal) return { label: 'BLOCKED', color: 'text-warning' };
  if (!analysis) return { label: 'MONITORING', color: 'text-info' };
  if (analysis.classification === 'ELITE') return { label: 'ELITE', color: 'text-elite' };
  if (analysis.classification === 'APPROVED') return { label: 'APPROVED', color: 'text-long' };
  if (analysis.blocked_reason) return { label: 'BLOCKED', color: 'text-warning' };
  if (analysis.rejected_reason) return { label: 'NO TRADE', color: 'text-muted-foreground' };
  return { label: 'MONITORING', color: 'text-info' };
}

export default function Dashboard() {
  const { isAdmin } = useAuth();
  const [pairs, setPairs] = useState<WatchlistPair[]>([]);
  const [activeSignals, setActiveSignals] = useState<SignalRow[]>([]);
  const [latestAnalysis, setLatestAnalysis] = useState<PairAnalysis[]>([]);
  const [lastUpdate, setLastUpdate] = useState<Date>(new Date());
  const [running, setRunning] = useState(false);

  const handleIngest = async () => { setRunning(true); try { const r = await invokeIngestMarketData(); toast.success(`Ingested ${r.ingested} pairs`); fetchData(); } catch(e:any) { toast.error(e.message); } finally { setRunning(false); } };
  const handleAnalysis = async () => { setRunning(true); try { const r = await invokeRunAnalysis(); toast.success(`Analysis: ${r.approved} approved, ${r.rejected} rejected`); fetchData(); } catch(e:any) { toast.error(e.message); } finally { setRunning(false); } };
  const handleReconcile = async () => { setRunning(true); try { const r = await invokeReconcileSignals(); toast.success(`Reconciled ${r.reconciled} signals`); fetchData(); } catch(e:any) { toast.error(e.message); } finally { setRunning(false); } };

  const symbols = pairs.filter(p => p.is_active).map(p => p.symbol);
  const { tickers, loading: tickersLoading, wsConnected } = useBinanceTickers(symbols);

  useEffect(() => {
    fetchData();
    const interval = setInterval(fetchData, 30000);
    return () => clearInterval(interval);
  }, []);

  const fetchData = async () => {
    const [pairsRes, signalsRes, analysisRes] = await Promise.all([
      supabase.from('watchlist_pairs').select('*').order('priority'),
      supabase.from('signals').select('*').eq('status', 'ACTIVE'),
      supabase.from('pair_analysis_log').select('*').order('created_at', { ascending: false }).limit(50),
    ]);

    if (pairsRes.data) setPairs(pairsRes.data);
    if (signalsRes.data) setActiveSignals(signalsRes.data as SignalRow[]);
    if (analysisRes.data) {
      const bySymbol = new Map<string, PairAnalysis>();
      analysisRes.data.forEach(a => {
        if (!bySymbol.has(a.symbol)) bySymbol.set(a.symbol, a as PairAnalysis);
      });
      setLatestAnalysis(Array.from(bySymbol.values()));
    }
    setLastUpdate(new Date());
  };

  const totalSignals = activeSignals.length;

  return (
    <div className="p-6 space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-foreground">Dashboard</h1>
          <p className="text-sm text-muted-foreground">Real-time crypto analysis monitoring</p>
        </div>
        <div className="flex items-center gap-2">
          {isAdmin && (
            <>
              <Button size="sm" variant="outline" disabled={running} onClick={handleIngest}><RefreshCw className="h-3 w-3 mr-1" />Ingest Data</Button>
              <Button size="sm" variant="outline" disabled={running} onClick={handleReconcile}><RefreshCw className="h-3 w-3 mr-1" />Reconcile</Button>
              <Button size="sm" disabled={running} onClick={handleAnalysis}><Play className="h-3 w-3 mr-1" />Run Analysis</Button>
            </>
          )}
          <Badge variant="outline" className={`gap-1 ${wsConnected ? '' : 'border-destructive'}`}>
            <Activity className={`h-3 w-3 ${wsConnected ? 'text-primary animate-pulse-glow' : 'text-destructive'}`} />
            {wsConnected ? 'Live WS' : 'REST Only'}
          </Badge>
          <span className="text-xs text-muted-foreground">
            <Clock className="h-3 w-3 inline mr-1" />
            {lastUpdate.toLocaleTimeString()}
          </span>
        </div>
      </div>

      {/* Summary Cards */}
      <div className="grid grid-cols-4 gap-4">
        <Card>
          <CardContent className="p-4">
            <div className="text-xs text-muted-foreground">Active Pairs</div>
            <div className="text-2xl font-bold text-foreground">{symbols.length}</div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-4">
            <div className="text-xs text-muted-foreground">Active Signals</div>
            <div className="text-2xl font-bold text-warning">{totalSignals}</div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-4">
            <div className="text-xs text-muted-foreground">Data Source</div>
            <div className="text-sm font-medium text-primary">Binance Spot</div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-4">
            <div className="text-xs text-muted-foreground">Strategy</div>
            <div className="text-sm font-medium text-foreground">crypto_intraday_v1</div>
          </CardContent>
        </Card>
      </div>

      {/* Pair Cards */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
        {pairs.filter(p => p.is_active).sort((a, b) => a.priority - b.priority).map(pair => {
          const ticker = tickers[pair.symbol];
          const signal = activeSignals.find(s => s.symbol === pair.symbol);
          const analysis = latestAnalysis.find(a => a.symbol === pair.symbol) ?? null;
          const pairStatus = getPairStatus(signal ?? null, analysis);

          return (
            <Card key={pair.id} className="relative overflow-hidden">
              <CardHeader className="pb-2 pt-4 px-4">
                <div className="flex items-center justify-between">
                  <CardTitle className="text-sm font-bold">{pair.symbol}</CardTitle>
                  <span className={`text-xs font-semibold ${pairStatus.color}`}>{pairStatus.label}</span>
                </div>
              </CardHeader>
              <CardContent className="px-4 pb-4 space-y-3">
                {ticker ? (
                  <div className="flex items-baseline justify-between">
                    <span className="text-lg font-mono font-bold text-foreground">
                      ${ticker.price.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: ticker.price < 1 ? 6 : 2 })}
                    </span>
                    <span className={`text-xs font-medium flex items-center gap-0.5 ${ticker.priceChangePercent >= 0 ? 'text-long' : 'text-short'}`}>
                      {ticker.priceChangePercent >= 0 ? <TrendingUp className="h-3 w-3" /> : <TrendingDown className="h-3 w-3" />}
                      {ticker.priceChangePercent.toFixed(2)}%
                    </span>
                  </div>
                ) : (
                  <div className="text-sm text-muted-foreground animate-pulse">Loading...</div>
                )}

                <div className="grid grid-cols-3 gap-2 text-xs">
                  <div>
                    <div className="text-muted-foreground">4H</div>
                    <div className="font-medium text-foreground">{analysis?.regime_4h || '—'}</div>
                  </div>
                  <div>
                    <div className="text-muted-foreground">1H</div>
                    <div className="font-medium text-foreground">{analysis?.alignment_1h || '—'}</div>
                  </div>
                  <div>
                    <div className="text-muted-foreground">15m</div>
                    <div className="font-medium text-foreground">{analysis?.setup_15m || '—'}</div>
                  </div>
                </div>

                {analysis?.score != null && (
                  <div className="flex items-center gap-2">
                    <div className="flex-1 h-1.5 bg-muted rounded-full overflow-hidden">
                      <div
                        className="h-full rounded-full transition-all"
                        style={{
                          width: `${analysis.score}%`,
                          backgroundColor: analysis.score >= 88
                            ? 'hsl(var(--elite))'
                            : analysis.score >= 75
                            ? 'hsl(var(--success))'
                            : 'hsl(var(--muted-foreground))',
                        }}
                      />
                    </div>
                    <span className="text-xs font-mono">{analysis.score}</span>
                  </div>
                )}

                {signal && (
                  <div className="rounded-md bg-secondary p-2 space-y-1 text-xs">
                    <div className="flex justify-between">
                      <Badge className={signal.direction === 'LONG' ? 'bg-long text-long' : 'bg-short text-short'} variant="outline">
                        {signal.direction}
                      </Badge>
                      <Badge className={getStatusColor(signal.status)}>{signal.status}</Badge>
                    </div>
                    <div className="grid grid-cols-2 gap-1 text-muted-foreground">
                      <div>Entry: <span className="text-foreground font-mono">{signal.entry_price}</span></div>
                      <div>SL: <span className="text-short font-mono">{signal.stop_loss}</span></div>
                      <div>TP: <span className="text-long font-mono">{signal.take_profit_final}</span></div>
                      <div>R:R: <span className="text-foreground font-mono">{signal.rr_ratio.toFixed(1)}</span></div>
                    </div>
                    <div className="text-muted-foreground">
                      Expires: {new Date(signal.expiry_time).toLocaleTimeString()}
                    </div>
                  </div>
                )}

                {!signal && analysis?.blocked_reason && (
                  <div className="flex items-start gap-1 text-xs text-muted-foreground">
                    <AlertTriangle className="h-3 w-3 mt-0.5 text-warning flex-shrink-0" />
                    {analysis.blocked_reason}
                  </div>
                )}
                {!signal && analysis?.rejected_reason && (
                  <div className="flex items-start gap-1 text-xs text-muted-foreground">
                    <CheckCircle className="h-3 w-3 mt-0.5 flex-shrink-0" />
                    {analysis.rejected_reason}
                  </div>
                )}
              </CardContent>
            </Card>
          );
        })}
      </div>
    </div>
  );
}

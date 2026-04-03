import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { createClient } from "jsr:@supabase/supabase-js@2";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

// Indicator helpers (same as run-analysis)
function calcEMA(closes: number[], period: number): number[] {
  if (closes.length < period) return [];
  const k = 2 / (period + 1);
  const result: number[] = new Array(period - 1).fill(NaN);
  let ema = closes.slice(0, period).reduce((a, b) => a + b, 0) / period;
  result.push(ema);
  for (let i = period; i < closes.length; i++) {
    ema = closes[i] * k + ema * (1 - k);
    result.push(ema);
  }
  return result;
}

function calcSMA(closes: number[], period: number): number[] {
  const result: number[] = [];
  for (let i = 0; i < closes.length; i++) {
    if (i < period - 1) { result.push(NaN); continue; }
    result.push(closes.slice(i - period + 1, i + 1).reduce((a, b) => a + b, 0) / period);
  }
  return result;
}

function calcRSI(closes: number[], period = 14): number[] {
  if (closes.length < period + 1) return [];
  const result: number[] = new Array(period).fill(NaN);
  const changes = closes.slice(1).map((c, i) => c - closes[i]);
  let avgGain = 0, avgLoss = 0;
  for (let i = 0; i < period; i++) {
    if (changes[i] > 0) avgGain += changes[i]; else avgLoss += Math.abs(changes[i]);
  }
  avgGain /= period; avgLoss /= period;
  const rs0 = avgLoss === 0 ? 100 : avgGain / avgLoss;
  result.push(avgLoss === 0 ? 100 : 100 - 100 / (1 + rs0));
  for (let i = period; i < changes.length; i++) {
    const gain = changes[i] > 0 ? changes[i] : 0;
    const loss = changes[i] < 0 ? Math.abs(changes[i]) : 0;
    avgGain = (avgGain * (period - 1) + gain) / period;
    avgLoss = (avgLoss * (period - 1) + loss) / period;
    const rs = avgLoss === 0 ? 100 : avgGain / avgLoss;
    result.push(avgLoss === 0 ? 100 : 100 - 100 / (1 + rs));
  }
  return result;
}

function last(arr: number[]): number | undefined {
  for (let i = arr.length - 1; i >= 0; i--) if (!isNaN(arr[i])) return arr[i];
  return undefined;
}

/**
 * Check if the 4H regime still supports the signal direction.
 * Returns null if still valid, or a reason string if invalidated.
 */
function checkRegime4H(candles: any[], direction: 'LONG' | 'SHORT', settings: any): string | null {
  if (candles.length < 210) return null; // not enough data to invalidate
  const closes = candles.map((c: any) => c.close);
  const ema20 = last(calcEMA(closes, 20))!;
  const ema50 = last(calcEMA(closes, 50))!;
  const sma200 = last(calcSMA(closes, 200))!;
  const rsi = last(calcRSI(closes))!;
  const price = closes[closes.length - 1];

  const regimeSettings = settings?.regime_4h || {};

  if (direction === 'LONG') {
    // Invalidate if EMAs crossed bearish or price dropped below SMA200
    if (ema20 < ema50) return `4H regime flipped bearish: EMA20(${ema20.toFixed(2)}) < EMA50(${ema50.toFixed(2)})`;
    if (price < sma200) return `4H price(${price.toFixed(2)}) dropped below SMA200(${sma200.toFixed(2)})`;
    const rsiMax = regimeSettings.rsi_long_max ?? 68;
    if (rsi > rsiMax + 5) return `4H RSI overextended: ${rsi.toFixed(1)} > ${rsiMax + 5}`;
  } else {
    if (ema20 > ema50) return `4H regime flipped bullish: EMA20(${ema20.toFixed(2)}) > EMA50(${ema50.toFixed(2)})`;
    if (price > sma200) return `4H price(${price.toFixed(2)}) rose above SMA200(${sma200.toFixed(2)})`;
    const rsiMin = regimeSettings.rsi_short_min ?? 32;
    if (rsi < rsiMin - 5) return `4H RSI overextended: ${rsi.toFixed(1)} < ${rsiMin - 5}`;
  }
  return null;
}

/**
 * Check if the 1H alignment still supports the signal direction.
 */
function checkAlignment1H(candles: any[], direction: 'LONG' | 'SHORT', settings: any): string | null {
  if (candles.length < 60) return null;
  const closes = candles.map((c: any) => c.close);
  const ema20 = last(calcEMA(closes, 20))!;
  const ema50 = last(calcEMA(closes, 50))!;
  const rsi = last(calcRSI(closes))!;

  if (direction === 'LONG') {
    if (ema20 < ema50) return `1H alignment lost: EMA20(${ema20.toFixed(2)}) < EMA50(${ema50.toFixed(2)})`;
    const minRsi = settings?.alignment_1h?.rsi_long_min ?? 50;
    if (rsi < minRsi - 5) return `1H RSI dropped: ${rsi.toFixed(1)} < ${minRsi - 5}`;
  } else {
    if (ema20 > ema50) return `1H alignment lost: EMA20(${ema20.toFixed(2)}) > EMA50(${ema50.toFixed(2)})`;
    const maxRsi = settings?.alignment_1h?.rsi_short_max ?? 50;
    if (rsi > maxRsi + 5) return `1H RSI rose: ${rsi.toFixed(1)} > ${maxRsi + 5}`;
  }
  return null;
}

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: corsHeaders });

  try {
    const supabase = createClient(
      Deno.env.get('SUPABASE_URL')!,
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!
    );

    // Load settings
    const { data: settingsRows } = await supabase.from('app_settings').select('key, value_json');
    const settings: Record<string, any> = {};
    (settingsRows || []).forEach((s: any) => { settings[s.key] = s.value_json; });
    const strategySettings = settings.strategy || {};

    // Get all ACTIVE signals
    const { data: activeSignals, error } = await supabase
      .from('signals')
      .select('*')
      .eq('status', 'ACTIVE');

    if (error) throw error;
    if (!activeSignals || activeSignals.length === 0) {
      return new Response(JSON.stringify({ success: true, invalidated: 0, message: 'No active signals' }), {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    let invalidated = 0;
    const details: any[] = [];

    for (const sig of activeSignals) {
      // Fetch 4H candles
      const { data: candles4h } = await supabase
        .from('market_candles')
        .select('*')
        .eq('symbol', sig.symbol)
        .eq('timeframe', '4h')
        .eq('is_closed', true)
        .order('open_time', { ascending: true });

      // Fetch 1H candles
      const { data: candles1h } = await supabase
        .from('market_candles')
        .select('*')
        .eq('symbol', sig.symbol)
        .eq('timeframe', '1h')
        .eq('is_closed', true)
        .order('open_time', { ascending: true });

      // Check regime
      const regimeReason = checkRegime4H(candles4h || [], sig.direction, strategySettings);
      const alignmentReason = checkAlignment1H(candles1h || [], sig.direction, strategySettings);

      const invalidationReason = regimeReason || alignmentReason;

      if (invalidationReason) {
        await supabase.from('signals').update({
          status: 'INVALIDATED',
          closed_time: new Date().toISOString(),
          close_reason: 'Automatic invalidation',
          invalidation_reason: invalidationReason,
        }).eq('id', sig.id);

        await supabase.from('signal_reconciliation_log').insert({
          signal_id: sig.id,
          previous_status: 'ACTIVE',
          new_status: 'INVALIDATED',
          resolution_reason: invalidationReason,
        });

        invalidated++;
        details.push({ signal_id: sig.id, symbol: sig.symbol, reason: invalidationReason });
      }
    }

    if (invalidated > 0) {
      await supabase.from('audit_log').insert({
        event_type: 'signal_invalidation',
        severity: 'warning',
        source: 'invalidate-signals',
        message: `Invalidated ${invalidated} signals due to regime/alignment change`,
        details_json: { invalidated, details },
      });
    }

    return new Response(JSON.stringify({ success: true, invalidated, details }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  } catch (e: any) {
    return new Response(JSON.stringify({ error: e.message }), {
      status: 500,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }
});

import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { createClient } from "jsr:@supabase/supabase-js@2";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

// ===== INDICATOR CALCULATIONS =====
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

function calcATR(candles: any[], period = 14): number[] {
  if (candles.length < 2) return [];
  const trs: number[] = [candles[0].high - candles[0].low];
  for (let i = 1; i < candles.length; i++) {
    const c = candles[i]; const pc = candles[i - 1].close;
    trs.push(Math.max(c.high - c.low, Math.abs(c.high - pc), Math.abs(c.low - pc)));
  }
  const result: number[] = new Array(period - 1).fill(NaN);
  let atr = trs.slice(0, period).reduce((a, b) => a + b, 0) / period;
  result.push(atr);
  for (let i = period; i < trs.length; i++) {
    atr = (atr * (period - 1) + trs[i]) / period;
    result.push(atr);
  }
  return result;
}

function calcVWAP(candles: any[]): number[] {
  let cumVol = 0, cumTP = 0;
  return candles.map((c: any) => {
    const tp = (c.high + c.low + c.close) / 3;
    cumVol += c.volume; cumTP += tp * c.volume;
    return cumVol === 0 ? tp : cumTP / cumVol;
  });
}

function last(arr: number[]): number | undefined {
  for (let i = arr.length - 1; i >= 0; i--) if (!isNaN(arr[i])) return arr[i];
  return undefined;
}

// ===== STRATEGY =====
interface Regime4H { valid: boolean; direction: 'LONG' | 'SHORT' | 'NONE'; reason: string; score: number; }
interface Alignment1H { valid: boolean; direction: 'LONG' | 'SHORT' | 'NONE'; reason: string; score: number; }
interface Setup15m { valid: boolean; direction: 'LONG' | 'SHORT' | 'NONE'; reason: string; score: number; entryPrice?: number; stopLoss?: number; }

function analyzeRegime4H(candles: any[], settings: any): Regime4H {
  if (candles.length < 210) return { valid: false, direction: 'NONE', reason: 'Insufficient 4H candles for warmup', score: 0 };
  const closes = candles.map((c: any) => c.close);
  const ema20 = last(calcEMA(closes, 20))!;
  const ema50 = last(calcEMA(closes, 50))!;
  const sma200 = last(calcSMA(closes, 200))!;
  const rsi = last(calcRSI(closes))!;
  const atr = last(calcATR(candles))!;
  const price = closes[closes.length - 1];
  const regimeSettings = settings?.regime_4h || {};
  const rsiLongMin = regimeSettings.rsi_long_min ?? 45;
  const rsiLongMax = regimeSettings.rsi_long_max ?? 72;
  const rsiShortMin = regimeSettings.rsi_short_min ?? 28;
  const rsiShortMax = regimeSettings.rsi_short_max ?? 55;
  const allowRanging = regimeSettings.allow_ranging ?? true;
  const emaDiffThreshold = regimeSettings.ema_diff_threshold_pct ?? 1.5;
  const maxExtension = settings?.filters?.max_extension_pct ?? 3.0;

  const emaDiffPct = Math.abs(ema20 - ema50) / ema50 * 100;

  // Check LONG - relaxed: price near or above SMA200 (within 2%)
  const priceAboveSma = price >= sma200 * 0.98;
  if (ema20 > ema50 && priceAboveSma && rsi >= rsiLongMin && rsi <= rsiLongMax) {
    const extension = Math.abs(price - ema20) / ema20 * 100;
    if (extension > maxExtension) {
      return { valid: false, direction: 'NONE', reason: `4H extended: ${extension.toFixed(2)}% from EMA20`, score: 0 };
    }
    let score = 15;
    score += price > sma200 ? 10 : 5; // partial credit if near SMA200
    score += Math.min(10, 10 * (1 - Math.abs(rsi - 58) / 20));
    return { valid: true, direction: 'LONG', reason: `4H bullish: EMA20>${ema50.toFixed(0)}, RSI=${rsi.toFixed(1)}`, score };
  }

  // Check SHORT - relaxed: price near or below SMA200 (within 2%)
  const priceBelowSma = price <= sma200 * 1.02;
  if (ema20 < ema50 && priceBelowSma && rsi >= rsiShortMin && rsi <= rsiShortMax) {
    const extension = Math.abs(price - ema20) / ema20 * 100;
    if (extension > maxExtension) {
      return { valid: false, direction: 'NONE', reason: `4H extended: ${extension.toFixed(2)}% from EMA20`, score: 0 };
    }
    let score = 15;
    score += price < sma200 ? 10 : 5;
    score += Math.min(10, 10 * (1 - Math.abs(rsi - 42) / 20));
    return { valid: true, direction: 'SHORT', reason: `4H bearish: EMA20<${ema50.toFixed(0)}, RSI=${rsi.toFixed(1)}`, score };
  }

  // RANGING MARKET: EMAs are close together, RSI near 50
  if (allowRanging && emaDiffPct < emaDiffThreshold) {
    // Determine lean direction from short-term momentum
    const ema9 = last(calcEMA(closes, 9))!;
    const recentCloses = closes.slice(-5);
    const shortMomentum = recentCloses[recentCloses.length - 1] - recentCloses[0];
    
    let direction: 'LONG' | 'SHORT';
    let reason: string;
    
    if (shortMomentum > 0 && ema9 > ema20) {
      direction = 'LONG';
      reason = `4H ranging-bullish: EMAs converged (${emaDiffPct.toFixed(2)}%), momentum up, RSI=${rsi.toFixed(1)}`;
    } else if (shortMomentum < 0 && ema9 < ema20) {
      direction = 'SHORT';
      reason = `4H ranging-bearish: EMAs converged (${emaDiffPct.toFixed(2)}%), momentum down, RSI=${rsi.toFixed(1)}`;
    } else {
      return { valid: false, direction: 'NONE', reason: `4H ranging but no momentum lean: EMA diff=${emaDiffPct.toFixed(2)}%, RSI=${rsi.toFixed(1)}`, score: 0 };
    }

    // Ranging regime gets lower base score (quality penalty)
    let score = 10;
    score += Math.min(8, 8 * (1 - Math.abs(rsi - 50) / 20));
    return { valid: true, direction, reason, score };
  }

  return { valid: false, direction: 'NONE', reason: `4H no clear regime: EMA20=${ema20.toFixed(2)}, EMA50=${ema50.toFixed(2)}, RSI=${rsi.toFixed(1)}`, score: 0 };
}

function analyzeAlignment1H(candles: any[], direction: 'LONG' | 'SHORT', settings: any): Alignment1H {
  if (candles.length < 60) return { valid: false, direction: 'NONE', reason: 'Insufficient 1H candles', score: 0 };
  const closes = candles.map((c: any) => c.close);
  const ema20 = last(calcEMA(closes, 20))!;
  const ema50 = last(calcEMA(closes, 50))!;
  const rsi = last(calcRSI(closes))!;
  const alSettings = settings?.alignment_1h || {};

  if (direction === 'LONG') {
    if (ema20 < ema50) return { valid: false, direction: 'NONE', reason: `1H EMA20 < EMA50`, score: 0 };
    const minRsi = alSettings.rsi_long_min ?? 50;
    const maxRsi = alSettings.rsi_long_max ?? 65;
    if (rsi < minRsi || rsi > maxRsi) return { valid: false, direction: 'NONE', reason: `1H RSI ${rsi.toFixed(1)} outside [${minRsi},${maxRsi}]`, score: 0 };
    let score = 10 + Math.min(10, 10 * (1 - Math.abs(rsi - 57.5) / 15));
    return { valid: true, direction: 'LONG', reason: `1H aligned LONG: RSI=${rsi.toFixed(1)}`, score };
  } else {
    if (ema20 > ema50) return { valid: false, direction: 'NONE', reason: `1H EMA20 > EMA50`, score: 0 };
    const minRsi = alSettings.rsi_short_min ?? 35;
    const maxRsi = alSettings.rsi_short_max ?? 50;
    if (rsi < minRsi || rsi > maxRsi) return { valid: false, direction: 'NONE', reason: `1H RSI ${rsi.toFixed(1)} outside [${minRsi},${maxRsi}]`, score: 0 };
    let score = 10 + Math.min(10, 10 * (1 - Math.abs(rsi - 42.5) / 15));
    return { valid: true, direction: 'SHORT', reason: `1H aligned SHORT: RSI=${rsi.toFixed(1)}`, score };
  }
}

function analyzeSetup15m(candles: any[], direction: 'LONG' | 'SHORT', settings: any): Setup15m {
  if (candles.length < 50) return { valid: false, direction: 'NONE', reason: 'Insufficient 15m candles', score: 0 };
  const closes = candles.map((c: any) => c.close);
  const volumes = candles.map((c: any) => c.volume);
  const ema9 = calcEMA(closes, 9);
  const ema21 = calcEMA(closes, 21);
  const rsi = calcRSI(closes);
  const atr = calcATR(candles);
  const vwap = calcVWAP(candles);
  const avgVol = volumes.slice(-20).reduce((a: number, b: number) => a + b, 0) / 20;
  const lastEma9 = last(ema9)!;
  const lastEma21 = last(ema21)!;
  const lastRsi = last(rsi)!;
  const lastAtr = last(atr)!;
  const lastVwap = last(vwap)!;
  const price = closes[closes.length - 1];
  const lastCandle = candles[candles.length - 1];
  const prevCandle = candles[candles.length - 2];

  const filterSettings = settings?.filters || {};
  const minAtr = filterSettings.min_atr_15m ?? 0.001;
  const maxAtr = filterSettings.max_atr_15m ?? 0.05;

  // ATR filters
  const atrPct = lastAtr / price;
  if (atrPct < minAtr) return { valid: false, direction: 'NONE', reason: `15m ATR too low: ${(atrPct*100).toFixed(4)}%`, score: 0 };
  if (atrPct > maxAtr) return { valid: false, direction: 'NONE', reason: `15m ATR too high: ${(atrPct*100).toFixed(4)}%`, score: 0 };

  // Body sizes for retake validation
  const bodies = candles.slice(-6, -1).map((c: any) => Math.abs(c.close - c.open));
  const avgBody = bodies.reduce((a: number, b: number) => a + b, 0) / bodies.length;
  const lastBody = Math.abs(lastCandle.close - lastCandle.open);
  const lastVolume = lastCandle.volume;

  let score = 0;

  if (direction === 'LONG') {
    // Check pullback to EMA9-EMA21 or VWAP
    const pullbackZone = price >= lastEma21 && price <= lastEma9 * 1.005 || Math.abs(price - lastVwap) / lastVwap < 0.003;
    // Check if last candle is bullish retake
    const isBullishRetake = lastCandle.close > lastCandle.open && lastCandle.close > lastEma9;
    const hasVolume = lastVolume > avgVol;
    const hasBody = lastBody > avgBody;
    const rsiRecovery = lastRsi > 50;

    if (!pullbackZone && !isBullishRetake) return { valid: false, direction: 'NONE', reason: '15m no valid pullback/retake for LONG', score: 0 };

    score += (pullbackZone ? 10 : 5);
    score += (isBullishRetake && hasBody ? 10 : 3);
    score += (hasVolume ? 10 : 3);

    if (!rsiRecovery) return { valid: false, direction: 'NONE', reason: `15m RSI ${lastRsi.toFixed(1)} not recovered above 50`, score: 0 };

    const sl = Math.min(lastEma21, price - 1.2 * lastAtr);
    const risk = price - sl;
    if (risk <= 0) return { valid: false, direction: 'NONE', reason: '15m invalid SL calculation', score: 0 };

    return { valid: true, direction: 'LONG', reason: `15m LONG setup: pullback retake, vol=${hasVolume}, RSI=${lastRsi.toFixed(1)}`, score, entryPrice: price, stopLoss: sl };
  } else {
    const pullbackZone = price <= lastEma21 && price >= lastEma9 * 0.995 || Math.abs(price - lastVwap) / lastVwap < 0.003;
    const isBearishRetake = lastCandle.close < lastCandle.open && lastCandle.close < lastEma9;
    const hasVolume = lastVolume > avgVol;
    const hasBody = lastBody > avgBody;
    const rsiDrop = lastRsi < 50;

    if (!pullbackZone && !isBearishRetake) return { valid: false, direction: 'NONE', reason: '15m no valid pullback/retake for SHORT', score: 0 };

    score += (pullbackZone ? 10 : 5);
    score += (isBearishRetake && hasBody ? 10 : 3);
    score += (hasVolume ? 10 : 3);

    if (!rsiDrop) return { valid: false, direction: 'NONE', reason: `15m RSI ${lastRsi.toFixed(1)} not below 50`, score: 0 };

    const sl = Math.max(lastEma21, price + 1.2 * lastAtr);
    const risk = sl - price;
    if (risk <= 0) return { valid: false, direction: 'NONE', reason: '15m invalid SL calculation', score: 0 };

    return { valid: true, direction: 'SHORT', reason: `15m SHORT setup: pullback retake, vol=${hasVolume}, RSI=${lastRsi.toFixed(1)}`, score, entryPrice: price, stopLoss: sl };
  }
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
    const riskSettings = settings.risk || {};
    const timingSettings = settings.timing || {};
    const minScore = strategySettings.min_score_approved ?? 75;
    const eliteScore = strategySettings.min_score_elite ?? 88;
    const expiryCandles = timingSettings.signal_expiry_candles_15m ?? 16;
    const cooldownMinutes = timingSettings.cooldown_minutes ?? 60;
    const minRR = riskSettings.min_rr_ratio ?? 2.0;

    // Load active watchlist
    const { data: pairs } = await supabase.from('watchlist_pairs').select('symbol').eq('is_active', true).order('priority');
    const symbols = (pairs || []).map((p: any) => p.symbol);

    // Create analysis run
    const { data: runData } = await supabase.from('analysis_runs').insert({ status: 'RUNNING' }).select().single();
    const runId = runData!.id;

    let processed = 0, rejected = 0, approved = 0, blocked = 0, errorsCount = 0;

    for (const symbol of symbols) {
      try {
        processed++;

        // Step 1: Reconcile active signals
        const { data: activeSignals } = await supabase.from('signals').select('*').eq('symbol', symbol).eq('status', 'ACTIVE');
        
        if (activeSignals && activeSignals.length > 0) {
          // Reconcile each active signal
          for (const sig of activeSignals) {
            const { data: recentCandles } = await supabase
              .from('market_candles')
              .select('*')
              .eq('symbol', symbol)
              .eq('timeframe', '15m')
              .eq('is_closed', true)
              .gt('open_time', new Date(sig.entry_time).getTime())
              .order('open_time', { ascending: true });

            let newStatus: string | null = null;
            let resolutionPrice: number | null = null;
            let resolutionReason: string | null = null;

            // Check expiry
            if (new Date() > new Date(sig.expiry_time)) {
              newStatus = 'EXPIRED';
              resolutionReason = 'Signal expired without hitting TP or SL';
            }

            // Check TP/SL
            if (!newStatus && recentCandles) {
              for (const candle of recentCandles) {
                if (sig.direction === 'LONG') {
                  if (candle.low <= sig.stop_loss) {
                    if (candle.high >= sig.take_profit_final) {
                      newStatus = 'AMBIGUOUS';
                      resolutionPrice = sig.stop_loss;
                      resolutionReason = 'Both SL and TP touched in same candle - conservatively marked as SL';
                    } else {
                      newStatus = 'STOP_LOSS_HIT';
                      resolutionPrice = sig.stop_loss;
                      resolutionReason = 'Stop loss hit';
                    }
                    break;
                  }
                  if (candle.high >= sig.take_profit_final) {
                    newStatus = 'TAKE_PROFIT_HIT';
                    resolutionPrice = sig.take_profit_final;
                    resolutionReason = 'Take profit hit';
                    break;
                  }
                } else {
                  if (candle.high >= sig.stop_loss) {
                    if (candle.low <= sig.take_profit_final) {
                      newStatus = 'AMBIGUOUS';
                      resolutionPrice = sig.stop_loss;
                      resolutionReason = 'Both SL and TP touched in same candle - conservatively marked as SL';
                    } else {
                      newStatus = 'STOP_LOSS_HIT';
                      resolutionPrice = sig.stop_loss;
                      resolutionReason = 'Stop loss hit';
                    }
                    break;
                  }
                  if (candle.low <= sig.take_profit_final) {
                    newStatus = 'TAKE_PROFIT_HIT';
                    resolutionPrice = sig.take_profit_final;
                    resolutionReason = 'Take profit hit';
                    break;
                  }
                }
              }

              // Track MFE/MAE
              if (recentCandles.length > 0) {
                const highs = recentCandles.map((c: any) => c.high);
                const lows = recentCandles.map((c: any) => c.low);
                const mfe = sig.direction === 'LONG'
                  ? Math.max(...highs) - sig.entry_price
                  : sig.entry_price - Math.min(...lows);
                const mae = sig.direction === 'LONG'
                  ? sig.entry_price - Math.min(...lows)
                  : Math.max(...highs) - sig.entry_price;
                await supabase.from('signals').update({ mfe, mae }).eq('id', sig.id);
              }
            }

            if (newStatus) {
              await supabase.from('signals').update({
                status: newStatus,
                closed_time: new Date().toISOString(),
                close_reason: resolutionReason,
                close_price: resolutionPrice,
              }).eq('id', sig.id);

              await supabase.from('signal_reconciliation_log').insert({
                signal_id: sig.id,
                previous_status: 'ACTIVE',
                new_status: newStatus,
                resolution_reason: resolutionReason,
                resolution_price: resolutionPrice,
              });
            }
          }

          // Re-check if still has active signal after reconciliation
          const { data: stillActive } = await supabase.from('signals').select('id').eq('symbol', symbol).eq('status', 'ACTIVE');
          if (stillActive && stillActive.length > 0) {
            blocked++;
            await supabase.from('pair_analysis_log').insert({
              analysis_run_id: runId,
              symbol,
              blocked_reason: 'Active signal exists - pair blocked',
            });
            continue;
          }
        }

        // Check cooldown
        const { data: recentClosed } = await supabase
          .from('signals')
          .select('closed_time, status')
          .eq('symbol', symbol)
          .in('status', ['STOP_LOSS_HIT', 'INVALIDATED'])
          .order('closed_time', { ascending: false })
          .limit(1);

        if (recentClosed && recentClosed.length > 0 && recentClosed[0].closed_time) {
          const cooldownEnd = new Date(recentClosed[0].closed_time).getTime() + cooldownMinutes * 60000;
          if (Date.now() < cooldownEnd) {
            rejected++;
            await supabase.from('pair_analysis_log').insert({
              analysis_run_id: runId,
              symbol,
              rejected_reason: `Cooldown active until ${new Date(cooldownEnd).toISOString()}`,
            });
            continue;
          }
        }

        // Load candles
        const loadCandles = async (tf: string, limit: number) => {
          const { data } = await supabase
            .from('market_candles')
            .select('*')
            .eq('symbol', symbol)
            .eq('timeframe', tf)
            .eq('is_closed', true)
            .order('open_time', { ascending: true })
            .limit(limit);
          return data || [];
        };

        const [candles4h, candles1h, candles15m] = await Promise.all([
          loadCandles('4h', 250),
          loadCandles('1h', 100),
          loadCandles('15m', 200),
        ]);

        // Analyze regime 4H
        const regime = analyzeRegime4H(candles4h, settings);
        if (!regime.valid || regime.direction === 'NONE') {
          rejected++;
          await supabase.from('pair_analysis_log').insert({
            analysis_run_id: runId, symbol,
            regime_4h: regime.reason,
            rejected_reason: regime.reason,
            score: 0,
          });
          continue;
        }

        // Analyze alignment 1H
        const alignment = analyzeAlignment1H(candles1h, regime.direction, settings);
        if (!alignment.valid) {
          rejected++;
          await supabase.from('pair_analysis_log').insert({
            analysis_run_id: runId, symbol,
            regime_4h: regime.reason,
            alignment_1h: alignment.reason,
            rejected_reason: alignment.reason,
            score: regime.score,
          });
          continue;
        }

        // Analyze setup 15m
        const setup = analyzeSetup15m(candles15m, regime.direction, settings);
        if (!setup.valid || !setup.entryPrice || !setup.stopLoss) {
          rejected++;
          await supabase.from('pair_analysis_log').insert({
            analysis_run_id: runId, symbol,
            regime_4h: regime.reason,
            alignment_1h: alignment.reason,
            setup_15m: setup.reason,
            rejected_reason: setup.reason,
            score: regime.score + alignment.score,
          });
          continue;
        }

        // Quality score (block 4)
        const atrOk = 5;
        const slOk = 5;
        const risk = Math.abs(setup.entryPrice - setup.stopLoss);
        const tp1 = regime.direction === 'LONG' ? setup.entryPrice + 1.5 * risk : setup.entryPrice - 1.5 * risk;
        const tp2 = regime.direction === 'LONG' ? setup.entryPrice + 2.5 * risk : setup.entryPrice - 2.5 * risk;
        const rrRatio = 2.5;
        const rrOk = rrRatio >= minRR ? 5 : 0;

        const totalScore = Math.round(regime.score + alignment.score + setup.score + atrOk + slOk + rrOk);
        const classification = totalScore >= eliteScore ? 'ELITE' : totalScore >= minScore ? 'APPROVED' : 'REJECTED';

        if (classification === 'REJECTED') {
          rejected++;
          await supabase.from('pair_analysis_log').insert({
            analysis_run_id: runId, symbol,
            regime_4h: regime.reason,
            alignment_1h: alignment.reason,
            setup_15m: setup.reason,
            score: totalScore,
            classification: 'REJECTED',
            rejected_reason: `Score ${totalScore} below threshold ${minScore}`,
          });
          continue;
        }

        // Build justification
        const justification = `${regime.reason}. ${alignment.reason}. ${setup.reason}. Score: ${totalScore}/100 (${classification}).`;

        const expiryTime = new Date(Date.now() + expiryCandles * 15 * 60000).toISOString();
        const riskPct = classification === 'ELITE' ? (riskSettings.elite_risk_pct ?? 1.0) : (riskSettings.approved_risk_pct_max ?? 0.75);

        // Persist signal
        const { error: sigError } = await supabase.from('signals').insert({
          symbol,
          direction: regime.direction,
          entry_time: new Date().toISOString(),
          entry_price: setup.entryPrice,
          stop_loss: setup.stopLoss,
          take_profit_1: tp1,
          take_profit_2: tp2,
          take_profit_final: tp2,
          rr_ratio: rrRatio,
          score: totalScore,
          classification,
          status: 'ACTIVE',
          expiry_time: expiryTime,
          strategy_version: 'crypto_intraday_v1',
          justification,
          score_details: {
            regime_4h: regime.score,
            alignment_1h: alignment.score,
            setup_15m: setup.score,
            atr_quality: atrOk,
            sl_quality: slOk,
            rr_quality: rrOk,
          },
        });

        if (sigError) {
          errorsCount++;
          await supabase.from('pair_analysis_log').insert({
            analysis_run_id: runId, symbol,
            regime_4h: regime.reason,
            alignment_1h: alignment.reason,
            setup_15m: setup.reason,
            score: totalScore,
            classification,
            rejected_reason: `Persistence error: ${sigError.message}`,
          });
        } else {
          approved++;
          await supabase.from('pair_analysis_log').insert({
            analysis_run_id: runId, symbol,
            regime_4h: regime.reason,
            alignment_1h: alignment.reason,
            setup_15m: setup.reason,
            score: totalScore,
            classification,
            approved_reason: justification,
          });
        }
      } catch (e: any) {
        errorsCount++;
        await supabase.from('pair_analysis_log').insert({
          analysis_run_id: runId, symbol,
          rejected_reason: `Error: ${e.message}`,
        });
      }
    }

    // Finalize run
    await supabase.from('analysis_runs').update({
      finished_at: new Date().toISOString(),
      status: errorsCount > 0 ? 'FAILED' : 'COMPLETED',
      pairs_processed: processed,
      pairs_rejected: rejected,
      pairs_approved: approved,
      pairs_blocked: blocked,
      errors_count: errorsCount,
      summary_json: { processed, rejected, approved, blocked, errors: errorsCount },
    }).eq('id', runId);

    // Audit log
    await supabase.from('audit_log').insert({
      event_type: 'analysis_run_completed',
      severity: errorsCount > 0 ? 'warning' : 'info',
      source: 'run-analysis',
      message: `Analysis completed: ${approved} approved, ${rejected} rejected, ${blocked} blocked, ${errorsCount} errors`,
      details_json: { runId, processed, rejected, approved, blocked, errors: errorsCount },
    });

    return new Response(JSON.stringify({
      success: true,
      runId,
      processed, rejected, approved, blocked, errors: errorsCount,
    }), { headers: { ...corsHeaders, 'Content-Type': 'application/json' } });

  } catch (e: any) {
    return new Response(JSON.stringify({ error: e.message }), {
      status: 500,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }
});

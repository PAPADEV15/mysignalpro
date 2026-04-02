export interface Candle {
  open: number;
  high: number;
  low: number;
  close: number;
  volume: number;
  openTime: number;
}

export function calcEMA(closes: number[], period: number): number[] {
  if (closes.length < period) return [];
  const k = 2 / (period + 1);
  const result: number[] = [];
  let ema = closes.slice(0, period).reduce((a, b) => a + b, 0) / period;
  for (let i = 0; i < period; i++) result.push(NaN);
  result[period - 1] = ema;
  for (let i = period; i < closes.length; i++) {
    ema = closes[i] * k + ema * (1 - k);
    result.push(ema);
  }
  return result;
}

export function calcSMA(closes: number[], period: number): number[] {
  if (closes.length < period) return [];
  const result: number[] = [];
  for (let i = 0; i < period - 1; i++) result.push(NaN);
  for (let i = period - 1; i < closes.length; i++) {
    const sum = closes.slice(i - period + 1, i + 1).reduce((a, b) => a + b, 0);
    result.push(sum / period);
  }
  return result;
}

export function calcRSI(closes: number[], period: number = 14): number[] {
  if (closes.length < period + 1) return [];
  const result: number[] = [];
  const changes = closes.slice(1).map((c, i) => c - closes[i]);

  let avgGain = 0, avgLoss = 0;
  for (let i = 0; i < period; i++) {
    if (changes[i] > 0) avgGain += changes[i];
    else avgLoss += Math.abs(changes[i]);
  }
  avgGain /= period;
  avgLoss /= period;

  for (let i = 0; i < period; i++) result.push(NaN);
  const rs = avgLoss === 0 ? 100 : avgGain / avgLoss;
  result.push(avgLoss === 0 ? 100 : 100 - 100 / (1 + rs));

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

export function calcATR(candles: Candle[], period: number = 14): number[] {
  if (candles.length < period + 1) return [];
  const trs: number[] = [candles[0].high - candles[0].low];
  for (let i = 1; i < candles.length; i++) {
    const c = candles[i];
    const prevClose = candles[i - 1].close;
    trs.push(Math.max(c.high - c.low, Math.abs(c.high - prevClose), Math.abs(c.low - prevClose)));
  }
  const result: number[] = [];
  for (let i = 0; i < period - 1; i++) result.push(NaN);
  let atr = trs.slice(0, period).reduce((a, b) => a + b, 0) / period;
  result.push(atr);
  for (let i = period; i < trs.length; i++) {
    atr = (atr * (period - 1) + trs[i]) / period;
    result.push(atr);
  }
  return result;
}

export function calcVWAP(candles: Candle[]): number[] {
  let cumVol = 0, cumTP = 0;
  return candles.map(c => {
    const tp = (c.high + c.low + c.close) / 3;
    cumVol += c.volume;
    cumTP += tp * c.volume;
    return cumVol === 0 ? tp : cumTP / cumVol;
  });
}

export function calcAvgVolume(volumes: number[], period: number): number[] {
  const result: number[] = [];
  for (let i = 0; i < volumes.length; i++) {
    if (i < period - 1) { result.push(NaN); continue; }
    const avg = volumes.slice(i - period + 1, i + 1).reduce((a, b) => a + b, 0) / period;
    result.push(avg);
  }
  return result;
}

export interface IndicatorSet {
  ema9?: number;
  ema20?: number;
  ema21?: number;
  ema50?: number;
  sma200?: number;
  rsi14?: number;
  atr14?: number;
  vwap?: number;
  avgVolume20?: number;
}

export function computeIndicators(candles: Candle[], timeframe: '4h' | '1h' | '15m'): IndicatorSet {
  const closes = candles.map(c => c.close);
  const volumes = candles.map(c => c.volume);
  const last = (arr: number[]) => arr.length > 0 ? arr[arr.length - 1] : undefined;

  const result: IndicatorSet = {};

  if (timeframe === '4h') {
    result.ema20 = last(calcEMA(closes, 20));
    result.ema50 = last(calcEMA(closes, 50));
    result.sma200 = last(calcSMA(closes, 200));
    result.rsi14 = last(calcRSI(closes));
    result.atr14 = last(calcATR(candles));
  } else if (timeframe === '1h') {
    result.ema20 = last(calcEMA(closes, 20));
    result.ema50 = last(calcEMA(closes, 50));
    result.rsi14 = last(calcRSI(closes));
    result.atr14 = last(calcATR(candles));
  } else {
    result.ema9 = last(calcEMA(closes, 9));
    result.ema21 = last(calcEMA(closes, 21));
    result.rsi14 = last(calcRSI(closes));
    result.atr14 = last(calcATR(candles));
    result.vwap = last(calcVWAP(candles));
    result.avgVolume20 = last(calcAvgVolume(volumes, 20));
  }

  return result;
}

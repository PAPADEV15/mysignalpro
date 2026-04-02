import { useState, useEffect, useRef, useCallback } from 'react';
import { fetchTicker24h } from '@/lib/binance';

export interface TickerData {
  symbol: string;
  price: number;
  priceChangePercent: number;
}

export function useBinanceTickers(symbols: string[]) {
  const [tickers, setTickers] = useState<Record<string, TickerData>>({});
  const [loading, setLoading] = useState(true);
  const intervalRef = useRef<ReturnType<typeof setInterval>>();

  const fetchAll = useCallback(async () => {
    try {
      const results = await Promise.allSettled(
        symbols.map(s => fetchTicker24h(s))
      );
      const newTickers: Record<string, TickerData> = {};
      results.forEach((r, i) => {
        if (r.status === 'fulfilled') {
          newTickers[symbols[i]] = {
            symbol: symbols[i],
            price: parseFloat(r.value.lastPrice),
            priceChangePercent: parseFloat(r.value.priceChangePercent),
          };
        }
      });
      setTickers(prev => ({ ...prev, ...newTickers }));
    } catch (e) {
      console.error('Ticker fetch error:', e);
    } finally {
      setLoading(false);
    }
  }, [symbols]);

  useEffect(() => {
    if (symbols.length === 0) return;
    fetchAll();
    intervalRef.current = setInterval(fetchAll, 5000);
    return () => { if (intervalRef.current) clearInterval(intervalRef.current); };
  }, [fetchAll, symbols]);

  return { tickers, loading };
}

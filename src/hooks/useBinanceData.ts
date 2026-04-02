import { useState, useEffect, useRef, useCallback, useMemo } from 'react';
import { fetchTicker24h } from '@/lib/binance';

export interface TickerData {
  symbol: string;
  price: number;
  priceChangePercent: number;
}

export function useBinanceTickers(symbols: string[]) {
  const [tickers, setTickers] = useState<Record<string, TickerData>>({});
  const [loading, setLoading] = useState(true);
  const [wsConnected, setWsConnected] = useState(false);
  const wsRef = useRef<WebSocket | null>(null);
  const reconnectRef = useRef<ReturnType<typeof setTimeout>>();

  // Stable key for symbols array
  const symbolsKey = useMemo(() => [...symbols].sort().join(','), [symbols]);

  // Initial REST fetch for 24h data
  const fetchAll = useCallback(async () => {
    if (symbols.length === 0) return;
    try {
      const results = await Promise.allSettled(symbols.map(s => fetchTicker24h(s)));
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
  }, [symbolsKey]);

  // WebSocket for real-time updates
  const connectWs = useCallback(() => {
    if (symbols.length === 0) return;

    // Close existing connection
    if (wsRef.current) {
      wsRef.current.close();
      wsRef.current = null;
    }

    // Combined stream: miniTicker for all symbols
    const streams = symbols.map(s => `${s.toLowerCase()}@miniTicker`).join('/');
    const ws = new WebSocket(`wss://stream.binance.com:9443/stream?streams=${streams}`);

    ws.onopen = () => {
      setWsConnected(true);
      console.log('[WS] Binance ticker stream connected');
    };

    ws.onmessage = (event) => {
      try {
        const msg = JSON.parse(event.data);
        const data = msg.data;
        if (data && data.s) {
          setTickers(prev => ({
            ...prev,
            [data.s]: {
              symbol: data.s,
              price: parseFloat(data.c), // close price
              priceChangePercent: prev[data.s]?.priceChangePercent ?? 0,
            },
          }));
        }
      } catch {}
    };

    ws.onclose = () => {
      setWsConnected(false);
      console.log('[WS] Disconnected, reconnecting in 3s...');
      reconnectRef.current = setTimeout(connectWs, 3000);
    };

    ws.onerror = (e) => {
      console.error('[WS] Error:', e);
      ws.close();
    };

    wsRef.current = ws;
  }, [symbolsKey]);

  useEffect(() => {
    fetchAll();
    connectWs();

    // Refresh 24h % every 60s via REST (WS miniTicker doesn't include it reliably)
    const interval = setInterval(fetchAll, 60000);

    return () => {
      clearInterval(interval);
      if (reconnectRef.current) clearTimeout(reconnectRef.current);
      if (wsRef.current) {
        wsRef.current.close();
        wsRef.current = null;
      }
    };
  }, [fetchAll, connectWs]);

  return { tickers, loading, wsConnected };
}

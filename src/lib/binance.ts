const BINANCE_BASE = 'https://api.binance.com/api/v3';

export interface BinanceKline {
  openTime: number;
  open: string;
  high: string;
  low: string;
  close: string;
  volume: string;
  closeTime: number;
}

export async function fetchKlines(
  symbol: string,
  interval: '15m' | '1h' | '4h',
  limit: number = 500
): Promise<BinanceKline[]> {
  const url = `${BINANCE_BASE}/klines?symbol=${symbol}&interval=${interval}&limit=${limit}`;
  const res = await fetch(url);
  if (!res.ok) throw new Error(`Binance API error: ${res.status}`);
  const data = await res.json();
  return data.map((k: any[]) => ({
    openTime: k[0],
    open: k[1],
    high: k[2],
    low: k[3],
    close: k[4],
    volume: k[5],
    closeTime: k[6],
  }));
}

export async function fetchTickerPrice(symbol: string): Promise<{ symbol: string; price: string }> {
  const res = await fetch(`${BINANCE_BASE}/ticker/price?symbol=${symbol}`);
  if (!res.ok) throw new Error(`Binance ticker error: ${res.status}`);
  return res.json();
}

export async function fetchTicker24h(symbol: string): Promise<{ symbol: string; priceChangePercent: string; lastPrice: string }> {
  const res = await fetch(`${BINANCE_BASE}/ticker/24hr?symbol=${symbol}`);
  if (!res.ok) throw new Error(`Binance 24h ticker error: ${res.status}`);
  return res.json();
}

export function createKlineWebSocket(
  symbol: string,
  interval: '15m' | '1h' | '4h',
  onMessage: (kline: BinanceKline & { isClosed: boolean }) => void
): WebSocket {
  const ws = new WebSocket(`wss://stream.binance.com:9443/ws/${symbol.toLowerCase()}@kline_${interval}`);
  ws.onmessage = (event) => {
    const data = JSON.parse(event.data);
    const k = data.k;
    onMessage({
      openTime: k.t,
      open: k.o,
      high: k.h,
      low: k.l,
      close: k.c,
      volume: k.v,
      closeTime: k.T,
      isClosed: k.x,
    });
  };
  return ws;
}

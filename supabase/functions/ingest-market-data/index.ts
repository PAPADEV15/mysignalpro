import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { createClient } from "jsr:@supabase/supabase-js@2";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

const BINANCE_BASE = 'https://api.binance.com/api/v3';
const TIMEFRAMES = ['15m', '1h', '4h'] as const;
const LIMITS: Record<string, number> = { '15m': 200, '1h': 200, '4h': 500 };

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: corsHeaders });

  try {
    const supabase = createClient(
      Deno.env.get('SUPABASE_URL')!,
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!
    );

    const body = await req.json().catch(() => ({}));
    const symbols: string[] = body.symbols || [];

    // If no symbols provided, fetch from watchlist
    let activeSymbols = symbols;
    if (activeSymbols.length === 0) {
      const { data: pairs } = await supabase.from('watchlist_pairs').select('symbol').eq('is_active', true);
      activeSymbols = (pairs || []).map((p: any) => p.symbol);
    }

    if (activeSymbols.length === 0) {
      return new Response(JSON.stringify({ success: true, message: 'No active symbols' }), {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    const results: any[] = [];
    const errors: any[] = [];

    for (const symbol of activeSymbols) {
      for (const tf of TIMEFRAMES) {
        try {
          const limit = LIMITS[tf];
          const url = `${BINANCE_BASE}/klines?symbol=${symbol}&interval=${tf}&limit=${limit}`;
          const res = await fetch(url);
          if (!res.ok) {
            errors.push({ symbol, tf, error: `HTTP ${res.status}` });
            continue;
          }
          const klines = await res.json();

          const candles = klines.map((k: any[]) => ({
            symbol,
            timeframe: tf,
            open_time: k[0],
            open: parseFloat(k[1]),
            high: parseFloat(k[2]),
            low: parseFloat(k[3]),
            close: parseFloat(k[4]),
            volume: parseFloat(k[5]),
            close_time: k[6],
            is_closed: true,
            source: 'binance_spot',
          }));

          // Mark last candle as not closed (still forming)
          if (candles.length > 0) {
            candles[candles.length - 1].is_closed = false;
          }

          // Upsert candles
          const { error: upsertError } = await supabase
            .from('market_candles')
            .upsert(candles, { onConflict: 'symbol,timeframe,open_time' });

          if (upsertError) {
            errors.push({ symbol, tf, error: upsertError.message });
          } else {
            results.push({ symbol, tf, count: candles.length });
          }
        } catch (e: any) {
          errors.push({ symbol, tf, error: e.message });
        }
      }
    }

    // Log audit
    await supabase.from('audit_log').insert({
      event_type: 'market_data_ingestion',
      severity: errors.length > 0 ? 'warning' : 'info',
      source: 'ingest-market-data',
      message: `Ingested data for ${results.length} symbol-timeframe pairs. ${errors.length} errors.`,
      details_json: { results, errors },
    });

    return new Response(JSON.stringify({
      success: true,
      ingested: results.length,
      errors: errors.length,
      details: { results, errors },
    }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  } catch (e: any) {
    return new Response(JSON.stringify({ error: e.message }), {
      status: 500,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }
});

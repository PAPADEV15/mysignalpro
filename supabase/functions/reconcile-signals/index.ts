import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { createClient } from "jsr:@supabase/supabase-js@2";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: corsHeaders });

  try {
    const supabase = createClient(
      Deno.env.get('SUPABASE_URL')!,
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!
    );

    // Load settings for ambiguous resolution
    const { data: settingsRows } = await supabase.from('app_settings').select('key, value_json').eq('key', 'reconciliation');
    const reconciliationSettings = settingsRows?.[0]?.value_json as any || {};
    const ambiguousDefault = reconciliationSettings.ambiguous_default || 'STOP_LOSS_HIT';

    // Get all ACTIVE signals
    const { data: activeSignals, error } = await supabase
      .from('signals')
      .select('*')
      .eq('status', 'ACTIVE');

    if (error) throw error;
    if (!activeSignals || activeSignals.length === 0) {
      return new Response(JSON.stringify({ success: true, reconciled: 0, message: 'No active signals' }), {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    let reconciled = 0;
    const details: any[] = [];

    for (const sig of activeSignals) {
      // Get candles since entry
      const { data: candles } = await supabase
        .from('market_candles')
        .select('*')
        .eq('symbol', sig.symbol)
        .eq('timeframe', '15m')
        .eq('is_closed', true)
        .gt('open_time', new Date(sig.entry_time).getTime())
        .order('open_time', { ascending: true });

      let newStatus: string | null = null;
      let resolutionPrice: number | null = null;
      let resolutionReason: string | null = null;
      let resolutionCandleTime: number | null = null;

      // Check expiry first
      if (new Date() > new Date(sig.expiry_time)) {
        newStatus = 'EXPIRED';
        resolutionReason = 'Signal expired without TP/SL hit';
      }

      // Check TP/SL
      if (!newStatus && candles) {
        for (const candle of candles) {
          const isLong = sig.direction === 'LONG';
          const hitSL = isLong ? candle.low <= sig.stop_loss : candle.high >= sig.stop_loss;
          const hitTP = isLong ? candle.high >= sig.take_profit_final : candle.low <= sig.take_profit_final;

          if (hitSL && hitTP) {
            // Ambiguous - use conservative default
            newStatus = ambiguousDefault;
            resolutionPrice = sig.stop_loss;
            resolutionReason = `Ambiguous: both SL and TP hit in candle ${candle.open_time}. Resolved as ${ambiguousDefault} (conservative)`;
            resolutionCandleTime = candle.open_time;
            break;
          }
          if (hitSL) {
            newStatus = 'STOP_LOSS_HIT';
            resolutionPrice = sig.stop_loss;
            resolutionReason = 'Stop loss hit';
            resolutionCandleTime = candle.open_time;
            break;
          }
          if (hitTP) {
            newStatus = 'TAKE_PROFIT_HIT';
            resolutionPrice = sig.take_profit_final;
            resolutionReason = 'Take profit hit';
            resolutionCandleTime = candle.open_time;
            break;
          }
        }

        // Update MFE/MAE
        if (candles.length > 0) {
          const highs = candles.map((c: any) => c.high);
          const lows = candles.map((c: any) => c.low);
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
          resolution_candle_time: resolutionCandleTime,
        });

        reconciled++;
        details.push({ signal_id: sig.id, symbol: sig.symbol, new_status: newStatus, reason: resolutionReason });
      }
    }

    if (reconciled > 0) {
      await supabase.from('audit_log').insert({
        event_type: 'signal_reconciliation',
        severity: 'info',
        source: 'reconcile-signals',
        message: `Reconciled ${reconciled} signals`,
        details_json: { reconciled, details },
      });
    }

    return new Response(JSON.stringify({ success: true, reconciled, details }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  } catch (e: any) {
    return new Response(JSON.stringify({ error: e.message }), {
      status: 500,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }
});

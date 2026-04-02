import { supabase } from '@/integrations/supabase/client';

export async function invokeIngestMarketData() {
  const { data, error } = await supabase.functions.invoke('ingest-market-data', { body: {} });
  if (error) throw error;
  return data;
}

export async function invokeRunAnalysis() {
  const { data, error } = await supabase.functions.invoke('run-analysis', { body: {} });
  if (error) throw error;
  return data;
}

export async function invokeReconcileSignals() {
  const { data, error } = await supabase.functions.invoke('reconcile-signals', { body: {} });
  if (error) throw error;
  return data;
}

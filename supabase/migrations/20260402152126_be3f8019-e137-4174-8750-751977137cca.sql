
-- Create enums
CREATE TYPE public.app_role AS ENUM ('admin', 'analyst', 'viewer');
CREATE TYPE public.signal_status AS ENUM ('ACTIVE', 'TAKE_PROFIT_HIT', 'STOP_LOSS_HIT', 'EXPIRED', 'INVALIDATED', 'AMBIGUOUS');
CREATE TYPE public.signal_direction AS ENUM ('LONG', 'SHORT');
CREATE TYPE public.signal_classification AS ENUM ('REJECTED', 'APPROVED', 'ELITE');
CREATE TYPE public.analysis_run_status AS ENUM ('RUNNING', 'COMPLETED', 'FAILED');

-- Timestamp trigger function
CREATE OR REPLACE FUNCTION public.update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SET search_path = public;

-- 1. User Roles table (MUST be created before role-checking functions)
CREATE TABLE public.user_roles (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE NOT NULL,
  role app_role NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (user_id, role)
);
ALTER TABLE public.user_roles ENABLE ROW LEVEL SECURITY;

-- Now create role-checking functions
CREATE OR REPLACE FUNCTION public.has_role(_user_id uuid, _role app_role)
RETURNS boolean
LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public
AS $$
  SELECT EXISTS (SELECT 1 FROM public.user_roles WHERE user_id = _user_id AND role = _role)
$$;

CREATE OR REPLACE FUNCTION public.has_any_role(_user_id uuid, _roles app_role[])
RETURNS boolean
LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public
AS $$
  SELECT EXISTS (SELECT 1 FROM public.user_roles WHERE user_id = _user_id AND role = ANY(_roles))
$$;

-- RLS for user_roles
CREATE POLICY "Admins can manage all roles" ON public.user_roles FOR ALL TO authenticated
  USING (public.has_role(auth.uid(), 'admin')) WITH CHECK (public.has_role(auth.uid(), 'admin'));
CREATE POLICY "Users can view own roles" ON public.user_roles FOR SELECT TO authenticated
  USING (auth.uid() = user_id);

-- 2. Watchlist Pairs
CREATE TABLE public.watchlist_pairs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  symbol TEXT NOT NULL UNIQUE,
  is_active BOOLEAN NOT NULL DEFAULT true,
  priority INTEGER NOT NULL DEFAULT 0,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
ALTER TABLE public.watchlist_pairs ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Auth users can view watchlist" ON public.watchlist_pairs FOR SELECT TO authenticated USING (true);
CREATE POLICY "Admins can manage watchlist" ON public.watchlist_pairs FOR ALL TO authenticated
  USING (public.has_role(auth.uid(), 'admin')) WITH CHECK (public.has_role(auth.uid(), 'admin'));
CREATE TRIGGER update_watchlist_pairs_updated_at BEFORE UPDATE ON public.watchlist_pairs
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- 3. Market Candles
CREATE TABLE public.market_candles (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  symbol TEXT NOT NULL,
  timeframe TEXT NOT NULL CHECK (timeframe IN ('15m', '1h', '4h')),
  open_time BIGINT NOT NULL,
  open NUMERIC NOT NULL, high NUMERIC NOT NULL, low NUMERIC NOT NULL, close NUMERIC NOT NULL,
  volume NUMERIC NOT NULL, close_time BIGINT NOT NULL,
  is_closed BOOLEAN NOT NULL DEFAULT false,
  source TEXT NOT NULL DEFAULT 'binance_spot',
  inserted_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
ALTER TABLE public.market_candles ENABLE ROW LEVEL SECURITY;
CREATE UNIQUE INDEX idx_candles_unique ON public.market_candles (symbol, timeframe, open_time);
CREATE INDEX idx_candles_lookup ON public.market_candles (symbol, timeframe, open_time DESC);
CREATE POLICY "Auth users can view candles" ON public.market_candles FOR SELECT TO authenticated USING (true);
CREATE POLICY "Service can manage candles" ON public.market_candles FOR ALL TO service_role USING (true) WITH CHECK (true);

-- 4. Indicators Snapshot
CREATE TABLE public.indicators_snapshot (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  symbol TEXT NOT NULL,
  timeframe TEXT NOT NULL CHECK (timeframe IN ('15m', '1h', '4h')),
  candle_open_time BIGINT NOT NULL,
  ema_9 NUMERIC, ema_20 NUMERIC, ema_21 NUMERIC, ema_50 NUMERIC, sma_200 NUMERIC,
  rsi_14 NUMERIC, atr_14 NUMERIC, vwap NUMERIC, avg_volume_20 NUMERIC,
  inserted_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
ALTER TABLE public.indicators_snapshot ENABLE ROW LEVEL SECURITY;
CREATE UNIQUE INDEX idx_indicators_unique ON public.indicators_snapshot (symbol, timeframe, candle_open_time);
CREATE INDEX idx_indicators_lookup ON public.indicators_snapshot (symbol, timeframe, candle_open_time DESC);
CREATE POLICY "Auth users can view indicators" ON public.indicators_snapshot FOR SELECT TO authenticated USING (true);
CREATE POLICY "Service can manage indicators" ON public.indicators_snapshot FOR ALL TO service_role USING (true) WITH CHECK (true);

-- 5. Signals
CREATE TABLE public.signals (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  symbol TEXT NOT NULL,
  direction signal_direction NOT NULL,
  entry_time TIMESTAMPTZ NOT NULL,
  entry_price NUMERIC NOT NULL,
  stop_loss NUMERIC NOT NULL,
  take_profit_1 NUMERIC NOT NULL,
  take_profit_2 NUMERIC NOT NULL,
  take_profit_final NUMERIC NOT NULL,
  rr_ratio NUMERIC NOT NULL,
  score INTEGER NOT NULL CHECK (score >= 0 AND score <= 100),
  classification signal_classification NOT NULL,
  status signal_status NOT NULL DEFAULT 'ACTIVE',
  expiry_time TIMESTAMPTZ NOT NULL,
  closed_time TIMESTAMPTZ,
  close_reason TEXT,
  close_price NUMERIC,
  mfe NUMERIC, mae NUMERIC,
  invalidation_reason TEXT,
  strategy_version TEXT NOT NULL DEFAULT 'crypto_intraday_v1',
  score_details JSONB,
  justification TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
ALTER TABLE public.signals ENABLE ROW LEVEL SECURITY;
CREATE INDEX idx_signals_symbol_status ON public.signals (symbol, status);
CREATE INDEX idx_signals_status ON public.signals (status);
CREATE INDEX idx_signals_created ON public.signals (created_at DESC);
CREATE POLICY "Auth users can view signals" ON public.signals FOR SELECT TO authenticated USING (true);
CREATE POLICY "Service can manage signals" ON public.signals FOR ALL TO service_role USING (true) WITH CHECK (true);
CREATE TRIGGER update_signals_updated_at BEFORE UPDATE ON public.signals
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- 6. Signal Reconciliation Log
CREATE TABLE public.signal_reconciliation_log (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  signal_id UUID NOT NULL REFERENCES public.signals(id) ON DELETE CASCADE,
  previous_status signal_status NOT NULL,
  new_status signal_status NOT NULL,
  checked_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  resolution_reason TEXT,
  resolution_price NUMERIC,
  resolution_candle_time BIGINT,
  notes TEXT
);
ALTER TABLE public.signal_reconciliation_log ENABLE ROW LEVEL SECURITY;
CREATE INDEX idx_reconciliation_signal ON public.signal_reconciliation_log (signal_id);
CREATE POLICY "Auth users can view reconciliation" ON public.signal_reconciliation_log FOR SELECT TO authenticated USING (true);
CREATE POLICY "Service can manage reconciliation" ON public.signal_reconciliation_log FOR ALL TO service_role USING (true) WITH CHECK (true);

-- 7. Analysis Runs
CREATE TABLE public.analysis_runs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  started_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  finished_at TIMESTAMPTZ,
  status analysis_run_status NOT NULL DEFAULT 'RUNNING',
  pairs_processed INTEGER NOT NULL DEFAULT 0,
  pairs_rejected INTEGER NOT NULL DEFAULT 0,
  pairs_approved INTEGER NOT NULL DEFAULT 0,
  pairs_blocked INTEGER NOT NULL DEFAULT 0,
  errors_count INTEGER NOT NULL DEFAULT 0,
  summary_json JSONB
);
ALTER TABLE public.analysis_runs ENABLE ROW LEVEL SECURITY;
CREATE INDEX idx_analysis_runs_started ON public.analysis_runs (started_at DESC);
CREATE POLICY "Auth users can view runs" ON public.analysis_runs FOR SELECT TO authenticated USING (true);
CREATE POLICY "Service can manage runs" ON public.analysis_runs FOR ALL TO service_role USING (true) WITH CHECK (true);

-- 8. Pair Analysis Log
CREATE TABLE public.pair_analysis_log (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  analysis_run_id UUID NOT NULL REFERENCES public.analysis_runs(id) ON DELETE CASCADE,
  symbol TEXT NOT NULL,
  regime_4h TEXT, alignment_1h TEXT, setup_15m TEXT,
  score INTEGER, classification signal_classification,
  blocked_reason TEXT, rejected_reason TEXT, approved_reason TEXT,
  raw_details_json JSONB,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
ALTER TABLE public.pair_analysis_log ENABLE ROW LEVEL SECURITY;
CREATE INDEX idx_pair_analysis_run ON public.pair_analysis_log (analysis_run_id);
CREATE INDEX idx_pair_analysis_symbol ON public.pair_analysis_log (symbol, created_at DESC);
CREATE POLICY "Auth users can view pair analysis" ON public.pair_analysis_log FOR SELECT TO authenticated USING (true);
CREATE POLICY "Service can manage pair analysis" ON public.pair_analysis_log FOR ALL TO service_role USING (true) WITH CHECK (true);

-- 9. App Settings
CREATE TABLE public.app_settings (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  key TEXT NOT NULL UNIQUE,
  value_json JSONB NOT NULL,
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
ALTER TABLE public.app_settings ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Auth users can view settings" ON public.app_settings FOR SELECT TO authenticated USING (true);
CREATE POLICY "Admins can manage settings" ON public.app_settings FOR ALL TO authenticated
  USING (public.has_role(auth.uid(), 'admin')) WITH CHECK (public.has_role(auth.uid(), 'admin'));
CREATE TRIGGER update_app_settings_updated_at BEFORE UPDATE ON public.app_settings
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- 10. Audit Log
CREATE TABLE public.audit_log (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  event_type TEXT NOT NULL,
  severity TEXT NOT NULL DEFAULT 'info' CHECK (severity IN ('info', 'warning', 'error', 'critical')),
  source TEXT NOT NULL,
  message TEXT NOT NULL,
  details_json JSONB,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
ALTER TABLE public.audit_log ENABLE ROW LEVEL SECURITY;
CREATE INDEX idx_audit_log_created ON public.audit_log (created_at DESC);
CREATE INDEX idx_audit_log_type ON public.audit_log (event_type, created_at DESC);
CREATE POLICY "Admins can view audit" ON public.audit_log FOR SELECT TO authenticated
  USING (public.has_role(auth.uid(), 'admin'));
CREATE POLICY "Service can manage audit" ON public.audit_log FOR ALL TO service_role USING (true) WITH CHECK (true);

-- Auto-assign viewer role on signup
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS TRIGGER AS $$
BEGIN
  INSERT INTO public.user_roles (user_id, role) VALUES (NEW.id, 'viewer');
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public;

CREATE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW EXECUTE FUNCTION public.handle_new_user();

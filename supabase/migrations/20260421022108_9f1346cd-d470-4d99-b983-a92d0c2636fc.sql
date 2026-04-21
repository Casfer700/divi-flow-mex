-- Daily cash session header
CREATE TABLE public.cash_sessions (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  session_date DATE NOT NULL DEFAULT CURRENT_DATE,
  status TEXT NOT NULL DEFAULT 'open' CHECK (status IN ('open', 'closed')),
  opened_by UUID,
  closed_by UUID,
  opened_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  closed_at TIMESTAMPTZ,
  notes TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Only one open session at a time
CREATE UNIQUE INDEX cash_sessions_one_open ON public.cash_sessions (status) WHERE status = 'open';

-- Per-account balance snapshot
CREATE TABLE public.cash_session_balances (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  session_id UUID NOT NULL REFERENCES public.cash_sessions(id) ON DELETE CASCADE,
  account_id UUID NOT NULL REFERENCES public.accounts(id) ON DELETE CASCADE,
  currency TEXT NOT NULL,
  opening_balance NUMERIC NOT NULL DEFAULT 0,
  expected_closing NUMERIC NOT NULL DEFAULT 0,
  actual_closing NUMERIC,
  difference NUMERIC,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (session_id, account_id)
);

CREATE INDEX cash_session_balances_session_idx ON public.cash_session_balances(session_id);
CREATE INDEX cash_session_balances_account_idx ON public.cash_session_balances(account_id);

-- Enable RLS
ALTER TABLE public.cash_sessions ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.cash_session_balances ENABLE ROW LEVEL SECURITY;

-- Policies: cash_sessions
CREATE POLICY "Admin and local can view cash sessions"
ON public.cash_sessions FOR SELECT TO authenticated
USING (has_role(auth.uid(), 'admin'::app_role) OR has_role(auth.uid(), 'local'::app_role));

CREATE POLICY "Admin and local can open cash sessions"
ON public.cash_sessions FOR INSERT TO authenticated
WITH CHECK (has_role(auth.uid(), 'admin'::app_role) OR has_role(auth.uid(), 'local'::app_role));

CREATE POLICY "Admin and local can close cash sessions"
ON public.cash_sessions FOR UPDATE TO authenticated
USING (has_role(auth.uid(), 'admin'::app_role) OR has_role(auth.uid(), 'local'::app_role));

CREATE POLICY "Only admins can delete cash sessions"
ON public.cash_sessions FOR DELETE TO authenticated
USING (has_role(auth.uid(), 'admin'::app_role));

-- Policies: cash_session_balances
CREATE POLICY "Admin and local can view cash balances"
ON public.cash_session_balances FOR SELECT TO authenticated
USING (has_role(auth.uid(), 'admin'::app_role) OR has_role(auth.uid(), 'local'::app_role));

CREATE POLICY "Admin and local can insert cash balances"
ON public.cash_session_balances FOR INSERT TO authenticated
WITH CHECK (has_role(auth.uid(), 'admin'::app_role) OR has_role(auth.uid(), 'local'::app_role));

CREATE POLICY "Admin and local can update cash balances"
ON public.cash_session_balances FOR UPDATE TO authenticated
USING (has_role(auth.uid(), 'admin'::app_role) OR has_role(auth.uid(), 'local'::app_role));

CREATE POLICY "Only admins can delete cash balances"
ON public.cash_session_balances FOR DELETE TO authenticated
USING (has_role(auth.uid(), 'admin'::app_role));

-- updated_at triggers
CREATE TRIGGER update_cash_sessions_updated_at
BEFORE UPDATE ON public.cash_sessions
FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

CREATE TRIGGER update_cash_session_balances_updated_at
BEFORE UPDATE ON public.cash_session_balances
FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- Helper: compute expected closing for a session balance row.
-- expected = opening + sum(income) - sum(expense) within session window for that account.
CREATE OR REPLACE FUNCTION public.compute_expected_closing(_session_id UUID, _account_id UUID)
RETURNS NUMERIC
LANGUAGE plpgsql
STABLE SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  s_opened TIMESTAMPTZ;
  s_closed TIMESTAMPTZ;
  s_status TEXT;
  opening NUMERIC := 0;
  net NUMERIC := 0;
BEGIN
  SELECT opened_at, closed_at, status INTO s_opened, s_closed, s_status
  FROM public.cash_sessions WHERE id = _session_id;

  SELECT COALESCE(opening_balance, 0) INTO opening
  FROM public.cash_session_balances
  WHERE session_id = _session_id AND account_id = _account_id;

  SELECT COALESCE(SUM(
    CASE WHEN movement_type = 'income' THEN amount
         WHEN movement_type = 'expense' THEN -amount
         ELSE 0 END
  ), 0) INTO net
  FROM public.financial_movements
  WHERE account_id = _account_id
    AND movement_date >= s_opened
    AND (s_closed IS NULL OR movement_date <= s_closed);

  RETURN opening + net;
END;
$$;

-- Trigger to keep difference in sync when actual_closing is set
CREATE OR REPLACE FUNCTION public.update_balance_difference()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF NEW.actual_closing IS NOT NULL THEN
    NEW.difference = NEW.actual_closing - NEW.expected_closing;
  ELSE
    NEW.difference = NULL;
  END IF;
  RETURN NEW;
END;
$$;

CREATE TRIGGER cash_balance_diff_trigger
BEFORE INSERT OR UPDATE ON public.cash_session_balances
FOR EACH ROW EXECUTE FUNCTION public.update_balance_difference();
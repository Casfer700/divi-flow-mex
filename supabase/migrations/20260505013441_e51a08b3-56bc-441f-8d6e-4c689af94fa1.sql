
-- Telegram configuration (singleton)
CREATE TABLE public.telegram_config (
  id int PRIMARY KEY CHECK (id = 1),
  bot_token text NOT NULL DEFAULT '',
  orders_chat_id text NOT NULL DEFAULT '',
  pos_chat_id text NOT NULL DEFAULT '',
  enabled boolean NOT NULL DEFAULT false,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE public.telegram_config ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Only admins can view telegram config"
  ON public.telegram_config FOR SELECT TO authenticated
  USING (has_role(auth.uid(), 'admin'::app_role));

CREATE POLICY "Only admins can insert telegram config"
  ON public.telegram_config FOR INSERT TO authenticated
  WITH CHECK (has_role(auth.uid(), 'admin'::app_role));

CREATE POLICY "Only admins can update telegram config"
  ON public.telegram_config FOR UPDATE TO authenticated
  USING (has_role(auth.uid(), 'admin'::app_role));

CREATE POLICY "Only admins can delete telegram config"
  ON public.telegram_config FOR DELETE TO authenticated
  USING (has_role(auth.uid(), 'admin'::app_role));

-- Seed default row
INSERT INTO public.telegram_config (id) VALUES (1);

-- Trigger for updated_at
CREATE TRIGGER update_telegram_config_updated_at
  BEFORE UPDATE ON public.telegram_config
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

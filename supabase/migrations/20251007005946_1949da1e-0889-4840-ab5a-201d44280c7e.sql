-- Create table for WhatsApp message templates
CREATE TABLE IF NOT EXISTS public.whatsapp_templates (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name TEXT NOT NULL UNIQUE,
  template TEXT NOT NULL,
  description TEXT,
  created_by UUID REFERENCES auth.users(id),
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Enable RLS
ALTER TABLE public.whatsapp_templates ENABLE ROW LEVEL SECURITY;

-- RLS Policies for whatsapp_templates
CREATE POLICY "Anyone can view templates"
  ON public.whatsapp_templates
  FOR SELECT
  USING (true);

CREATE POLICY "Only admins can insert templates"
  ON public.whatsapp_templates
  FOR INSERT
  WITH CHECK (has_role(auth.uid(), 'admin'));

CREATE POLICY "Only admins can update templates"
  ON public.whatsapp_templates
  FOR UPDATE
  USING (has_role(auth.uid(), 'admin'));

CREATE POLICY "Only admins can delete templates"
  ON public.whatsapp_templates
  FOR DELETE
  USING (has_role(auth.uid(), 'admin'));

-- Trigger for updated_at
CREATE TRIGGER update_whatsapp_templates_updated_at
  BEFORE UPDATE ON public.whatsapp_templates
  FOR EACH ROW
  EXECUTE FUNCTION public.update_updated_at_column();

-- Insert default template
INSERT INTO public.whatsapp_templates (name, template, description)
VALUES (
  'default_order',
  'Hola {customer_name}! 👋

Tu pedido ha sido registrado:

💵 Montos:
{currency_amounts}

💰 Total: ${total_mxn} MXN

📍 Dirección: {address}
📱 Teléfono MX: {phone_mx}

Estado de pago: {payment_status}
Estado de entrega: {delivery_status}

¡Gracias por tu confianza! 🙌',
  'Plantilla predeterminada para confirmación de órdenes'
) ON CONFLICT (name) DO NOTHING;
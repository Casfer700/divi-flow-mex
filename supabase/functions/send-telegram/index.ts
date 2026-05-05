const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

interface TelegramPayload {
  event: 'new_order' | 'order_paid' | 'order_delivered' | 'pos_sale';
  data: Record<string, any>;
}

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders });
  }

  const TELEGRAM_BOT_TOKEN = Deno.env.get('TELEGRAM_BOT_TOKEN');
  const TELEGRAM_CHAT_ID = Deno.env.get('TELEGRAM_CHAT_ID');

  if (!TELEGRAM_BOT_TOKEN || !TELEGRAM_CHAT_ID) {
    return new Response(JSON.stringify({ error: 'Telegram not configured' }), {
      status: 200, // fail silently
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }

  try {
    const { event, data } = await req.json() as TelegramPayload;
    const message = buildMessage(event, data);
    if (!message) {
      return new Response(JSON.stringify({ ok: true, skipped: true }), {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    const resp = await fetch(`https://api.telegram.org/bot${TELEGRAM_BOT_TOKEN}/sendMessage`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ chat_id: TELEGRAM_CHAT_ID, text: message, parse_mode: 'HTML' }),
    });

    const result = await resp.json();
    return new Response(JSON.stringify({ ok: result.ok }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  } catch (err) {
    console.error('Telegram error:', err);
    return new Response(JSON.stringify({ ok: false }), {
      status: 200,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }
});

function buildMessage(event: string, data: Record<string, any>): string | null {
  const { customer_name, total_mxn, usd_amount, eur_amount, cup_amount, address, assigned_user, delivery_notes } = data;

  const currencyParts: string[] = [];
  if (usd_amount > 0) currencyParts.push(`$${usd_amount} USD`);
  if (eur_amount > 0) currencyParts.push(`€${eur_amount} EUR`);
  if (cup_amount > 0) currencyParts.push(`$${cup_amount} CUP`);
  const currencySummary = currencyParts.length > 0 ? currencyParts.join(', ') : 'N/A';

  const deliveryType = assigned_user?.role === 'delivery' ? 'Domicilio' : 'Local';

  switch (event) {
    case 'new_order': {
      let msg = `🆕 Nueva orden\nCliente: ${customer_name}\nTotal: $${total_mxn} MXN\nDivisas: ${currencySummary}\nTipo: ${deliveryType}`;
      if (address) msg += `\nDirección: ${address}`;
      if (delivery_notes) msg += `\nNotas: ${delivery_notes}`;
      return msg;
    }
    case 'order_paid': {
      return `💸 Orden pagada\nCliente: ${customer_name}\nTotal: $${total_mxn} MXN\nDivisas: ${currencySummary}`;
    }
    case 'order_delivered': {
      return `✅ Orden entregada\nCliente: ${customer_name}\nDivisas: ${currencySummary}\nTipo: ${deliveryType}`;
    }
    case 'pos_sale': {
      const { product_name, price, sales_agent } = data;
      let msg = `💰 Nueva venta\nProducto: ${product_name}\nPrecio: $${price}`;
      if (sales_agent) msg += `\nAgente: ${sales_agent}`;
      return msg;
    }
    default:
      return null;
  }
}

import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

interface TelegramPayload {
  event: 'new_order' | 'order_paid' | 'order_delivered' | 'order_in_transit' | 'pos_sale' | 'test';
  data: Record<string, any>;
}

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders });
  }

  try {
    const { event, data } = await req.json() as TelegramPayload;

    // Read config from DB
    const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
    const serviceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
    const sb = createClient(supabaseUrl, serviceKey);

    const { data: config } = await sb.from('telegram_config').select('*').eq('id', 1).single();

    if (!config || !config.enabled || !config.bot_token) {
      return new Response(JSON.stringify({ ok: true, skipped: true, reason: 'disabled' }), {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    // Determine which chat_id to use
    let chatId: string | null = null;
    if (event === 'pos_sale') {
      chatId = config.pos_chat_id || null;
    } else if (event === 'test') {
      // For test messages, chat_id comes from data
      chatId = data.chat_id || null;
    } else {
      chatId = config.orders_chat_id || null;
    }

    if (!chatId) {
      return new Response(JSON.stringify({ ok: true, skipped: true, reason: 'no_chat_id' }), {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    const message = buildMessage(event, data);
    if (!message) {
      return new Response(JSON.stringify({ ok: true, skipped: true }), {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    const resp = await fetch(`https://api.telegram.org/bot${config.bot_token}/sendMessage`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ chat_id: chatId, text: message, parse_mode: 'HTML' }),
    });

    const result = await resp.json();
    return new Response(JSON.stringify({ ok: result.ok, error: result.ok ? undefined : result.description }), {
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
  const {
    customer_name, total_mxn, usd_amount, eur_amount, cup_amount,
    address, assigned_user, delivery_notes, phone_mx, phone_cu,
    payment_status,
  } = data;

  const currencyParts: string[] = [];
  if (usd_amount > 0) currencyParts.push(`$${usd_amount} USD`);
  if (eur_amount > 0) currencyParts.push(`€${eur_amount} EUR`);
  if (cup_amount > 0) currencyParts.push(`$${cup_amount} CUP`);
  const currencySummary = currencyParts.length > 0 ? currencyParts.join('\n') : '';

  const phones: string[] = [];
  if (phone_mx) phones.push(phone_mx);
  if (phone_cu) phones.push(phone_cu);
  const phoneStr = phones.length > 0 ? phones.join(' / ') : '';

  const assignedName = assigned_user?.full_name || assigned_user?.role || '';
  const paymentLabel = payment_status === 'paid' || payment_status === 'verified' ? '🟢 Confirmado' : '🔴 No pagado';
  const date = new Date().toLocaleString('es-MX', { timeZone: 'America/Mexico_City' });

  const sep = '━━━━━━━━━━━━━━━━━━';

  switch (event) {
    case 'new_order': {
      let msg = `🆕 NUEVA ORDEN\n\n🔴 Estado: Pendiente\n💰 Pago: No pagado`;
      msg += `\n\n👤 Cliente: ${customer_name || '—'}`;
      if (phoneStr) msg += `\n📞 Tel: ${phoneStr}`;
      if (address) msg += `\n\n📍 Dirección:\n${address}`;
      if (currencySummary) msg += `\n\n💱 Divisas:\n${currencySummary}`;
      if (total_mxn) msg += `\n\n💰 Total: $${total_mxn} MXN`;
      if (delivery_notes) msg += `\n\n📝 Notas:\n${delivery_notes}`;
      if (assignedName) msg += `\n\n👨‍💼 Asignado a: ${assignedName}`;
      msg += `\n🕒 Fecha: ${date}`;
      msg += `\n\n${sep}`;
      return msg;
    }
    case 'order_paid': {
      let msg = `💸 ORDEN PAGADA\n\n🟢 Estado: Pagado\n💰 Pago: Confirmado`;
      msg += `\n\n👤 Cliente: ${customer_name || '—'}`;
      if (phoneStr) msg += `\n📞 Tel: ${phoneStr}`;
      if (currencySummary) msg += `\n\n💱 Divisas:\n${currencySummary}`;
      if (total_mxn) msg += `\n\n💰 Total recibido: $${total_mxn} MXN`;
      if (address) msg += `\n\n📍 Dirección:\n${address}`;
      if (assignedName) msg += `\n\n👨‍💼 Responsable: ${assignedName}`;
      msg += `\n🕒 Fecha: ${date}`;
      msg += `\n\n${sep}`;
      return msg;
    }
    case 'order_in_transit': {
      let msg = `🚚 ORDEN EN CAMINO\n\n🟡 Estado: En camino\n💰 Pago: ${paymentLabel}`;
      msg += `\n\n👤 Cliente: ${customer_name || '—'}`;
      if (address) msg += `\n\n📍 Dirección:\n${address}`;
      if (currencySummary) msg += `\n\n💱 Divisas:\n${currencySummary}`;
      if (assignedName) msg += `\n\n👨‍💼 Responsable: ${assignedName}`;
      msg += `\n\n${sep}`;
      return msg;
    }
    case 'order_delivered': {
      let msg = `✅ ENTREGA COMPLETADA\n\n✅ Estado: Entregado\n💰 Pago: ${paymentLabel}`;
      msg += `\n\n👤 Cliente: ${customer_name || '—'}`;
      if (currencySummary) msg += `\n\n💱 Divisas entregadas:\n${currencySummary}`;
      msg += `\n\n${sep}`;
      return msg;
    }
    case 'pos_sale': {
      const { product_name, price, sales_agent } = data;
      let msg = `💰 VENTA REGISTRADA\n\n📦 Producto: ${product_name || '—'}`;
      if (price) msg += `\n💵 Precio: $${price}`;
      if (sales_agent) msg += `\n\n👨‍💼 Agente: ${sales_agent}`;
      msg += `\n\n${sep}`;
      return msg;
    }
    case 'test': {
      return `✅ Mensaje de prueba exitoso\n\n${sep}`;
    }
    default:
      return null;
  }
}

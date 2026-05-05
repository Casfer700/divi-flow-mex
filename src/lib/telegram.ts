import { supabase } from "@/integrations/supabase/client";

/**
 * Send a Telegram notification via edge function. Non-blocking, fails silently.
 */
export async function sendTelegramNotification(
  event: "new_order" | "order_paid" | "order_delivered" | "order_in_transit" | "pos_sale" | "test",
  data: Record<string, any>
) {
  try {
    await supabase.functions.invoke("send-telegram", {
      body: { event, data },
    });
  } catch {
    // fail silently
  }
}

/**
 * Send a test message to a specific chat. Returns the result for UI feedback.
 */
export async function sendTelegramTest(chatType: "orders" | "pos"): Promise<{ ok: boolean; error?: string }> {
  try {
    const { data, error } = await supabase.functions.invoke("send-telegram", {
      body: {
        event: "test",
        data: { chat_type: chatType },
      },
    });
    if (error) return { ok: false, error: error.message };
    return data as { ok: boolean; error?: string };
  } catch (e: any) {
    return { ok: false, error: e.message };
  }
}

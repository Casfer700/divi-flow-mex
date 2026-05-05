import { supabase } from "@/integrations/supabase/client";

/**
 * Send a Telegram notification via edge function. Non-blocking, fails silently.
 */
export async function sendTelegramNotification(
  event: "new_order" | "order_paid" | "order_delivered" | "pos_sale",
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

import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { sendTelegramTest } from "@/lib/telegram";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { toast } from "sonner";
import { Bot, Eye, EyeOff, Send } from "lucide-react";

interface TelegramConfig {
  bot_token: string;
  orders_chat_id: string;
  pos_chat_id: string;
  enabled: boolean;
}

export function TelegramConfigManager() {
  const [config, setConfig] = useState<TelegramConfig>({
    bot_token: "",
    orders_chat_id: "",
    pos_chat_id: "",
    enabled: false,
  });
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [showToken, setShowToken] = useState(false);
  const [testingOrders, setTestingOrders] = useState(false);
  const [testingPos, setTestingPos] = useState(false);
  const [isOpen, setIsOpen] = useState(false);

  useEffect(() => {
    fetchConfig();
  }, []);

  const fetchConfig = async () => {
    const { data, error } = await supabase
      .from("telegram_config")
      .select("*")
      .eq("id", 1)
      .single();
    if (!error && data) {
      setConfig({
        bot_token: (data as any).bot_token || "",
        orders_chat_id: (data as any).orders_chat_id || "",
        pos_chat_id: (data as any).pos_chat_id || "",
        enabled: (data as any).enabled || false,
      });
    }
    setLoading(false);
  };

  const saveConfig = async () => {
    setSaving(true);
    const { error } = await supabase
      .from("telegram_config")
      .update({
        bot_token: config.bot_token,
        orders_chat_id: config.orders_chat_id,
        pos_chat_id: config.pos_chat_id,
        enabled: config.enabled,
      } as any)
      .eq("id", 1);
    setSaving(false);
    if (error) {
      toast.error("Error al guardar configuración");
    } else {
      toast.success("Configuración guardada");
    }
  };

  const testChat = async (type: "orders" | "pos") => {
    if (type === "orders") setTestingOrders(true);
    else setTestingPos(true);

    // Save first so edge function reads latest config
    await supabase
      .from("telegram_config")
      .update({
        bot_token: config.bot_token,
        orders_chat_id: config.orders_chat_id,
        pos_chat_id: config.pos_chat_id,
        enabled: true, // temporarily enable for test
      } as any)
      .eq("id", 1);

    const result = await sendTelegramTest(type);

    // Restore enabled state
    if (!config.enabled) {
      await supabase
        .from("telegram_config")
        .update({ enabled: false } as any)
        .eq("id", 1);
    }

    if (type === "orders") setTestingOrders(false);
    else setTestingPos(false);

    if (result.ok) {
      toast.success(`Mensaje de prueba enviado al chat de ${type === "orders" ? "Órdenes" : "POS"}`);
    } else {
      toast.error(`Error: ${result.error || "No se pudo enviar"}`);
    }
  };

  if (loading) return null;

  return (
    <div className="space-y-3">
      <button
        onClick={() => setIsOpen(!isOpen)}
        className="flex items-center gap-2 w-full text-left"
      >
        <Bot className="h-4 w-4 text-primary" />
        <h2 className="text-sm font-semibold text-muted-foreground uppercase tracking-wider">
          Notificaciones Telegram
        </h2>
      </button>

      {isOpen && (
        <div className="bg-card rounded-xl p-4 shadow-fintech-sm space-y-4 animate-fade-in">
          <div className="flex items-center justify-between">
            <Label className="text-sm font-medium">Notificaciones activas</Label>
            <Switch
              checked={config.enabled}
              onCheckedChange={(v) => setConfig((p) => ({ ...p, enabled: v }))}
            />
          </div>

          <div className="space-y-2">
            <Label className="text-sm">Bot Token</Label>
            <div className="flex gap-2">
              <Input
                type={showToken ? "text" : "password"}
                value={config.bot_token}
                onChange={(e) => setConfig((p) => ({ ...p, bot_token: e.target.value }))}
                placeholder="123456:ABC-DEF..."
                className="flex-1"
              />
              <Button
                size="icon"
                variant="ghost"
                onClick={() => setShowToken(!showToken)}
                className="h-10 w-10"
              >
                {showToken ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
              </Button>
            </div>
          </div>

          <div className="space-y-2">
            <Label className="text-sm">Chat ID — Órdenes</Label>
            <div className="flex gap-2">
              <Input
                value={config.orders_chat_id}
                onChange={(e) => setConfig((p) => ({ ...p, orders_chat_id: e.target.value }))}
                placeholder="-1001234567890"
                className="flex-1"
              />
              <Button
                size="sm"
                variant="outline"
                disabled={testingOrders || !config.bot_token || !config.orders_chat_id}
                onClick={() => testChat("orders")}
                className="gap-1 whitespace-nowrap"
              >
                <Send className="h-3.5 w-3.5" />
                {testingOrders ? "..." : "Probar"}
              </Button>
            </div>
          </div>

          <div className="space-y-2">
            <Label className="text-sm">Chat ID — Ventas POS</Label>
            <div className="flex gap-2">
              <Input
                value={config.pos_chat_id}
                onChange={(e) => setConfig((p) => ({ ...p, pos_chat_id: e.target.value }))}
                placeholder="-1001234567890"
                className="flex-1"
              />
              <Button
                size="sm"
                variant="outline"
                disabled={testingPos || !config.bot_token || !config.pos_chat_id}
                onClick={() => testChat("pos")}
                className="gap-1 whitespace-nowrap"
              >
                <Send className="h-3.5 w-3.5" />
                {testingPos ? "..." : "Probar"}
              </Button>
            </div>
          </div>

          <Button onClick={saveConfig} disabled={saving} className="w-full">
            {saving ? "Guardando..." : "Guardar configuración"}
          </Button>
        </div>
      )}
    </div>
  );
}

import { useState, useEffect } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { toast } from "sonner";
import { TrendingUp, Check, X } from "lucide-react";

interface ExchangeRate {
  id: string;
  currency: string;
  rate_type: string;
  buy_rate: number;
  sell_rate: number;
}

export function ExchangeRatesManager() {
  const [rates, setRates] = useState<ExchangeRate[]>([]);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editValues, setEditValues] = useState({ buy_rate: "", sell_rate: "" });

  useEffect(() => { fetchRates(); }, []);

  const fetchRates = async () => {
    const { data, error } = await supabase.from("exchange_rates").select("*").order("currency").order("rate_type");
    if (error) { toast.error("Error al cargar tasas"); return; }
    setRates(data || []);
  };

  const handleEdit = (rate: ExchangeRate) => {
    setEditingId(rate.id);
    setEditValues({ buy_rate: rate.buy_rate.toString(), sell_rate: rate.sell_rate.toString() });
  };

  const handleSave = async (id: string) => {
    const { error } = await supabase.from("exchange_rates").update({
      buy_rate: parseFloat(editValues.buy_rate), sell_rate: parseFloat(editValues.sell_rate),
    }).eq("id", id);
    if (error) { toast.error("Error al actualizar"); return; }
    toast.success("Tasa actualizada");
    setEditingId(null);
    fetchRates();
  };

  const getRateLabel = (type: string) => {
    const labels: Record<string, string> = { wholesale: "Mayoreo", retail: "Menudeo", individual: "Individual" };
    return labels[type] || type;
  };

  return (
    <div className="space-y-3">
      <div className="flex items-center gap-2">
        <TrendingUp className="h-4 w-4 text-primary" />
        <h2 className="text-sm font-semibold text-muted-foreground uppercase tracking-wider">Tasas de Cambio</h2>
      </div>

      <div className="space-y-2">
        {rates.map((rate) => (
          <div key={rate.id} className="bg-card rounded-2xl shadow-fintech-sm p-4 animate-fade-in">
            <div className="flex items-center justify-between mb-3">
              <div>
                <span className="font-bold text-base">{rate.currency}</span>
                <span className="text-xs text-muted-foreground ml-2 bg-muted px-2 py-0.5 rounded-full">
                  {getRateLabel(rate.rate_type)}
                </span>
              </div>
              {editingId === rate.id ? (
                <div className="flex gap-1">
                  <Button size="icon" onClick={() => handleSave(rate.id)} className="h-8 w-8 min-h-0 rounded-lg bg-success hover:bg-success/90">
                    <Check className="h-3.5 w-3.5" />
                  </Button>
                  <Button size="icon" variant="outline" onClick={() => setEditingId(null)} className="h-8 w-8 min-h-0 rounded-lg">
                    <X className="h-3.5 w-3.5" />
                  </Button>
                </div>
              ) : (
                <Button size="sm" variant="ghost" onClick={() => handleEdit(rate)} className="h-8 min-h-0 text-xs font-medium text-primary">
                  Editar
                </Button>
              )}
            </div>

            <div className="grid grid-cols-2 gap-3">
              <div>
                <p className="text-[10px] text-muted-foreground font-medium uppercase mb-1">Compra (MXN)</p>
                {editingId === rate.id ? (
                  <Input type="number" step="0.01" value={editValues.buy_rate}
                    onChange={(e) => setEditValues({ ...editValues, buy_rate: e.target.value })}
                    className="h-10 rounded-lg text-center font-semibold" />
                ) : (
                  <p className="text-lg font-bold">${rate.buy_rate.toFixed(2)}</p>
                )}
              </div>
              <div>
                <p className="text-[10px] text-muted-foreground font-medium uppercase mb-1">Venta (MXN)</p>
                {editingId === rate.id ? (
                  <Input type="number" step="0.01" value={editValues.sell_rate}
                    onChange={(e) => setEditValues({ ...editValues, sell_rate: e.target.value })}
                    className="h-10 rounded-lg text-center font-semibold" />
                ) : (
                  <p className="text-lg font-bold">${rate.sell_rate.toFixed(2)}</p>
                )}
              </div>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}

import { useState, useEffect } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { toast } from "sonner";
import { Plus, ArrowUpRight, ArrowDownLeft, RefreshCw, DollarSign, Banknote, Coins } from "lucide-react";
import { useAuth } from "@/contexts/AuthContext";

interface InventoryMovement {
  id: string;
  currency: string;
  amount: number;
  movement_type: string;
  notes: string | null;
  created_at: string;
  reference_type: string | null;
  reference_id: string | null;
}

interface InventoryBalance {
  USD: number;
  EUR: number;
  CUP: number;
}

export function InventoryManager() {
  const { user } = useAuth();
  const [movements, setMovements] = useState<InventoryMovement[]>([]);
  const [balance, setBalance] = useState<InventoryBalance>({ USD: 0, EUR: 0, CUP: 0 });
  const [orderCustomers, setOrderCustomers] = useState<Record<string, string>>({});
  const [isDialogOpen, setIsDialogOpen] = useState(false);
  const [formData, setFormData] = useState({ currency: "", amount: "", movement_type: "", notes: "" });

  useEffect(() => { fetchMovements(); calculateBalance(); }, []);

  const fetchMovements = async () => {
    const { data, error } = await supabase.from("inventory_movements").select("*").order("created_at", { ascending: false }).limit(20);
    if (error) { toast.error("Error al cargar movimientos"); return; }
    const movs = data || [];
    setMovements(movs);

    // Enrich order-related movements with customer names
    const orderIds = Array.from(new Set(
      movs.filter(m => m.reference_type === "order" && m.reference_id)
        .map(m => m.reference_id as string)
    ));
    if (orderIds.length > 0) {
      const { data: ords } = await supabase
        .from("orders")
        .select("id, customer:customers(name)")
        .in("id", orderIds);
      const map: Record<string, string> = {};
      (ords as any[] | null)?.forEach(o => {
        if (o.customer?.name) map[o.id] = o.customer.name;
      });
      setOrderCustomers(map);
    } else {
      setOrderCustomers({});
    }
  };

  const calculateBalance = async () => {
    const { data, error } = await supabase.from("inventory_movements").select("currency, amount, movement_type");
    if (error) return;
    const newBalance: InventoryBalance = { USD: 0, EUR: 0, CUP: 0 };
    data?.forEach((mov) => {
      const currency = mov.currency as keyof InventoryBalance;
      const amount = parseFloat(mov.amount.toString());
      if (mov.movement_type === "in") newBalance[currency] += amount;
      else if (mov.movement_type === "out") newBalance[currency] -= amount;
      else if (mov.movement_type === "adjustment") newBalance[currency] = amount;
    });
    setBalance(newBalance);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    const { error } = await supabase.from("inventory_movements").insert([{ ...formData, amount: parseFloat(formData.amount), created_by: user?.id }]);
    if (error) { toast.error("Error al registrar movimiento"); return; }
    toast.success("Movimiento registrado");
    setIsDialogOpen(false);
    setFormData({ currency: "", amount: "", movement_type: "", notes: "" });
    fetchMovements();
    calculateBalance();
  };

  const getMovementTypeLabel = (type: string) => {
    const labels: Record<string, string> = { in: "Entrada", out: "Salida", adjustment: "Ajuste" };
    return labels[type] || type;
  };

  const getMovementIcon = (type: string) => {
    if (type === "in") return <ArrowDownLeft className="h-3.5 w-3.5 text-success" />;
    if (type === "out") return <ArrowUpRight className="h-3.5 w-3.5 text-destructive" />;
    return <RefreshCw className="h-3.5 w-3.5 text-muted-foreground" />;
  };

  const walletCards = [
    { currency: "USD", symbol: "$", balance: balance.USD, icon: DollarSign, gradient: "from-emerald-500 to-emerald-600" },
    { currency: "EUR", symbol: "€", balance: balance.EUR, icon: Banknote, gradient: "from-blue-500 to-blue-600" },
    { currency: "CUP", symbol: "$", balance: balance.CUP, icon: Coins, gradient: "from-amber-500 to-amber-600" },
  ];

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <h2 className="text-sm font-semibold text-muted-foreground uppercase tracking-wider">Inventario de Divisas</h2>
        <Button size="sm" onClick={() => setIsDialogOpen(true)} className="h-9 rounded-xl gap-1 text-xs font-semibold">
          <Plus className="h-3.5 w-3.5" />
          Movimiento
        </Button>
      </div>

      {/* Wallet-style horizontal scroll cards */}
      <div className="flex gap-3 overflow-x-auto scrollbar-hide pb-1 -mx-4 px-4">
        {walletCards.map((card) => {
          const Icon = card.icon;
          return (
            <div key={card.currency} className={`flex-shrink-0 w-44 bg-gradient-to-br ${card.gradient} rounded-2xl p-4 text-white shadow-fintech-md`}>
              <div className="flex items-center justify-between mb-3">
                <span className="text-sm font-medium opacity-90">{card.currency}</span>
                <Icon className="h-5 w-5 opacity-70" />
              </div>
              <p className="text-2xl font-bold tracking-tight">
                {card.symbol}{card.balance.toFixed(2)}
              </p>
              <p className="text-xs opacity-70 mt-1">Saldo disponible</p>
            </div>
          );
        })}
      </div>

      {/* Transactions list */}
      <div className="bg-card rounded-2xl shadow-fintech-sm overflow-hidden">
        <div className="px-4 py-3 border-b">
          <h3 className="text-sm font-semibold">Últimos movimientos</h3>
        </div>
        <div className="divide-y">
          {movements.map((mov) => {
            const customerName = (mov.reference_type === "order" || mov.reference_type === "order_reversal" || mov.reference_type === "order_adjustment")
              && mov.reference_id ? orderCustomers[mov.reference_id] : null;
            return (
              <div key={mov.id} className="flex items-center gap-3 px-4 py-3">
                <div className="w-8 h-8 rounded-full bg-muted flex items-center justify-center flex-shrink-0">
                  {getMovementIcon(mov.movement_type)}
                </div>
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-medium">
                    {mov.currency} · {getMovementTypeLabel(mov.movement_type)}
                    {customerName && <span className="text-muted-foreground font-normal"> · {customerName}</span>}
                  </p>
                  <p className="text-xs text-muted-foreground truncate">{mov.notes || "Sin notas"}</p>
                </div>
                <div className="text-right flex-shrink-0">
                  <p className={`text-sm font-semibold ${mov.movement_type === "in" ? "text-success" : mov.movement_type === "out" ? "text-destructive" : ""}`}>
                    {mov.movement_type === "in" ? "+" : mov.movement_type === "out" ? "-" : ""}
                    {mov.amount.toFixed(2)}
                  </p>
                  <p className="text-[10px] text-muted-foreground">
                    {new Date(mov.created_at).toLocaleDateString("es-MX", { day: "numeric", month: "short" })}
                  </p>
                </div>
              </div>
            );
          })}
          {movements.length === 0 && (
            <div className="text-center py-8 text-muted-foreground text-sm">Sin movimientos</div>
          )}
        </div>
      </div>

      <Dialog open={isDialogOpen} onOpenChange={setIsDialogOpen}>
        <DialogContent className="rounded-2xl">
          <DialogHeader>
            <DialogTitle className="text-lg font-bold">Nuevo Movimiento</DialogTitle>
          </DialogHeader>
          <form onSubmit={handleSubmit} className="space-y-4">
            <div className="space-y-1">
              <Label className="text-xs font-medium text-muted-foreground uppercase tracking-wider">Divisa</Label>
              <Select value={formData.currency} onValueChange={(v) => setFormData({ ...formData, currency: v })} required>
                <SelectTrigger className="h-12 rounded-xl"><SelectValue placeholder="Seleccionar" /></SelectTrigger>
                <SelectContent className="bg-popover">
                  <SelectItem value="USD">USD</SelectItem>
                  <SelectItem value="EUR">EUR</SelectItem>
                  <SelectItem value="CUP">CUP</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-1">
              <Label className="text-xs font-medium text-muted-foreground uppercase tracking-wider">Tipo</Label>
              <Select value={formData.movement_type} onValueChange={(v) => setFormData({ ...formData, movement_type: v })} required>
                <SelectTrigger className="h-12 rounded-xl"><SelectValue placeholder="Seleccionar" /></SelectTrigger>
                <SelectContent className="bg-popover">
                  <SelectItem value="in">Entrada</SelectItem>
                  <SelectItem value="out">Salida</SelectItem>
                  <SelectItem value="adjustment">Ajuste</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-1">
              <Label className="text-xs font-medium text-muted-foreground uppercase tracking-wider">Cantidad</Label>
              <Input type="number" step="0.01" value={formData.amount}
                onChange={(e) => setFormData({ ...formData, amount: e.target.value })}
                required className="h-12 rounded-xl text-center text-lg font-semibold" />
            </div>
            <div className="space-y-1">
              <Label className="text-xs font-medium text-muted-foreground uppercase tracking-wider">Notas</Label>
              <Textarea value={formData.notes} onChange={(e) => setFormData({ ...formData, notes: e.target.value })}
                placeholder="Detalles..." className="rounded-xl" />
            </div>
            <Button type="submit" className="w-full h-12 rounded-xl font-semibold">Registrar</Button>
          </form>
        </DialogContent>
      </Dialog>
    </div>
  );
}

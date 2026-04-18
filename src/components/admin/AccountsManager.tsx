import { useState, useEffect } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import { Switch } from "@/components/ui/switch";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { toast } from "sonner";
import { Plus, Wallet, Building2, Smartphone, Pencil, Trash2 } from "lucide-react";
import { useAuth } from "@/contexts/AuthContext";

interface Account {
  id: string;
  name: string;
  account_type: "cash" | "bank" | "wallet" | "other";
  currency: string;
  initial_balance: number;
  is_active: boolean;
  notes: string | null;
}

const TYPE_ICON: Record<string, any> = {
  cash: Wallet,
  bank: Building2,
  wallet: Smartphone,
  other: Wallet,
};

const TYPE_LABEL: Record<string, string> = {
  cash: "Efectivo",
  bank: "Banco",
  wallet: "Billetera",
  other: "Otra",
};

export function AccountsManager() {
  const { user } = useAuth();
  const [accounts, setAccounts] = useState<Account[]>([]);
  const [isOpen, setIsOpen] = useState(false);
  const [editing, setEditing] = useState<Account | null>(null);
  const [form, setForm] = useState({
    name: "",
    account_type: "cash",
    currency: "MXN",
    initial_balance: "0",
    is_active: true,
    notes: "",
  });

  useEffect(() => { fetch(); }, []);

  const fetch = async () => {
    const { data, error } = await supabase.from("accounts").select("*").order("created_at", { ascending: true });
    if (error) { toast.error("Error al cargar cuentas"); return; }
    setAccounts((data || []) as Account[]);
  };

  const openNew = () => {
    setEditing(null);
    setForm({ name: "", account_type: "cash", currency: "MXN", initial_balance: "0", is_active: true, notes: "" });
    setIsOpen(true);
  };

  const openEdit = (acc: Account) => {
    setEditing(acc);
    setForm({
      name: acc.name,
      account_type: acc.account_type,
      currency: acc.currency,
      initial_balance: String(acc.initial_balance),
      is_active: acc.is_active,
      notes: acc.notes || "",
    });
    setIsOpen(true);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    const payload = {
      name: form.name,
      account_type: form.account_type as Account["account_type"],
      currency: form.currency,
      initial_balance: parseFloat(form.initial_balance) || 0,
      is_active: form.is_active,
      notes: form.notes || null,
    };
    const { error } = editing
      ? await supabase.from("accounts").update(payload).eq("id", editing.id)
      : await supabase.from("accounts").insert([{ ...payload, created_by: user?.id }]);
    if (error) { toast.error(error.message); return; }
    toast.success(editing ? "Cuenta actualizada" : "Cuenta creada");
    setIsOpen(false);
    fetch();
  };

  const handleDelete = async (id: string) => {
    if (!confirm("¿Eliminar esta cuenta? Los movimientos quedarán sin cuenta asociada.")) return;
    const { error } = await supabase.from("accounts").delete().eq("id", id);
    if (error) { toast.error(error.message); return; }
    toast.success("Cuenta eliminada");
    fetch();
  };

  return (
    <div className="space-y-3">
      <div className="flex items-center justify-between">
        <h2 className="text-sm font-semibold text-muted-foreground uppercase tracking-wider">Cuentas</h2>
        <Button size="sm" onClick={openNew} className="h-9 rounded-xl gap-1 text-xs font-semibold">
          <Plus className="h-3.5 w-3.5" />
          Nueva
        </Button>
      </div>

      <div className="grid gap-2">
        {accounts.map((acc) => {
          const Icon = TYPE_ICON[acc.account_type] || Wallet;
          return (
            <div key={acc.id} className="bg-card rounded-2xl p-3 shadow-fintech-sm flex items-center gap-3">
              <div className="w-10 h-10 rounded-xl bg-primary/10 flex items-center justify-center flex-shrink-0">
                <Icon className="h-5 w-5 text-primary" />
              </div>
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2">
                  <p className="text-sm font-semibold truncate">{acc.name}</p>
                  {!acc.is_active && (
                    <span className="text-[10px] bg-muted text-muted-foreground px-1.5 py-0.5 rounded">Inactiva</span>
                  )}
                </div>
                <p className="text-xs text-muted-foreground">
                  {TYPE_LABEL[acc.account_type]} · {acc.currency}
                </p>
              </div>
              <div className="flex items-center gap-1 flex-shrink-0">
                <Button size="icon" variant="ghost" className="h-8 w-8" onClick={() => openEdit(acc)}>
                  <Pencil className="h-3.5 w-3.5" />
                </Button>
                <Button size="icon" variant="ghost" className="h-8 w-8 text-destructive" onClick={() => handleDelete(acc.id)}>
                  <Trash2 className="h-3.5 w-3.5" />
                </Button>
              </div>
            </div>
          );
        })}
        {accounts.length === 0 && (
          <div className="text-center py-6 text-muted-foreground text-sm">Sin cuentas</div>
        )}
      </div>

      <Dialog open={isOpen} onOpenChange={setIsOpen}>
        <DialogContent className="rounded-2xl">
          <DialogHeader>
            <DialogTitle className="text-lg font-bold">{editing ? "Editar cuenta" : "Nueva cuenta"}</DialogTitle>
          </DialogHeader>
          <form onSubmit={handleSubmit} className="space-y-4">
            <div className="space-y-1">
              <Label className="text-xs font-medium text-muted-foreground uppercase tracking-wider">Nombre</Label>
              <Input value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} required
                placeholder="Caja Principal" className="h-12 rounded-xl" />
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1">
                <Label className="text-xs font-medium text-muted-foreground uppercase tracking-wider">Tipo</Label>
                <Select value={form.account_type} onValueChange={(v) => setForm({ ...form, account_type: v })}>
                  <SelectTrigger className="h-12 rounded-xl"><SelectValue /></SelectTrigger>
                  <SelectContent className="bg-popover">
                    <SelectItem value="cash">Efectivo</SelectItem>
                    <SelectItem value="bank">Banco</SelectItem>
                    <SelectItem value="wallet">Billetera</SelectItem>
                    <SelectItem value="other">Otra</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-1">
                <Label className="text-xs font-medium text-muted-foreground uppercase tracking-wider">Divisa</Label>
                <Select value={form.currency} onValueChange={(v) => setForm({ ...form, currency: v })}>
                  <SelectTrigger className="h-12 rounded-xl"><SelectValue /></SelectTrigger>
                  <SelectContent className="bg-popover">
                    <SelectItem value="MXN">MXN</SelectItem>
                    <SelectItem value="USD">USD</SelectItem>
                    <SelectItem value="EUR">EUR</SelectItem>
                    <SelectItem value="CUP">CUP</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </div>
            <div className="space-y-1">
              <Label className="text-xs font-medium text-muted-foreground uppercase tracking-wider">Saldo inicial</Label>
              <Input type="number" step="0.01" value={form.initial_balance}
                onChange={(e) => setForm({ ...form, initial_balance: e.target.value })}
                className="h-12 rounded-xl text-center text-lg font-semibold" />
            </div>
            <div className="space-y-1">
              <Label className="text-xs font-medium text-muted-foreground uppercase tracking-wider">Notas</Label>
              <Textarea value={form.notes} onChange={(e) => setForm({ ...form, notes: e.target.value })} className="rounded-xl" />
            </div>
            <div className="flex items-center justify-between bg-muted/50 rounded-xl px-3 py-2">
              <Label className="text-sm font-medium">Activa</Label>
              <Switch checked={form.is_active} onCheckedChange={(v) => setForm({ ...form, is_active: v })} />
            </div>
            <Button type="submit" className="w-full h-12 rounded-xl font-semibold">
              {editing ? "Guardar" : "Crear"}
            </Button>
          </form>
        </DialogContent>
      </Dialog>
    </div>
  );
}

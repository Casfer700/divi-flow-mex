import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Switch } from "@/components/ui/switch";
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { toast } from "sonner";
import { UsersRound, Plus, Pencil, Trash2 } from "lucide-react";

interface Agent {
  id: string;
  name: string;
  default_commission_mxn: number;
  is_active: boolean;
  notes: string | null;
}

export function SalesAgentsManager() {
  const [agents, setAgents] = useState<Agent[]>([]);
  const [open, setOpen] = useState(false);
  const [editing, setEditing] = useState<Agent | null>(null);
  const [form, setForm] = useState({ name: "", default_commission_mxn: "0", is_active: true, notes: "" });

  const load = async () => {
    const { data } = await supabase.from("sales_agents").select("*").order("name");
    setAgents((data as Agent[]) || []);
  };
  useEffect(() => { load(); }, []);

  const reset = () => {
    setEditing(null);
    setForm({ name: "", default_commission_mxn: "0", is_active: true, notes: "" });
  };

  const openEdit = (a: Agent) => {
    setEditing(a);
    setForm({
      name: a.name,
      default_commission_mxn: String(a.default_commission_mxn),
      is_active: a.is_active,
      notes: a.notes ?? "",
    });
    setOpen(true);
  };

  const submit = async () => {
    if (!form.name.trim()) return toast.error("Nombre obligatorio");
    const payload = {
      name: form.name.trim(),
      default_commission_mxn: parseFloat(form.default_commission_mxn) || 0,
      is_active: form.is_active,
      notes: form.notes.trim() || null,
    };
    const { data: { user } } = await supabase.auth.getUser();
    const op = editing
      ? supabase.from("sales_agents").update(payload).eq("id", editing.id)
      : supabase.from("sales_agents").insert({ ...payload, created_by: user?.id });
    const { error } = await op;
    if (error) return toast.error(error.message);
    toast.success(editing ? "Agente actualizado" : "Agente creado");
    setOpen(false); reset(); load();
  };

  const remove = async (id: string) => {
    if (!confirm("¿Eliminar agente?")) return;
    const { error } = await supabase.from("sales_agents").delete().eq("id", id);
    if (error) return toast.error(error.message);
    toast.success("Eliminado"); load();
  };

  return (
    <Card>
      <CardHeader className="pb-3">
        <div className="flex items-center justify-between">
          <CardTitle className="flex items-center gap-2 text-base">
            <UsersRound className="h-4 w-4" /> Agentes de venta
          </CardTitle>
          <Dialog open={open} onOpenChange={(v) => { setOpen(v); if (!v) reset(); }}>
            <DialogTrigger asChild>
              <Button size="sm" className="gap-1.5"><Plus className="h-4 w-4" /> Nuevo</Button>
            </DialogTrigger>
            <DialogContent className="max-w-md">
              <DialogHeader><DialogTitle>{editing ? "Editar agente" : "Nuevo agente"}</DialogTitle></DialogHeader>
              <div className="space-y-3">
                <div>
                  <Label>Nombre *</Label>
                  <Input value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} />
                </div>
                <div>
                  <Label>Comisión por defecto (opcional, MXN)</Label>
                  <Input type="number" step="0.01" value={form.default_commission_mxn}
                    onChange={(e) => setForm({ ...form, default_commission_mxn: e.target.value })} />
                </div>
                <div>
                  <Label>Notas</Label>
                  <Input value={form.notes} onChange={(e) => setForm({ ...form, notes: e.target.value })} />
                </div>
                <div className="flex items-center justify-between">
                  <Label>Activo</Label>
                  <Switch checked={form.is_active} onCheckedChange={(v) => setForm({ ...form, is_active: v })} />
                </div>
              </div>
              <DialogFooter>
                <Button variant="outline" onClick={() => setOpen(false)}>Cancelar</Button>
                <Button onClick={submit}>{editing ? "Guardar" : "Crear"}</Button>
              </DialogFooter>
            </DialogContent>
          </Dialog>
        </div>
      </CardHeader>
      <CardContent>
        {agents.length === 0 ? (
          <p className="text-xs text-muted-foreground text-center py-4">Sin agentes registrados.</p>
        ) : (
          <div className="space-y-1.5">
            {agents.map((a) => (
              <div key={a.id} className="rounded-lg border bg-card p-2.5 flex items-center justify-between gap-2">
                <div className="min-w-0 flex-1">
                  <div className="flex items-center gap-2">
                    <p className="font-semibold text-sm truncate">{a.name}</p>
                    {!a.is_active && (
                      <span className="text-[10px] px-1.5 py-0.5 rounded bg-muted text-muted-foreground">inactivo</span>
                    )}
                  </div>
                  <p className="text-[11px] text-muted-foreground">
                    {Number(a.default_commission_mxn) > 0
                      ? `Comisión por defecto: $${Number(a.default_commission_mxn).toFixed(2)} MXN`
                      : "Sin comisión por defecto"}
                  </p>
                </div>
                <div className="flex gap-1">
                  <Button size="icon" variant="ghost" className="h-8 w-8" onClick={() => openEdit(a)}>
                    <Pencil className="h-4 w-4" />
                  </Button>
                  <Button size="icon" variant="ghost" className="h-8 w-8 text-destructive" onClick={() => remove(a.id)}>
                    <Trash2 className="h-4 w-4" />
                  </Button>
                </div>
              </div>
            ))}
          </div>
        )}
      </CardContent>
    </Card>
  );
}

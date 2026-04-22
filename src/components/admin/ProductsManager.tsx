import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent } from "@/components/ui/card";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { toast } from "sonner";
import { Plus, Pencil, Trash2, Package } from "lucide-react";
import { Switch } from "@/components/ui/switch";

interface Product {
  id: string;
  name: string;
  description: string | null;
  base_price: number;
  currency: string;
  category: string | null;
  is_active: boolean;
  is_invoice_tracked: boolean;
}

const CURRENCIES = ["MXN", "USD", "EUR", "CUP"];

export function ProductsManager() {
  const [products, setProducts] = useState<Product[]>([]);
  const [loading, setLoading] = useState(true);
  const [open, setOpen] = useState(false);
  const [editing, setEditing] = useState<Product | null>(null);
  const [form, setForm] = useState({
    name: "",
    description: "",
    base_price: "",
    currency: "MXN",
    category: "",
    is_active: true,
    is_invoice_tracked: false,
  });

  const load = async () => {
    setLoading(true);
    const { data, error } = await supabase
      .from("products")
      .select("*")
      .order("created_at", { ascending: false });
    if (error) toast.error("Error al cargar productos");
    else setProducts(data || []);
    setLoading(false);
  };

  useEffect(() => {
    load();
  }, []);

  const reset = () => {
    setEditing(null);
    setForm({ name: "", description: "", base_price: "", currency: "MXN", category: "", is_active: true, is_invoice_tracked: false });
  };

  const openEdit = (p: Product) => {
    setEditing(p);
    setForm({
      name: p.name,
      description: p.description ?? "",
      base_price: String(p.base_price),
      currency: p.currency,
      category: p.category ?? "",
      is_active: p.is_active,
      is_invoice_tracked: p.is_invoice_tracked ?? false,
    });
    setOpen(true);
  };

  const submit = async () => {
    if (!form.name.trim() || !form.base_price) {
      toast.error("Nombre y precio son obligatorios");
      return;
    }
    const payload = {
      name: form.name.trim(),
      description: form.description.trim() || null,
      base_price: Number(form.base_price),
      currency: form.currency,
      category: form.category.trim() || null,
      is_active: form.is_active,
      is_invoice_tracked: form.is_invoice_tracked,
    };

    const { data: { user } } = await supabase.auth.getUser();
    const op = editing
      ? supabase.from("products").update(payload).eq("id", editing.id)
      : supabase.from("products").insert({ ...payload, created_by: user?.id });

    const { error } = await op;
    if (error) {
      toast.error(error.message);
      return;
    }
    toast.success(editing ? "Producto actualizado" : "Producto creado");
    setOpen(false);
    reset();
    load();
  };

  const remove = async (id: string) => {
    if (!confirm("¿Eliminar este producto?")) return;
    const { error } = await supabase.from("products").delete().eq("id", id);
    if (error) toast.error(error.message);
    else {
      toast.success("Producto eliminado");
      load();
    }
  };

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <h2 className="text-lg font-bold flex items-center gap-2">
          <Package className="h-5 w-5" /> Productos
        </h2>
        <Dialog open={open} onOpenChange={(o) => { setOpen(o); if (!o) reset(); }}>
          <DialogTrigger asChild>
            <Button size="sm" className="gap-1.5 h-9">
              <Plus className="h-4 w-4" /> Nuevo
            </Button>
          </DialogTrigger>
          <DialogContent className="max-w-md">
            <DialogHeader>
              <DialogTitle>{editing ? "Editar producto" : "Nuevo producto"}</DialogTitle>
            </DialogHeader>
            <div className="space-y-3">
              <div>
                <Label>Nombre *</Label>
                <Input value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} />
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <Label>Precio *</Label>
                  <Input
                    type="number"
                    step="0.01"
                    value={form.base_price}
                    onChange={(e) => setForm({ ...form, base_price: e.target.value })}
                  />
                </div>
                <div>
                  <Label>Divisa</Label>
                  <Select value={form.currency} onValueChange={(v) => setForm({ ...form, currency: v })}>
                    <SelectTrigger><SelectValue /></SelectTrigger>
                    <SelectContent>
                      {CURRENCIES.map((c) => <SelectItem key={c} value={c}>{c}</SelectItem>)}
                    </SelectContent>
                  </Select>
                </div>
              </div>
              <div>
                <Label>Categoría</Label>
                <Input value={form.category} onChange={(e) => setForm({ ...form, category: e.target.value })} />
              </div>
              <div>
                <Label>Descripción</Label>
                <Input value={form.description} onChange={(e) => setForm({ ...form, description: e.target.value })} />
              </div>
              <div className="flex items-center justify-between">
                <Label>Activo</Label>
                <Switch checked={form.is_active} onCheckedChange={(v) => setForm({ ...form, is_active: v })} />
              </div>
              <div className="flex items-center justify-between">
                <div>
                  <Label>Rastrear por factura</Label>
                  <p className="text-[10px] text-muted-foreground">Cada unidad = una factura. POS pedirá elegirla.</p>
                </div>
                <Switch checked={form.is_invoice_tracked} onCheckedChange={(v) => setForm({ ...form, is_invoice_tracked: v })} />
              </div>
              <Button className="w-full h-11" onClick={submit}>
                {editing ? "Guardar cambios" : "Crear producto"}
              </Button>
            </div>
          </DialogContent>
        </Dialog>
      </div>

      {loading ? (
        <p className="text-sm text-muted-foreground">Cargando...</p>
      ) : products.length === 0 ? (
        <Card><CardContent className="p-6 text-center text-sm text-muted-foreground">Sin productos</CardContent></Card>
      ) : (
        <div className="space-y-2">
          {products.map((p) => (
            <Card key={p.id}>
              <CardContent className="p-3 flex items-center justify-between gap-2">
                <div className="min-w-0 flex-1">
                  <div className="flex items-center gap-2">
                    <p className="font-semibold truncate">{p.name}</p>
                    {!p.is_active && (
                      <span className="text-[10px] px-1.5 py-0.5 rounded bg-muted text-muted-foreground">inactivo</span>
                    )}
                  </div>
                  <p className="text-xs text-muted-foreground truncate">
                    {p.category ? `${p.category} · ` : ""}{p.base_price.toFixed(2)} {p.currency}
                  </p>
                </div>
                <div className="flex gap-1">
                  <Button size="icon" variant="ghost" className="h-9 w-9" onClick={() => openEdit(p)}>
                    <Pencil className="h-4 w-4" />
                  </Button>
                  <Button size="icon" variant="ghost" className="h-9 w-9 text-destructive" onClick={() => remove(p.id)}>
                    <Trash2 className="h-4 w-4" />
                  </Button>
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      )}
    </div>
  );
}

import { useEffect, useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";
import { Layout } from "@/components/Layout";
import { useAuth } from "@/contexts/AuthContext";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent } from "@/components/ui/card";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { toast } from "sonner";
import { Search, ShoppingCart, Check, Receipt, X } from "lucide-react";

interface Product {
  id: string;
  name: string;
  base_price: number;
  currency: string;
  category: string | null;
}

interface Account {
  id: string;
  name: string;
  currency: string;
}

interface RecentSale {
  id: string;
  product_name: string;
  total_amount: number;
  currency: string;
  sales_agent: string | null;
  sale_date: string;
}

export default function POS() {
  const { profile } = useAuth();
  const navigate = useNavigate();
  const [products, setProducts] = useState<Product[]>([]);
  const [accounts, setAccounts] = useState<Account[]>([]);
  const [recent, setRecent] = useState<RecentSale[]>([]);
  const [search, setSearch] = useState("");
  const [selected, setSelected] = useState<Product | null>(null);
  const [price, setPrice] = useState("");
  const [quantity, setQuantity] = useState("1");
  const [paymentMethod, setPaymentMethod] = useState<"cash" | "transfer">("cash");
  const [accountId, setAccountId] = useState<string>("");
  const [salesAgent, setSalesAgent] = useState("");
  const [notes, setNotes] = useState("");
  const [submitting, setSubmitting] = useState(false);

  useEffect(() => {
    if (profile && profile.role !== "admin" && profile.role !== "local") {
      navigate("/");
    }
  }, [profile, navigate]);

  const load = async () => {
    const [{ data: prods }, { data: accs }, { data: sales }] = await Promise.all([
      supabase.from("products").select("*").eq("is_active", true).order("name"),
      supabase.from("accounts").select("id,name,currency").eq("is_active", true).order("name"),
      supabase
        .from("pos_sales")
        .select("id,product_name,total_amount,currency,sales_agent,sale_date")
        .order("sale_date", { ascending: false })
        .limit(8),
    ]);
    setProducts(prods || []);
    setAccounts(accs || []);
    setRecent(sales || []);
  };

  useEffect(() => {
    load();
  }, []);

  const filtered = useMemo(() => {
    const q = search.toLowerCase().trim();
    if (!q) return products;
    return products.filter(
      (p) =>
        p.name.toLowerCase().includes(q) ||
        (p.category ?? "").toLowerCase().includes(q),
    );
  }, [products, search]);

  const matchingAccounts = useMemo(
    () => accounts.filter((a) => !selected || a.currency === selected.currency),
    [accounts, selected],
  );

  const total = useMemo(() => {
    const p = parseFloat(price) || 0;
    const q = parseFloat(quantity) || 0;
    return p * q;
  }, [price, quantity]);

  const pickProduct = (p: Product) => {
    setSelected(p);
    setPrice(String(p.base_price));
    setQuantity("1");
    setAccountId("");
  };

  const clear = () => {
    setSelected(null);
    setPrice("");
    setQuantity("1");
    setNotes("");
    setAccountId("");
  };

  const confirm = async () => {
    if (!selected) {
      toast.error("Selecciona un producto");
      return;
    }
    const unit = parseFloat(price);
    const qty = parseFloat(quantity);
    if (!unit || unit <= 0) {
      toast.error("Precio inválido");
      return;
    }
    if (!qty || qty <= 0) {
      toast.error("Cantidad inválida");
      return;
    }

    setSubmitting(true);
    const { data: { user } } = await supabase.auth.getUser();

    const { error } = await supabase.from("pos_sales").insert({
      product_id: selected.id,
      product_name: selected.name,
      unit_price: unit,
      quantity: qty,
      total_amount: unit * qty,
      currency: selected.currency,
      payment_method: paymentMethod,
      account_id: accountId || null,
      sales_agent: salesAgent.trim() || null,
      notes: notes.trim() || null,
      created_by: user?.id,
    });

    setSubmitting(false);
    if (error) {
      toast.error(error.message);
      return;
    }
    toast.success("Venta registrada");
    clear();
    load();
  };

  if (profile && profile.role !== "admin" && profile.role !== "local") return null;

  return (
    <Layout>
      <div className="space-y-5">
        <div>
          <h1 className="text-xl font-bold flex items-center gap-2">
            <ShoppingCart className="h-5 w-5" /> POS
          </h1>
          <p className="text-xs text-muted-foreground">Registra ventas rápidas</p>
        </div>

        {/* Selected product summary */}
        {selected && (
          <Card className="border-primary/40 bg-primary/5">
            <CardContent className="p-3">
              <div className="flex items-start justify-between gap-2">
                <div className="min-w-0">
                  <p className="text-[11px] uppercase text-muted-foreground tracking-wide">Producto</p>
                  <p className="font-bold truncate">{selected.name}</p>
                  <p className="text-xs text-muted-foreground">
                    Base: {selected.base_price.toFixed(2)} {selected.currency}
                  </p>
                </div>
                <Button size="icon" variant="ghost" className="h-8 w-8" onClick={clear}>
                  <X className="h-4 w-4" />
                </Button>
              </div>

              <div className="grid grid-cols-2 gap-3 mt-3">
                <div>
                  <Label className="text-xs">Precio unidad</Label>
                  <Input
                    type="number"
                    step="0.01"
                    value={price}
                    onChange={(e) => setPrice(e.target.value)}
                    className="h-11"
                  />
                </div>
                <div>
                  <Label className="text-xs">Cantidad</Label>
                  <Input
                    type="number"
                    step="0.01"
                    value={quantity}
                    onChange={(e) => setQuantity(e.target.value)}
                    className="h-11"
                  />
                </div>
              </div>

              <div className="grid grid-cols-2 gap-3 mt-3">
                <div>
                  <Label className="text-xs">Método</Label>
                  <Select value={paymentMethod} onValueChange={(v: "cash" | "transfer") => setPaymentMethod(v)}>
                    <SelectTrigger className="h-11"><SelectValue /></SelectTrigger>
                    <SelectContent>
                      <SelectItem value="cash">Efectivo</SelectItem>
                      <SelectItem value="transfer">Transferencia</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
                <div>
                  <Label className="text-xs">Cuenta</Label>
                  <Select value={accountId} onValueChange={setAccountId}>
                    <SelectTrigger className="h-11"><SelectValue placeholder="Opcional" /></SelectTrigger>
                    <SelectContent>
                      {matchingAccounts.length === 0 && (
                        <SelectItem value="__none" disabled>Sin cuentas {selected.currency}</SelectItem>
                      )}
                      {matchingAccounts.map((a) => (
                        <SelectItem key={a.id} value={a.id}>{a.name}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
              </div>

              <div className="mt-3">
                <Label className="text-xs">Agente de ventas</Label>
                <Input
                  value={salesAgent}
                  onChange={(e) => setSalesAgent(e.target.value)}
                  placeholder="Nombre del agente"
                  className="h-11"
                />
              </div>

              <div className="mt-3">
                <Label className="text-xs">Notas</Label>
                <Input value={notes} onChange={(e) => setNotes(e.target.value)} className="h-11" />
              </div>

              <div className="mt-4 flex items-center justify-between bg-card rounded-lg p-3">
                <span className="text-sm text-muted-foreground">Total</span>
                <span className="text-xl font-bold">
                  {total.toFixed(2)} {selected.currency}
                </span>
              </div>

              <Button
                className="w-full h-12 mt-3 gap-2"
                onClick={confirm}
                disabled={submitting}
              >
                <Check className="h-5 w-5" />
                {submitting ? "Procesando..." : "Confirmar venta"}
              </Button>
            </CardContent>
          </Card>
        )}

        {/* Product picker */}
        <div className="space-y-2">
          <div className="relative">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
            <Input
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Buscar producto..."
              className="h-11 pl-10"
            />
          </div>

          {filtered.length === 0 ? (
            <Card>
              <CardContent className="p-6 text-center text-sm text-muted-foreground">
                {products.length === 0
                  ? "Sin productos. Crea uno en Admin → Productos."
                  : "Sin resultados"}
              </CardContent>
            </Card>
          ) : (
            <div className="grid grid-cols-2 gap-2">
              {filtered.map((p) => {
                const active = selected?.id === p.id;
                return (
                  <button
                    key={p.id}
                    onClick={() => pickProduct(p)}
                    className={`text-left rounded-xl border p-3 transition ${
                      active
                        ? "border-primary bg-primary/10"
                        : "border-border bg-card hover:border-primary/40"
                    }`}
                  >
                    <p className="font-semibold text-sm truncate">{p.name}</p>
                    {p.category && (
                      <p className="text-[10px] text-muted-foreground truncate">{p.category}</p>
                    )}
                    <p className="text-sm font-bold mt-1">
                      {p.base_price.toFixed(2)} <span className="text-[10px] text-muted-foreground">{p.currency}</span>
                    </p>
                  </button>
                );
              })}
            </div>
          )}
        </div>

        {/* Recent sales */}
        {recent.length > 0 && (
          <div className="space-y-2">
            <h2 className="text-sm font-bold flex items-center gap-2">
              <Receipt className="h-4 w-4" /> Ventas recientes
            </h2>
            <div className="space-y-1.5">
              {recent.map((s) => (
                <Card key={s.id}>
                  <CardContent className="p-3 flex items-center justify-between">
                    <div className="min-w-0">
                      <p className="text-sm font-semibold truncate">{s.product_name}</p>
                      <p className="text-[11px] text-muted-foreground">
                        {new Date(s.sale_date).toLocaleString("es-MX", {
                          day: "2-digit", month: "short", hour: "2-digit", minute: "2-digit",
                        })}
                        {s.sales_agent ? ` · ${s.sales_agent}` : ""}
                      </p>
                    </div>
                    <span className="font-bold text-sm">
                      {Number(s.total_amount).toFixed(2)} {s.currency}
                    </span>
                  </CardContent>
                </Card>
              ))}
            </div>
          </div>
        )}
      </div>
    </Layout>
  );
}

import { useState, useEffect } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Layout } from "@/components/Layout";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Textarea } from "@/components/ui/textarea";
import { toast } from "sonner";
import { Search, Plus, Phone, MapPin, Edit, Trash2, MessageCircle } from "lucide-react";
import { useAuth } from "@/contexts/AuthContext";

interface Customer {
  id: string;
  name: string;
  phone_mx: string;
  phone_cu: string | null;
  address: string;
  notes: string | null;
}

export default function Customers() {
  const { user } = useAuth();
  const [customers, setCustomers] = useState<Customer[]>([]);
  const [searchTerm, setSearchTerm] = useState("");
  const [isDialogOpen, setIsDialogOpen] = useState(false);
  const [editingCustomer, setEditingCustomer] = useState<Customer | null>(null);
  const [formData, setFormData] = useState({
    name: "", phone_mx: "", phone_cu: "", address: "", notes: "",
  });

  useEffect(() => { fetchCustomers(); }, []);

  const fetchCustomers = async () => {
    const { data, error } = await supabase.from("customers").select("*").order("name");
    if (error) { toast.error("Error al cargar clientes"); return; }
    setCustomers(data || []);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (editingCustomer) {
      const { error } = await supabase.from("customers").update(formData).eq("id", editingCustomer.id);
      if (error) { toast.error("Error al actualizar cliente"); return; }
      toast.success("Cliente actualizado");
    } else {
      const { error } = await supabase.from("customers").insert([{ ...formData, created_by: user?.id }]);
      if (error) { toast.error("Error al crear cliente"); return; }
      toast.success("Cliente creado");
    }
    setIsDialogOpen(false);
    setEditingCustomer(null);
    setFormData({ name: "", phone_mx: "", phone_cu: "", address: "", notes: "" });
    fetchCustomers();
  };

  const handleEdit = (customer: Customer) => {
    setEditingCustomer(customer);
    setFormData({ name: customer.name, phone_mx: customer.phone_mx, phone_cu: customer.phone_cu || "", address: customer.address, notes: customer.notes || "" });
    setIsDialogOpen(true);
  };

  const handleDelete = async (id: string) => {
    if (!confirm("¿Eliminar este cliente?")) return;
    const { error } = await supabase.from("customers").delete().eq("id", id);
    if (error) { toast.error("Error al eliminar cliente"); return; }
    toast.success("Cliente eliminado");
    fetchCustomers();
  };

  const openWhatsApp = (phone: string) => {
    const clean = phone.replace(/\D/g, "");
    window.open(`https://wa.me/${clean}`, "_blank");
  };

  const callPhone = (phone: string) => {
    window.open(`tel:${phone}`, "_self");
  };

  const filteredCustomers = customers.filter((c) =>
    c.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
    c.phone_mx.includes(searchTerm) ||
    c.phone_cu?.includes(searchTerm) ||
    c.address.toLowerCase().includes(searchTerm.toLowerCase())
  );

  return (
    <Layout>
      <div className="space-y-4">
        <div className="flex items-center justify-between">
          <h1 className="text-xl font-bold">Clientes</h1>
          <Button
            onClick={() => { setEditingCustomer(null); setFormData({ name: "", phone_mx: "", phone_cu: "", address: "", notes: "" }); setIsDialogOpen(true); }}
            size="sm" className="h-10 rounded-xl gap-1.5 font-semibold"
          >
            <Plus className="h-4 w-4" />
            Nuevo
          </Button>
        </div>

        <div className="relative">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
          <Input
            placeholder="Buscar cliente..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            className="pl-10 h-12 rounded-xl bg-card border-0 shadow-fintech-sm"
          />
        </div>

        <div className="space-y-3">
          {filteredCustomers.map((customer) => (
            <div key={customer.id} className="bg-card rounded-2xl shadow-fintech-md p-4 space-y-3 animate-fade-in">
              <div className="flex items-start justify-between">
                <div className="flex-1 min-w-0">
                  <h3 className="font-semibold text-base">{customer.name}</h3>
                  <div className="flex items-center gap-1 mt-1">
                    <MapPin className="h-3 w-3 text-muted-foreground flex-shrink-0" />
                    <p className="text-xs text-muted-foreground truncate">{customer.address}</p>
                  </div>
                </div>
              </div>

              <div className="space-y-1.5">
                <div className="flex items-center gap-2 text-sm">
                  <Phone className="h-3.5 w-3.5 text-muted-foreground" />
                  <span className="text-sm">MX: {customer.phone_mx}</span>
                </div>
                {customer.phone_cu && (
                  <div className="flex items-center gap-2 text-sm">
                    <Phone className="h-3.5 w-3.5 text-muted-foreground" />
                    <span className="text-sm">CU: {customer.phone_cu}</span>
                  </div>
                )}
              </div>

              {customer.notes && (
                <p className="text-xs text-muted-foreground bg-muted/50 rounded-xl px-3 py-2 italic">{customer.notes}</p>
              )}

              <div className="flex gap-2">
                <Button variant="outline" size="sm" onClick={() => callPhone(customer.phone_mx)}
                  className="flex-1 h-10 rounded-xl gap-1 text-xs font-medium">
                  <Phone className="h-3.5 w-3.5" />
                  Llamar
                </Button>
                <Button variant="outline" size="sm" onClick={() => openWhatsApp(customer.phone_mx)}
                  className="flex-1 h-10 rounded-xl gap-1 text-xs font-medium">
                  <MessageCircle className="h-3.5 w-3.5" />
                  WhatsApp
                </Button>
                <Button variant="outline" size="sm" onClick={() => handleEdit(customer)}
                  className="h-10 w-10 rounded-xl p-0">
                  <Edit className="h-3.5 w-3.5" />
                </Button>
                <Button variant="outline" size="sm" onClick={() => handleDelete(customer.id)}
                  className="h-10 w-10 rounded-xl p-0 text-destructive hover:text-destructive">
                  <Trash2 className="h-3.5 w-3.5" />
                </Button>
              </div>
            </div>
          ))}
        </div>

        {filteredCustomers.length === 0 && (
          <div className="text-center py-16 text-muted-foreground text-sm">
            {searchTerm ? "Sin resultados" : "No hay clientes registrados"}
          </div>
        )}
      </div>

      <Dialog open={isDialogOpen} onOpenChange={setIsDialogOpen}>
        <DialogContent className="max-w-md rounded-2xl">
          <DialogHeader>
            <DialogTitle className="text-lg font-bold">
              {editingCustomer ? "Editar cliente" : "Nuevo cliente"}
            </DialogTitle>
          </DialogHeader>
          <form onSubmit={handleSubmit} className="space-y-4">
            {[
              { id: "name", label: "Nombre completo", value: formData.name, required: true },
              { id: "phone_mx", label: "Teléfono México", value: formData.phone_mx, required: true, placeholder: "+52 1234567890" },
              { id: "phone_cu", label: "Teléfono Cuba", value: formData.phone_cu, placeholder: "+53 12345678" },
            ].map(field => (
              <div key={field.id} className="space-y-1">
                <Label className="text-xs font-medium text-muted-foreground uppercase tracking-wider">{field.label}</Label>
                <Input
                  value={field.value}
                  onChange={(e) => setFormData({ ...formData, [field.id]: e.target.value })}
                  required={field.required}
                  placeholder={field.placeholder}
                  className="h-12 rounded-xl bg-secondary/50 border-0"
                />
              </div>
            ))}
            <div className="space-y-1">
              <Label className="text-xs font-medium text-muted-foreground uppercase tracking-wider">Dirección</Label>
              <Textarea value={formData.address} onChange={(e) => setFormData({ ...formData, address: e.target.value })}
                required className="rounded-xl bg-secondary/50 border-0" />
            </div>
            <div className="space-y-1">
              <Label className="text-xs font-medium text-muted-foreground uppercase tracking-wider">Notas</Label>
              <Textarea value={formData.notes} onChange={(e) => setFormData({ ...formData, notes: e.target.value })}
                className="rounded-xl bg-secondary/50 border-0" />
            </div>
            <Button type="submit" className="w-full h-12 rounded-xl font-semibold">
              {editingCustomer ? "Actualizar" : "Crear"}
            </Button>
          </form>
        </DialogContent>
      </Dialog>
    </Layout>
  );
}

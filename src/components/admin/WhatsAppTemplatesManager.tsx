import { useState, useEffect } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from "@/components/ui/dialog";
import { toast } from "sonner";
import { Plus, Save, Trash2, Info, MessageCircle } from "lucide-react";

interface WhatsAppTemplate {
  id: string;
  name: string;
  template: string;
  description: string | null;
}

export function WhatsAppTemplatesManager() {
  const [templates, setTemplates] = useState<WhatsAppTemplate[]>([]);
  const [selectedTemplate, setSelectedTemplate] = useState<WhatsAppTemplate | null>(null);
  const [isDialogOpen, setIsDialogOpen] = useState(false);
  const [formData, setFormData] = useState({ name: "", template: "", description: "" });

  useEffect(() => { fetchTemplates(); }, []);

  const fetchTemplates = async () => {
    const { data, error } = await supabase.from("whatsapp_templates").select("*").order("created_at", { ascending: false });
    if (error) { toast.error("Error al cargar plantillas"); return; }
    setTemplates(data || []);
  };

  const handleSave = async () => {
    if (!formData.name || !formData.template) { toast.error("Nombre y plantilla obligatorios"); return; }
    if (selectedTemplate) {
      const { error } = await supabase.from("whatsapp_templates").update({ name: formData.name, template: formData.template, description: formData.description }).eq("id", selectedTemplate.id);
      if (error) { toast.error("Error al actualizar"); return; }
      toast.success("Plantilla actualizada");
    } else {
      const { error } = await supabase.from("whatsapp_templates").insert([formData]);
      if (error) { toast.error("Error al crear"); return; }
      toast.success("Plantilla creada");
    }
    setIsDialogOpen(false);
    setFormData({ name: "", template: "", description: "" });
    setSelectedTemplate(null);
    fetchTemplates();
  };

  const handleDelete = async (id: string) => {
    const { error } = await supabase.from("whatsapp_templates").delete().eq("id", id);
    if (error) { toast.error("Error al eliminar"); return; }
    toast.success("Plantilla eliminada");
    fetchTemplates();
  };

  return (
    <div className="space-y-3">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <MessageCircle className="h-4 w-4 text-primary" />
          <h2 className="text-sm font-semibold text-muted-foreground uppercase tracking-wider">Plantillas WhatsApp</h2>
        </div>
        <Button size="sm" onClick={() => { setSelectedTemplate(null); setFormData({ name: "", template: "", description: "" }); setIsDialogOpen(true); }}
          className="h-9 rounded-xl gap-1 text-xs font-semibold">
          <Plus className="h-3.5 w-3.5" /> Nueva
        </Button>
      </div>

      <div className="space-y-2">
        {templates.map((t) => (
          <div key={t.id} className="bg-card rounded-2xl shadow-fintech-sm p-4 space-y-2">
            <div className="flex items-start justify-between">
              <div>
                <p className="font-semibold text-sm">{t.name}</p>
                {t.description && <p className="text-xs text-muted-foreground">{t.description}</p>}
              </div>
              <div className="flex gap-1">
                <Button variant="ghost" size="sm" onClick={() => { setSelectedTemplate(t); setFormData({ name: t.name, template: t.template, description: t.description || "" }); setIsDialogOpen(true); }}
                  className="h-8 min-h-0 text-xs text-primary">Editar</Button>
                <Button variant="ghost" size="icon" onClick={() => handleDelete(t.id)}
                  className="h-8 w-8 min-h-0 text-destructive"><Trash2 className="h-3.5 w-3.5" /></Button>
              </div>
            </div>
            <pre className="text-xs bg-muted/50 rounded-xl p-3 whitespace-pre-wrap font-mono overflow-x-auto">{t.template}</pre>
          </div>
        ))}
        {templates.length === 0 && <div className="text-center py-8 text-muted-foreground text-sm">Sin plantillas</div>}
      </div>

      <div className="bg-muted/30 rounded-xl p-3 flex gap-2 items-start">
        <Info className="h-4 w-4 text-muted-foreground flex-shrink-0 mt-0.5" />
        <div className="text-xs text-muted-foreground space-y-0.5">
          <p className="font-medium">Variables disponibles:</p>
          {["{customer_name}", "{currency_amounts}", "{total_mxn}", "{address}", "{phone_mx}", "{payment_status}", "{delivery_status}"].map(v => (
            <code key={v} className="block bg-card px-1.5 py-0.5 rounded text-[10px]">{v}</code>
          ))}
        </div>
      </div>

      <Dialog open={isDialogOpen} onOpenChange={setIsDialogOpen}>
        <DialogContent className="max-w-lg rounded-2xl max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle className="text-lg font-bold">{selectedTemplate ? "Editar" : "Nueva"} Plantilla</DialogTitle>
            <DialogDescription className="text-xs">Usa las variables para personalizar el mensaje</DialogDescription>
          </DialogHeader>
          <div className="space-y-4 mt-2">
            <div className="space-y-1">
              <Label className="text-xs font-medium text-muted-foreground uppercase tracking-wider">Nombre</Label>
              <Input value={formData.name} onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                className="h-12 rounded-xl bg-secondary/50 border-0" />
            </div>
            <div className="space-y-1">
              <Label className="text-xs font-medium text-muted-foreground uppercase tracking-wider">Descripción</Label>
              <Input value={formData.description} onChange={(e) => setFormData({ ...formData, description: e.target.value })}
                className="h-12 rounded-xl bg-secondary/50 border-0" />
            </div>
            <div className="space-y-1">
              <Label className="text-xs font-medium text-muted-foreground uppercase tracking-wider">Plantilla</Label>
              <Textarea value={formData.template} onChange={(e) => setFormData({ ...formData, template: e.target.value })}
                className="min-h-[200px] rounded-xl bg-secondary/50 border-0 font-mono text-sm" />
            </div>
            <Button onClick={handleSave} className="w-full h-12 rounded-xl font-semibold gap-2">
              <Save className="h-4 w-4" /> Guardar
            </Button>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}

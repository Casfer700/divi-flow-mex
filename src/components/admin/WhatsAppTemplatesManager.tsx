import { useState, useEffect } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Textarea } from "@/components/ui/textarea";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { useToast } from "@/hooks/use-toast";
import { Plus, Save, Trash2, Info } from "lucide-react";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";

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
  const [formData, setFormData] = useState({
    name: "",
    template: "",
    description: "",
  });
  const { toast } = useToast();

  useEffect(() => {
    fetchTemplates();
  }, []);

  const fetchTemplates = async () => {
    const { data, error } = await supabase
      .from("whatsapp_templates")
      .select("*")
      .order("created_at", { ascending: false });

    if (error) {
      toast({
        title: "Error",
        description: "No se pudieron cargar las plantillas",
        variant: "destructive",
      });
      return;
    }

    setTemplates(data || []);
  };

  const handleSave = async () => {
    if (!formData.name || !formData.template) {
      toast({
        title: "Error",
        description: "El nombre y la plantilla son obligatorios",
        variant: "destructive",
      });
      return;
    }

    if (selectedTemplate) {
      const { error } = await supabase
        .from("whatsapp_templates")
        .update({
          name: formData.name,
          template: formData.template,
          description: formData.description,
        })
        .eq("id", selectedTemplate.id);

      if (error) {
        toast({
          title: "Error",
          description: "No se pudo actualizar la plantilla",
          variant: "destructive",
        });
        return;
      }

      toast({
        title: "Éxito",
        description: "Plantilla actualizada correctamente",
      });
    } else {
      const { error } = await supabase.from("whatsapp_templates").insert([
        {
          name: formData.name,
          template: formData.template,
          description: formData.description,
        },
      ]);

      if (error) {
        toast({
          title: "Error",
          description: "No se pudo crear la plantilla",
          variant: "destructive",
        });
        return;
      }

      toast({
        title: "Éxito",
        description: "Plantilla creada correctamente",
      });
    }

    setIsDialogOpen(false);
    resetForm();
    fetchTemplates();
  };

  const handleDelete = async (id: string) => {
    const { error } = await supabase
      .from("whatsapp_templates")
      .delete()
      .eq("id", id);

    if (error) {
      toast({
        title: "Error",
        description: "No se pudo eliminar la plantilla",
        variant: "destructive",
      });
      return;
    }

    toast({
      title: "Éxito",
      description: "Plantilla eliminada correctamente",
    });
    fetchTemplates();
  };

  const resetForm = () => {
    setFormData({ name: "", template: "", description: "" });
    setSelectedTemplate(null);
  };

  const openEditDialog = (template: WhatsAppTemplate) => {
    setSelectedTemplate(template);
    setFormData({
      name: template.name,
      template: template.template,
      description: template.description || "",
    });
    setIsDialogOpen(true);
  };

  const openNewDialog = () => {
    resetForm();
    setIsDialogOpen(true);
  };

  return (
    <Card>
      <CardHeader>
        <div className="flex items-center justify-between">
          <div>
            <CardTitle>Plantillas de WhatsApp</CardTitle>
            <CardDescription>
              Personaliza los mensajes de confirmación de órdenes
            </CardDescription>
          </div>
          <Dialog open={isDialogOpen} onOpenChange={setIsDialogOpen}>
            <DialogTrigger asChild>
              <Button onClick={openNewDialog}>
                <Plus className="w-4 h-4 mr-2" />
                Nueva Plantilla
              </Button>
            </DialogTrigger>
            <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
              <DialogHeader>
                <DialogTitle>
                  {selectedTemplate ? "Editar" : "Nueva"} Plantilla
                </DialogTitle>
                <DialogDescription>
                  Variables disponibles: {"{customer_name}"}, {"{currency_amounts}"}, {"{total_mxn}"}, {"{address}"}, {"{phone_mx}"}, {"{payment_status}"}, {"{delivery_status}"}
                </DialogDescription>
              </DialogHeader>
              <div className="space-y-4 mt-4">
                <div>
                  <Label htmlFor="name">Nombre de la plantilla</Label>
                  <Input
                    id="name"
                    value={formData.name}
                    onChange={(e) =>
                      setFormData({ ...formData, name: e.target.value })
                    }
                    placeholder="ej: confirmacion_pedido"
                  />
                </div>
                <div>
                  <Label htmlFor="description">Descripción</Label>
                  <Input
                    id="description"
                    value={formData.description}
                    onChange={(e) =>
                      setFormData({ ...formData, description: e.target.value })
                    }
                    placeholder="Descripción de la plantilla"
                  />
                </div>
                <div>
                  <Label htmlFor="template">Plantilla del mensaje</Label>
                  <Textarea
                    id="template"
                    value={formData.template}
                    onChange={(e) =>
                      setFormData({ ...formData, template: e.target.value })
                    }
                    placeholder="Escribe tu plantilla aquí..."
                    className="min-h-[300px] font-mono text-sm"
                  />
                </div>
                <Button onClick={handleSave} className="w-full">
                  <Save className="w-4 h-4 mr-2" />
                  Guardar Plantilla
                </Button>
              </div>
            </DialogContent>
          </Dialog>
        </div>
      </CardHeader>
      <CardContent>
        <div className="space-y-4">
          {templates.length === 0 ? (
            <div className="text-center py-8 text-muted-foreground">
              No hay plantillas configuradas
            </div>
          ) : (
            templates.map((template) => (
              <Card key={template.id}>
                <CardHeader>
                  <div className="flex items-start justify-between">
                    <div className="flex-1">
                      <CardTitle className="text-lg">{template.name}</CardTitle>
                      {template.description && (
                        <CardDescription>{template.description}</CardDescription>
                      )}
                    </div>
                    <div className="flex gap-2">
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={() => openEditDialog(template)}
                      >
                        Editar
                      </Button>
                      <Button
                        variant="destructive"
                        size="sm"
                        onClick={() => handleDelete(template.id)}
                      >
                        <Trash2 className="w-4 h-4" />
                      </Button>
                    </div>
                  </div>
                </CardHeader>
                <CardContent>
                  <div className="bg-muted p-4 rounded-md">
                    <pre className="text-sm whitespace-pre-wrap font-mono">
                      {template.template}
                    </pre>
                  </div>
                </CardContent>
              </Card>
            ))
          )}
          <Card className="bg-muted/50">
            <CardHeader>
              <div className="flex items-start gap-2">
                <Info className="w-5 h-5 text-muted-foreground mt-0.5" />
                <div>
                  <CardTitle className="text-sm">Variables disponibles</CardTitle>
                  <CardDescription className="mt-2 space-y-1 text-xs">
                    <div><code className="bg-background px-1 py-0.5 rounded">{"{customer_name}"}</code> - Nombre del cliente</div>
                    <div><code className="bg-background px-1 py-0.5 rounded">{"{currency_amounts}"}</code> - Lista de montos por divisa</div>
                    <div><code className="bg-background px-1 py-0.5 rounded">{"{total_mxn}"}</code> - Total en MXN</div>
                    <div><code className="bg-background px-1 py-0.5 rounded">{"{address}"}</code> - Dirección de entrega</div>
                    <div><code className="bg-background px-1 py-0.5 rounded">{"{phone_mx}"}</code> - Teléfono México</div>
                    <div><code className="bg-background px-1 py-0.5 rounded">{"{payment_status}"}</code> - Estado de pago</div>
                    <div><code className="bg-background px-1 py-0.5 rounded">{"{delivery_status}"}</code> - Estado de entrega</div>
                  </CardDescription>
                </div>
              </div>
            </CardHeader>
          </Card>
        </div>
      </CardContent>
    </Card>
  );
}
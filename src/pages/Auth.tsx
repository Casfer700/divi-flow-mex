import { useState, useEffect } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useNavigate } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { toast } from "sonner";
import { DollarSign } from "lucide-react";

export default function Auth() {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [fullName, setFullName] = useState("");
  const [role, setRole] = useState<"local" | "delivery">("local");
  const [isSignUp, setIsSignUp] = useState(false);
  const [loading, setLoading] = useState(false);
  const [availableRoles, setAvailableRoles] = useState<string[]>([]);
  const navigate = useNavigate();

  useEffect(() => {
    supabase.auth.getSession().then(({ data: { session } }) => {
      if (session) {
        navigate("/");
      }
    });
    checkAvailableRoles();
  }, [navigate]);

  const checkAvailableRoles = async () => {
    const { data, error } = await supabase
      .from("user_roles")
      .select("role");
    
    if (error) {
      console.error("Error checking roles:", error);
      setAvailableRoles(["local", "delivery"]);
      return;
    }

    const takenRoles = data.map(r => r.role as string);
    const available = ["local", "delivery"].filter(r => !takenRoles.includes(r));
    setAvailableRoles(available);
    
    // Set default to first available role
    if (available.length > 0 && !available.includes(role)) {
      setRole(available[0] as "local" | "delivery");
    }
  };

  const handleAuth = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);

    try {
      if (isSignUp) {
        const { data, error } = await supabase.auth.signUp({
          email,
          password,
          options: {
            data: {
              full_name: fullName,
              role: role,
            },
            emailRedirectTo: `${window.location.origin}/`,
          },
        });

        if (error) throw error;

        if (data.user) {
          // Insert role into user_roles table
          const { error: roleError } = await supabase
            .from("user_roles")
            .insert({ user_id: data.user.id, role: role });

          if (roleError) {
            toast.error(`Error al asignar rol: ${roleError.message}`);
          } else {
            toast.success("Cuenta creada. Por favor revisa tu email.");
            checkAvailableRoles();
          }
        }
      } else {
        const { error } = await supabase.auth.signInWithPassword({
          email,
          password,
        });

        if (error) throw error;
        navigate("/");
      }
    } catch (error: any) {
      toast.error(error.message || "Error en la autenticación");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="flex min-h-screen items-center justify-center bg-background p-4">
      <Card className="w-full max-w-md">
        <CardHeader className="space-y-1 text-center">
          <div className="flex justify-center mb-4">
            <div className="rounded-full bg-primary p-3">
              <DollarSign className="h-8 w-8 text-primary-foreground" />
            </div>
          </div>
          <CardTitle className="text-2xl font-bold">
            {isSignUp ? "Crear cuenta" : "Iniciar sesión"}
          </CardTitle>
          <CardDescription>
            {isSignUp
              ? "Completa los datos para crear tu cuenta"
              : "Ingresa tus credenciales para continuar"}
          </CardDescription>
        </CardHeader>
        <CardContent>
          <form onSubmit={handleAuth} className="space-y-4">
            {isSignUp && (
              <>
                <div className="space-y-2">
                  <Label htmlFor="fullName">Nombre completo</Label>
                  <Input
                    id="fullName"
                    type="text"
                    placeholder="Juan Pérez"
                    value={fullName}
                    onChange={(e) => setFullName(e.target.value)}
                    required
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="role">Rol</Label>
                  <Select 
                    value={role} 
                    onValueChange={(value: "local" | "delivery") => setRole(value)}
                    disabled={availableRoles.length === 0}
                  >
                    <SelectTrigger>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent className="bg-popover">
                      <SelectItem value="local" disabled={!availableRoles.includes("local")}>
                        Local {!availableRoles.includes("local") && "(No disponible)"}
                      </SelectItem>
                      <SelectItem value="delivery" disabled={!availableRoles.includes("delivery")}>
                        Repartidor {!availableRoles.includes("delivery") && "(No disponible)"}
                      </SelectItem>
                    </SelectContent>
                  </Select>
                  {availableRoles.length === 0 && (
                    <p className="text-sm text-destructive">Todos los roles están ocupados</p>
                  )}
                </div>
              </>
            )}
            <div className="space-y-2">
              <Label htmlFor="email">Email</Label>
              <Input
                id="email"
                type="email"
                placeholder="tu@email.com"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                required
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="password">Contraseña</Label>
              <Input
                id="password"
                type="password"
                placeholder="••••••••"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                required
              />
            </div>
            <Button type="submit" className="w-full" disabled={loading || (isSignUp && availableRoles.length === 0)}>
              {loading ? "Procesando..." : isSignUp ? "Crear cuenta" : "Iniciar sesión"}
            </Button>
          </form>
          <div className="mt-4 text-center text-sm">
            <button
              type="button"
              onClick={() => setIsSignUp(!isSignUp)}
              className="text-primary hover:underline"
            >
              {isSignUp
                ? "¿Ya tienes cuenta? Inicia sesión"
                : "¿No tienes cuenta? Regístrate"}
            </button>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}

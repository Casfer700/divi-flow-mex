import { useState, useEffect } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useNavigate } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { toast } from "sonner";
import { ArrowRight, Eye, EyeOff } from "lucide-react";

export default function Auth() {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [fullName, setFullName] = useState("");
  const [role, setRole] = useState<"local" | "delivery">("local");
  const [isSignUp, setIsSignUp] = useState(false);
  const [loading, setLoading] = useState(false);
  const [showPassword, setShowPassword] = useState(false);
  const [availableRoles, setAvailableRoles] = useState<string[]>([]);
  const navigate = useNavigate();

  useEffect(() => {
    supabase.auth.getSession().then(({ data: { session } }) => {
      if (session) navigate("/");
    });
    checkAvailableRoles();
  }, [navigate]);

  const checkAvailableRoles = async () => {
    const { data, error } = await supabase.from("user_roles").select("role");
    if (error) {
      setAvailableRoles(["local", "delivery"]);
      return;
    }
    const takenRoles = data.map(r => r.role as string);
    const available = ["local", "delivery"].filter(r => !takenRoles.includes(r));
    setAvailableRoles(available);
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
          email, password,
          options: {
            data: { full_name: fullName, role },
            emailRedirectTo: `${window.location.origin}/`,
          },
        });
        if (error) throw error;
        if (data.user) {
          const { error: roleError } = await supabase
            .from("user_roles")
            .insert({ user_id: data.user.id, role });
          if (roleError) toast.error(`Error al asignar rol: ${roleError.message}`);
          else {
            toast.success("Cuenta creada. Revisa tu email.");
            checkAvailableRoles();
          }
        }
      } else {
        const { error } = await supabase.auth.signInWithPassword({ email, password });
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
    <div className="min-h-screen bg-background flex flex-col">
      {/* Header gradient area */}
      <div className="bg-primary pt-16 pb-24 px-6 rounded-b-[2rem]">
        <div className="max-w-sm mx-auto">
          <div className="w-12 h-12 rounded-2xl bg-primary-foreground/20 flex items-center justify-center mb-6">
            <span className="text-primary-foreground font-bold text-xl">D</span>
          </div>
          <h1 className="text-2xl font-bold text-primary-foreground">
            {isSignUp ? "Crear cuenta" : "Bienvenido"}
          </h1>
          <p className="text-primary-foreground/70 mt-1 text-sm">
            {isSignUp ? "Completa tus datos para comenzar" : "Inicia sesión para continuar"}
          </p>
        </div>
      </div>

      {/* Form card floating over gradient */}
      <div className="px-4 -mt-12 flex-1">
        <div className="max-w-sm mx-auto bg-card rounded-2xl shadow-fintech-lg p-6">
          <form onSubmit={handleAuth} className="space-y-5">
            {isSignUp && (
              <>
                <div className="space-y-2">
                  <Label className="text-xs font-medium text-muted-foreground uppercase tracking-wider">Nombre completo</Label>
                  <Input
                    type="text"
                    placeholder="Juan Pérez"
                    value={fullName}
                    onChange={(e) => setFullName(e.target.value)}
                    required
                    className="h-12 rounded-xl bg-secondary/50 border-0 text-sm"
                  />
                </div>
                <div className="space-y-2">
                  <Label className="text-xs font-medium text-muted-foreground uppercase tracking-wider">Rol</Label>
                  <Select value={role} onValueChange={(v: "local" | "delivery") => setRole(v)} disabled={availableRoles.length === 0}>
                    <SelectTrigger className="h-12 rounded-xl bg-secondary/50 border-0">
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
                </div>
              </>
            )}

            <div className="space-y-2">
              <Label className="text-xs font-medium text-muted-foreground uppercase tracking-wider">Email</Label>
              <Input
                type="email"
                placeholder="tu@email.com"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                required
                className="h-12 rounded-xl bg-secondary/50 border-0 text-sm"
              />
            </div>

            <div className="space-y-2">
              <Label className="text-xs font-medium text-muted-foreground uppercase tracking-wider">Contraseña</Label>
              <div className="relative">
                <Input
                  type={showPassword ? "text" : "password"}
                  placeholder="••••••••"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  required
                  className="h-12 rounded-xl bg-secondary/50 border-0 text-sm pr-12"
                />
                <button
                  type="button"
                  onClick={() => setShowPassword(!showPassword)}
                  className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground p-1"
                >
                  {showPassword ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                </button>
              </div>
            </div>

            <Button
              type="submit"
              className="w-full h-12 rounded-xl font-semibold text-sm gap-2"
              disabled={loading || (isSignUp && availableRoles.length === 0)}
            >
              {loading ? "Procesando..." : isSignUp ? "Crear cuenta" : "Iniciar sesión"}
              {!loading && <ArrowRight className="h-4 w-4" />}
            </Button>
          </form>

          <div className="mt-6 text-center">
            <button
              type="button"
              onClick={() => setIsSignUp(!isSignUp)}
              className="text-sm text-primary font-medium min-h-0"
            >
              {isSignUp ? "¿Ya tienes cuenta? Inicia sesión" : "¿No tienes cuenta? Regístrate"}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}

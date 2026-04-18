import { useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { Layout } from "@/components/Layout";
import { useAuth } from "@/contexts/AuthContext";
import { FinancialMovementsManager } from "@/components/admin/FinancialMovementsManager";

export default function Finance() {
  const { profile } = useAuth();
  const navigate = useNavigate();

  useEffect(() => {
    if (profile && profile.role !== "admin" && profile.role !== "local") {
      navigate("/");
    }
  }, [profile, navigate]);

  if (profile && profile.role !== "admin" && profile.role !== "local") return null;

  return (
    <Layout>
      <div className="space-y-5">
        <div>
          <h1 className="text-xl font-bold">Finanzas</h1>
          <p className="text-xs text-muted-foreground">Gestión unificada de ingresos y egresos</p>
        </div>
        <FinancialMovementsManager />
      </div>
    </Layout>
  );
}

import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { Layout } from "@/components/Layout";
import { useAuth } from "@/contexts/AuthContext";
import { FinancialMovementsManager } from "@/components/admin/FinancialMovementsManager";
import { ManualMovementsManager } from "@/components/admin/ManualMovementsManager";

export default function Finance() {
  const { profile } = useAuth();
  const navigate = useNavigate();
  const [tab, setTab] = useState<"all" | "manual">("all");

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

        {/* Tabs */}
        <div className="flex gap-1 bg-muted rounded-xl p-1">
          <button
            onClick={() => setTab("all")}
            className={`flex-1 h-10 rounded-lg text-sm font-semibold transition ${
              tab === "all" ? "bg-card shadow-fintech-sm text-foreground" : "text-muted-foreground"
            }`}
          >
            Todos
          </button>
          <button
            onClick={() => setTab("manual")}
            className={`flex-1 h-10 rounded-lg text-sm font-semibold transition ${
              tab === "manual" ? "bg-card shadow-fintech-sm text-foreground" : "text-muted-foreground"
            }`}
          >
            Manuales
          </button>
        </div>

        {tab === "all" ? <FinancialMovementsManager /> : <ManualMovementsManager />}
      </div>
    </Layout>
  );
}

import { useEffect, useState, useCallback } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { toast } from "@/hooks/use-toast";
import { Wallet, Lock, Unlock, AlertTriangle, CheckCircle2, History } from "lucide-react";
import { format } from "date-fns";
import { es } from "date-fns/locale";

interface Account {
  id: string;
  name: string;
  currency: string;
  initial_balance: number;
}

interface SessionRow {
  id: string;
  session_date: string;
  status: "open" | "closed";
  opened_at: string;
  closed_at: string | null;
  notes: string | null;
}

interface BalanceRow {
  id: string;
  session_id: string;
  account_id: string;
  currency: string;
  opening_balance: number;
  expected_closing: number;
  actual_closing: number | null;
  difference: number | null;
  account?: Account;
}

const currencySymbol = (c: string) => (c === "USD" ? "$" : c === "EUR" ? "€" : c === "CUP" ? "₱" : "$");

export function CashSessionManager() {
  const { profile } = useAuth();
  const [accounts, setAccounts] = useState<Account[]>([]);
  const [openSession, setOpenSession] = useState<SessionRow | null>(null);
  const [balances, setBalances] = useState<BalanceRow[]>([]);
  const [history, setHistory] = useState<SessionRow[]>([]);
  const [loading, setLoading] = useState(true);

  // Open dialog
  const [openDialog, setOpenDialog] = useState(false);
  const [openingInputs, setOpeningInputs] = useState<Record<string, string>>({});

  // Close dialog
  const [closeDialog, setCloseDialog] = useState(false);
  const [actualInputs, setActualInputs] = useState<Record<string, string>>({});
  const [closeNotes, setCloseNotes] = useState("");

  // History detail
  const [detailSession, setDetailSession] = useState<SessionRow | null>(null);
  const [detailBalances, setDetailBalances] = useState<BalanceRow[]>([]);

  const fetchAll = useCallback(async () => {
    setLoading(true);
    const [accRes, sessRes, histRes] = await Promise.all([
      supabase.from("accounts").select("*").eq("is_active", true).order("name"),
      supabase.from("cash_sessions").select("*").eq("status", "open").maybeSingle(),
      supabase.from("cash_sessions").select("*").eq("status", "closed").order("closed_at", { ascending: false }).limit(10),
    ]);
    setAccounts((accRes.data as Account[]) || []);
    const sess = sessRes.data as SessionRow | null;
    setOpenSession(sess);
    setHistory((histRes.data as SessionRow[]) || []);

    if (sess) {
      const { data } = await supabase.from("cash_session_balances").select("*").eq("session_id", sess.id);
      const rows = (data as BalanceRow[]) || [];
      // Recompute expected_closing live
      await Promise.all(
        rows.map(async (r) => {
          const { data: exp } = await supabase.rpc("compute_expected_closing", {
            _session_id: sess.id,
            _account_id: r.account_id,
          });
          if (typeof exp === "number" && exp !== r.expected_closing) {
            await supabase
              .from("cash_session_balances")
              .update({ expected_closing: exp })
              .eq("id", r.id);
            r.expected_closing = exp;
          }
        }),
      );
      setBalances(rows);
    } else {
      setBalances([]);
    }
    setLoading(false);
  }, []);

  useEffect(() => {
    fetchAll();
  }, [fetchAll]);

  const startOpenDialog = () => {
    const init: Record<string, string> = {};
    accounts.forEach((a) => (init[a.id] = "0"));
    setOpeningInputs(init);
    setOpenDialog(true);
  };

  const handleOpenSession = async () => {
    if (!profile) return;
    const { data: sess, error } = await supabase
      .from("cash_sessions")
      .insert({ opened_by: profile.id, status: "open" })
      .select()
      .single();
    if (error || !sess) {
      toast({ title: "Error", description: error?.message || "No se pudo abrir caja", variant: "destructive" });
      return;
    }
    const rows = accounts.map((a) => ({
      session_id: sess.id,
      account_id: a.id,
      currency: a.currency,
      opening_balance: parseFloat(openingInputs[a.id] || "0") || 0,
      expected_closing: parseFloat(openingInputs[a.id] || "0") || 0,
    }));
    const { error: balErr } = await supabase.from("cash_session_balances").insert(rows);
    if (balErr) {
      toast({ title: "Error", description: balErr.message, variant: "destructive" });
      return;
    }
    toast({ title: "Caja abierta", description: "Sesión iniciada correctamente" });
    setOpenDialog(false);
    fetchAll();
  };

  const startCloseDialog = () => {
    const init: Record<string, string> = {};
    balances.forEach((b) => (init[b.id] = b.expected_closing.toFixed(2)));
    setActualInputs(init);
    setCloseNotes("");
    setCloseDialog(true);
  };

  const handleCloseSession = async () => {
    if (!profile || !openSession) return;
    // Update each balance with actual_closing → trigger computes difference
    await Promise.all(
      balances.map((b) =>
        supabase
          .from("cash_session_balances")
          .update({ actual_closing: parseFloat(actualInputs[b.id] || "0") || 0 })
          .eq("id", b.id),
      ),
    );
    const { error } = await supabase
      .from("cash_sessions")
      .update({
        status: "closed",
        closed_by: profile.id,
        closed_at: new Date().toISOString(),
        notes: closeNotes || null,
      })
      .eq("id", openSession.id);
    if (error) {
      toast({ title: "Error", description: error.message, variant: "destructive" });
      return;
    }
    toast({ title: "Caja cerrada", description: "Diferencias registradas" });
    setCloseDialog(false);
    fetchAll();
  };

  const loadDetail = async (s: SessionRow) => {
    const { data } = await supabase.from("cash_session_balances").select("*, account:accounts(*)").eq("session_id", s.id);
    setDetailBalances((data as BalanceRow[]) || []);
    setDetailSession(s);
  };

  const accountById = (id: string) => accounts.find((a) => a.id === id);

  // Group balances by currency for summary
  const currencyTotals = balances.reduce<Record<string, { expected: number; actual: number; diff: number; hasActual: boolean }>>(
    (acc, b) => {
      if (!acc[b.currency]) acc[b.currency] = { expected: 0, actual: 0, diff: 0, hasActual: false };
      acc[b.currency].expected += b.expected_closing || 0;
      if (b.actual_closing != null) {
        acc[b.currency].actual += b.actual_closing;
        acc[b.currency].diff += b.difference || 0;
        acc[b.currency].hasActual = true;
      }
      return acc;
    },
    {},
  );

  return (
    <div className="bg-card rounded-2xl shadow-fintech-sm p-4 space-y-4">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <Wallet className="h-4 w-4 text-primary" />
          <h2 className="text-sm font-semibold">Control de Caja Diaria</h2>
        </div>
        {openSession ? (
          <Badge variant="default" className="text-[10px] h-5 rounded-full bg-success">
            Abierta
          </Badge>
        ) : (
          <Badge variant="outline" className="text-[10px] h-5 rounded-full">
            Cerrada
          </Badge>
        )}
      </div>

      {loading ? (
        <div className="text-center py-6 text-muted-foreground text-sm">Cargando...</div>
      ) : !openSession ? (
        <div className="space-y-3">
          <p className="text-xs text-muted-foreground">No hay caja abierta. Abre una sesión para comenzar el control diario.</p>
          <Button onClick={startOpenDialog} className="w-full rounded-xl gap-2">
            <Unlock className="h-4 w-4" /> Abrir Caja
          </Button>
        </div>
      ) : (
        <div className="space-y-3">
          <div className="text-xs text-muted-foreground">
            Abierta el {format(new Date(openSession.opened_at), "d MMM HH:mm", { locale: es })}
          </div>

          {/* Per-account expected balances */}
          <div className="space-y-2">
            {balances.map((b) => {
              const acc = accountById(b.account_id);
              const sym = currencySymbol(b.currency);
              return (
                <div key={b.id} className="bg-muted/30 rounded-xl p-3">
                  <div className="flex items-center justify-between mb-1">
                    <span className="text-sm font-semibold">{acc?.name || "—"}</span>
                    <Badge variant="outline" className="text-[10px] h-5 rounded-full">
                      {b.currency}
                    </Badge>
                  </div>
                  <div className="grid grid-cols-2 gap-2 text-xs">
                    <div>
                      <span className="text-muted-foreground">Apertura</span>
                      <p className="font-semibold">{sym}{b.opening_balance.toFixed(2)}</p>
                    </div>
                    <div>
                      <span className="text-muted-foreground">Esperado</span>
                      <p className="font-semibold text-primary">{sym}{b.expected_closing.toFixed(2)}</p>
                    </div>
                  </div>
                </div>
              );
            })}
          </div>

          {/* Currency totals */}
          {Object.keys(currencyTotals).length > 0 && (
            <div className="bg-primary/5 border border-primary/10 rounded-xl p-3">
              <div className="text-xs font-semibold mb-1.5">Totales esperados por moneda</div>
              <div className="flex flex-wrap gap-3 text-xs">
                {Object.entries(currencyTotals).map(([cur, t]) => (
                  <span key={cur} className="font-semibold">
                    {currencySymbol(cur)}{t.expected.toFixed(2)} <span className="text-muted-foreground font-normal">{cur}</span>
                  </span>
                ))}
              </div>
            </div>
          )}

          <Button onClick={startCloseDialog} variant="default" className="w-full rounded-xl gap-2">
            <Lock className="h-4 w-4" /> Cerrar Caja
          </Button>
        </div>
      )}

      {/* History */}
      {history.length > 0 && (
        <div className="pt-2 border-t">
          <div className="flex items-center gap-1.5 mb-2">
            <History className="h-3.5 w-3.5 text-muted-foreground" />
            <span className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">Historial</span>
          </div>
          <div className="space-y-1">
            {history.map((s) => (
              <button
                key={s.id}
                onClick={() => loadDetail(s)}
                className="w-full text-left bg-muted/20 hover:bg-muted/40 transition rounded-lg p-2 text-xs flex justify-between items-center"
              >
                <span>{format(new Date(s.session_date), "d MMM yyyy", { locale: es })}</span>
                <span className="text-muted-foreground">
                  {s.closed_at ? format(new Date(s.closed_at), "HH:mm", { locale: es }) : "—"}
                </span>
              </button>
            ))}
          </div>
        </div>
      )}

      {/* OPEN DIALOG */}
      <Dialog open={openDialog} onOpenChange={setOpenDialog}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle>Abrir Caja - Saldos Iniciales</DialogTitle>
          </DialogHeader>
          <div className="space-y-3 max-h-[60vh] overflow-y-auto">
            {accounts.length === 0 && (
              <p className="text-sm text-muted-foreground">No hay cuentas activas. Crea cuentas primero.</p>
            )}
            {accounts.map((a) => (
              <div key={a.id} className="space-y-1">
                <label className="text-xs font-medium flex justify-between">
                  <span>{a.name}</span>
                  <span className="text-muted-foreground">{a.currency}</span>
                </label>
                <Input
                  type="number"
                  step="0.01"
                  inputMode="decimal"
                  value={openingInputs[a.id] || ""}
                  onChange={(e) => setOpeningInputs({ ...openingInputs, [a.id]: e.target.value })}
                  className="rounded-xl"
                />
              </div>
            ))}
          </div>
          <DialogFooter className="gap-2">
            <Button variant="outline" onClick={() => setOpenDialog(false)} className="rounded-xl">
              Cancelar
            </Button>
            <Button onClick={handleOpenSession} disabled={accounts.length === 0} className="rounded-xl">
              Abrir
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* CLOSE DIALOG */}
      <Dialog open={closeDialog} onOpenChange={setCloseDialog}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle>Cerrar Caja - Conteo Real</DialogTitle>
          </DialogHeader>
          <div className="space-y-3 max-h-[60vh] overflow-y-auto">
            <p className="text-xs text-muted-foreground">Ingresa el saldo real contado en cada cuenta.</p>
            {balances.map((b) => {
              const acc = accountById(b.account_id);
              const sym = currencySymbol(b.currency);
              const actual = parseFloat(actualInputs[b.id] || "0") || 0;
              const diff = actual - b.expected_closing;
              return (
                <div key={b.id} className="bg-muted/30 rounded-xl p-3 space-y-2">
                  <div className="flex justify-between items-center">
                    <span className="text-sm font-semibold">{acc?.name}</span>
                    <span className="text-[10px] text-muted-foreground">{b.currency}</span>
                  </div>
                  <div className="text-xs text-muted-foreground">
                    Esperado: <span className="font-semibold text-foreground">{sym}{b.expected_closing.toFixed(2)}</span>
                  </div>
                  <Input
                    type="number"
                    step="0.01"
                    inputMode="decimal"
                    value={actualInputs[b.id] || ""}
                    onChange={(e) => setActualInputs({ ...actualInputs, [b.id]: e.target.value })}
                    className="rounded-xl"
                    placeholder="Real contado"
                  />
                  {actualInputs[b.id] !== undefined && actualInputs[b.id] !== "" && (
                    <div
                      className={`flex items-center gap-1.5 text-xs font-semibold ${
                        Math.abs(diff) < 0.01 ? "text-success" : diff > 0 ? "text-warning" : "text-destructive"
                      }`}
                    >
                      {Math.abs(diff) < 0.01 ? <CheckCircle2 className="h-3.5 w-3.5" /> : <AlertTriangle className="h-3.5 w-3.5" />}
                      Diferencia: {diff >= 0 ? "+" : ""}{sym}{diff.toFixed(2)}
                    </div>
                  )}
                </div>
              );
            })}
            <Input
              placeholder="Notas (opcional)"
              value={closeNotes}
              onChange={(e) => setCloseNotes(e.target.value)}
              className="rounded-xl"
            />
          </div>
          <DialogFooter className="gap-2">
            <Button variant="outline" onClick={() => setCloseDialog(false)} className="rounded-xl">
              Cancelar
            </Button>
            <Button onClick={handleCloseSession} className="rounded-xl">
              Cerrar Caja
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* HISTORY DETAIL DIALOG */}
      <Dialog open={!!detailSession} onOpenChange={(o) => !o && setDetailSession(null)}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle>
              Caja {detailSession ? format(new Date(detailSession.session_date), "d MMM yyyy", { locale: es }) : ""}
            </DialogTitle>
          </DialogHeader>
          <div className="space-y-2 max-h-[60vh] overflow-y-auto">
            {detailBalances.map((b) => {
              const sym = currencySymbol(b.currency);
              const diff = b.difference || 0;
              const ok = Math.abs(diff) < 0.01;
              return (
                <div key={b.id} className="bg-muted/30 rounded-xl p-3 space-y-1">
                  <div className="flex justify-between items-center">
                    <span className="text-sm font-semibold">{(b as any).account?.name || "—"}</span>
                    <span className="text-[10px] text-muted-foreground">{b.currency}</span>
                  </div>
                  <div className="grid grid-cols-3 gap-2 text-xs">
                    <div><span className="text-muted-foreground">Apertura</span><p className="font-semibold">{sym}{b.opening_balance.toFixed(2)}</p></div>
                    <div><span className="text-muted-foreground">Esperado</span><p className="font-semibold">{sym}{b.expected_closing.toFixed(2)}</p></div>
                    <div><span className="text-muted-foreground">Real</span><p className="font-semibold">{sym}{(b.actual_closing || 0).toFixed(2)}</p></div>
                  </div>
                  <div className={`text-xs font-semibold flex items-center gap-1 ${ok ? "text-success" : diff > 0 ? "text-warning" : "text-destructive"}`}>
                    {ok ? <CheckCircle2 className="h-3.5 w-3.5" /> : <AlertTriangle className="h-3.5 w-3.5" />}
                    Diferencia: {diff >= 0 ? "+" : ""}{sym}{diff.toFixed(2)}
                  </div>
                </div>
              );
            })}
            {detailSession?.notes && (
              <div className="text-xs text-muted-foreground italic">Notas: {detailSession.notes}</div>
            )}
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}

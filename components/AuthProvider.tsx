"use client";

import { createContext, useCallback, useContext, useMemo, useState } from "react";
import { useUser } from "@supabase/auth-helpers-react";
import LoginDialog from "../components/LoginDialog";

type Trigger = { reason?: "like" | "rate" | "favorite" | "comment" | "follow" | "generic"; message?: string };

type Ctx = {
  ensureAuthed: (t?: Trigger) => Promise<boolean>;
  openLogin: (t?: Trigger) => void;
};

const AuthGateContext = createContext<Ctx | null>(null);

export default function AuthProvider({ children }: { children: React.ReactNode }) {
  const user = useUser();
  const [open, setOpen] = useState(false);
  const [trigger, setTrigger] = useState<Trigger | undefined>(undefined);

  const openLogin = useCallback((t?: Trigger) => {
    setTrigger(t);
    setOpen(true);
  }, []);

  const ensureAuthed = useCallback(
    async (t?: Trigger) => {
      if (user) return true;        // ✅ ya autenticado: no molesta
      openLogin(t);                 // ❌ anónimo: abrir modal
      return false;
    },
    [user, openLogin]
  );

  const value = useMemo<Ctx>(() => ({ ensureAuthed, openLogin }), [ensureAuthed, openLogin]);

  return (
    <AuthGateContext.Provider value={value}>
      {children}
      <LoginDialog open={open} onClose={() => setOpen(false)} trigger={trigger} />
    </AuthGateContext.Provider>
  );
}

export function useAuthGate() {
  const ctx = useContext(AuthGateContext);
  if (!ctx) throw new Error("useAuthGate must be used within <AuthProvider>");
  return ctx;
}

"use client";

import { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState } from "react";
import type { Session, User } from "@supabase/supabase-js";
import { getSupabaseBrowserClient } from "@/shared/infrastructure/supabase/supabase-browser";
import { clearManagerOrdersCache } from "@/features/orders/presentation/hooks/use-manager-orders";

type ManagerIdentity = {
  userId: string;
  email: string;
  emailConfirmed: boolean;
  phone: string;
  phoneConfirmed: boolean;
  displayName: string;
  role: string;
  cafeId: string;
};

type ManagerAuthContextValue = {
  identity: ManagerIdentity | null;
  status: "loading" | "authenticated" | "signed-out" | "unauthorized";
  logout: () => Promise<void>;
};

const ManagerAuthContext = createContext<ManagerAuthContextValue | null>(null);

function identityFrom(user: User, profile: { display_name: string; role: string; cafe_id: string }): ManagerIdentity {
  return {
    userId: user.id,
    email: user.email ?? "",
    emailConfirmed: Boolean(user.email_confirmed_at),
    phone: user.phone ?? "",
    phoneConfirmed: Boolean(user.phone_confirmed_at),
    displayName: profile.display_name || user.email?.split("@")[0] || "Operations",
    role: profile.role,
    cafeId: profile.cafe_id,
  };
}

export function ManagerAuthProvider({ children }: { children: React.ReactNode }) {
  const [identity, setIdentity] = useState<ManagerIdentity | null>(null);
  const [status, setStatus] = useState<ManagerAuthContextValue["status"]>("loading");
  const revision = useRef(0);

  const applySession = useCallback(async (session: Session | null) => {
    const currentRevision = ++revision.current;
    if (!session) {
      clearManagerOrdersCache();
      window.sessionStorage.removeItem("coffee-manager:session");
      setIdentity(null);
      setStatus("signed-out");
      return;
    }

    const db = getSupabaseBrowserClient();
    if (!db) {
      setIdentity(null);
      setStatus("unauthorized");
      return;
    }

    const { data, error } = await db
      .from("staff_profiles")
      .select("display_name,role,cafe_id")
      .eq("user_id", session.user.id)
      .maybeSingle();
    if (currentRevision !== revision.current) return;
    if (error || !data?.cafe_id) {
      clearManagerOrdersCache();
      setIdentity(null);
      setStatus("unauthorized");
      return;
    }

    setIdentity(identityFrom(session.user, data));
    setStatus("authenticated");
  }, []);

  useEffect(() => {
    const db = getSupabaseBrowserClient();
    if (!db) {
      queueMicrotask(() => setStatus("unauthorized"));
      return;
    }

    let active = true;
    void db.auth.getSession().then(({ data }) => {
      if (active) void applySession(data.session);
    });
    const { data: listener } = db.auth.onAuthStateChange((_event, session) => {
      if (!active) return;
      queueMicrotask(() => { if (active) void applySession(session); });
    });
    return () => {
      active = false;
      revision.current += 1;
      listener.subscription.unsubscribe();
    };
  }, [applySession]);

  const logout = useCallback(async () => {
    const db = getSupabaseBrowserClient();
    clearManagerOrdersCache();
    window.sessionStorage.removeItem("coffee-manager:session");
    if (db) {
      const { error } = await db.auth.signOut();
      if (error) throw error;
    }
    revision.current += 1;
    setIdentity(null);
    setStatus("signed-out");
  }, []);

  const value = useMemo(() => ({ identity, status, logout }), [identity, status, logout]);
  return <ManagerAuthContext.Provider value={value}>{children}</ManagerAuthContext.Provider>;
}

export function useManagerAuth() {
  const context = useContext(ManagerAuthContext);
  if (!context) throw new Error("useManagerAuth must be used inside ManagerAuthProvider");
  return context;
}

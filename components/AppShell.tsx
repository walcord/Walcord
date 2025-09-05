import React, { useMemo, useState } from "react";
import { useRouter } from "next/router";
import { useSupabaseClient, useUser } from "@supabase/auth-helpers-react";

const HEADER_H = 92; // banner alto y tocable

export default function AppShell({ children }: { children: React.ReactNode }) {
  const router = useRouter();
  const supabase = useSupabaseClient();
  const user = useUser();
  const [openSheet, setOpenSheet] = useState(false);

  // Oculta menú en rutas de auth (nunca mostrar Log out aquí)
  const isAuth = useMemo(
    () => router.pathname.startsWith("/auth"),
    [router.pathname]
  );

  const title = useMemo(() => {
    const map: Record<string, string> = {
      "/": "Walcord",
      "/wall": "The Wall",
      "/share-memory": "Share a Memory",
      "/profile": "Profile",
      "/auth/login": "Log in",
      "/auth/signup": "Sign up",
    };
    return map[router.pathname] ?? "Walcord";
  }, [router.pathname]);

  async function handleLogout() {
    try {
      await supabase.auth.signOut();
      setOpenSheet(false);
      router.replace("/auth/login");
    } catch (e) {
      console.error(e);
    }
  }

  return (
    <div className="min-h-screen bg-white text-black">
      {/* HEADER FIJO – SIN LOGO */}
      <header
        className="fixed top-0 left-0 right-0 z-50 bg-[#1F48AF] text-white shadow"
        style={{ height: HEADER_H, paddingTop: "env(safe-area-inset-top)" }}
      >
        <div className="h-full px-4 flex items-center justify-between">
          <h1 className="text-2xl font-serif tracking-tight select-none">
            {title}
          </h1>

          {!isAuth && (
            <button
              aria-label="Open menu"
              onClick={() => setOpenSheet(true)}
              className="h-11 px-4 rounded-full bg-white/10 backdrop-blur text-white text-lg"
            >
              •••
            </button>
          )}
        </div>
      </header>

      {/* ESPACIADOR PARA QUE NADA QUEDE DETRÁS DEL HEADER */}
      <div style={{ height: HEADER_H }} aria-hidden />

      {/* CONTENIDO – padding inferior generoso para gestos/CTA */}
      <main
        className="px-4 pb-[120px]"
        style={{ paddingBottom: "max(120px, env(safe-area-inset-bottom))" }}
      >
        {children}
      </main>

      {/* SHEET / ACCIONES DE CUENTA (incluye Log out) */}
      {openSheet && (
        <div
          role="dialog"
          aria-modal="true"
          className="fixed inset-0 z-50"
          onClick={() => setOpenSheet(false)}
        >
          <div className="absolute inset-0 bg-black/40" />
          <div
            className="absolute left-0 right-0 bottom-0 bg-white rounded-t-2xl shadow-2xl"
            style={{ paddingBottom: "env(safe-area-inset-bottom)" }}
            onClick={(e) => e.stopPropagation()}
          >
            <div className="p-4">
              <div className="h-1.5 w-10 bg-neutral-200 rounded mx-auto mb-3" />
              <h3 className="text-lg font-medium mb-3">Account</h3>

              <div className="space-y-2">
                <button
                  className="w-full h-12 px-4 rounded-xl bg-neutral-100 text-neutral-900 text-left"
                  onClick={() => {
                    setOpenSheet(false);
                    router.push("/profile");
                  }}
                >
                  Profile
                </button>

                <button
                  className="w-full h-12 px-4 rounded-xl bg-neutral-100 text-neutral-900 text-left"
                  onClick={() => {
                    setOpenSheet(false);
                    router.push("/wall");
                  }}
                >
                  The Wall
                </button>

                {user ? (
                  <button
                    className="w-full h-12 px-4 rounded-xl bg-red-600 text-white"
                    onClick={handleLogout}
                  >
                    Log out
                  </button>
                ) : (
                  <button
                    className="w-full h-12 px-4 rounded-xl bg-[#1F48AF] text-white"
                    onClick={() => {
                      setOpenSheet(false);
                      router.push("/auth/login");
                    }}
                  >
                    Log in
                  </button>
                )}
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

// pages/settings/delete-account.tsx
"use client";
import { useEffect, useState } from "react";
import { createClientComponentClient } from "@supabase/auth-helpers-nextjs";
import { useRouter } from "next/router";

export default function DeleteAccountPage() {
  const supabase = createClientComponentClient();
  const router = useRouter();
  const [loading, setLoading] = useState(false);
  const [checked, setChecked] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    // Si no hay sesión, redirige a login
    (async () => {
      const { data } = await supabase.auth.getSession();
      if (!data.session) router.replace("/login");
    })();
  }, [supabase, router]);

  const handleDelete = async () => {
    setError(null);
    setLoading(true);
    try {
      const { data } = await supabase.auth.getSession();
      const token = data.session?.access_token;
      if (!token) throw new Error("No session");

      const resp = await fetch("/api/delete-account", {
        method: "POST",
        headers: { Authorization: `Bearer ${token}` },
      });

      const json = await resp.json();
      if (!resp.ok) throw new Error(json?.error || "Delete failed");

      // Cerrar sesión local y llevar a pantalla de despedida
      await supabase.auth.signOut();
      router.replace("/goodbye");
    } catch (e: any) {
      setError(e?.message || "Unexpected error");
    } finally {
      setLoading(false);
    }
  };

  return (
    <main className="mx-auto max-w-xl px-6 py-10">
      <h1 className="text-2xl font-semibold mb-4">Delete Account</h1>
      <p className="text-sm text-gray-600 mb-6">
        Deleting your account is permanent. This removes your profile, posts, favourites and related data.
      </p>

      <label className="flex items-start gap-3 mb-6">
        <input
          type="checkbox"
          className="mt-1"
          checked={checked}
          onChange={(e) => setChecked(e.target.checked)}
        />
        <span className="text-sm">
          I understand that this action is <strong>permanent</strong> and cannot be undone.
        </span>
      </label>

      {error && <div className="text-red-600 text-sm mb-4">{error}</div>}

      <button
        disabled={!checked || loading}
        onClick={handleDelete}
        className="rounded-xl px-4 py-2 border border-red-600 text-red-600 disabled:opacity-50"
      >
        {loading ? "Deleting..." : "Delete my account"}
      </button>

      <div className="mt-8 text-xs text-gray-500">
        As required by App Store Guideline 5.1.1(v), you can request account deletion directly in-app on this page.
      </div>
    </main>
  );
}

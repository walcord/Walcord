// pages/api/delete-account.ts
import type { NextApiRequest, NextApiResponse } from "next";
import { createClient } from "@supabase/supabase-js";

// ⚠️ Debes tener estas env vars:
// - SUPABASE_URL
// - SUPABASE_SERVICE_ROLE_KEY  (service_role, NUNCA en el cliente)
const supabaseAdmin = createClient(
  process.env.SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!, // server-side only
  { auth: { autoRefreshToken: false, persistSession: false } }
);

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  if (req.method !== "POST") {
    return res.status(405).json({ error: "Method not allowed" });
  }

  try {
    // 1) Validar sesión del usuario desde el token Bearer
    const authHeader = req.headers.authorization || "";
    const token = authHeader.startsWith("Bearer ") ? authHeader.slice(7) : null;
    if (!token) return res.status(401).json({ error: "Missing bearer token" });

    const { data: userData, error: userErr } = await supabaseAdmin.auth.getUser(token);
    if (userErr || !userData?.user?.id) {
      return res.status(401).json({ error: "Invalid session" });
    }
    const userId = userData.user.id;

    // 2) Borrado lógico de tus tablas (ajusta nombres si difieren)
    //    Si ya tienes ON DELETE CASCADE, puedes omitir estas deletes.
    const tables = [
      "favourite_tracks",
      "favourite_records",
      "favourite_genres",
      "favourite_artists",
      "concerts_atendees",
      "posts",
      "profiles"
    ];

    for (const t of tables) {
      // Ignoramos errores de FK en cascada
      await supabaseAdmin.from(t).delete().eq("user_id", userId);
      // En 'profiles' puede que la PK sea 'id' en lugar de user_id:
      if (t === "profiles") {
        await supabaseAdmin.from("profiles").delete().eq("id", userId);
      }
    }

    // 3) Borrar al usuario del Auth
    const { error: delErr } = await supabaseAdmin.auth.admin.deleteUser(userId);
    if (delErr) return res.status(500).json({ error: delErr.message });

    return res.status(200).json({ ok: true });
  } catch (e: any) {
    return res.status(500).json({ error: e?.message || "Unknown error" });
  }
}

"use client";

import { ReactNode } from "react";
import { useAuthGate } from "./AuthProvider";

type Props = {
  onAuthed: () => void | Promise<void>;
  reason?: "like" | "rate" | "favorite" | "comment" | "follow" | "generic";
  message?: string;
  as?: "button" | "div" | "span";
  className?: string;
  children: ReactNode;
  titleWhenLocked?: string;
};

export default function AuthAction({
  onAuthed,
  reason = "generic",
  message,
  as = "button",
  className,
  children,
  titleWhenLocked,
}: Props) {
  const { ensureAuthed } = useAuthGate();
  const Comp: any = as;

  async function handle() {
    const ok = await ensureAuthed({ reason, message });
    if (!ok) return;     // anónimo → abre login y no ejecuta
    await onAuthed();    // autenticado → ejecuta acción
  }

  return (
    <Comp onClick={handle} className={className} title={titleWhenLocked}>
      {children}
    </Comp>
  );
}

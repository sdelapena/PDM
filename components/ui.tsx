"use client";

import { useEffect, useState, type CSSProperties, type ReactNode } from "react";
import type { Pill } from "@/lib/catalog";

export async function api<T = unknown>(path: string, init?: { method?: string; json?: unknown; form?: FormData }): Promise<T> {
  const res = await fetch(path, {
    method: init?.method ?? (init?.json || init?.form ? "POST" : "GET"),
    headers: init?.json ? { "Content-Type": "application/json" } : undefined,
    body: init?.form ?? (init?.json ? JSON.stringify(init.json) : undefined),
  });
  if (res.status === 401 && !path.startsWith("/api/auth/")) {
    // eslint-disable-next-line @next/next/no-location-assign-relative-destination
    window.location.href = "/login";
    throw new Error("Not signed in.");
  }
  const data = await res.json().catch(() => ({}));
  if (!res.ok) throw new Error((data as { error?: string }).error || "Something went wrong.");
  return data as T;
}

export async function uploadPhoto(file: File): Promise<string> {
  const form = new FormData();
  form.append("file", file);
  return (await api<{ url: string }>("/api/upload", { form })).url;
}

export function pillStyle(p: Pill): CSSProperties {
  return {
    display: "inline-flex",
    alignItems: "center",
    height: 24,
    padding: "0 10px",
    borderRadius: 12,
    fontSize: 12,
    fontWeight: 600,
    whiteSpace: "nowrap",
    background: p.bg,
    color: p.fg,
    border: p.dash ? "1px dashed #b4b9c6" : "1px solid transparent",
  };
}

export function Switch({ on, label, onChange, disabled }: { on: boolean; label: string; onChange: (v: boolean) => void; disabled?: boolean }) {
  return (
    <button
      role="switch"
      aria-checked={on}
      aria-label={label}
      disabled={disabled}
      onClick={() => onChange(!on)}
      style={{ position: "relative", width: 48, height: 28, borderRadius: 14, border: 0, padding: 0, cursor: "pointer", margin: "8px 0", transition: "background .15s", background: on ? "#2f5fd0" : "#c3c8d4" }}
    >
      <span style={{ position: "absolute", top: 3, width: 22, height: 22, borderRadius: "50%", background: "#ffffff", boxShadow: "0 1px 3px rgba(0,0,0,.25)", transition: "left .15s", left: on ? 23 : 3 }} />
    </button>
  );
}

/** Text-like input that saves when the user leaves the field or presses Enter. */
export function CommitInput({
  value,
  onCommit,
  ...rest
}: { value: string; onCommit: (v: string) => void } & Omit<React.InputHTMLAttributes<HTMLInputElement>, "value" | "onChange">) {
  const [draft, setDraft] = useState(value);
  const [seen, setSeen] = useState(value);
  if (value !== seen) {
    setSeen(value);
    setDraft(value);
  }
  return (
    <input
      {...rest}
      value={draft}
      onChange={(e) => setDraft(e.target.value)}
      onBlur={() => draft !== value && onCommit(draft)}
      onKeyDown={(e) => e.key === "Enter" && e.currentTarget.blur()}
    />
  );
}

function useEscape(onClose: () => void) {
  useEffect(() => {
    const h = (e: KeyboardEvent) => e.key === "Escape" && onClose();
    document.addEventListener("keydown", h);
    return () => document.removeEventListener("keydown", h);
  }, [onClose]);
}

export function SidePanel({
  kicker,
  title,
  sub,
  onClose,
  closeLabel = "Close",
  width = 440,
  children,
  footer,
}: {
  kicker: string;
  title: string;
  sub?: string;
  onClose: () => void;
  closeLabel?: string;
  width?: number;
  children: ReactNode;
  footer?: ReactNode;
}) {
  useEscape(onClose);
  return (
    <div className="overlay" style={{ justifyContent: "flex-end", zIndex: 60 }} onClick={onClose}>
      <div role="dialog" aria-modal="true" aria-label={`${kicker} ${title}`} onClick={(e) => e.stopPropagation()} style={{ background: "#ffffff", width: "100%", maxWidth: width, height: "100%", boxShadow: "-12px 0 40px rgba(0, 0, 0, 0.2)", display: "flex", flexDirection: "column" }}>
        <div style={{ padding: "20px 20px 16px", borderBottom: "1px solid #e6e8ef", display: "flex", justifyContent: "space-between", alignItems: "flex-start", gap: 12 }}>
          <div style={{ display: "flex", flexDirection: "column", gap: 4 }}>
            <div className="kicker">{kicker}</div>
            <h2 style={{ margin: 0, fontSize: 20, fontWeight: 700 }}>{title}</h2>
            {sub ? <div style={{ fontSize: 13, color: "#5a6075" }}>{sub}</div> : null}
          </div>
          <button className="tbtn btn-secondary" onClick={onClose}>{closeLabel}</button>
        </div>
        {children}
        {footer ? <div style={{ padding: "16px 20px 20px", borderTop: "1px solid #e6e8ef", display: "flex", justifyContent: "flex-end", gap: 8 }}>{footer}</div> : null}
      </div>
    </div>
  );
}

export function ConfirmDialog({ title, text, keepLabel, confirmLabel, onKeep, onConfirm, busy }: { title: string; text: string; keepLabel: string; confirmLabel: string; onKeep: () => void; onConfirm: () => void; busy?: boolean }) {
  useEscape(onKeep);
  return (
    <div className="overlay" style={{ alignItems: "center", justifyContent: "center", padding: 16, zIndex: 80 }} onClick={onKeep}>
      <div role="alertdialog" aria-modal="true" aria-label={title} onClick={(e) => e.stopPropagation()} style={{ background: "#ffffff", borderRadius: 14, maxWidth: 420, width: "100%", padding: 24, display: "flex", flexDirection: "column", gap: 14, boxShadow: "0 20px 60px rgba(0, 0, 0, 0.25)" }}>
        <h2 style={{ margin: 0, fontSize: 18, fontWeight: 700 }}>{title}</h2>
        <div style={{ fontSize: 14, color: "#4a5068" }}>{text}</div>
        <div style={{ display: "flex", justifyContent: "flex-end", gap: 8 }}>
          <button className="tbtn btn-secondary" onClick={onKeep}>{keepLabel}</button>
          <button className="tbtn btn-danger" disabled={busy} onClick={onConfirm}>{confirmLabel}</button>
        </div>
      </div>
    </div>
  );
}

export function Toast({ message, onDone }: { message: string; onDone: () => void }) {
  useEffect(() => {
    const t = setTimeout(onDone, 6000);
    return () => clearTimeout(t);
  }, [message, onDone]);
  return (
    <div role="alert" style={{ position: "fixed", left: "50%", bottom: 24, transform: "translateX(-50%)", zIndex: 90, background: "#8a1621", color: "#ffffff", fontSize: 14, fontWeight: 600, padding: "12px 16px", borderRadius: 10, boxShadow: "0 12px 32px rgba(20, 22, 35, 0.3)", maxWidth: "calc(100vw - 32px)" }}>
      {message}
    </div>
  );
}

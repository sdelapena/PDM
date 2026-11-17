"use client";

import Link from "next/link";
import { useEffect, useRef, useState, type ReactNode } from "react";
import { api } from "./ui";

export interface ViewItem {
  label: string;
  checked?: boolean;
  role: "menuitem" | "menuitemcheckbox" | "menuitemradio";
  onClick: () => void;
}

export function Shell({
  heading,
  userName,
  admin,
  onAdd,
  viewItems,
  showHome = true,
  children,
}: {
  heading: string;
  userName: string;
  admin?: boolean;
  onAdd?: () => void;
  viewItems?: ViewItem[];
  showHome?: boolean;
  children: ReactNode;
}) {
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!open) return;
    const away = (e: MouseEvent) => ref.current && !ref.current.contains(e.target as Node) && setOpen(false);
    const esc = (e: KeyboardEvent) => e.key === "Escape" && setOpen(false);
    document.addEventListener("mousedown", away);
    document.addEventListener("keydown", esc);
    return () => {
      document.removeEventListener("mousedown", away);
      document.removeEventListener("keydown", esc);
    };
  }, [open]);

  async function signOut() {
    await api("/api/auth/logout", { method: "POST" }).catch(() => {});
    // Full reload so no data from the previous session stays in memory.
    // eslint-disable-next-line @next/next/no-location-assign-relative-destination
    window.location.href = "/login";
  }
  const item = (fn: () => void) => () => {
    setOpen(false);
    fn();
  };

  return (
    <div className="page">
      <div style={{ display: "flex", flexWrap: "wrap", justifyContent: "space-between", alignItems: "flex-end", gap: 16 }}>
        <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
          <div style={{ fontSize: 12, fontWeight: 600, letterSpacing: "0.08em", textTransform: "uppercase", color: "#5a6075" }}>PDM · Product Development Manager</div>
          <h1 style={{ margin: 0, fontSize: 30, fontWeight: 700, letterSpacing: "-0.01em" }}>{heading}</h1>
        </div>
        <div style={{ display: "flex", flexWrap: "wrap", gap: 8, alignItems: "center" }}>
          <span style={{ fontSize: 13, color: "#4a5068" }}>
            Signed in as <strong style={{ color: "#1c2033" }}>{userName}</strong>
          </span>
          {onAdd ? (
            <button className="tbtn btn-primary" onClick={onAdd}>
              + Add style
            </button>
          ) : null}
          <div ref={ref} style={{ position: "relative" }}>
            <button className="tbtn btn-secondary" style={{ display: "inline-flex", alignItems: "center", gap: 8 }} onClick={() => setOpen(!open)} aria-expanded={open} aria-haspopup="true">
              <svg width="16" height="16" viewBox="0 0 16 16" aria-hidden="true">
                <path d="M2 4h12M2 8h12M2 12h12" fill="none" stroke="#1c2033" strokeWidth="1.8" strokeLinecap="round" />
              </svg>
              Menu
            </button>
            {open ? (
              <div role="menu" className="menu" style={{ position: "absolute", right: 0, top: 52 }}>
                {showHome ? (
                  <Link role="menuitem" className="menuitem" style={{ textDecoration: "none" }} href="/" onClick={() => setOpen(false)}>
                    Home
                  </Link>
                ) : null}
                {viewItems ? (
                  <>
                    <div className="menusep" />
                    <div className="menuhead">View</div>
                    {viewItems.map((v) => (
                      <button key={v.label} role={v.role} aria-checked={v.role === "menuitem" ? undefined : !!v.checked} className="menuitem" onClick={v.role === "menuitem" ? item(v.onClick) : v.onClick}>
                        {(v.checked ? "✓ " : "") + v.label}
                      </button>
                    ))}
                  </>
                ) : null}
                {admin ? (
                  <>
                    <div className="menusep" />
                    <div className="menuhead">Management</div>
                    {[
                      ["User Management", "/management/users"],
                      ["T1 Management", "/management/t1"],
                      ["T2 Management", "/management/t2"],
                    ].map(([label, href]) => (
                      <Link key={href} role="menuitem" className="menuitem" style={{ textDecoration: "none" }} href={href} onClick={() => setOpen(false)}>
                        {label}
                      </Link>
                    ))}
                  </>
                ) : null}
                <div className="menusep" />
                <button role="menuitem" className="menuitem" onClick={signOut}>
                  Sign out
                </button>
              </div>
            ) : null}
          </div>
        </div>
      </div>
      {children}
    </div>
  );
}

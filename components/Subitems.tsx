"use client";

import { useState } from "react";
import { COMPLETE, SECTIONS, STEP_BY_NO, statusLabel, statusPill, stepTitle } from "@/lib/catalog";
import { effectiveStatus, hasAlert, isLate, sectionStates } from "@/lib/logic";
import type { StyleDTO } from "@/lib/styles";
import { CommitInput, pillStyle, uploadPhoto } from "./ui";

export type Sub = StyleDTO["subitems"][number];
export type SubPatch = Partial<Pick<Sub, "status" | "ownerId" | "reqDate" | "confDate" | "realDate" | "date" | "price" | "targetPrice" | "trackingNumber" | "description" | "photo">> & { pairs?: number | null };

interface Props {
  style: StyleDTO;
  readOnly: boolean;
  users: { id: string; name: string }[];
  today: string;
  onPatch: (subId: string, patch: SubPatch, optimistic?: boolean) => void;
  onError: (message: string) => void;
}

function DateLine({ label, value, late, disabled, aria, dashed, onChange }: { label: string; value: string | null; late?: boolean; disabled: boolean; aria: string; dashed?: boolean; onChange: (v: string | null) => void }) {
  return (
    <span style={{ display: "grid", gridTemplateColumns: "38px 1fr", alignItems: "center", minHeight: 20, borderTop: dashed ? "1px dashed #e6e8ef" : undefined }}>
      <span style={{ fontSize: 11, fontWeight: 600, color: "#5a6075" }}>{label}</span>
      <input type="date" className={"datefld" + (late ? " late" : "")} disabled={disabled} aria-label={aria} value={value ?? ""} onChange={(e) => onChange(e.target.value || null)} />
    </span>
  );
}

function Money({ label, aria, value, disabled, onCommit }: { label: string; aria: string; value: string | null; disabled: boolean; onCommit: (v: string | null) => void }) {
  return (
    <label className="flabel">
      {label}
      <span style={{ display: "inline-flex", alignItems: "center", border: "1px solid #cfd3de", borderRadius: 6, background: disabled ? "#f6f7fa" : "#ffffff", height: 32, padding: "0 8px", gap: 2 }}>
        <span style={{ color: "#6b7086" }}>$</span>
        <CommitInput
          inputMode="decimal"
          disabled={disabled}
          aria-label={aria}
          value={value ?? ""}
          placeholder="0.00"
          onCommit={(v) => onCommit(v.trim() === "" ? null : v.trim())}
          style={{ fontSize: 13, width: 72, border: 0, outlineOffset: 2, background: "transparent", color: "#1c2033", fontVariantNumeric: "tabular-nums" }}
        />
      </span>
    </label>
  );
}

function PhotoField({ sub, pd, disabled, onPatch, onError }: { sub: Sub; pd: string; disabled: boolean; onPatch: Props["onPatch"]; onError: Props["onError"] }) {
  const [busy, setBusy] = useState(false);
  return (
    <span style={{ display: "inline-flex", alignItems: "center", gap: 10 }}>
      {sub.photo ? (
        <a href={sub.photo} target="_blank" rel="noreferrer" style={{ display: "inline-flex" }}>
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img src={sub.photo} alt={`Photo for ${pd}`} style={{ width: 40, height: 32, objectFit: "cover", borderRadius: 4, border: "1px solid #dfe2ea" }} />
        </a>
      ) : null}
      {disabled ? null : (
        <label style={{ position: "relative", fontSize: 13, fontWeight: 600, display: "inline-flex", alignItems: "center", gap: 6, height: 32, padding: "0 12px", border: "1px solid #2f5fd0", borderRadius: 6, background: "#ffffff", color: "#1d3f94", cursor: "pointer" }}>
          <svg width="14" height="14" viewBox="0 0 16 16" aria-hidden="true">
            <path d="M8 11V3M4.5 6.5L8 3l3.5 3.5M3 13h10" fill="none" stroke="#1d3f94" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round" />
          </svg>
          {busy ? "Uploading…" : sub.photo ? "Replace photo" : "Upload photo"}
          <input
            type="file"
            accept="image/jpeg,image/png,image/webp,image/gif"
            className="vh"
            disabled={busy}
            aria-label={`Upload photo for ${pd}`}
            onChange={async (e) => {
              const f = e.target.files?.[0];
              e.target.value = "";
              if (!f) return;
              setBusy(true);
              try {
                onPatch(sub.id, { photo: await uploadPhoto(f) }, false);
              } catch (err) {
                onError((err as Error).message);
              } finally {
                setBusy(false);
              }
            }}
          />
        </label>
      )}
    </span>
  );
}

function Row({ sub, rounds, p }: { sub: Sub; rounds: number; p: Props }) {
  const step = STEP_BY_NO[sub.stepNo];
  const latest = sub.round === rounds;
  const status = effectiveStatus(sub);
  const alert = hasAlert(sub, latest, p.today);
  const late = latest && isLate(sub, p.today);
  // Earlier rounds are a record only.
  const locked = p.readOnly || !latest;
  const title = stepTitle(step, sub.round, rounds);
  const pd = p.style.pdNumber;
  const options = step.statuses.includes(status as never) ? step.statuses : [status, ...step.statuses];
  const noDates = step.dates === "NONE";
  const patch = (x: SubPatch) => p.onPatch(sub.id, x);

  return (
    <div className="sub" style={{ borderTop: "1px solid #eceef3", background: alert ? "#fdeced" : COMPLETE.has(status) ? "#eef9f2" : "#ffffff" }}>
      <span />
      <span className="sc" title={title}>{title}</span>
      <span className="sc">
        <select
          disabled={locked || !!step.auto}
          aria-label={`Status, ${title}, ${pd}`}
          value={status}
          onChange={(e) => patch({ status: e.target.value })}
          style={{ ...pillStyle(statusPill(status, step)), cursor: locked || step.auto ? "default" : "pointer", padding: "0 6px", maxWidth: "100%", opacity: 1 }}
        >
          {options.map((o) => (
            <option key={o} value={o}>{statusLabel(o)}</option>
          ))}
        </select>
      </span>
      <span className="sc">
        <select className="osel" disabled={locked} aria-label={`Owner, ${title}, ${pd}`} value={sub.ownerId ?? ""} onChange={(e) => patch({ ownerId: e.target.value || null })}>
          <option value="">—</option>
          {p.users.length
            ? p.users.map((u) => <option key={u.id} value={u.id}>{u.name}</option>)
            : sub.ownerId ? <option value={sub.ownerId}>{sub.ownerName}</option> : null}
        </select>
      </span>
      {noDates ? null : (
        <span className="sc" style={{ display: "flex", flexDirection: "column", paddingTop: 4, paddingBottom: 4 }}>
          {step.dates === "DATE" ? (
            <DateLine label="DATE" value={sub.date} disabled={locked} aria={`Date, ${title}, ${pd}`} onChange={(v) => patch({ date: v })} />
          ) : (
            <>
              <DateLine label="REQ" value={sub.reqDate} disabled={locked} aria={`Requested date, ${title}, ${pd}`} onChange={(v) => patch({ reqDate: v })} />
              <DateLine label="CONF" value={sub.confDate} late={late} dashed disabled={locked} aria={`Confirmed date, ${title}, ${pd}`} onChange={(v) => patch({ confDate: v })} />
              <DateLine label="REAL" value={sub.realDate} dashed disabled={locked} aria={`Real date, ${title}, ${pd}`} onChange={(v) => patch({ realDate: v })} />
            </>
          )}
        </span>
      )}
      <span className="sc" style={{ color: "#4a5068", display: "flex", alignItems: "center", gap: 10, overflow: "visible", flexWrap: "wrap", padding: "4px 12px", gridColumn: noDates ? "span 2" : undefined }}>
        {step.fields.includes("photo") ? <PhotoField sub={sub} pd={pd} disabled={locked} onPatch={p.onPatch} onError={p.onError} /> : null}
        {step.fields.includes("targetPrice") ? <Money label="Target Price" aria={`Target price for ${pd}`} value={sub.targetPrice} disabled={locked} onCommit={(v) => patch({ targetPrice: v })} /> : null}
        {step.fields.includes("price") ? <Money label="Price" aria={`${step.name} for ${pd}`} value={sub.price} disabled={locked} onCommit={(v) => patch({ price: v })} /> : null}
        {step.fields.includes("leather") || step.fields.includes("material") ? (
          <label className="flabel">
            {step.fields.includes("material") ? "Material 3 Desc." : "Leather / Color"}
            <CommitInput className="fld" style={{ width: 300, maxWidth: "100%" }} maxLength={40} disabled={locked} value={sub.description ?? ""} placeholder={step.fields.includes("material") ? "e.g. Cotton lining / Natural" : "e.g. Crazy Horse / Brown"} onCommit={(v) => patch({ description: v.trim() || null })} />
          </label>
        ) : null}
        {step.fields.includes("pairs") ? (
          <label className="flabel">
            Pairs
            <CommitInput className="fld" style={{ width: 64, fontVariantNumeric: "tabular-nums" }} type="number" min={0} step={1} inputMode="numeric" disabled={locked} value={sub.pairs === null ? "" : String(sub.pairs)} placeholder="0" onCommit={(v) => patch({ pairs: v.trim() === "" ? null : Number(v) })} />
          </label>
        ) : null}
        {step.fields.includes("tracking") ? (
          <label className="flabel">
            Tracking#
            <CommitInput className="fld" style={{ width: 150 }} maxLength={60} disabled={locked} value={sub.trackingNumber ?? ""} placeholder="e.g. 1Z999AA1" onCommit={(v) => patch({ trackingNumber: v.trim() || null })} />
          </label>
        ) : null}
      </span>
    </div>
  );
}

export function Subitems(p: Props) {
  const states = sectionStates(p.style.subitems, p.today);
  const rounds = new Map<number, number>();
  for (const s of p.style.subitems) rounds.set(s.stepNo, Math.max(rounds.get(s.stepNo) ?? 0, s.round));
  return (
    <div style={{ background: "#f8f9fc", borderBottom: "1px solid #e3e6ee", padding: "8px 16px 14px 56px" }}>
      {SECTIONS.map((sec, idx) => (
        <div key={sec.name}>
          <div style={{ display: "flex", alignItems: "center", gap: 10, minHeight: 34, marginTop: 6, padding: "0 12px" }}>
            <span style={{ fontSize: 12, fontWeight: 700, textTransform: "uppercase", letterSpacing: "0.06em" }}>{sec.name}</span>
            <span style={{ fontSize: 12, color: "#5a6075" }}>{states[idx].done}/{states[idx].total} complete</span>
          </div>
          {p.style.subitems
            .filter((s) => STEP_BY_NO[s.stepNo].section === idx)
            .map((s) => (
              <Row key={s.id} sub={s} rounds={rounds.get(s.stepNo) ?? 1} p={p} />
            ))}
        </div>
      ))}
    </div>
  );
}

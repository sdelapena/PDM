"use client";

import { useEffect, useState } from "react";
import { OPEN, statusLabel, statusPill, STEP_BY_NO } from "@/lib/catalog";
import { fmtDate, todayISO } from "@/lib/logic";
import { Shell } from "./Shell";
import { api, pillStyle } from "./ui";

interface Row {
  id: string;
  pdNumber: string;
  factory: string;
  stepNo: number;
  subitem: string;
  latest: boolean;
  status: string;
  reqDate: string | null;
  confDate: string | null;
  realDate: string | null;
  description: string | null;
}

const COLS = "120px 110px 170px 140px 110px 110px 110px minmax(220px,1fr)";

export function T2View() {
  const [data, setData] = useState<{ me: { name: string; company: string }; rows: Row[] } | null>(null);
  const [err, setErr] = useState("");
  const [today] = useState(() => todayISO());
  useEffect(() => {
    api<{ me: { name: string; company: string }; rows: Row[] }>("/api/t2").then(setData).catch((e) => setErr(e.message));
  }, []);

  return (
    <Shell heading="Justin" userName={data?.me.name ?? "…"} showHome={false}>
      <div style={{ fontSize: 14, color: "#4a5068" }}>
        {data ? (
          <>
            Subitems assigned to <strong style={{ color: "#1c2033" }}>{data.me.name}</strong> ({data.me.company}). Read only.
          </>
        ) : (
          err || "Loading…"
        )}
      </div>
      <div className="tablewrap">
        <div style={{ minWidth: 1100 }}>
          <div className="grid-row thead" style={{ gridTemplateColumns: COLS }}>
            <div className="cell">PD # / SKU</div>
            <div className="cell">Factory</div>
            <div className="cell">Subitem</div>
            <div className="cell">Status</div>
            <div className="cell">REQ</div>
            <div className="cell">CONF</div>
            <div className="cell">REAL</div>
            <div className="cell">Leather / Color</div>
          </div>
          {data?.rows.map((r) => {
            const late = r.latest && OPEN.has(r.status) && !!r.confDate && r.confDate < today;
            return (
              <div key={r.id} className="grid-row" style={{ gridTemplateColumns: COLS, borderBottom: "1px solid #eceef3", background: late ? "#fdeced" : "#ffffff" }}>
                <div className="cell" style={{ fontWeight: 600 }}>{r.pdNumber}</div>
                <div className="cell">{r.factory}</div>
                <div className="cell" title={r.subitem}>{r.subitem}</div>
                <div className="cell"><span style={pillStyle(statusPill(r.status, STEP_BY_NO[r.stepNo]))}>{statusLabel(r.status)}</span></div>
                <div className="cell" style={{ fontVariantNumeric: "tabular-nums" }}>{fmtDate(r.reqDate)}</div>
                <div className="cell" style={{ fontVariantNumeric: "tabular-nums", ...(late ? { color: "#a3202b", fontWeight: 700 } : { color: "#4a5068" }) }}>{fmtDate(r.confDate)}</div>
                <div className="cell" style={{ fontVariantNumeric: "tabular-nums" }}>{fmtDate(r.realDate)}</div>
                <div className="cell" style={{ whiteSpace: "normal" }}>{r.description ?? ""}</div>
              </div>
            );
          })}
          {data && data.rows.length === 0 ? <div style={{ padding: 32, textAlign: "center", fontSize: 14, color: "#5a6075" }}>No subitems assigned.</div> : null}
        </div>
      </div>
    </Shell>
  );
}

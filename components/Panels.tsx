"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { statusPill, STATUS_LABEL, type Status } from "@/lib/catalog";
import { fmtDateTime, SECTION_STATE_UI, STYLE_STATUS_UI, type SectionState, type StyleStatus } from "@/lib/logic";
import type { StyleDTO } from "@/lib/styles";
import { api, pillStyle, SidePanel, uploadPhoto } from "./ui";

export interface UserLite {
  id: string;
  name: string;
  type: string;
  isLineBuilder: boolean;
  companyId: string | null;
}
interface Named {
  id: string;
  name: string;
}

const TYPE_LABEL: Record<string, string> = { ADMIN: "Admin", JUSTIN: "Justin", T1: "T1", T2: "T2" };

export function StyleForm({
  mode,
  style,
  factories,
  users,
  admin,
  onClose,
  onSaved,
  onAskDelete,
}: {
  mode: "add" | "duplicate" | "edit";
  style?: StyleDTO;
  factories: Named[];
  users: UserLite[];
  admin: boolean;
  onClose: () => void;
  onSaved: (s: StyleDTO) => void;
  onAskDelete?: () => void;
}) {
  const [factoryId, setFactoryId] = useState(style?.factoryId ?? factories[0]?.id ?? "");
  const [pdNumber, setPdNumber] = useState("");
  const [collection, setCollection] = useState(style?.collection ?? "");
  const [lineBuilderId, setLineBuilderId] = useState(style?.lineBuilderId ?? "");
  const [photo, setPhoto] = useState(style?.photo ?? "");
  const [err, setErr] = useState("");
  const [busy, setBusy] = useState(false);
  const [uploading, setUploading] = useState(false);
  const edit = mode === "edit";
  const lineBuilders = users.filter((u) => u.isLineBuilder);

  async function save() {
    if (!edit && !pdNumber.trim()) return setErr("PD # / SKU is required.");
    if (!lineBuilderId) return setErr("Line Builder is required.");
    setBusy(true);
    setErr("");
    const payload = { collection, lineBuilderId, photo: photo || null };
    try {
      const saved = edit
        ? await api<StyleDTO>(`/api/styles/${style!.id}`, { method: "PATCH", json: payload })
        : await api<StyleDTO>("/api/styles", { json: { ...payload, factoryId, pdNumber, duplicateOfId: mode === "duplicate" ? style!.id : undefined } });
      onSaved(saved);
    } catch (e) {
      setErr((e as Error).message);
      setBusy(false);
    }
  }

  return (
    <SidePanel
      kicker={edit ? "Edit style" : mode === "duplicate" ? "Duplicate style" : "New style"}
      title={edit ? style!.pdNumber : mode === "duplicate" ? `Copy of ${style!.pdNumber}` : "Add style"}
      sub={edit ? style!.factory : undefined}
      onClose={onClose}
      closeLabel="Cancel"
      footer={
        <>
          {edit && admin && onAskDelete ? <button className="tbtn btn-danger-outline" style={{ marginRight: "auto" }} onClick={onAskDelete}>Delete style</button> : null}
          <button className="tbtn btn-secondary" onClick={onClose}>Cancel</button>
          <button className="tbtn btn-primary" disabled={busy || uploading} onClick={save}>{edit ? "Save" : "Add style"}</button>
        </>
      }
    >
      <div style={{ flex: 1, overflowY: "auto", padding: 20, display: "flex", flexDirection: "column", gap: 16 }}>
        {edit ? null : (
          <>
            <label className="formlabel">
              Factory (T1) *
              <select className="inp" value={factoryId} onChange={(e) => setFactoryId(e.target.value)}>
                {factories.map((f) => <option key={f.id} value={f.id}>{f.name}</option>)}
              </select>
            </label>
            <label className="formlabel">
              PD # / SKU *
              <input className="inp" value={pdNumber} maxLength={40} onChange={(e) => setPdNumber(e.target.value)} placeholder="e.g. TL5400" />
            </label>
          </>
        )}
        <label className="formlabel">
          Collection
          <input className="inp" value={collection} maxLength={80} onChange={(e) => setCollection(e.target.value)} placeholder="e.g. TL ACS" />
        </label>
        <label className="formlabel">
          Line Builder *
          <select className="inp" value={lineBuilderId} onChange={(e) => setLineBuilderId(e.target.value)}>
            <option value="">—</option>
            {lineBuilders.map((u) => <option key={u.id} value={u.id}>{u.name}</option>)}
          </select>
        </label>
        <div className="formlabel">
          Style photo
          <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
            {/* eslint-disable-next-line @next/next/no-img-element */}
            {photo ? <img src={photo} alt="Style photo" style={{ width: 50, height: 50, objectFit: "cover", borderRadius: 6, border: "1px solid #dfe2ea" }} /> : null}
            <label style={{ position: "relative", fontSize: 13, fontWeight: 600, display: "inline-flex", alignItems: "center", gap: 6, minHeight: 44, padding: "0 14px", border: "1px solid #2f5fd0", borderRadius: 8, background: "#ffffff", color: "#1d3f94", cursor: "pointer" }}>
              {uploading ? "Uploading…" : photo ? "Replace photo" : "Upload photo"}
              <input
                type="file"
                accept="image/jpeg,image/png,image/webp,image/gif"
                className="vh"
                aria-label="Style photo"
                disabled={uploading}
                onChange={async (e) => {
                  const f = e.target.files?.[0];
                  e.target.value = "";
                  if (!f) return;
                  setUploading(true);
                  setErr("");
                  try {
                    setPhoto(await uploadPhoto(f));
                  } catch (x) {
                    setErr((x as Error).message);
                  } finally {
                    setUploading(false);
                  }
                }}
              />
            </label>
            {photo ? <button className="tbtn btn-secondary" onClick={() => setPhoto("")}>Remove</button> : null}
          </div>
        </div>
        {edit ? null : <div style={{ fontSize: 12, color: "#5a6075" }}>The new style starts with every subitem in Not Started.</div>}
        {err ? <div role="alert" className="alertbox">{err}</div> : null}
        {edit ? <div style={{ fontSize: 12, color: "#5a6075" }}>Status is calculated from the subitems and can&#39;t be edited here.</div> : null}
      </div>
    </SidePanel>
  );
}

interface Message {
  id: string;
  author: string;
  text: string;
  createdAt: string;
}

export function DiscussionPanel({ style, author, onClose, onCount }: { style: StyleDTO; author: string; onClose: () => void; onCount: (n: number) => void }) {
  const [msgs, setMsgs] = useState<Message[] | null>(null);
  const [draft, setDraft] = useState("");
  const [err, setErr] = useState("");
  const [busy, setBusy] = useState(false);
  const end = useRef<HTMLDivElement>(null);
  const url = `/api/styles/${style.id}/discussion`;

  const apply = useCallback(
    (list: Message[]) => {
      setMsgs(list);
      onCount(list.length);
      requestAnimationFrame(() => end.current?.scrollIntoView({ block: "end" }));
    },
    [onCount],
  );
  useEffect(() => {
    api<{ messages: Message[] }>(url).then((r) => apply(r.messages)).catch((e) => setErr(e.message));
  }, [url, apply]);

  async function post() {
    if (!draft.trim()) return;
    setBusy(true);
    setErr("");
    try {
      apply((await api<{ messages: Message[] }>(url, { json: { text: draft } })).messages);
      setDraft("");
    } catch (e) {
      setErr((e as Error).message);
    } finally {
      setBusy(false);
    }
  }

  return (
    <SidePanel kicker="Discussion" title={style.pdNumber} sub={`${style.factory}${style.collection ? " · " + style.collection : ""}`} width={460} onClose={onClose}>
      <div style={{ flex: 1, overflowY: "auto", padding: "16px 20px", display: "flex", flexDirection: "column", gap: 14, background: "#f8f9fc" }}>
        {msgs === null && !err ? <div style={{ fontSize: 14, color: "#5a6075", textAlign: "center", padding: "32px 0" }}>Loading…</div> : null}
        {msgs?.length === 0 ? <div style={{ fontSize: 14, color: "#5a6075", textAlign: "center", padding: "32px 0" }}>No messages yet. Start the discussion below.</div> : null}
        {msgs?.map((m) => (
          <div key={m.id} style={{ background: "#ffffff", border: "1px solid #e3e6ee", borderRadius: 10, padding: "12px 14px", display: "flex", flexDirection: "column", gap: 6 }}>
            <div style={{ display: "flex", justifyContent: "space-between", gap: 8, fontSize: 12 }}>
              <span style={{ fontWeight: 700, color: "#1c2033" }}>{m.author}</span>
              <span style={{ color: "#5a6075" }}>{fmtDateTime(m.createdAt)}</span>
            </div>
            <div style={{ fontSize: 14, color: "#1c2033", whiteSpace: "pre-wrap", overflowWrap: "anywhere" }}>{m.text}</div>
          </div>
        ))}
        <div ref={end} />
      </div>
      <div style={{ padding: "16px 20px 20px", borderTop: "1px solid #e6e8ef", display: "flex", flexDirection: "column", gap: 10 }}>
        <div style={{ fontSize: 12, fontWeight: 600, color: "#4a5068" }}>Posting as <span style={{ color: "#1c2033" }}>{author}</span></div>
        <textarea aria-label="New message" value={draft} maxLength={4000} onChange={(e) => setDraft(e.target.value)} placeholder="Write a message…" style={{ fontSize: 14, minHeight: 88, resize: "vertical", padding: "10px 12px", border: "1px solid #cfd3de", borderRadius: 8, boxSizing: "border-box", color: "#1c2033" }} />
        {err ? <div role="alert" className="alertbox">{err}</div> : null}
        <div style={{ display: "flex", justifyContent: "flex-end" }}>
          <button className="tbtn btn-primary" disabled={busy || !draft.trim()} onClick={post}>Post</button>
        </div>
      </div>
    </SidePanel>
  );
}

interface Subscriber {
  id: string;
  name: string;
  type: string;
}

export function NotificationsPanel({ style, users, onClose, onCount }: { style: StyleDTO; users: UserLite[]; onClose: () => void; onCount: (n: number) => void }) {
  const [list, setList] = useState<Subscriber[] | null>(null);
  const [pick, setPick] = useState("");
  const [err, setErr] = useState("");
  const url = `/api/styles/${style.id}/notifications`;

  const run = useCallback(
    (p: Promise<{ subscribers: Subscriber[] }>) =>
      p.then((r) => {
        setList(r.subscribers);
        onCount(r.subscribers.length);
        setErr("");
      }).catch((e) => setErr(e.message)),
    [onCount],
  );
  useEffect(() => {
    run(api(url));
  }, [url, run]);

  // Only people who can see the style's discussion can be notified about it.
  const available = users.filter((u) => (u.type === "ADMIN" || u.type === "JUSTIN" || (u.type === "T1" && u.companyId === style.factoryId)) && !list?.some((s) => s.id === u.id));

  return (
    <SidePanel kicker="Notifications" title={style.pdNumber} sub="These users receive email updates about this style." width={420} onClose={onClose}>
      <div style={{ padding: "16px 20px", borderBottom: "1px solid #e6e8ef", display: "flex", gap: 8, alignItems: "flex-end", flexWrap: "wrap" }}>
        <label className="formlabel" style={{ flex: 1, minWidth: 160 }}>
          Add user
          <select className="inp" value={pick} onChange={(e) => setPick(e.target.value)}>
            <option value="">Select a user…</option>
            {available.map((u) => <option key={u.id} value={u.id}>{u.name}</option>)}
          </select>
        </label>
        <button className="tbtn btn-primary" disabled={!pick} onClick={() => { run(api(url, { json: { userId: pick } })); setPick(""); }}>Add user</button>
      </div>
      <div style={{ flex: 1, overflowY: "auto", padding: "8px 20px 20px" }}>
        {err ? <div role="alert" className="alertbox" style={{ marginTop: 8 }}>{err}</div> : null}
        {list?.length === 0 ? <div style={{ fontSize: 14, color: "#5a6075", textAlign: "center", padding: "32px 0" }}>Nobody receives notifications for this style.</div> : null}
        {list?.map((u) => (
          <div key={u.id} style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: 12, minHeight: 52, borderBottom: "1px solid #eceef3" }}>
            <div style={{ display: "flex", flexDirection: "column", gap: 2 }}>
              <span style={{ fontSize: 14, fontWeight: 600 }}>{u.name}</span>
              <span style={{ fontSize: 12, color: "#5a6075" }}>{TYPE_LABEL[u.type] ?? u.type}</span>
            </div>
            <button aria-label={`Remove ${u.name} from notifications`} onClick={() => run(api(`${url}?userId=${encodeURIComponent(u.id)}`, { method: "DELETE" }))} style={{ fontSize: 13, minHeight: 36, padding: "0 12px", border: "1px solid #cfd3de", borderRadius: 6, background: "#ffffff", color: "#8a1621", cursor: "pointer" }}>
              Remove
            </button>
          </div>
        ))}
      </div>
    </SidePanel>
  );
}

export function HistoryPanel({ style, onClose }: { style: StyleDTO; onClose: () => void }) {
  const [list, setList] = useState<{ id: string; user: string; timestamp: string; description: string }[] | null>(null);
  const [err, setErr] = useState("");
  useEffect(() => {
    api<{ entries: { id: string; user: string; timestamp: string; description: string }[] }>(`/api/styles/${style.id}/history`).then((r) => setList(r.entries)).catch((e) => setErr(e.message));
  }, [style.id]);
  return (
    <SidePanel kicker="Change history" title={style.pdNumber} width={460} onClose={onClose}>
      <div style={{ flex: 1, overflowY: "auto", padding: "8px 20px 20px" }}>
        {err ? <div role="alert" className="alertbox" style={{ marginTop: 8 }}>{err}</div> : null}
        {list?.length === 0 ? <div style={{ fontSize: 14, color: "#5a6075", textAlign: "center", padding: "32px 0" }}>No changes recorded yet.</div> : null}
        {list?.map((h) => (
          <div key={h.id} style={{ display: "flex", flexDirection: "column", gap: 3, padding: "12px 0", borderBottom: "1px solid #eceef3" }}>
            <div style={{ display: "flex", justifyContent: "space-between", gap: 8, fontSize: 12 }}>
              <span style={{ fontWeight: 700, color: "#1c2033" }}>{h.user}</span>
              <span style={{ color: "#5a6075", fontVariantNumeric: "tabular-nums" }}>{fmtDateTime(h.timestamp)}</span>
            </div>
            <div style={{ fontSize: 14, color: "#1c2033", overflowWrap: "anywhere" }}>{h.description}</div>
          </div>
        ))}
      </div>
    </SidePanel>
  );
}

function LegendPills({ list }: { list: Status[] }) {
  return (
    <>
      {list.map((k) => <span key={k} style={pillStyle(statusPill(k))}>{STATUS_LABEL[k]}</span>)}
    </>
  );
}

export function Legend({ onClose }: { onClose: () => void }) {
  useEffect(() => {
    const h = (e: KeyboardEvent) => e.key === "Escape" && onClose();
    document.addEventListener("keydown", h);
    return () => document.removeEventListener("keydown", h);
  }, [onClose]);
  const letter = (l: string, s: SectionState) => (
    <>
      <span style={{ display: "inline-flex", alignItems: "center", justifyContent: "center", width: 26, height: 22, borderRadius: 4, fontSize: 11, fontWeight: 700, background: SECTION_STATE_UI[s].bg, color: SECTION_STATE_UI[s].fg }}>{l}</span>
      <span>{SECTION_STATE_UI[s].label}</span>
    </>
  );
  const note = { color: "#5a6075" };
  return (
    <div className="overlay" style={{ alignItems: "center", justifyContent: "center", padding: 16, zIndex: 50 }} onClick={onClose}>
      <div role="dialog" aria-modal="true" aria-label="Status descriptions" onClick={(e) => e.stopPropagation()} style={{ background: "#ffffff", borderRadius: 14, maxWidth: 820, width: "100%", maxHeight: "85vh", overflowY: "auto", boxShadow: "0 20px 60px rgba(0, 0, 0, 0.25)", padding: 24, display: "flex", flexDirection: "column", gap: 16 }}>
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", gap: 12 }}>
          <h2 style={{ margin: 0, fontSize: 20, fontWeight: 700 }}>Status descriptions</h2>
          <button className="tbtn btn-secondary" onClick={onClose}>Close</button>
        </div>
        <div style={{ display: "flex", flexDirection: "column", gap: 12, fontSize: 12, color: "#4a5068" }}>
          <div className="lg"><span className="lgt">Status</span><LegendPills list={["NOT_STARTED", "PENDING", "IN_PROGRESS", "APPROVED", "NA"]} /></div>
          <div className="lg">
            <span className="lgt">Price steps</span>
            {(["NOT_STARTED", "CALCULATING", "SENT", "APPROVED"] as Status[]).map((k) => (
              <span key={k} style={pillStyle(statusPill(k, { fields: ["price"] } as never))}>{STATUS_LABEL[k]}</span>
            ))}
            <span style={note}>Proto Price, Final Price and Confirmed Price</span>
          </div>
          <div className="lg"><span className="lgt">Project Brief</span><LegendPills list={["NOT_DELIVERED", "DELIVERED"]} /><span style={note}>Project Brief, Proto Specs, Specs and Packing Definition</span></div>
          <div className="lg"><span className="lgt">Leather steps</span><LegendPills list={["NOT_STARTED", "REQUESTED", "REJECTED", "RECEIVED"]} /><span style={note}>Leather Shaft, Leather Vamp and Material 3. Requested fills REQ with today and CONF with today + 28 days.</span></div>
          <div className="lg"><span className="lgt">Sample steps</span><LegendPills list={["NOT_STARTED", "REQUESTED", "IN_PROCESS", "SENT", "REJECTED_MX", "REJECTED_USA", "APPROVED"]} /><span style={note}>Sales, Go By, Fit, Lab Samples and Pilot Run. A rejected Fit or Lab sample opens a new round.</span></div>
          <div className="lg"><span className="lgt">Photo</span><LegendPills list={["NOT_STARTED", "UPLOADED"]} /><span style={note}>Set automatically when the photo is uploaded</span></div>
          <div className="lg">
            <span className="lgt">Progress</span>
            {letter("D", "COMPLETE")}{letter("C", "IN_PROGRESS")}{letter("T", "ALERT")}{letter("O", "NOT_STARTED")}
            <span style={note}>D = Design · C = Commercial · O = Operations · T = Technical · P = Production</span>
          </div>
          <div className="lg">
            <span className="lgt">Style Status</span>
            {(["ON_TIME", "AT_RISK", "FINALIZED", "CANCELLED"] as StyleStatus[]).map((k) => (
              <span key={k} style={pillStyle(STYLE_STATUS_UI[k])}>{STYLE_STATUS_UI[k].label}</span>
            ))}
            <span style={note}>Finalized = every step complete · At Risk = a step is rejected or passed its confirmed date while still open</span>
          </div>
          <div className="lg"><span className="lgt">Rows</span><span style={{ background: "#eef9f2", padding: "2px 8px", borderRadius: 4 }}>Complete</span><span style={{ background: "#fdeced", padding: "2px 8px", borderRadius: 4 }}>Alert</span></div>
          <div className="lg"><span className="lgt" /><span style={{ color: "#a3202b", fontWeight: 700 }}>Red date</span><span>= the confirmed date has passed and the step is still open</span></div>
        </div>
      </div>
    </div>
  );
}

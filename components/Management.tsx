"use client";

import { useCallback, useEffect, useState } from "react";
import { Shell } from "./Shell";
import { api, CommitInput, Switch } from "./ui";

interface Company {
  id: string;
  name: string;
  kind: "T1" | "T2";
  active: boolean;
  users: number;
}
interface UserRow {
  id: string;
  name: string;
  email: string;
  type: "ADMIN" | "JUSTIN" | "T1" | "T2";
  companyId: string | null;
  isLineBuilder: boolean;
  hasPassword: boolean;
}

const TYPES = [
  ["ADMIN", "Admin"],
  ["JUSTIN", "Justin"],
  ["T1", "T1"],
  ["T2", "T2"],
] as const;
const USER_COLS = "minmax(150px,1fr) 250px 130px 200px 130px";

export function UserManagement({ userName }: { userName: string }) {
  const [users, setUsers] = useState<UserRow[]>([]);
  const [meId, setMeId] = useState("");
  const [companies, setCompanies] = useState<Company[]>([]);
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [type, setType] = useState<UserRow["type"]>("JUSTIN");
  const [companyId, setCompanyId] = useState("");
  const [err, setErr] = useState("");
  const [note, setNote] = useState("");

  const load = useCallback(async () => {
    const [u, c] = await Promise.all([api<{ meId: string; users: UserRow[] }>("/api/users"), api<{ companies: Company[] }>("/api/companies")]);
    setUsers(u.users);
    setMeId(u.meId);
    setCompanies(c.companies);
  }, []);
  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect -- state is set after the fetch resolves
    load().catch((e) => setErr(e.message));
  }, [load]);

  const of = (kind: string) => companies.filter((c) => c.kind === kind);
  const needsCompany = type === "T1" || type === "T2";
  const newCompany = needsCompany ? (of(type).some((c) => c.id === companyId) ? companyId : (of(type)[0]?.id ?? "")) : "";

  async function run(p: Promise<unknown>, ok = "") {
    setErr("");
    setNote("");
    try {
      await p;
      setNote(ok);
    } catch (e) {
      setErr((e as Error).message);
    }
    await load().catch(() => {});
  }
  const patch = (id: string, json: Record<string, unknown>, ok = "") => run(api(`/api/users/${id}`, { method: "PATCH", json }), ok);

  async function add() {
    await run(api("/api/users", { json: { name, email, type, companyId: newCompany } }).then(() => { setName(""); setEmail(""); }), `Invitation sent to ${email}.`);
  }

  return (
    <Shell heading="User Management" userName={userName} admin>
      <div className="card" style={{ padding: 20, display: "flex", flexWrap: "wrap", gap: 12, alignItems: "flex-end" }}>
        <label className="formlabel">Name<input className="inp" style={{ width: 240 }} value={name} onChange={(e) => setName(e.target.value)} placeholder="e.g. Maria" /></label>
        <label className="formlabel">Email<input className="inp" type="email" style={{ width: 240 }} value={email} onChange={(e) => setEmail(e.target.value)} placeholder="name@company.com" /></label>
        <label className="formlabel">
          Type
          <select className="inp" style={{ width: 140 }} value={type} onChange={(e) => setType(e.target.value as UserRow["type"])}>
            {TYPES.map(([v, l]) => <option key={v} value={v}>{l}</option>)}
          </select>
        </label>
        {needsCompany ? (
          <label className="formlabel">
            Company
            <select className="inp" style={{ width: 200 }} value={newCompany} onChange={(e) => setCompanyId(e.target.value)}>
              {of(type).length === 0 ? <option value="">No {type} companies yet</option> : null}
              {of(type).map((c) => <option key={c.id} value={c.id}>{c.name}</option>)}
            </select>
          </label>
        ) : null}
        <button className="tbtn btn-primary" disabled={!name.trim() || !email.trim()} onClick={add}>Add user</button>
        {err ? <span role="alert" style={{ fontSize: 13, fontWeight: 600, color: "#8a1621" }}>{err}</span> : null}
        {note ? <span role="status" style={{ fontSize: 13, fontWeight: 600, color: "#0d4f30" }}>{note}</span> : null}
      </div>
      <div style={{ fontSize: 13, color: "#5a6075" }}>New users receive an email with a link to choose their password.</div>
      <div className="tablewrap">
        <div style={{ minWidth: 960 }}>
          <div className="grid-row thead" style={{ gridTemplateColumns: USER_COLS, minHeight: 48 }}>
            <div className="cell">User</div><div className="cell">Email</div><div className="cell">Type</div><div className="cell">Company</div><div className="cell">Line Builder</div>
          </div>
          {users.map((u) => {
            const internal = u.type === "ADMIN" || u.type === "JUSTIN";
            return (
              <div key={u.id} className="grid-row" style={{ gridTemplateColumns: USER_COLS, minHeight: 48, borderBottom: "1px solid #eceef3" }}>
                <div className="cell" style={{ fontWeight: 600 }}>
                  {u.name}
                  {u.hasPassword ? null : <span style={{ fontWeight: 500, color: "#6b7086" }}> · no password yet</span>}
                </div>
                <div className="cell" style={{ overflow: "visible" }}>
                  <CommitInput className="osel" type="email" aria-label={`Email of ${u.name}`} value={u.email} placeholder="name@company.com" onCommit={(v) => patch(u.id, { email: v }, u.hasPassword ? "" : `Invitation sent to ${v.trim().toLowerCase()}.`)} />
                </div>
                <div className="cell" style={{ overflow: "visible" }}>
                  <select
                    className="osel"
                    aria-label={`Type of ${u.name}`}
                    value={u.type}
                    disabled={u.id === meId}
                    onChange={(e) => {
                      const t = e.target.value;
                      patch(u.id, { type: t, companyId: t === "T1" || t === "T2" ? (of(t)[0]?.id ?? null) : null });
                    }}
                  >
                    {TYPES.map(([v, l]) => <option key={v} value={v}>{l}</option>)}
                  </select>
                </div>
                <div className="cell" style={{ overflow: "visible" }}>
                  {internal ? (
                    <span style={{ color: "#6b7086" }}>Justin</span>
                  ) : (
                    <select className="osel" aria-label={`Company of ${u.name}`} value={u.companyId ?? ""} onChange={(e) => patch(u.id, { companyId: e.target.value })}>
                      {of(u.type).map((c) => <option key={c.id} value={c.id}>{c.name}</option>)}
                    </select>
                  )}
                </div>
                <div className="cell">
                  {internal ? <Switch on={u.isLineBuilder} label={`Line Builder: ${u.name}`} onChange={(v) => patch(u.id, { isLineBuilder: v })} /> : <span style={{ color: "#6b7086" }}>Not available</span>}
                </div>
              </div>
            );
          })}
        </div>
      </div>
    </Shell>
  );
}

export function CompanyManagement({ kind, userName }: { kind: "T1" | "T2"; userName: string }) {
  const [list, setList] = useState<Company[]>([]);
  const [draft, setDraft] = useState("");
  const [err, setErr] = useState("");
  const t1 = kind === "T1";
  const cols = `minmax(200px,1fr) 180px${t1 ? " 140px" : ""}`;

  const load = useCallback(() => api<{ companies: Company[] }>("/api/companies").then((r) => setList(r.companies.filter((c) => c.kind === kind))), [kind]);
  useEffect(() => {
    load().catch((e) => setErr(e.message));
  }, [load]);

  async function run(p: Promise<unknown>) {
    setErr("");
    try {
      await p;
    } catch (e) {
      setErr((e as Error).message);
    }
    await load().catch(() => {});
  }

  return (
    <Shell heading={`${kind} Management`} userName={userName} admin>
      <div className="card" style={{ padding: 20, display: "flex", flexWrap: "wrap", gap: 12, alignItems: "flex-end" }}>
        <label className="formlabel">
          {t1 ? "New factory (T1)" : "New supplier (T2)"}
          <input className="inp" style={{ width: 280 }} value={draft} maxLength={80} onChange={(e) => setDraft(e.target.value)} placeholder="Company name" />
        </label>
        <button className="tbtn btn-primary" disabled={!draft.trim()} onClick={() => run(api("/api/companies", { json: { name: draft, kind } }).then(() => setDraft("")))}>{t1 ? "Add factory" : "Add supplier"}</button>
        {err ? <span role="alert" style={{ fontSize: 13, fontWeight: 600, color: "#8a1621" }}>{err}</span> : null}
      </div>
      {t1 ? <div style={{ fontSize: 13, color: "#5a6075" }}>An inactive factory disappears from the tabs and from Add style. Its styles are kept.</div> : null}
      <div className="tablewrap">
        <div style={{ minWidth: 480 }}>
          <div className="grid-row thead" style={{ gridTemplateColumns: cols, minHeight: 48 }}>
            <div className="cell">{t1 ? "Factory" : "Supplier"}</div>
            <div className="cell">Users related</div>
            {t1 ? <div className="cell">Active</div> : null}
          </div>
          {list.map((c) => (
            <div key={c.id} className="grid-row" style={{ gridTemplateColumns: cols, minHeight: 48, borderBottom: "1px solid #eceef3" }}>
              <div className="cell" style={{ fontWeight: 600 }}>{c.name}</div>
              <div className="cell" style={{ fontVariantNumeric: "tabular-nums", color: "#4a5068" }}>{c.users}</div>
              {t1 ? <div className="cell"><Switch on={c.active} label={`Active: ${c.name}`} onChange={(v) => run(api(`/api/companies/${c.id}`, { method: "PATCH", json: { active: v } }))} /></div> : null}
            </div>
          ))}
          {list.length === 0 ? <div style={{ padding: 32, textAlign: "center", fontSize: 14, color: "#5a6075" }}>None yet.</div> : null}
        </div>
      </div>
    </Shell>
  );
}

"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { FINAL_PRICE_STEP, PROTO_PRICE_STEP, SECTIONS } from "@/lib/catalog";
import { fmtPrice, latestRounds, SECTION_STATE_UI, sectionStates, STYLE_STATUS_UI, styleStatus, todayISO, type StyleStatus } from "@/lib/logic";
import type { StyleDTO } from "@/lib/styles";
import { DiscussionPanel, HistoryPanel, Legend, NotificationsPanel, StyleForm, type UserLite } from "./Panels";
import { Shell, type ViewItem } from "./Shell";
import { Subitems, type SubPatch } from "./Subitems";
import { api, ConfirmDialog, pillStyle, Toast } from "./ui";

interface BoardData {
  me: { id: string; name: string; type: string };
  perms: { admin: boolean; edit: boolean; manageStyles: boolean };
  factories: { id: string; name: string }[];
  users: UserLite[];
  t2Companies: { id: string; name: string }[];
  styles: StyleDTO[];
}

type Panel = { kind: "add" } | { kind: "duplicate" | "edit" | "discussion" | "notifications" | "history"; styleId: string };

const GROUP_COLORS = ["#2f5fd0", "#7a3fc9", "#0f8a8a", "#c2620a", "#3d4a63"];

function sortStyles(list: StyleDTO[]): StyleDTO[] {
  return [...list].sort((a, b) => a.collection.localeCompare(b.collection) || a.firstPoDate.localeCompare(b.firstPoDate) || a.pdNumber.localeCompare(b.pdNumber));
}

export function Board() {
  const [data, setData] = useState<BoardData | null>(null);
  const [loadError, setLoadError] = useState("");
  const [tab, setTab] = useState("ALL");
  const [open, setOpen] = useState<Set<string>>(new Set());
  const [hideFinalized, setHideFinalized] = useState(false);
  const [showPics, setShowPics] = useState(false);
  const [rowMenu, setRowMenu] = useState<{ id: string; right: number; top?: number; bottom?: number } | null>(null);
  const [panel, setPanel] = useState<Panel | null>(null);
  const [confirm, setConfirm] = useState<{ kind: "cancel" | "delete"; styleId: string } | null>(null);
  const [busy, setBusy] = useState(false);
  const [legend, setLegend] = useState(false);
  const [toast, setToast] = useState("");
  const [today] = useState(() => todayISO());
  const menuRef = useRef<HTMLDivElement>(null);

  const load = useCallback(() => api<BoardData>("/api/board").then((d) => { setData(d); setLoadError(""); }).catch((e) => setLoadError(e.message)), []);
  useEffect(() => {
    load();
  }, [load]);

  useEffect(() => {
    if (!rowMenu) return;
    const close = () => setRowMenu(null);
    const away = (e: MouseEvent) => menuRef.current && !menuRef.current.contains(e.target as Node) && close();
    const esc = (e: KeyboardEvent) => e.key === "Escape" && close();
    document.addEventListener("mousedown", away);
    document.addEventListener("keydown", esc);
    window.addEventListener("scroll", close, true);
    window.addEventListener("resize", close);
    return () => {
      document.removeEventListener("mousedown", away);
      document.removeEventListener("keydown", esc);
      window.removeEventListener("scroll", close, true);
      window.removeEventListener("resize", close);
    };
  }, [rowMenu]);

  const replaceStyle = useCallback((s: StyleDTO) => {
    setData((d) => d && { ...d, styles: d.styles.some((x) => x.id === s.id) ? d.styles.map((x) => (x.id === s.id ? s : x)) : sortStyles([...d.styles, s]) });
  }, []);

  const patchSub = useCallback(
    (styleId: string, subId: string, patch: SubPatch, optimistic = true) => {
      if (optimistic) {
        setData((d) => d && { ...d, styles: d.styles.map((s) => (s.id !== styleId ? s : { ...s, subitems: s.subitems.map((x) => (x.id === subId ? { ...x, ...patch } : x)) })) });
      }
      api<StyleDTO>(`/api/subitems/${subId}`, { method: "PATCH", json: patch })
        .then(replaceStyle)
        .catch((e) => {
          setToast(e.message);
          load();
        });
    },
    [replaceStyle, load],
  );

  const panelStyleId = panel && panel.kind !== "add" ? panel.styleId : null;
  const panelIdRef = useRef(panelStyleId);
  useEffect(() => {
    panelIdRef.current = panelStyleId;
  }, [panelStyleId]);
  const setCount = useCallback((key: "messages" | "subscribers", n: number) => {
    const id = panelIdRef.current;
    setData((d) => d && { ...d, styles: d.styles.map((s) => (s.id === id && s[key] !== n ? { ...s, [key]: n } : s)) });
  }, []);
  const onMessages = useCallback((n: number) => setCount("messages", n), [setCount]);
  const onSubscribers = useCallback((n: number) => setCount("subscribers", n), [setCount]);
  const clearToast = useCallback(() => setToast(""), []);

  const view = useMemo(() => {
    if (!data) return null;
    const rows = data.styles.map((s) => {
      const status = styleStatus(s.subitems, s.cancelled, today);
      const latest = latestRounds(s.subitems);
      return { s, status, sections: sectionStates(s.subitems, today), proto: fmtPrice(latest.get(PROTO_PRICE_STEP)?.price), final: fmtPrice(latest.get(FINAL_PRICE_STEP)?.price) };
    });
    const visible = rows.filter((r) => !hideFinalized || r.status !== "FINALIZED");
    return { rows, visible };
  }, [data, today, hideFinalized]);

  if (!data || !view) {
    return (
      <Shell heading="Justin" userName="…">
        <div className="card" style={{ padding: 32, textAlign: "center", fontSize: 14, color: "#5a6075" }}>
          {loadError || "Loading…"}
        </div>
      </Shell>
    );
  }

  const { me, perms, factories } = data;
  // T1 users only get their own factory tab.
  const single = me.type === "T1";
  const activeTab = single ? (factories[0]?.id ?? "") : factories.some((f) => f.id === tab) ? tab : "ALL";
  const tabs = [...(single ? [] : [{ id: "ALL", name: "All" }]), ...factories];
  const groups = factories
    .filter((f) => activeTab === "ALL" || f.id === activeTab)
    .map((f) => ({
      factory: f,
      color: GROUP_COLORS[factories.indexOf(f) % GROUP_COLORS.length],
      total: view.rows.filter((r) => r.s.factoryId === f.id).length,
      risk: view.rows.filter((r) => r.s.factoryId === f.id && r.status === "AT_RISK").length,
      rows: view.visible.filter((r) => r.s.factoryId === f.id),
    }))
    .filter((g) => g.rows.length > 0);
  const shown = groups.flatMap((g) => g.rows);
  const cols = `44px ${showPics ? "66px " : ""}116px 130px 140px 176px 120px 100px 100px 90px minmax(0,1fr)`;
  const panelStyle = panelStyleId ? data.styles.find((s) => s.id === panelStyleId) : undefined;
  const confirmStyle = confirm ? data.styles.find((s) => s.id === confirm.styleId) : undefined;
  const menuStyle = rowMenu ? data.styles.find((s) => s.id === rowMenu.id) : undefined;

  const viewItems: ViewItem[] = [
    { label: "Expand all", role: "menuitem", onClick: () => setOpen(new Set(shown.map((r) => r.s.id))) },
    { label: "Hide Finalized", role: "menuitemcheckbox", checked: hideFinalized, onClick: () => setHideFinalized(!hideFinalized) },
    { label: "Collapse all", role: "menuitem", onClick: () => setOpen(new Set()) },
    { label: "With picture", role: "menuitemradio", checked: showPics, onClick: () => setShowPics(true) },
    { label: "Without picture", role: "menuitemradio", checked: !showPics, onClick: () => setShowPics(false) },
  ];

  function toggle(id: string) {
    setOpen((o) => {
      const n = new Set(o);
      if (n.has(id)) n.delete(id);
      else n.add(id);
      return n;
    });
  }

  function openRowMenu(e: React.MouseEvent<HTMLButtonElement>, id: string) {
    e.stopPropagation();
    if (rowMenu?.id === id) return setRowMenu(null);
    const r = e.currentTarget.getBoundingClientRect();
    const right = Math.max(8, window.innerWidth - r.right);
    setRowMenu(window.innerHeight - r.bottom < 320 && r.top > 320 ? { id, right, bottom: window.innerHeight - r.top + 6 } : { id, right, top: r.bottom + 6 });
  }

  async function runConfirm() {
    if (!confirm) return;
    setBusy(true);
    try {
      if (confirm.kind === "cancel") replaceStyle(await api<StyleDTO>(`/api/styles/${confirm.styleId}/cancel`, { method: "POST" }));
      else {
        await api(`/api/styles/${confirm.styleId}`, { method: "DELETE" });
        setData((d) => d && { ...d, styles: d.styles.filter((s) => s.id !== confirm.styleId) });
        setPanel(null);
      }
    } catch (e) {
      setToast((e as Error).message);
    } finally {
      setBusy(false);
      setConfirm(null);
    }
  }

  const menuAction = (fn: () => void) => () => {
    setRowMenu(null);
    fn();
  };
  const count = (n: number) => <span style={{ fontSize: 12, fontWeight: 700, color: "#1d4fb8", fontVariantNumeric: "tabular-nums" }}>{n}</span>;
  const rowItem = { minHeight: 40 } as const;

  return (
    <Shell heading="Justin" userName={me.name} admin={perms.admin} onAdd={perms.manageStyles && factories.length ? () => setPanel({ kind: "add" }) : undefined} viewItems={viewItems}>
      <div role="tablist" aria-label="Factories" style={{ display: "flex", flexWrap: "wrap", gap: 4, borderBottom: "1px solid #dcdfe8" }}>
        {tabs.map((t) => {
          const active = t.id === activeTab;
          const n = t.id === "ALL" ? view.rows.length : view.rows.filter((r) => r.s.factoryId === t.id).length;
          return (
            <button key={t.id} className="tab" role="tab" aria-selected={active} onClick={() => setTab(t.id)} style={active ? { color: "#1c2033", fontWeight: 700, boxShadow: "inset 0 -3px 0 #2f5fd0" } : { color: "#4a5068", fontWeight: 500 }}>
              {t.name}
              <span style={{ fontSize: 12, fontWeight: 600, padding: "2px 8px", borderRadius: 10, ...(active ? { background: "#2f5fd0", color: "#ffffff" } : { background: "#eceef3", color: "#4a5068" }) }}>{n}</span>
            </button>
          );
        })}
      </div>

      <div className="tablewrap">
        <div style={{ minWidth: showPics ? 1146 : 1080 }}>
          <div className="grid-row thead" style={{ gridTemplateColumns: cols }}>
            <div className="cell" />
            {showPics ? <div className="cell">Photo</div> : null}
            <div className="cell">PD # / SKU</div>
            <div className="cell">Collection</div>
            <div className="cell">Line Builder</div>
            <div className="cell">Progress</div>
            <div className="cell">Status</div>
            <div className="cell">Proto Price</div>
            <div className="cell">Final Price</div>
            <div className="cell" style={{ textAlign: "center" }}>Actions</div>
          </div>

          {groups.map((g) => (
            <div key={g.factory.id}>
              {activeTab === "ALL" ? (
                <div style={{ background: "#fafbfd", minHeight: 48, display: "flex", alignItems: "center", gap: 12, padding: "0 16px", borderBottom: "1px solid #e6e8ef" }}>
                  <span style={{ fontSize: 16, fontWeight: 700, color: g.color }}>{g.factory.name}</span>
                  <span style={{ fontSize: 12, color: "#5a6075" }}>T1 · {g.total} styles · {g.risk} at risk</span>
                </div>
              ) : null}
              {g.rows.map(({ s, status, sections, proto, final }) => {
                const isOpen = open.has(s.id);
                const ui = STYLE_STATUS_UI[status as StyleStatus];
                const rowBg = status === "FINALIZED" ? { background: "#eef9f2" } : status === "CANCELLED" ? { background: "#c9cdd6", color: "#2a2e3b" } : {};
                return (
                  <div key={s.id}>
                    <div className="rowbtn grid-row" style={{ gridTemplateColumns: cols, ...rowBg }} onClick={() => toggle(s.id)}>
                      <span className="cell" style={{ display: "flex", justifyContent: "center" }}>
                        <button aria-expanded={isOpen} aria-label={`${isOpen ? "Collapse" : "Expand"} ${s.pdNumber}`} onClick={(e) => { e.stopPropagation(); toggle(s.id); }} style={{ border: 0, background: "transparent", width: 32, height: 32, padding: 0, display: "flex", alignItems: "center", justifyContent: "center", cursor: "pointer", borderRadius: 6 }}>
                          <svg width="14" height="14" viewBox="0 0 16 16" aria-hidden="true" style={{ flex: "none", transition: "transform .15s", transform: `rotate(${isOpen ? 90 : 0}deg)` }}>
                            <path d="M6 4l4 4-4 4" fill="none" stroke="#4a5068" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" />
                          </svg>
                        </button>
                      </span>
                      {showPics ? (
                        <span className="cell" style={{ padding: "6px 8px", overflow: "visible" }}>
                          {s.photo ? (
                            // eslint-disable-next-line @next/next/no-img-element
                            <img src={s.photo} alt={`Photo of ${s.pdNumber}`} style={{ width: 50, height: 50, objectFit: "cover", borderRadius: 6, border: "1px solid #dfe2ea", display: "block" }} />
                          ) : (
                            <span style={{ width: 50, height: 50, boxSizing: "border-box", border: "1px dashed #c3c8d4", borderRadius: 6, background: "#f6f7fa", display: "flex", alignItems: "center", justifyContent: "center" }}>
                              <svg width="20" height="20" viewBox="0 0 16 16" aria-hidden="true">
                                <rect x="2" y="3" width="12" height="10" rx="1.5" fill="none" stroke="#9aa0b2" strokeWidth="1.3" />
                                <circle cx="6" cy="6.5" r="1.2" fill="#9aa0b2" />
                                <path d="M3 12l3.5-3.5 2.5 2.5 2-2 2.5 2.5" fill="none" stroke="#9aa0b2" strokeWidth="1.3" strokeLinejoin="round" />
                              </svg>
                            </span>
                          )}
                        </span>
                      ) : null}
                      <span className="cell" style={{ fontWeight: 600 }} title={s.pdNumber}>{s.pdNumber}</span>
                      <span className="cell" title={s.collection}>{s.collection}</span>
                      <span className="cell">{s.lineBuilderName ?? "—"}</span>
                      <span className="cell" style={{ overflow: "visible" }}>
                        <span role="img" aria-label={`Progress: ${sections.map((x, i) => `${SECTIONS[i].name} ${SECTION_STATE_UI[x.state].label}`).join(", ")}`} style={{ display: "inline-flex", gap: 3 }}>
                          {sections.map((x, i) => (
                            <span key={i} title={`${SECTIONS[i].name}: ${SECTION_STATE_UI[x.state].label}`} style={{ display: "inline-flex", alignItems: "center", justifyContent: "center", width: 26, height: 22, borderRadius: 4, fontSize: 11, fontWeight: 700, background: SECTION_STATE_UI[x.state].bg, color: SECTION_STATE_UI[x.state].fg }}>
                              {SECTIONS[i].letter}
                            </span>
                          ))}
                        </span>
                      </span>
                      <span className="cell"><span style={pillStyle(ui)}>{ui.label}</span></span>
                      <span className="cell" style={{ fontVariantNumeric: "tabular-nums" }}>{proto}</span>
                      <span className="cell" style={{ fontVariantNumeric: "tabular-nums" }}>{final}</span>
                      <span className="cell" style={{ overflow: "visible", display: "flex", justifyContent: "center", alignItems: "center" }}>
                        <button aria-label={`Actions for ${s.pdNumber}`} aria-haspopup="true" aria-expanded={rowMenu?.id === s.id} onMouseDown={(e) => e.stopPropagation()} onClick={(e) => openRowMenu(e, s.id)} style={{ display: "inline-flex", alignItems: "center", justifyContent: "center", minHeight: 32, minWidth: 44, padding: "0 10px", border: "1px solid #dfe2ea", borderRadius: 6, background: "#ffffff", cursor: "pointer" }}>
                          <svg width="16" height="16" viewBox="0 0 16 16" aria-hidden="true">
                            <path d="M2.5 4h11M2.5 8h11M2.5 12h11" fill="none" stroke="#1c2033" strokeWidth="1.6" strokeLinecap="round" />
                          </svg>
                        </button>
                      </span>
                    </div>
                    {isOpen ? <Subitems style={s} readOnly={!perms.edit} users={data.users} today={today} onPatch={(subId, patch, optimistic) => patchSub(s.id, subId, patch, optimistic)} onError={setToast} /> : null}
                  </div>
                );
              })}
            </div>
          ))}
          {shown.length === 0 ? <div style={{ padding: 32, textAlign: "center", fontSize: 14, color: "#5a6075" }}>No styles match this view.</div> : null}
        </div>
      </div>

      <div style={{ display: "flex" }}>
        <button className="tbtn btn-secondary" onClick={() => setLegend(true)}>Show status descriptions</button>
      </div>

      {rowMenu && menuStyle ? (
        <div ref={menuRef} role="menu" className="menu" style={{ position: "fixed", right: rowMenu.right, top: rowMenu.top, bottom: rowMenu.bottom, minWidth: 210, zIndex: 45 }}>
          <button role="menuitem" className="menuitem" style={rowItem} onClick={menuAction(() => setPanel({ kind: "discussion", styleId: menuStyle.id }))}>Discussion{count(menuStyle.messages)}</button>
          {perms.edit ? <button role="menuitem" className="menuitem" style={rowItem} onClick={menuAction(() => setPanel({ kind: "notifications", styleId: menuStyle.id }))}>Notifications{count(menuStyle.subscribers)}</button> : null}
          <button role="menuitem" className="menuitem" style={rowItem} onClick={menuAction(() => setPanel({ kind: "history", styleId: menuStyle.id }))}>History</button>
          {perms.edit ? <button role="menuitem" className="menuitem" style={rowItem} onClick={menuAction(() => setPanel({ kind: "edit", styleId: menuStyle.id }))}>Edit</button> : null}
          {perms.manageStyles ? <button role="menuitem" className="menuitem" style={rowItem} onClick={menuAction(() => setPanel({ kind: "duplicate", styleId: menuStyle.id }))}>Duplicate</button> : null}
          {perms.manageStyles && !menuStyle.cancelled ? (
            <>
              <div className="menusep" />
              <button role="menuitem" className="menuitem" style={{ ...rowItem, color: "#8a1621" }} onClick={menuAction(() => setConfirm({ kind: "cancel", styleId: menuStyle.id }))}>Cancel style</button>
            </>
          ) : null}
          {perms.admin && menuStyle.cancelled ? (
            <>
              <div className="menusep" />
              <button role="menuitem" className="menuitem" style={{ ...rowItem, color: "#1d3f94" }} onClick={menuAction(() => api<StyleDTO>(`/api/styles/${menuStyle.id}/restore`, { method: "POST" }).then(replaceStyle).catch((e) => setToast(e.message)))}>Restore style</button>
            </>
          ) : null}
        </div>
      ) : null}

      {panel?.kind === "add" ? <StyleForm mode="add" factories={factories} users={data.users} t2Companies={data.t2Companies} admin={perms.admin} onClose={() => setPanel(null)} onSaved={(s) => { replaceStyle(s); setPanel(null); }} /> : null}
      {panel && panelStyle && (panel.kind === "duplicate" || panel.kind === "edit") ? (
        <StyleForm key={panel.kind + panelStyle.id} mode={panel.kind} style={panelStyle} factories={factories} users={data.users} t2Companies={data.t2Companies} admin={perms.admin} onClose={() => setPanel(null)} onSaved={(s) => { replaceStyle(s); setPanel(null); }} onAskDelete={() => setConfirm({ kind: "delete", styleId: panelStyle.id })} />
      ) : null}
      {panel?.kind === "discussion" && panelStyle ? <DiscussionPanel style={panelStyle} author={me.name} onClose={() => setPanel(null)} onCount={onMessages} /> : null}
      {panel?.kind === "notifications" && panelStyle ? <NotificationsPanel style={panelStyle} users={data.users} onClose={() => setPanel(null)} onCount={onSubscribers} /> : null}
      {panel?.kind === "history" && panelStyle ? <HistoryPanel style={panelStyle} onClose={() => setPanel(null)} /> : null}

      {confirm && confirmStyle ? (
        confirm.kind === "cancel" ? (
          <ConfirmDialog title={`Cancel ${confirmStyle.pdNumber}?`} text="The style will be marked as Cancelled. Only an Admin can remove that status." keepLabel="Keep style" confirmLabel="Cancel style" busy={busy} onKeep={() => setConfirm(null)} onConfirm={runConfirm} />
        ) : (
          <ConfirmDialog title={`Delete ${confirmStyle.pdNumber}?`} text="The style, its subitems, discussion and history will be removed from PDM. To keep it visible as a record, cancel the style instead." keepLabel="Keep style" confirmLabel="Delete style" busy={busy} onKeep={() => setConfirm(null)} onConfirm={runConfirm} />
        )
      ) : null}
      {legend ? <Legend onClose={() => setLegend(false)} /> : null}
      {toast ? <Toast message={toast} onDone={clearToast} /> : null}
    </Shell>
  );
}

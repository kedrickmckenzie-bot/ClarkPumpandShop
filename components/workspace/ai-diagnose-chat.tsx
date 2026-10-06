"use client";

import { useEffect, useRef, useState, type SyntheticEvent } from "react";

type ChatMessage = { from: "tech" | "ai"; text: string };
type Source = { kind: "history" | "note" | "document" | "general" | "web"; label: string; url?: string };
type Entry = ChatMessage & { sources?: Source[] };

/** The job's troubleshooting chat is kept in this browser until checkout, which saves it with the job. */
export const diagnoseStorageKey = (workOrderId: string) => `ai-diagnose:${workOrderId}`;

export function readDiagnoseChat(workOrderId: string): ChatMessage[] {
  try {
    const saved = JSON.parse(window.localStorage.getItem(diagnoseStorageKey(workOrderId)) ?? "[]") as Entry[];
    return Array.isArray(saved) ? saved.map(({ from, text }) => ({ from, text })) : [];
  } catch { return []; }
}
export function clearDiagnoseChat(workOrderId: string) {
  try { window.localStorage.removeItem(diagnoseStorageKey(workOrderId)); } catch { /* storage unavailable */ }
}

const sourceText: Record<Source["kind"], string> = { history: "This unit's history", note: "Earlier repair notes", document: "On file", general: "General knowledge · double-check", web: "Web · double-check" };
const sourceColor: Record<Source["kind"], string> = { history: "#17643a", note: "#17643a", document: "#2457d6", general: "#8a5a00", web: "#8a5a00" };

/** Troubleshooting chat that reads this unit's history, repair notes and document titles. */
export function AiDiagnoseChat({ workOrderId, assetId, title = "Troubleshoot with AI" }: { workOrderId?: string; assetId?: string; title?: string }) {
  const greeting = "What's it doing? Include any readings you have.";
  const [messages, setMessages] = useState<Entry[]>([]), [loaded, setLoaded] = useState(false);
  // An earlier chat on this job (kept in this browser) comes back when the box is opened.
  function onToggle(event: SyntheticEvent<HTMLDetailsElement>) {
    if (!event.currentTarget.open || loaded) return;
    setLoaded(true);
    if (workOrderId) try { setMessages(JSON.parse(window.localStorage.getItem(diagnoseStorageKey(workOrderId)) ?? "[]") as Entry[]); } catch { /* storage unavailable */ }
    window.setTimeout(() => input.current?.focus(), 0);
  }
  const [text, setText] = useState(""), [busy, setBusy] = useState(false), [error, setError] = useState("");
  const input = useRef<HTMLTextAreaElement>(null), log = useRef<HTMLOListElement>(null);
  useEffect(() => { log.current?.lastElementChild?.scrollIntoView({ block: "nearest" }); }, [messages, busy]);
  function remember(next: Entry[]) {
    setMessages(next);
    if (workOrderId) try { window.localStorage.setItem(diagnoseStorageKey(workOrderId), JSON.stringify(next.slice(-38))); } catch { /* storage unavailable */ }
  }
  async function send() {
    const said = text.trim();
    if (!said || busy) return;
    const next: Entry[] = [...messages, { from: "tech", text: said }];
    remember(next); setText(""); setBusy(true); setError("");
    try {
      const chat = [{ from: "ai" as const, text: greeting }, ...next].slice(-38).map(({ from, text }) => ({ from, text }));
      const response = await fetch("/api/ops/ai/diagnose", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ workOrderId, assetId, messages: chat }) });
      const result = await response.json() as { turn?: { reply: string; sources: Source[] }; error?: string };
      if (!response.ok || !result.turn) throw new Error(result.error ?? "The AI couldn't answer. Try again.");
      remember([...next, { from: "ai", text: result.turn.reply, sources: result.turn.sources }]);
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : "The AI couldn't answer. Try again.");
    } finally {
      setBusy(false);
      input.current?.focus();
    }
  }
  return <details onToggle={onToggle} style={{ border: "1px solid #c9d7f5", borderRadius: 6, background: "#f5f8ff", padding: "10px 14px" }}>
    <summary style={{ cursor: "pointer", fontWeight: 600, color: "#2457d6", minHeight: 32, display: "flex", alignItems: "center" }}>{title}</summary>
    <div style={{ display: "grid", gap: 10, marginTop: 10 }}>
      <ol ref={log} aria-live="polite" style={{ listStyle: "none", margin: 0, padding: 0, display: "grid", gap: 8, maxHeight: 420, overflowY: "auto" }}>
        <li style={{ justifySelf: "start", maxWidth: "85%", padding: "8px 12px", borderRadius: 12, background: "white", border: "1px solid #dbe2ec" }}>{greeting}</li>
        {messages.map((message, index) => <li key={index} style={{ justifySelf: message.from === "tech" ? "end" : "start", maxWidth: "85%", display: "grid", gap: 4 }}>
          <span style={{ padding: "8px 12px", borderRadius: 12, background: message.from === "tech" ? "#2457d6" : "white", color: message.from === "tech" ? "white" : "#1d2b3e", border: message.from === "tech" ? 0 : "1px solid #dbe2ec", whiteSpace: "pre-wrap" }}>{message.text}</span>
          {message.sources?.length ? <span style={{ display: "flex", flexWrap: "wrap", gap: 6 }}>{message.sources.map((source, i) => { const chip = { padding: "2px 8px", borderRadius: 10, border: `1px solid ${sourceColor[source.kind]}`, color: sourceColor[source.kind], background: "white", fontSize: 13 }; return source.url ? <a key={i} href={source.url} target="_blank" rel="noreferrer noopener" style={chip}>{sourceText[source.kind]}: {source.label} ↗</a> : <small key={i} style={chip}>{sourceText[source.kind]}: {source.label}</small>; })}</span> : null}
        </li>)}
        {busy ? <li style={{ justifySelf: "start", color: "#5b6b80" }}>Looking at this unit&apos;s history and manuals…</li> : null}
      </ol>
      {error ? <p role="alert" style={{ margin: 0, color: "#8c3427" }}>{error}</p> : null}
      <div style={{ display: "flex", gap: 8, alignItems: "flex-end" }}>
        <label style={{ flex: 1, display: "grid" }}>
          <span style={{ position: "absolute", width: 1, height: 1, overflow: "hidden", clip: "rect(0 0 0 0)" }}>Your question</span>
          <textarea ref={input} rows={2} maxLength={2000} value={text} onChange={event => setText(event.target.value)} onKeyDown={event => { if (event.key === "Enter" && !event.shiftKey) { event.preventDefault(); void send(); } }} placeholder="Describe it, or ask about recent service" disabled={busy}/>
        </label>
        <button type="button" onClick={() => void send()} disabled={busy || !text.trim()} style={{ minHeight: 44, padding: "8px 16px", borderRadius: 5, border: "1px solid #2457d6", background: "#2457d6", color: "white", fontWeight: 600 }}>Send</button>
      </div>
      <small style={{ color: "#5b6b80" }}>Suggestions only. Lock out power before electrical work.{workOrderId ? " This chat is saved with the job when you finish it." : ""}</small>
    </div>
  </details>;
}

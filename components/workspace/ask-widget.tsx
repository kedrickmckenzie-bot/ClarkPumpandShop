"use client";
import Link from "next/link";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { Fragment, useEffect, useRef, useState, type FormEvent, type ReactNode } from "react";
import { ArrowLeft, Minus, Sparkles, X } from "lucide-react";
import styles from "./ask-widget.module.css";

type Turn = { role: "user" | "assistant"; content: string; error?: boolean };
type Saved = { open: boolean; minimized: boolean; turns: Turn[]; origin?: string };
const KEY = "ops-ask-window";
const STARTERS = [
  "What did we spend on maintenance in the last 12 months, by store?",
  "Which equipment keeps getting repaired?",
  "What urgent work is late right now?",
  "Did we pay for repairs on equipment under warranty?",
];

function load(): Saved {
  try { const raw = sessionStorage.getItem(KEY); if (raw) return JSON.parse(raw) as Saved; } catch { /* private mode */ }
  return { open: false, minimized: false, turns: [] };
}

/** Plain answer text with [label](/app/...) links and "- " bullets, rendered without HTML. */
function Answer({ text }: { text: string }) {
  const inline = (line: string) => line.split(/(\[[^\]]+\]\(\/app\/[^)\s]+\))/g).map((part, i) => {
    const link = /^\[([^\]]+)\]\((\/app\/[^)\s]+)\)$/.exec(part);
    return link ? <Link key={i} href={link[2]!}>{link[1]}</Link> : <Fragment key={i}>{part.replace(/\*\*/g, "")}</Fragment>;
  });
  const blocks: ReactNode[] = []; let bullets: string[] = [];
  const flush = () => { if (bullets.length) blocks.push(<ul key={blocks.length}>{bullets.map((b, i) => <li key={i}>{inline(b)}</li>)}</ul>); bullets = []; };
  for (const line of text.split("\n")) {
    if (/^\s*[-•*]\s+/.test(line)) bullets.push(line.replace(/^\s*[-•*]\s+/, ""));
    else { flush(); if (line.trim()) blocks.push(<p key={blocks.length}>{inline(line)}</p>); }
  }
  flush();
  return <>{blocks}</>;
}

/** "Ask": a header button that opens a small window answering questions from the company's records. */
export function AskWidget() {
  const pathname = usePathname(), search = useSearchParams(), router = useRouter();
  const here = `${pathname}${search?.toString() ? `?${search}` : ""}`;
  const [state, setState] = useState<Saved>({ open: false, minimized: false, turns: [] });
  const [draft, setDraft] = useState(""), [pending, setPending] = useState(false);
  const listRef = useRef<HTMLDivElement>(null), inputRef = useRef<HTMLTextAreaElement>(null);
  // eslint-disable-next-line react-hooks/set-state-in-effect -- restore the window after a reload, once, on the client.
  useEffect(() => { setState(load()); }, []);
  useEffect(() => { try { sessionStorage.setItem(KEY, JSON.stringify(state)); } catch { /* private mode */ } }, [state]);
  useEffect(() => { listRef.current?.scrollTo({ top: listRef.current.scrollHeight }); }, [state.turns, pending, state.open, state.minimized]);
  useEffect(() => { if (state.open && !state.minimized) inputRef.current?.focus(); }, [state.open, state.minimized]);

  async function ask(question: string) {
    const text = question.trim();
    if (!text || pending) return;
    const turns: Turn[] = [...state.turns, { role: "user", content: text }];
    setState(s => ({ ...s, turns, origin: s.origin ?? here })); setDraft(""); setPending(true);
    try {
      const response = await fetch("/api/ops/ask", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ messages: turns.filter(t => !t.error).map(({ role, content }) => ({ role, content })) }) });
      const body = await response.json().catch(() => ({})) as { answer?: string; error?: string };
      setState(s => ({ ...s, turns: [...s.turns, response.ok && body.answer ? { role: "assistant", content: body.answer } : { role: "assistant", content: body.error ?? "Ask couldn't answer just now. Try again.", error: true }] }));
    } catch {
      setState(s => ({ ...s, turns: [...s.turns, { role: "assistant", content: "Ask couldn't reach the server. Check your connection and try again.", error: true }] }));
    } finally { setPending(false); }
  }
  const submit = (event: FormEvent) => { event.preventDefault(); void ask(draft); };
  const close = () => setState({ open: false, minimized: false, turns: [] });

  return <>
    <button type="button" aria-label="Ask" className={styles.headerButton} onClick={() => setState(s => ({ ...s, open: true, minimized: false }))} aria-expanded={state.open && !state.minimized}>
      <Sparkles size={17} aria-hidden="true"/><span>Ask</span>
    </button>
    {state.open && state.minimized ? <button type="button" className={styles.tab} onClick={() => setState(s => ({ ...s, minimized: false }))}>
      <Sparkles size={16} aria-hidden="true"/> Ask{state.turns.length ? ` · ${Math.ceil(state.turns.length / 2)}` : ""}
    </button> : null}
    {state.open && !state.minimized ? <section className={styles.window} role="dialog" aria-label="Ask">
      <header className={styles.bar}>
        <strong><Sparkles size={16} aria-hidden="true"/> Ask</strong>
        <button type="button" onClick={() => setState(s => ({ ...s, minimized: true }))} aria-label="Minimize Ask"><Minus size={18}/></button>
        <button type="button" onClick={close} aria-label="Close Ask and clear the conversation"><X size={18}/></button>
      </header>
      {state.origin && state.origin !== here ? <button type="button" className={styles.back} onClick={() => router.push(state.origin!)}><ArrowLeft size={15} aria-hidden="true"/> Back to where you asked</button> : null}
      <div className={styles.list} ref={listRef} aria-live="polite">
        {state.turns.length ? state.turns.map((turn, i) => <div key={i} className={turn.role === "user" ? styles.question : turn.error ? styles.problem : styles.answer}>
          {turn.role === "user" ? turn.content : <Answer text={turn.content}/>}
        </div>) : <div className={styles.empty}>
          <p>Ask about your stores, vendors, equipment and spending. Answers come from your records, with links to the jobs behind them.</p>
          <ul>{STARTERS.map(q => <li key={q}><button type="button" onClick={() => void ask(q)}>{q}</button></li>)}</ul>
        </div>}
        {pending ? <div className={styles.thinking}>Looking through your records…</div> : null}
      </div>
      <form className={styles.form} onSubmit={submit}>
        <textarea ref={inputRef} value={draft} onChange={e => setDraft(e.target.value)} rows={2} maxLength={2000} placeholder="Ask about your stores, vendors, spending…"
          onKeyDown={e => { if (e.key === "Enter" && !e.shiftKey) { e.preventDefault(); void ask(draft); } }} aria-label="Your question"/>
        <button type="submit" disabled={pending || !draft.trim()}>Ask</button>
      </form>
    </section> : null}
  </>;
}

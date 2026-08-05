import { ChevronRight, type LucideIcon } from "lucide-react";
import Link from "next/link";
import type { ReactNode } from "react";

export function Breadcrumbs({ items }: { items: Array<{ label: string; href?: string }> }) {
  return <nav className="breadcrumbs" aria-label="Breadcrumb">{items.map((item, index) => <span key={`${item.label}-${index}`} style={{ display: "contents" }}>{index > 0 && <ChevronRight aria-hidden="true" />}{item.href ? <Link href={item.href}>{item.label}</Link> : <span aria-current="page">{item.label}</span>}</span>)}</nav>;
}

export function PageHeader({ eyebrow, title, description, children }: { eyebrow: string; title: string; description: string; children?: ReactNode }) {
  return <div className="page-head"><div><p className="eyebrow">{eyebrow}</p><h1>{title}</h1><p>{description}</p></div>{children && <div className="page-head-actions">{children}</div>}</div>;
}

export function StatusBadge({ children, tone = "neutral" }: { children: ReactNode; tone?: string }) {
  return <span className={`status ${tone}`}>{children}</span>;
}

export function MetricCard({ label, value, note, icon: Icon, href, tone = "", trend }: { label: string; value: string; note: string; icon: LucideIcon; href?: string; tone?: string; trend?: { label: string; direction: "up" | "down" } }) {
  const content = <><div className="metric-top"><span>{label}</span><span className="metric-icon"><Icon aria-hidden="true" /></span></div><div className="metric-value">{value}</div><div className="metric-foot">{trend && <span className={trend.direction === "up" ? "trend-up" : "trend-down"}>{trend.label}</span>}<span>{note}</span></div></>;
  return href ? <Link className={`metric-card ${tone}`} href={href}>{content}</Link> : <div className={`metric-card ${tone}`}>{content}</div>;
}

export function PanelTitle({ title, description, href, linkLabel = "View details" }: { title: string; description?: string; href?: string; linkLabel?: string }) {
  return <div className="panel-title"><div><h2>{title}</h2>{description && <p>{description}</p>}</div>{href && <Link href={href}>{linkLabel} →</Link>}</div>;
}

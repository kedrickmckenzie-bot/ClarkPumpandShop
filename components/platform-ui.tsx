import { ArrowRight, ChevronRight, type LucideIcon } from "lucide-react";
import Link from "@/components/site-link";
import type { ReactNode } from "react";

export function PlatformBreadcrumbs({ items }: { items: Array<{ label: string; href?: string }> }) {
  return (
    <nav className="pf-breadcrumbs" aria-label="Breadcrumb">
      {items.map((item, index) => (
        <span key={`${item.label}-${index}`}>
          {index > 0 && <ChevronRight aria-hidden="true" />}
          {item.href ? <Link href={item.href}>{item.label}</Link> : <em aria-current="page">{item.label}</em>}
        </span>
      ))}
    </nav>
  );
}

export function PlatformPageHeader({
  eyebrow,
  title,
  description,
  children,
}: {
  eyebrow: string;
  title: string;
  description: string;
  children?: ReactNode;
}) {
  return (
    <header className="pf-page-header">
      <div><p>{eyebrow}</p><h1>{title}</h1><span>{description}</span></div>
      {children && <div className="pf-page-actions">{children}</div>}
    </header>
  );
}

export function PlatformSectionHeader({
  title,
  description,
  href,
  linkLabel = "View all",
  children,
}: {
  title: string;
  description?: string;
  href?: string;
  linkLabel?: string;
  children?: ReactNode;
}) {
  return (
    <header className="pf-section-header">
      <div><h2>{title}</h2>{description && <p>{description}</p>}</div>
      <div className="pf-section-actions">{children}{href && <Link href={href}>{linkLabel}<ArrowRight /></Link>}</div>
    </header>
  );
}

export function PlatformStat({
  label,
  value,
  note,
  icon: Icon,
  tone = "default",
  href,
  badge,
}: {
  label: string;
  value: string;
  note: string;
  icon: LucideIcon;
  tone?: "default" | "positive" | "warning" | "critical" | "info";
  href?: string;
  badge?: string;
}) {
  const content = (
    <>
      <div className="pf-stat-top"><span>{label}</span><i><Icon /></i></div>
      <strong>{value}</strong>
      <footer><span>{note}</span>{badge && <em>{badge}</em>}</footer>
    </>
  );
  return href ? <Link className={`pf-stat ${tone}`} href={href}>{content}</Link> : <article className={`pf-stat ${tone}`}>{content}</article>;
}

export function PlatformBadge({ children, tone = "neutral" }: { children: ReactNode; tone?: "neutral" | "good" | "warning" | "critical" | "info" | "purple" }) {
  return <span className={`pf-badge ${tone}`}>{children}</span>;
}

export function PlatformTabs({ items, active }: { items: Array<{ label: string; href: string; count?: number }>; active: string }) {
  return (
    <nav className="pf-tabs" aria-label="Page sections">
      {items.map((item) => <Link className={active === item.label ? "active" : ""} href={item.href} key={item.label}><span>{item.label}</span>{typeof item.count === "number" && <em>{item.count}</em>}</Link>)}
    </nav>
  );
}

export function PlatformEmpty({ icon: Icon, title, description, action }: { icon: LucideIcon; title: string; description: string; action?: ReactNode }) {
  return <div className="pf-empty"><i><Icon /></i><strong>{title}</strong><p>{description}</p>{action}</div>;
}

export function PlatformProgress({ value, tone = "teal", label }: { value: number; tone?: "teal" | "blue" | "amber" | "red" | "purple"; label?: string }) {
  const width = `${Math.max(0, Math.min(100, value * 100))}%`;
  return <div className="pf-progress-wrap"><div className={`pf-progress ${tone}`}><i style={{ width }} /></div>{label && <span>{label}</span>}</div>;
}

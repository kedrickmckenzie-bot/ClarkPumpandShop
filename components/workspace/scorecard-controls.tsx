"use client";

import { useRouter } from "next/navigation";
import { Printer } from "lucide-react";

/** Region picker: changes the page as soon as a region is chosen. */
export function RegionSelect({ regions, value, baseHref, className }: { regions: Array<{ value: string; label: string }>; value?: string; baseHref: string; className?: string }) {
  const router = useRouter();
  return <label className={className}><span>Region</span>
    <select value={value ?? ""} onChange={event => {
      const url = new URL(baseHref, window.location.origin);
      if (event.target.value) url.searchParams.set("region", event.target.value);
      router.push(`${url.pathname}${url.search}`);
    }}>
      <option value="">All my stores</option>
      {regions.map(region => <option key={region.value} value={region.value}>{region.label}</option>)}
    </select>
  </label>;
}

export function PrintButton({ className }: { className?: string }) {
  return <button type="button" className={className} onClick={() => window.print()}><Printer size={16} aria-hidden="true" />Print</button>;
}

"use client";
import { Printer } from "lucide-react";

export function PrintButton() {
  return <button type="button" onClick={() => window.print()}><Printer size={16} aria-hidden="true" /> Print or save as PDF</button>;
}

import type { CSSProperties } from "react";

/**
 * The single presentation boundary for the product's temporary identity.
 *
 * Product and domain code must not depend on these values. A rename should be
 * completed here (and by replacing configured assets), without changing
 * routes, data models, events, storage keys, or component names.
 */
export const productPresentation = {
  identity: {
    workingName: "TraceOps",
    suiteLabel: "Convenience Suite",
    monogram: "T",
  },
  metadata: {
    description:
      "A convenience-retail facilities platform for accountable service work, vendor performance, equipment, and maintenance spend.",
    socialDescription:
      "Connect every service request, vendor visit, maintenance outcome, and recorded cost.",
  },
  assets: {
    logoPath: null as string | null,
    faviconPath: "/favicon.svg",
    // Leave unset until the temporary identity has a matching enterprise card.
    socialPreviewPath: null as string | null,
    socialPreviewWidth: 1731,
    socialPreviewHeight: 909,
  },
  links: {
    workspaceHome: "/app/overview",
    support: null as string | null,
  },
  theme: {
    canvas: "#f3f4f6",
    surface: "#ffffff",
    surfaceSubtle: "#f8fafc",
    navigation: "#111827",
    navigationRaised: "#1f2937",
    navigationText: "#d1d5db",
    navigationTextStrong: "#ffffff",
    action: "#2563eb",
    actionHover: "#1d4ed8",
    actionSoft: "#eff6ff",
    focus: "#3b82f6",
  },
} as const;

export const productFullName = [
  productPresentation.identity.workingName,
  productPresentation.identity.suiteLabel,
].filter(Boolean).join(" ");

export const productThemeVariables = {
  "--product-canvas": productPresentation.theme.canvas,
  "--product-surface": productPresentation.theme.surface,
  "--product-surface-subtle": productPresentation.theme.surfaceSubtle,
  "--product-navigation": productPresentation.theme.navigation,
  "--product-navigation-raised": productPresentation.theme.navigationRaised,
  "--product-navigation-text": productPresentation.theme.navigationText,
  "--product-navigation-text-strong": productPresentation.theme.navigationTextStrong,
  "--product-action": productPresentation.theme.action,
  "--product-action-hover": productPresentation.theme.actionHover,
  "--product-action-soft": productPresentation.theme.actionSoft,
  "--product-focus": productPresentation.theme.focus,
} as CSSProperties;

import React from "react";
import Link from "next/link";
import { ChevronLeft } from "lucide-react";

// ─────────────────────────────────────────────────────────────────────────────
// CANONICAL PageLayout PROPS  (Phase 2 homogenisation standard)
// ─────────────────────────────────────────────────────────────────────────────
type PageLayoutCanonicalProps = {
  /** Page-level heading displayed above the panes. */
  title: React.ReactNode;
  /** Optional CTA / action button shown top-right of the header. */
  actionButton?: React.ReactNode;
  /** Content for the left dark espresso pane (metrics, inbox, nav, etc.). */
  leftPanelNode: React.ReactNode;
  /** Main content area rendered in the frosted-glass right pane. */
  rightPanelNode: React.ReactNode;
  /** When true, renders a "Back to Dashboard" breadcrumb. */
  backToDashboard?: boolean;
};

// ─────────────────────────────────────────────────────────────────────────────
// LEGACY ALIAS PROPS  (kept for backward-compat while pages are migrated)
// These map onto the canonical props internally.
// ─────────────────────────────────────────────────────────────────────────────
type PageLayoutLegacyProps = {
  pageTitle: React.ReactNode;
  headerAction?: React.ReactNode;
  /** Composed header row for the dark pane (icon + title/subtitle). */
  darkPaneHeader: React.ReactNode;
  /** Body content for the dark pane. */
  darkPaneContent: React.ReactNode;
  /** Optional header row for the right/main pane. */
  mainPaneHeader?: React.ReactNode;
  /** Body content for the right/main pane. */
  mainPaneContent: React.ReactNode;
  backToDashboard?: boolean;
};

type PageLayoutProps = PageLayoutCanonicalProps | PageLayoutLegacyProps;

function isLegacy(p: PageLayoutProps): p is PageLayoutLegacyProps {
  return "pageTitle" in p;
}

// ─────────────────────────────────────────────────────────────────────────────
// PAGE LAYOUT COMPONENT
//
// OVERLAP MATH (baked in):
//   Left pane:   w-[42%]  (shrinks to 38% on lg)
//   Right pane:  flex-1, -ml-[8%] mobile / -ml-[6%] lg  →  creates overlap
//   Left inner padding-right (pr-16) gives breathing room behind the overlap
//
// GLASSMORPHISM:
//   Right pane uses bg-white/85 + backdrop-blur-2xl (light)
//              and dark:bg-[#1A1510]/85 + backdrop-blur-2xl (dark)
//   Where the right pane overlaps the dark espresso left pane the
//   semi-transparent glass reveals the warm gradient beneath, creating
//   the layered glassmorphism gradient effect.
//
// GRADIENTS:
//   Left dark pane: from-[#3a2c23] → to-[#291e16]  (Espresso standard)
// ─────────────────────────────────────────────────────────────────────────────
export function PageLayout(props: PageLayoutProps) {
  // ── Normalise props ──────────────────────────────────────────────────────
  let title: React.ReactNode;
  let actionButton: React.ReactNode;
  let leftPanelNode: React.ReactNode;
  let rightPanelNode: React.ReactNode;
  let backToDashboard = false;

  if (isLegacy(props)) {
    title = props.pageTitle;
    actionButton = props.headerAction;
    backToDashboard = props.backToDashboard ?? false;

    // Compose legacy dark pane: header row + body
    leftPanelNode = (
      <>
        <div className="flex items-center gap-4 mb-8 shrink-0">
          {props.darkPaneHeader}
        </div>
        <div className="flex-1 flex flex-col">
          {props.darkPaneContent}
        </div>
      </>
    );

    // Compose legacy right pane: optional sticky header + scrollable body
    rightPanelNode = (
      <>
        {props.mainPaneHeader && (
          <div className="flex justify-between items-center border-b border-white/20 dark:border-white/5 bg-white/40 dark:bg-white/5 backdrop-blur-md px-10 py-6 shrink-0 rounded-tr-[2.5rem]">
            {props.mainPaneHeader}
          </div>
        )}
        <div className="flex-1 overflow-y-auto scrollbar-hide">
          {props.mainPaneContent}
        </div>
      </>
    );
  } else {
    title = props.title;
    actionButton = props.actionButton;
    leftPanelNode = props.leftPanelNode;
    rightPanelNode = props.rightPanelNode;
    backToDashboard = props.backToDashboard ?? false;
  }

  // ── Render ───────────────────────────────────────────────────────────────
  return (
    <div className="relative flex flex-col flex-1 p-8 lg:p-12 min-h-screen bg-lawdger-base text-foreground font-sans z-0">

      {/* Ambient background orb — warm espresso glow */}
      <div className="absolute top-[10%] left-[-5%] w-[60%] h-[70%] bg-primary/10 rounded-full blur-[140px] -z-10 pointer-events-none" />

      {/* ── Page Header ─────────────────────────────────────────────────── */}
      <div className="flex justify-between items-end mb-10 z-10">
        <div>
          {backToDashboard && (
            <Link
              href="/dashboard"
              className="inline-flex items-center gap-1 text-[10px] font-bold uppercase tracking-widest text-muted-foreground hover:text-foreground transition-colors mb-4"
            >
              <ChevronLeft className="h-3 w-3" />
              Back to Dashboard
            </Link>
          )}
          {/* h1 suppressed — Header.tsx renders the route-aware page title */}
        </div>
        {actionButton && <div>{actionButton}</div>}
      </div>

      {/* ── OVERLAPPING PANES ───────────────────────────────────────────── */}
      {/*
        Width container: 98% mobile → 95% xl gives full-bleed feel.
        Height: calc(100vh - 12rem) so panes fill the viewport below header.
      */}
      <div className="relative lg:w-[98%] xl:w-[95%] flex z-20 mx-auto h-[calc(100vh-12rem)] min-h-[600px]">

        {/* ── LEFT DARK PANE (Espresso Gradient) ─────────────────────────
            w-[42%] / lg:w-[38%]
            Gradient: from-[#3a2c23] to-[#291e16]
            pr-16 ensures content doesn't slide under the overlapping right pane
        */}
        <div
          className={[
            "w-[35%]",
            "rounded-3xl",
            "bg-lawdger-espresso",
            "p-10 pr-16",
            "shadow-xl",
            "h-full flex flex-col",
            "z-10 shrink-0",
            "border border-white/5",
            "overflow-y-auto scrollbar-hide",
          ].join(" ")}
        >
          {leftPanelNode}
        </div>

        {/* ── RIGHT FROSTED-GLASS PANE ────────────────────────────────────
            Negative margin (-ml-[8%] / lg:-ml-[6%]) makes it overlap the
            left pane. The semi-transparent background + backdrop-blur
            reveals the espresso gradient beneath → layered glassmorphism.

            Light:  bg-white/85  (warm cream glass)
            Dark:   bg-[#1A1510]/85  (deep espresso glass)
            Both:   backdrop-blur-2xl, border border-white/60 (light)
                                                / border-white/10 (dark)
        */}
        <div
          className={[
            "flex-1",
            "-ml-[60px]",
            "mt-8",
            "rounded-3xl",
            "bg-white/40 dark:bg-lawdger-cream/5 backdrop-blur-2xl",
            "border border-white/30 dark:border-white/10",
            "shadow-2xl shadow-lawdger-espresso/10",
            "flex flex-col",
            "z-30",
            "pl-[10%] lg:pl-[8%]",
            "overflow-hidden h-full",
          ].join(" ")}
        >
          {rightPanelNode}
        </div>
      </div>
    </div>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// DARK PANE HEADER TITLE
// Standardised icon + title + subtitle row for the left dark pane.
// ─────────────────────────────────────────────────────────────────────────────
export function DarkPaneHeaderTitle({
  icon: Icon,
  title,
  subtitle,
}: {
  icon: React.ElementType;
  title: string;
  subtitle: string;
}) {
  return (
    <>
      <div className="w-12 h-12 bg-white/40 rounded-2xl flex items-center justify-center text-white shadow-inner shrink-0">
        <Icon className="w-6 h-6" />
      </div>
      <div>
        {/* Explicit inline styles override global h2 size for dark pane context */}
        <h2 className="text-[1.5rem] text-[#f4efe8] dark:text-white leading-tight">
          {title}
        </h2>
        <p className="text-[12px] text-[#f4efe8]/60 dark:text-white/50 uppercase tracking-widest font-bold mt-0.5">
          {subtitle}
        </p>
      </div>
    </>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// CONTENT HEADING
// The canonical heading for content areas (right pane columns, modal titles).
// Typography: Playfair Display Bold 1.4rem tracking-tight — the global standard
// extracted from the Tasks "My Plate / Associates / Clerks & Filings" headings.
// ─────────────────────────────────────────────────────────────────────────────
export function ContentHeading({
  children,
  className = "",
}: {
  children: React.ReactNode;
  className?: string;
}) {
  return (
    <h3
      className={`font-bold tracking-tight text-[1.4rem] text-foreground dark:text-white ${className}`}
    >
      {children}
    </h3>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// DASHBOARD LINK
// Renders a small "← Back to Dashboard" breadcrumb link.
// Used in pages that pass beforeTitle or need an explicit back-nav.
// ─────────────────────────────────────────────────────────────────────────────
export function DashboardLink({ href = "/dashboard" }: { href?: string }) {
  return (
    <Link
      href={href}
      className="inline-flex items-center gap-1 text-[10px] font-bold uppercase tracking-widest text-muted-foreground hover:text-foreground transition-colors mb-4"
    >
      <ChevronLeft className="h-3 w-3" />
      Back to Dashboard
    </Link>
  );
}

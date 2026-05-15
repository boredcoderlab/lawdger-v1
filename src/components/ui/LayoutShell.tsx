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

    // Compose legacy right pane: optional dissolved header row + flexible body.
    // ── Phase 3h contract ──
    //   The cream pane's inner content wrapper (rendered below) provides the
    //   universal padding (pl-2/3 pt-12/14 pb-6 pr-6/8) so the header rides
    //   on the cream surface with the kanban's "edge-to-edge" alignment.
    //   The body slot is `flex-1 min-h-0` with NO overflow — each consumer
    //   owns its own scroll strategy (per-column for kanban, full-pane for
    //   lists, internal scroll regions for chat, etc.).
    rightPanelNode = (
      <>
        {props.mainPaneHeader && (
          <div className="flex justify-between items-center gap-6 pb-4 shrink-0 border-b border-lawdger-border/[0.06]">
            {props.mainPaneHeader}
          </div>
        )}
        <div className="flex-1 min-h-0">
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
            "-ml-[40px]",
            "mt-8",
            "rounded-[2rem]",
            "backdrop-blur-2xl",
            "border border-lawdger-cream/30 dark:border-lawdger-cream/10",
            "shadow-[0_24px_60px_-20px_color-mix(in_srgb,var(--color-lawdger-border)_35%,transparent)]",
            "flex flex-col",
            "z-30",
            // Phase 3h: padding is OFF the glass surface and on the inner
            // wrapper below. The cream pane itself stays edge-to-edge so
            // consumers (Tasks kanban et al.) can ride right up against the
            // 32px rounded corners — the corners clip overflow naturally.
            "overflow-hidden h-full",
            // Layered depth lives in the inline style:
            //   1) left-edge translucency strip so the espresso pane shows through the overlap
            //   2) diagonal multi-tone cream → base gradient (top-left highlight → bottom-right deeper)
            "lawdger-cream-pane",
          ].join(" ")}
        >
          {/* ── INNER CONTENT WRAPPER (Phase 3h) ─────────────────────────
              Universal padding contract for every consumer:
                pl-2 lg:pl-3   8–12px from the cream pane's left edge — deep
                               inside the glassmorphism strip
                pt-12 lg:pt-14 sits BELOW the 32px top rounded corner curve
                pr-6 lg:pr-8   comfortable right gutter
                pb-6           bottom gutter
              h-full flex flex-col min-h-0 lets the consumer's mainPaneContent
              slot use `flex-1 min-h-0 overflow-y-auto` (or per-column scroll,
              per the Tasks kanban pattern) for its own scroll strategy.
          */}
          <div className="h-full flex flex-col min-h-0 pl-2 lg:pl-3 pt-12 lg:pt-14 pb-6 pr-6 lg:pr-8">
            {rightPanelNode}
          </div>
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
  // Color is LOCKED to text-lawdger-cream — consumers cannot override.
  // Dark-pane headings against the espresso gradient have exactly one correct
  // colour; allowing consumer className overrides historically produced
  // dark-on-dark washout (Orchestration title regression).
  return (
    <>
      <div className="w-12 h-12 bg-lawdger-cream/15 rounded-2xl flex items-center justify-center text-lawdger-cream shadow-inner shrink-0">
        <Icon className="w-6 h-6" />
      </div>
      <div>
        <h2 className="text-[1.5rem] text-lawdger-cream leading-tight">
          {title}
        </h2>
        <p className="text-[12px] text-lawdger-cream/60 uppercase tracking-widest font-bold mt-0.5">
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

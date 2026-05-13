"use client";

import { useEffect, useRef, useState, useTransition } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import {
  Search,
  Plus,
  Briefcase,
  X,
  LayoutGrid,
  Calendar,
  Scale,
  Hash,
  ArrowRight,
} from "lucide-react";
import {
  createCase,
  CASE_TYPES,
  type CaseRecord,
  type CaseType,
} from "@/app/(lawdger)/cases/actions";
import {
  PageLayout,
  DarkPaneHeaderTitle,
  ContentHeading,
} from "@/components/ui/LayoutShell";

// ── Constants ─────────────────────────────────────────────────────────────────

const FORUM_OPTIONS = [
  "Supreme Court of India",
  "High Court",
  "District Court",
  "Sessions Court",
  "Magistrate Court",
  "Tribunal",
  "Other",
] as const;

const CASE_TYPE_LABEL: Record<CaseType, string> = {
  CIVIL: "Civil",
  CRIMINAL: "Criminal",
  WRIT: "Writ Petition",
  APPEAL: "Appeal",
  COMMERCIAL: "Commercial",
  FAMILY: "Family",
  ARBITRATION: "Arbitration",
  OTHER: "Other",
};

type StatusTab = "all" | "active" | "pending" | "closed";

const STATUS_TABS: { id: StatusTab; label: string }[] = [
  { id: "all", label: "All" },
  { id: "active", label: "Active" },
  { id: "pending", label: "Pending" },
  { id: "closed", label: "Closed" },
];

function statusBadgeClass(status: string): string {
  switch (status.toLowerCase()) {
    case "urgent":
      return "bg-red-500/10 text-red-600 dark:text-red-400 border-red-500/20";
    case "active":
      return "bg-green-500/10 text-green-600 dark:text-green-400 border-green-500/20";
    case "pending":
      return "bg-amber-500/10 text-amber-600 dark:text-amber-400 border-amber-500/20";
    case "closed":
      return "bg-lawdger-muted/15 text-lawdger-muted border-lawdger-muted/25";
    case "dormant":
      return "bg-lawdger-muted/10 text-lawdger-muted/80 border-lawdger-muted/20";
    default:
      return "bg-lawdger-muted/15 text-lawdger-muted border-lawdger-muted/25";
  }
}

function formatHearing(d: Date | null): string {
  if (!d) return "Not scheduled";
  return new Date(d).toLocaleDateString("en-IN", {
    day: "2-digit",
    month: "short",
    year: "numeric",
  });
}

// ── New Matter Dialog ─────────────────────────────────────────────────────────

function NewMatterDialog({
  open,
  onClose,
  onCreated,
}: {
  open: boolean;
  onClose: () => void;
  onCreated: () => void;
}) {
  const [title, setTitle] = useState("");
  const [clientName, setClientName] = useState("");
  const [matterId, setMatterId] = useState("");
  const [forum, setForum] = useState<string>(FORUM_OPTIONS[1]);
  const [court, setCourt] = useState("");
  const [caseType, setCaseType] = useState<CaseType>("CIVIL");
  const [nextHearingDate, setNextHearingDate] = useState("");
  const [description, setDescription] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [isPending, startTransition] = useTransition();

  const dialogRef = useRef<HTMLDivElement>(null);
  const firstFieldRef = useRef<HTMLInputElement>(null);

  // Reset on open
  useEffect(() => {
    if (open) {
      setTitle("");
      setClientName("");
      setMatterId("");
      setForum(FORUM_OPTIONS[1]);
      setCourt("");
      setCaseType("CIVIL");
      setNextHearingDate("");
      setDescription("");
      setError(null);
      // Focus first field
      const t = setTimeout(() => firstFieldRef.current?.focus(), 50);
      return () => clearTimeout(t);
    }
  }, [open]);

  // Escape close + focus trap
  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") {
        e.preventDefault();
        onClose();
      }
      if (e.key === "Tab" && dialogRef.current) {
        const focusables = dialogRef.current.querySelectorAll<HTMLElement>(
          'input, select, textarea, button, [tabindex]:not([tabindex="-1"])'
        );
        if (focusables.length === 0) return;
        const first = focusables[0];
        const last = focusables[focusables.length - 1];
        if (e.shiftKey && document.activeElement === first) {
          e.preventDefault();
          last.focus();
        } else if (!e.shiftKey && document.activeElement === last) {
          e.preventDefault();
          first.focus();
        }
      }
    };
    document.addEventListener("keydown", onKey);
    return () => document.removeEventListener("keydown", onKey);
  }, [open, onClose]);

  // Lock body scroll
  useEffect(() => {
    if (!open) return;
    const prev = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => {
      document.body.style.overflow = prev;
    };
  }, [open]);

  if (!open) return null;

  const submit = (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    startTransition(async () => {
      const result = await createCase({
        title,
        clientName,
        matterId: matterId || undefined,
        forum,
        court,
        caseType,
        nextHearingDate: nextHearingDate || undefined,
        description: description || undefined,
      });
      if ("error" in result) {
        setError(result.error);
      } else {
        onCreated();
        onClose();
      }
    });
  };

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-lawdger-espresso/70 backdrop-blur-md animate-in fade-in duration-200"
      role="dialog"
      aria-modal="true"
      aria-labelledby="new-matter-title"
      onClick={onClose}
    >
      <div
        ref={dialogRef}
        onClick={(e) => e.stopPropagation()}
        className="bg-background rounded-[1.5rem] shadow-[0_30px_80px_rgba(0,0,0,0.4)] w-full max-w-lg overflow-hidden border border-lawdger-gold/20 animate-in zoom-in-95 duration-200"
      >
        {/* Header */}
        <div className="flex items-center justify-between px-7 py-6 border-b border-lawdger-gold/15 bg-lawdger-base">
          <div className="flex items-center gap-4">
            <div className="w-11 h-11 rounded-xl bg-lawdger-gold/15 flex items-center justify-center text-lawdger-gold">
              <Briefcase className="w-5 h-5" />
            </div>
            <div>
              <h2
                id="new-matter-title"
                className="font-serif text-[1.4rem] font-bold text-lawdger-espresso leading-none"
              >
                New Matter
              </h2>
              <p className="text-[10px] uppercase tracking-widest font-bold text-lawdger-gold mt-1.5">
                Initialize Case Record
              </p>
            </div>
          </div>
          <button
            type="button"
            onClick={onClose}
            aria-label="Close dialog"
            className="text-lawdger-muted hover:text-lawdger-espresso transition-colors p-2 hover:bg-lawdger-espresso/5 rounded-full"
          >
            <X className="h-5 w-5" />
          </button>
        </div>

        {/* Form */}
        <form
          onSubmit={submit}
          className="px-7 py-6 space-y-5 max-h-[70vh] overflow-y-auto scrollbar-hide"
        >
          {error && (
            <div className="rounded-xl border border-red-500/30 bg-red-500/10 text-red-600 dark:text-red-400 px-4 py-3 text-[13px] font-medium">
              {error}
            </div>
          )}

          <FormField
            label="Case Title"
            required
            value={title}
            onChange={setTitle}
            placeholder="e.g. Sharma v. State of M.P."
            inputRef={firstFieldRef}
          />

          <FormField
            label="Client Name"
            required
            value={clientName}
            onChange={setClientName}
            placeholder="e.g. Amit Sharma"
          />

          <div className="grid grid-cols-2 gap-4">
            <FormField
              label="Matter ID (optional)"
              value={matterId}
              onChange={setMatterId}
              placeholder="e.g. MP/2026/0142"
            />
            <FormSelect
              label="Forum"
              required
              value={forum}
              onChange={setForum}
              options={FORUM_OPTIONS.map((o) => ({ value: o, label: o }))}
            />
          </div>

          <FormField
            label="Court"
            required
            value={court}
            onChange={setCourt}
            placeholder="e.g. M.P. High Court, Indore Bench"
          />

          <div className="grid grid-cols-2 gap-4">
            <FormSelect
              label="Case Type"
              required
              value={caseType}
              onChange={(v) => setCaseType(v as CaseType)}
              options={CASE_TYPES.map((t) => ({
                value: t,
                label: CASE_TYPE_LABEL[t],
              }))}
            />
            <FormField
              label="Next Hearing Date"
              type="date"
              value={nextHearingDate}
              onChange={setNextHearingDate}
            />
          </div>

          <div>
            <label className="block text-[10px] font-bold uppercase tracking-widest text-lawdger-muted mb-2">
              Description (optional)
            </label>
            <textarea
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              rows={3}
              placeholder="Brief note on the matter, parties, or stage…"
              className="w-full bg-lawdger-base border border-lawdger-gold/15 rounded-xl px-4 py-3 text-[14px] text-lawdger-espresso focus:outline-none focus:border-lawdger-gold focus:ring-1 focus:ring-lawdger-gold transition-all resize-none placeholder:text-lawdger-muted/60"
            />
          </div>

          <div className="pt-2 flex items-center gap-3">
            <button
              type="button"
              onClick={onClose}
              className="flex-1 py-3 rounded-xl border border-lawdger-gold/20 text-lawdger-espresso text-[12px] uppercase tracking-widest font-bold hover:bg-lawdger-base/60 transition-colors"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={isPending}
              className="flex-1 bg-lawdger-espresso text-lawdger-base px-7 py-3 rounded-xl text-[12px] uppercase tracking-widest font-bold hover:bg-lawdger-espresso/90 hover:shadow-[0_0_20px_rgba(212,175,55,0.25)] transition-all disabled:opacity-60"
            >
              {isPending ? "Committing…" : "Commit to Registry"}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}

function FormField({
  label,
  required,
  value,
  onChange,
  placeholder,
  type = "text",
  inputRef,
}: {
  label: string;
  required?: boolean;
  value: string;
  onChange: (v: string) => void;
  placeholder?: string;
  type?: string;
  inputRef?: React.RefObject<HTMLInputElement | null>;
}) {
  return (
    <div>
      <label className="block text-[10px] font-bold uppercase tracking-widest text-lawdger-muted mb-2">
        {label}
        {required && <span className="text-lawdger-gold ml-1">*</span>}
      </label>
      <input
        ref={inputRef}
        type={type}
        required={required}
        value={value}
        onChange={(e) => onChange(e.target.value)}
        placeholder={placeholder}
        className="w-full bg-lawdger-base border border-lawdger-gold/15 rounded-xl px-4 py-3 text-[14px] text-lawdger-espresso focus:outline-none focus:border-lawdger-gold focus:ring-1 focus:ring-lawdger-gold transition-all placeholder:text-lawdger-muted/60"
      />
    </div>
  );
}

function FormSelect({
  label,
  required,
  value,
  onChange,
  options,
}: {
  label: string;
  required?: boolean;
  value: string;
  onChange: (v: string) => void;
  options: { value: string; label: string }[];
}) {
  return (
    <div>
      <label className="block text-[10px] font-bold uppercase tracking-widest text-lawdger-muted mb-2">
        {label}
        {required && <span className="text-lawdger-gold ml-1">*</span>}
      </label>
      <select
        required={required}
        value={value}
        onChange={(e) => onChange(e.target.value)}
        className="w-full bg-lawdger-base border border-lawdger-gold/15 rounded-xl px-4 py-3 text-[14px] text-lawdger-espresso focus:outline-none focus:border-lawdger-gold focus:ring-1 focus:ring-lawdger-gold transition-all appearance-none"
      >
        {options.map((o) => (
          <option key={o.value} value={o.value}>
            {o.label}
          </option>
        ))}
      </select>
    </div>
  );
}

// ── Case Tile ─────────────────────────────────────────────────────────────────

function CaseTile({ c }: { c: CaseRecord }) {
  const forumDisplay = c.forum ?? "—";
  const courtDisplay = c.court ?? c.courtName ?? "—";
  const typeLabel = c.caseType
    ? CASE_TYPE_LABEL[c.caseType as CaseType] ?? c.caseType
    : null;

  return (
    <Link href={`/cases/${c.id}`} className="group block">
      <article className="h-full flex flex-col rounded-[1.5rem] border border-lawdger-gold/15 bg-lawdger-cream p-6 shadow-sm transition-all duration-300 hover:border-lawdger-gold/50 hover:shadow-[0_15px_30px_rgba(212,175,55,0.12)] hover:-translate-y-1 relative overflow-hidden">
        {/* Top accent line on hover */}
        <div className="absolute top-0 left-0 right-0 h-[2px] bg-gradient-to-r from-transparent via-lawdger-gold/40 to-transparent opacity-0 group-hover:opacity-100 transition-opacity" />

        {/* Title + status */}
        <div className="flex items-start justify-between gap-3 mb-4">
          <h3 className="font-serif text-[1.2rem] font-bold text-lawdger-espresso leading-tight group-hover:text-lawdger-espresso transition-colors line-clamp-2">
            {c.title}
          </h3>
          <span
            className={`shrink-0 inline-flex items-center rounded-md px-2.5 py-1 text-[9px] font-bold uppercase tracking-widest border ${statusBadgeClass(
              c.status
            )}`}
          >
            {c.status}
          </span>
        </div>

        {/* Client */}
        {c.clientName && (
          <p className="text-[13px] text-lawdger-espresso/80 font-medium mb-5 truncate">
            {c.clientName}
          </p>
        )}

        {/* Matter ID + Next hearing */}
        <div className="grid grid-cols-2 gap-3 mb-4">
          <div className="rounded-lg bg-lawdger-base/60 border border-lawdger-gold/10 px-3 py-2.5">
            <p className="flex items-center gap-1.5 text-[9px] font-bold uppercase tracking-widest text-lawdger-muted mb-1">
              <Hash className="w-2.5 h-2.5" /> Matter ID
            </p>
            <p className="text-[12px] font-semibold text-lawdger-espresso truncate">
              {c.matterId ?? <span className="text-lawdger-muted/70">—</span>}
            </p>
          </div>
          <div className="rounded-lg bg-lawdger-base/60 border border-lawdger-gold/10 px-3 py-2.5">
            <p className="flex items-center gap-1.5 text-[9px] font-bold uppercase tracking-widest text-lawdger-muted mb-1">
              <Calendar className="w-2.5 h-2.5" /> Next Hearing
            </p>
            <p className="text-[12px] font-semibold text-lawdger-espresso truncate">
              {formatHearing(c.nextHearingDate)}
            </p>
          </div>
        </div>

        {/* Forum / Court */}
        <div className="mt-auto pt-4 border-t border-lawdger-gold/10">
          <p className="flex items-center gap-1.5 text-[9px] font-bold uppercase tracking-widest text-lawdger-muted mb-1.5">
            <Scale className="w-2.5 h-2.5" /> Forum / Court
          </p>
          <p className="text-[12px] font-semibold text-lawdger-espresso leading-snug">
            {forumDisplay}
            <span className="text-lawdger-muted"> · </span>
            <span className="font-medium">{courtDisplay}</span>
          </p>
          {typeLabel && (
            <p className="mt-1 text-[10px] uppercase tracking-widest text-lawdger-muted font-bold">
              {typeLabel}
            </p>
          )}
        </div>

        {/* Open case file link */}
        <div className="mt-4 flex items-center gap-1.5 text-[11px] font-bold uppercase tracking-widest text-lawdger-gold opacity-70 group-hover:opacity-100 transition-opacity">
          Open Case File
          <ArrowRight className="w-3 h-3 transition-transform group-hover:translate-x-0.5" />
        </div>
      </article>
    </Link>
  );
}

// ── Main Component ────────────────────────────────────────────────────────────

export default function CasesClient({
  initialCases,
  counts,
}: {
  initialCases: CaseRecord[];
  counts: { total: number; active: number; pending: number; closed: number };
}) {
  const router = useRouter();
  const [search, setSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState<StatusTab>("all");
  const [dialogOpen, setDialogOpen] = useState(false);

  const filtered = initialCases.filter((c) => {
    const q = search.trim().toLowerCase();
    const matchesSearch =
      !q ||
      c.title.toLowerCase().includes(q) ||
      (c.clientName ?? "").toLowerCase().includes(q);
    const matchesStatus =
      statusFilter === "all" || c.status.toLowerCase() === statusFilter;
    return matchesSearch && matchesStatus;
  });

  const handleCreated = () => {
    router.refresh();
  };

  return (
    <>
      <PageLayout
        pageTitle="Case Registry"
        headerAction={
          <button
            onClick={() => setDialogOpen(true)}
            className="flex items-center gap-2 bg-lawdger-espresso text-lawdger-base px-6 py-3 rounded-full hover:bg-lawdger-espresso/90 hover:shadow-[0_0_20px_rgba(212,175,55,0.25)] transition-all font-bold tracking-widest uppercase text-[11px]"
          >
            <Plus className="h-4 w-4" />
            New Matter
          </button>
        }
        darkPaneHeader={
          <DarkPaneHeaderTitle
            icon={LayoutGrid}
            title="Case Registry"
            subtitle="Matters"
          />
        }
        darkPaneContent={
          <>
            {/* Metrics */}
            <div className="space-y-3 mb-10">
              <MetricRow label="Total Matters" value={counts.total} prominent />
              <MetricRow
                label="Active"
                value={counts.active}
                accentDot
              />
              <MetricRow label="Pending" value={counts.pending} />
              <MetricRow label="Closed" value={counts.closed} dim />
            </div>

            {/* Quick Search */}
            <div className="mt-auto">
              <label className="block text-[10px] font-bold uppercase tracking-widest text-lawdger-cream/50 mb-3">
                Quick Search
              </label>
              <div className="relative">
                <Search className="absolute left-4 top-1/2 -translate-y-1/2 h-4 w-4 text-lawdger-cream/40" />
                <input
                  type="text"
                  value={search}
                  onChange={(e) => setSearch(e.target.value)}
                  placeholder="Find by name, client…"
                  className="w-full bg-lawdger-base/10 border border-lawdger-cream/10 rounded-full pl-11 pr-4 py-3.5 text-[13px] text-lawdger-cream placeholder:text-lawdger-cream/30 focus:outline-none focus:border-lawdger-gold focus:ring-1 focus:ring-lawdger-gold/40 transition-all"
                />
              </div>
            </div>
          </>
        }
        mainPaneHeader={
          <>
            <div className="flex items-center gap-5">
              <ContentHeading className="text-[1.3rem]">
                Registry Entries
              </ContentHeading>
              <div className="flex bg-lawdger-base/60 border border-lawdger-gold/10 rounded-full p-1">
                {STATUS_TABS.map(({ id, label }) => (
                  <button
                    key={id}
                    onClick={() => setStatusFilter(id)}
                    className={`px-4 py-1.5 rounded-full text-[11px] tracking-wide transition-all font-bold uppercase ${
                      statusFilter === id
                        ? "bg-lawdger-espresso text-lawdger-base shadow-sm"
                        : "text-lawdger-muted hover:text-lawdger-espresso"
                    }`}
                  >
                    {label}
                  </button>
                ))}
              </div>
            </div>
            <p className="text-[11px] uppercase tracking-widest font-bold text-lawdger-muted">
              {filtered.length} {filtered.length === 1 ? "entry" : "entries"}
            </p>
          </>
        }
        mainPaneContent={
          <div className="p-8 h-full">
            {filtered.length === 0 ? (
              <EmptyState
                searchActive={search.length > 0 || statusFilter !== "all"}
                onNewMatter={() => setDialogOpen(true)}
              />
            ) : (
              <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-5 pb-10">
                {filtered.map((c) => (
                  <CaseTile key={c.id} c={c} />
                ))}
              </div>
            )}
          </div>
        }
      />

      <NewMatterDialog
        open={dialogOpen}
        onClose={() => setDialogOpen(false)}
        onCreated={handleCreated}
      />
    </>
  );
}

// ── Metric Row ────────────────────────────────────────────────────────────────

function MetricRow({
  label,
  value,
  prominent = false,
  accentDot = false,
  dim = false,
}: {
  label: string;
  value: number;
  prominent?: boolean;
  accentDot?: boolean;
  dim?: boolean;
}) {
  return (
    <div
      className={`flex items-center justify-between rounded-2xl px-5 py-4 border ${
        prominent
          ? "bg-lawdger-base/15 border-lawdger-cream/15"
          : accentDot
          ? "bg-lawdger-gold/15 border-lawdger-gold/25"
          : "bg-lawdger-base/8 border-lawdger-cream/5"
      }`}
    >
      <span
        className={`text-[13px] font-medium flex items-center gap-2 ${
          dim ? "text-lawdger-cream/45" : "text-lawdger-cream/85"
        }`}
      >
        {accentDot && (
          <span className="w-1.5 h-1.5 rounded-full bg-lawdger-gold animate-pulse" />
        )}
        {label}
      </span>
      <span
        className={`font-serif text-[20px] font-bold ${
          dim ? "text-lawdger-cream/45" : "text-lawdger-cream"
        }`}
      >
        {value}
      </span>
    </div>
  );
}

// ── Empty State ───────────────────────────────────────────────────────────────

function EmptyState({
  searchActive,
  onNewMatter,
}: {
  searchActive: boolean;
  onNewMatter: () => void;
}) {
  return (
    <div className="flex-1 h-full rounded-[2rem] border border-dashed border-lawdger-gold/20 bg-lawdger-cream/60 flex flex-col items-center justify-center text-center p-10">
      <div className="w-14 h-14 rounded-2xl bg-lawdger-gold/10 flex items-center justify-center text-lawdger-gold mb-5">
        <Briefcase className="w-7 h-7" />
      </div>
      <h4 className="font-serif text-[1.4rem] font-bold text-lawdger-espresso mb-2">
        {searchActive ? "No matches found" : "No matters yet"}
      </h4>
      <p className="text-[13px] text-lawdger-muted max-w-sm mb-6">
        {searchActive
          ? "Try clearing the search or switching filters to see other entries."
          : "Create your first matter to begin building your Lawdger."}
      </p>
      {!searchActive && (
        <button
          onClick={onNewMatter}
          className="flex items-center gap-2 bg-lawdger-espresso text-lawdger-base px-6 py-3 rounded-full hover:bg-lawdger-espresso/90 hover:shadow-[0_0_20px_rgba(212,175,55,0.25)] transition-all font-bold tracking-widest uppercase text-[11px]"
        >
          <Plus className="h-4 w-4" />
          New Matter
        </button>
      )}
    </div>
  );
}

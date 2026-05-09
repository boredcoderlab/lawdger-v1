"use client";

import { useState } from "react";
import Link from "next/link";
import { IndianRupee, AlertCircle, Plus, Receipt, History, Send, X, Trash2, ChevronDown, ChevronUp } from "lucide-react";
import { createPayment, updateCaseAgreedFee, deletePayment } from "@/actions/financeActions";
import { PageLayout, DarkPaneHeaderTitle, ContentHeading, DashboardLink } from "@/components/ui/LayoutShell";
import { format } from "date-fns";

type Payment = { id: string; amount: number; status: string; dueDate: Date | null; createdAt: Date };
type CaseWithPayments = {
  id: string; title: string; clientName: string | null;
  agreedFee: number | null; status: string;
  payments: Payment[];
};

function fmt(n: number) {
  return "₹" + n.toLocaleString("en-IN");
}

export default function FinancesClient({ cases }: { cases: CaseWithPayments[] }) {
  const [modalCaseId, setModalCaseId] = useState<string | null>(null);
  const [payAmount, setPayAmount] = useState("");
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [editFeeId, setEditFeeId] = useState<string | null>(null);
  const [editFeeValue, setEditFeeValue] = useState("");
  const [expandedCaseId, setExpandedCaseId] = useState<string | null>(null);
  const [now] = useState(() => Date.now());

  const totalExpected = cases.reduce((s, c) => s + (c.agreedFee ?? 0), 0);
  const totalReceived = cases.reduce((s, c) =>
    s + c.payments.filter((p) => p.status === "paid").reduce((a, p) => a + p.amount, 0), 0);
  const totalBalance = totalExpected - totalReceived;

  const collectionRate = totalExpected > 0 ? Math.round((totalReceived / totalExpected) * 100) : 0;

  const forgottenDues = cases.filter((c) => {
    const balance = (c.agreedFee ?? 0) - c.payments.filter((p) => p.status === "paid").reduce((a, p) => a + p.amount, 0);
    const lastActivity = c.payments.length > 0
      ? Math.max(...c.payments.map((p) => new Date(p.createdAt).getTime()))
      : 0;
    const daysInactive = lastActivity ? Math.floor((now - lastActivity) / 86400000) : 999;
    return balance > 0 && daysInactive > 60;
  });

  const handleLogPayment = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!modalCaseId || !payAmount) return;
    setIsSubmitting(true);
    await createPayment({ caseId: modalCaseId, amount: parseFloat(payAmount), status: "paid" });
    setPayAmount("");
    setModalCaseId(null);
    setIsSubmitting(false);
  };

  const handleSaveFee = async (caseId: string) => {
    const val = parseFloat(editFeeValue);
    if (isNaN(val)) return;
    await updateCaseAgreedFee(caseId, val);
    setEditFeeId(null);
    setEditFeeValue("");
  };

  return (
    <>
      <PageLayout
        pageTitle="Finances"
        backToDashboard={true}
        headerAction={
          <button onClick={() => setModalCaseId(cases[0]?.id ?? null)}
            className="flex items-center gap-2 bg-primary text-primary-foreground px-7 py-3 rounded-full hover:scale-[1.02] transition-transform font-bold tracking-widest uppercase text-[12px] shadow-[0_0_20px_rgba(200,150,62,0.3)]">
            <Plus className="h-4 w-4" /> Log Payment
          </button>
        }
        darkPaneHeader={
          <DarkPaneHeaderTitle icon={IndianRupee} title="Overview" subtitle="Metrics & Alerts" />
        }
        darkPaneContent={
          <>
            {/* KPI Cards */}
            <div className="space-y-4 mb-8">
              <div className="bg-white/5 rounded-2xl p-5 border border-white/10">
                <p className="text-[10px] font-bold uppercase tracking-widest text-white/50 mb-1">Total Agreed Fees</p>
                <h3 className="font-serif text-[1.5rem] font-bold text-[#f4efe8] dark:text-white">{fmt(totalExpected)}</h3>
              </div>
              <div className="flex gap-4">
                <div className="flex-1 bg-green-500/10 rounded-2xl p-5 border border-green-500/20">
                  <p className="text-[10px] font-bold uppercase tracking-widest text-green-400 mb-1">Total Received</p>
                  <h3 className="font-serif text-[1.4rem] font-bold text-green-400">{fmt(totalReceived)}</h3>
                </div>
                <div className="flex-1 bg-red-500/10 rounded-2xl p-5 border border-red-500/20">
                  <p className="text-[10px] font-bold uppercase tracking-widest text-red-400 mb-1">Outstanding</p>
                  <h3 className="font-serif text-[1.4rem] font-bold text-red-400">{fmt(Math.max(0, totalBalance))}</h3>
                </div>
              </div>
            </div>

            {/* Collection Rate Progress Bar */}
            <div className="mb-8 bg-black/20 dark:bg-card/80 rounded-[2rem] p-6 shadow-inner border border-white/5">
              <div className="flex justify-between items-end mb-3">
                <span className="text-[12px] font-bold uppercase tracking-widest text-[#f4efe8]/70 dark:text-white/70">Collection Rate</span>
                <span className="text-[18px] font-bold text-[#f4efe8] dark:text-white">{collectionRate}%</span>
              </div>
              <div className="h-2 w-full bg-white/40 rounded-full overflow-hidden">
                <div className="h-full bg-primary rounded-full transition-all duration-1000" style={{ width: `${collectionRate}%` }} />
              </div>
            </div>

            {/* Forgotten Dues */}
            <div className="flex-1 rounded-3xl border border-red-500/20 bg-red-500/5 p-6 relative overflow-hidden flex flex-col">
              <div className="absolute top-0 left-0 w-full h-1 bg-gradient-to-r from-red-500/50 to-orange-500/50" />
              <div className="flex items-center gap-3 mb-4">
                <AlertCircle className="h-5 w-5 text-red-400" />
                <div>
                  <h3 className="font-serif text-lg font-medium text-red-400">Forgotten Dues</h3>
                </div>
              </div>
              <div className="flex-1 overflow-y-auto pr-2 space-y-3 scrollbar-hide">
                {forgottenDues.length === 0 ? (
                  <p className="text-xs text-white/50 font-medium">No stagnant dues. All good!</p>
                ) : (
                  forgottenDues.map((c) => {
                    const balance = (c.agreedFee ?? 0) - c.payments.filter((p) => p.status === "paid").reduce((a, p) => a + p.amount, 0);
                    return (
                      <div key={c.id} className="rounded-xl border border-red-500/10 bg-black/20 p-4">
                        <p className="font-medium text-[13px] text-white truncate mb-2">{c.title}</p>
                        <div className="flex justify-between items-center">
                          <p className="text-sm font-bold text-red-400">{fmt(balance)}</p>
                          <button title="Send Reminder" className="h-7 w-7 flex items-center justify-center rounded-full bg-red-500/20 text-red-400 hover:bg-red-500/30 transition-colors">
                            <Send className="h-3 w-3 ml-0.5" />
                          </button>
                        </div>
                      </div>
                    );
                  })
                )}
              </div>
            </div>
          </>
        }
        mainPaneHeader={
          <ContentHeading className="flex items-center gap-4 text-[1.6rem]">
            <Receipt className="h-6 w-6 text-primary" />
            Case Fee Tracker
          </ContentHeading>
        }
        mainPaneContent={
          <div className="p-10 h-full">
            <div className="flex-1 overflow-y-auto scrollbar-hide h-full">
              {cases.length === 0 ? (
                <div className="flex flex-col items-center justify-center h-full text-muted-foreground opacity-60">
                  <Receipt className="h-12 w-12 mb-4" />
                  <p className="font-serif text-xl font-medium">No cases yet</p>
                </div>
              ) : (
                <div className="space-y-6">
                  {cases.map((c) => {
                    const received = c.payments.filter((p) => p.status === "paid").reduce((a, p) => a + p.amount, 0);
                    const balance = (c.agreedFee ?? 0) - received;
                    const statusLabel = !c.agreedFee ? "No Fee Set" : balance <= 0 ? "Paid" : received > 0 ? "Partial" : "Unpaid";
                    const statusCls = statusLabel === "Paid" ? "bg-green-500/10 text-green-600 dark:text-green-400 border-green-500/20"
                      : statusLabel === "Partial" ? "bg-orange-500/10 text-orange-600 dark:text-orange-400 border-orange-500/20"
                      : statusLabel === "Unpaid" ? "bg-red-500/10 text-red-600 dark:text-red-400 border-red-500/20"
                      : "bg-black/5 dark:bg-white/5 text-muted-foreground border-white/10";
                    const isExpanded = expandedCaseId === c.id;
                    const pct = c.agreedFee && c.agreedFee > 0 ? Math.min(100, Math.round((received / c.agreedFee) * 100)) : 0;

                    return (
                      <div key={c.id} className="rounded-[1.5rem] bg-white/70 dark:bg-card/80 border border-white/50 dark:border-white/10 shadow-sm overflow-hidden transition-all hover:shadow-md">
                        {/* Premium Dark Header */}
                        <div className="bg-gradient-to-b from-[#3a2c23] to-[#291e16] px-6 py-4 flex items-center justify-between">
                          <Link href={`/cases/${c.id}`} className="font-serif text-[1.1rem] font-medium text-[#f4efe8] hover:text-primary transition-colors">
                            {c.title}
                          </Link>
                          <span className={`inline-flex items-center rounded-full px-3 py-1 text-[9px] font-bold tracking-widest uppercase border ${statusCls}`}>
                            {statusLabel}
                          </span>
                        </div>

                        {/* Case Details */}
                        <div className="p-6">
                          <div className="flex flex-wrap items-center justify-between gap-6 mb-6">
                            
                            <div className="flex-1 min-w-[200px]">
                              <p className="text-[10px] font-bold uppercase tracking-widest text-muted-foreground mb-1">Agreed Fee</p>
                              {editFeeId === c.id ? (
                                <div className="flex items-center gap-2">
                                  <input autoFocus type="number" value={editFeeValue}
                                    onChange={(e) => setEditFeeValue(e.target.value)}
                                    className="w-28 bg-black/5 dark:bg-white/5 border border-primary/30 rounded-lg px-3 py-1.5 text-sm focus:outline-none focus:ring-1 focus:ring-primary"
                                    placeholder="Amount" />
                                  <button onClick={() => handleSaveFee(c.id)} className="text-[10px] font-bold text-primary border border-primary/30 rounded-lg px-3 py-1.5 hover:bg-primary/10">Save</button>
                                  <button onClick={() => setEditFeeId(null)} className="text-[10px] font-bold text-muted-foreground hover:text-foreground">Cancel</button>
                                </div>
                              ) : (
                                <button onClick={() => { setEditFeeId(c.id); setEditFeeValue(String(c.agreedFee ?? "")); }}
                                  className="text-[18px] font-bold text-foreground hover:text-primary transition-colors flex items-center gap-2">
                                  {c.agreedFee ? fmt(c.agreedFee) : <span className="text-sm text-muted-foreground">Set fee →</span>}
                                </button>
                              )}
                            </div>

                            <div className="flex items-center gap-8">
                              <div>
                                <p className="text-[10px] font-bold uppercase tracking-widest text-green-600 dark:text-green-400 mb-1">Received</p>
                                <p className="text-[16px] font-bold text-green-600 dark:text-green-400">{fmt(received)}</p>
                              </div>
                              <div className="w-px h-8 bg-black/10 dark:bg-white/40" />
                              <div>
                                <p className="text-[10px] font-bold uppercase tracking-widest text-red-500 mb-1">Balance</p>
                                <p className="text-[16px] font-bold text-red-500">{fmt(Math.max(0, balance))}</p>
                              </div>
                            </div>
                            
                            <div className="flex items-center gap-2">
                              <button onClick={() => setModalCaseId(c.id)}
                                className="flex items-center gap-1.5 text-[10px] font-bold uppercase tracking-widest text-primary border border-primary/30 rounded-full px-4 py-2 hover:bg-primary/10 transition-colors">
                                <Plus className="h-3 w-3" /> Log
                              </button>
                              {c.payments.length > 0 && (
                                <button onClick={() => setExpandedCaseId(isExpanded ? null : c.id)}
                                  className="flex items-center gap-1.5 text-[10px] font-bold uppercase tracking-widest text-muted-foreground border border-black/10 dark:border-white/10 rounded-full px-3 py-2 hover:bg-black/5 dark:hover:bg-white/5 transition-colors">
                                  {isExpanded ? <ChevronUp className="h-3 w-3" /> : <ChevronDown className="h-3 w-3" />}
                                  {c.payments.length}
                                </button>
                              )}
                            </div>
                          </div>

                          {/* Progress Bar */}
                          {c.agreedFee && c.agreedFee > 0 && (
                            <div className="w-full bg-black/5 dark:bg-white/5 rounded-full h-1.5 overflow-hidden">
                              <div className="bg-green-500 h-full rounded-full transition-all duration-700" style={{ width: `${pct}%` }} />
                            </div>
                          )}
                        </div>

                        {/* Payment History Expandable */}
                        {isExpanded && c.payments.length > 0 && (
                          <div className="bg-black/5 dark:bg-card/80 border-t border-black/5 dark:border-white/5 px-6 py-4 space-y-2">
                            <p className="text-[9px] font-bold uppercase tracking-widest text-muted-foreground mb-3">Payment History</p>
                            {[...c.payments].sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime()).map((p) => (
                              <div key={p.id} className="flex items-center justify-between group bg-white/95 dark:bg-white/5 rounded-xl px-4 py-3 hover:bg-white dark:hover:bg-white/40 transition-colors">
                                <div className="flex items-center gap-4">
                                  <span className="h-2 w-2 rounded-full bg-green-500 shadow-[0_0_10px_rgba(34,197,94,0.5)]" />
                                  <span className="text-[14px] font-bold text-foreground">{fmt(p.amount)}</span>
                                  <span className="text-[11px] text-muted-foreground font-medium flex items-center gap-1.5"><History className="w-3 h-3"/>{format(new Date(p.createdAt), "d MMM yyyy")}</span>
                                </div>
                                <button onClick={() => deletePayment(p.id)} className="p-1.5 text-muted-foreground hover:text-red-500 hover:bg-red-500/10 rounded-full transition-colors opacity-0 group-hover:opacity-100">
                                  <Trash2 className="h-4 w-4" />
                                </button>
                              </div>
                            ))}
                          </div>
                        )}
                      </div>
                    );
                  })}
                </div>
              )}
            </div>
          </div>
        }
      />

      {/* Log Payment Modal */}
      {modalCaseId && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm">
          <div className="bg-background  border border-white/60 dark:border-primary/20 rounded-[1.5rem] shadow-[0_0_50px_rgba(0,0,0,0.5)] w-full max-w-sm animate-in fade-in zoom-in duration-200 overflow-hidden">
            <div className="bg-[#291e16] dark:bg-[#1A1918] px-6 py-5 flex items-center justify-between">
              <div className="flex items-center gap-3">
                 <div className="w-9 h-9 rounded-xl bg-primary/20 border border-primary/30 flex items-center justify-center">
                    <Receipt className="w-4 h-4 text-primary" />
                 </div>
                 <ContentHeading className="text-[1.2rem] text-[#f4efe8] leading-none">Log Payment</ContentHeading>
              </div>
              <button onClick={() => setModalCaseId(null)} className="text-white/40 hover:text-white transition-colors p-1.5 rounded-full hover:bg-white/40"><X className="h-5 w-5" /></button>
            </div>
            <form onSubmit={handleLogPayment} className="p-6 space-y-5">
              <div>
                <label className="block text-[10px] font-bold uppercase tracking-widest text-muted-foreground mb-2">Case</label>
                <select value={modalCaseId} onChange={(e) => setModalCaseId(e.target.value)}
                  className="w-full bg-white dark:bg-black/30 border border-primary/10 rounded-xl px-4 py-3 text-[14px] focus:outline-none focus:ring-1 focus:ring-primary shadow-sm appearance-none">
                  {cases.map((c) => <option key={c.id} value={c.id}>{c.title}</option>)}
                </select>
              </div>
              <div>
                <label className="block text-[10px] font-bold uppercase tracking-widest text-muted-foreground mb-2">Amount Received (₹)</label>
                <input required autoFocus type="number" min="1" value={payAmount} onChange={(e) => setPayAmount(e.target.value)}
                  className="w-full bg-white dark:bg-black/30 border border-primary/10 rounded-xl px-4 py-3 text-[14px] focus:outline-none focus:ring-1 focus:ring-primary shadow-sm"
                  placeholder="e.g. 25000" />
              </div>
              <button type="submit" disabled={isSubmitting}
                className="w-full bg-primary text-primary-foreground font-bold uppercase tracking-widest text-[12px] py-4 rounded-xl hover:shadow-[0_0_20px_rgba(200,150,62,0.3)] transition-all disabled:opacity-60">
                {isSubmitting ? "Saving…" : "Save Payment"}
              </button>
            </form>
          </div>
        </div>
      )}
    </>
  );
}

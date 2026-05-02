"use client";

import { useState } from "react";
import Link from "next/link";
import { IndianRupee, AlertCircle, Plus, Receipt, History, Send, X, Trash2, ChevronDown, ChevronUp } from "lucide-react";
import { createPayment, updateCaseAgreedFee, deletePayment } from "@/actions/financeActions";
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

  const totalExpected = cases.reduce((s, c) => s + (c.agreedFee ?? 0), 0);
  const totalReceived = cases.reduce((s, c) =>
    s + c.payments.filter((p) => p.status === "paid").reduce((a, p) => a + p.amount, 0), 0);
  const totalBalance = totalExpected - totalReceived;

  const forgottenDues = cases.filter((c) => {
    const balance = (c.agreedFee ?? 0) - c.payments.filter((p) => p.status === "paid").reduce((a, p) => a + p.amount, 0);
    const lastActivity = c.payments.length > 0
      ? Math.max(...c.payments.map((p) => new Date(p.createdAt).getTime()))
      : 0;
    const daysInactive = lastActivity ? Math.floor((Date.now() - lastActivity) / 86400000) : 999;
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
      {/* Header */}
      <div className="relative border-b border-white/5 bg-card/60 backdrop-blur-xl px-10 py-8 shrink-0 z-10 shadow-sm">
        <div className="flex justify-between items-end">
          <div>
            <h1 className="font-serif text-4xl font-semibold tracking-tight text-foreground mb-2">Case Fees & Collections</h1>
            <p className="text-muted-foreground text-lg font-light">Track agreed case fees, partial receipts, and outstanding dues.</p>
          </div>
          <button onClick={() => setModalCaseId(cases[0]?.id ?? null)}
            className="flex items-center gap-2 bg-accent text-accent-foreground px-6 py-3 rounded-full hover:scale-105 transition-transform font-medium shadow-[0_0_20px_rgba(243,225,215,0.2)]">
            <Plus className="h-4 w-4" /> Log Payment
          </button>
        </div>
      </div>

      {/* Body */}
      <div className="p-8 relative z-10">
        <div className="max-w-7xl mx-auto space-y-8">

          {/* KPI Cards */}
          <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
            <div className="rounded-3xl bg-card/60 backdrop-blur-xl border border-white/5 p-8 shadow-xl relative overflow-hidden group">
              <div className="absolute top-0 right-0 p-4 opacity-5 group-hover:opacity-10 transition-opacity"><Receipt className="h-24 w-24 text-foreground" /></div>
              <div className="relative z-10">
                <div className="flex items-center justify-between mb-4">
                  <p className="text-sm font-semibold tracking-widest uppercase text-muted-foreground">Total Agreed Fees</p>
                  <div className="h-10 w-10 rounded-full bg-white/5 flex items-center justify-center border border-white/10"><IndianRupee className="h-4 w-4" /></div>
                </div>
                <h3 className="font-serif text-4xl font-bold">{fmt(totalExpected)}</h3>
              </div>
            </div>
            <div className="rounded-3xl bg-accent/5 backdrop-blur-xl border border-accent/20 p-8 shadow-[0_0_30px_rgba(243,225,215,0.05)]">
              <div className="flex items-center justify-between mb-4">
                <p className="text-sm font-semibold tracking-widest uppercase text-accent">Total Received</p>
                <div className="h-10 w-10 rounded-full bg-accent/20 flex items-center justify-center border border-accent/30"><IndianRupee className="h-4 w-4 text-accent" /></div>
              </div>
              <h3 className="font-serif text-4xl font-bold">{fmt(totalReceived)}</h3>
            </div>
            <div className="rounded-3xl bg-red-500/5 backdrop-blur-xl border border-red-500/20 p-8 shadow-[0_0_30px_rgba(239,68,68,0.05)]">
              <div className="flex items-center justify-between mb-4">
                <p className="text-sm font-semibold tracking-widest uppercase text-red-400 flex items-center gap-1.5"><AlertCircle className="h-4 w-4" /> Outstanding</p>
              </div>
              <h3 className="font-serif text-4xl font-bold text-red-400">{fmt(Math.max(0, totalBalance))}</h3>
            </div>
          </div>

          <div className="grid grid-cols-1 xl:grid-cols-3 gap-8">
            {/* Fee Tracker Table */}
            <div className="xl:col-span-2 rounded-3xl border border-white/5 bg-card/60 backdrop-blur-xl overflow-hidden shadow-2xl">
              <div className="flex items-center justify-between border-b border-white/5 bg-white/5 px-8 py-6">
                <h2 className="font-serif text-2xl font-medium">Case Fee Tracker</h2>
              </div>
              {cases.length === 0 ? (
                <div className="p-12 text-center text-muted-foreground font-light">No cases yet. <Link href="/cases" className="text-accent hover:underline">Add a case →</Link></div>
              ) : (
                <div className="divide-y divide-white/5">
                  {cases.map((c) => {
                    const received = c.payments.filter((p) => p.status === "paid").reduce((a, p) => a + p.amount, 0);
                    const balance = (c.agreedFee ?? 0) - received;
                    const statusLabel = !c.agreedFee ? "No Fee Set" : balance <= 0 ? "Paid" : received > 0 ? "Partial" : "Unpaid";
                    const statusCls = statusLabel === "Paid" ? "bg-green-500/10 text-green-400 border-green-500/20"
                      : statusLabel === "Partial" ? "bg-orange-500/10 text-orange-400 border-orange-500/20"
                      : statusLabel === "Unpaid" ? "bg-red-500/10 text-red-400 border-red-500/20"
                      : "bg-white/5 text-muted-foreground border-white/10";
                    const isExpanded = expandedCaseId === c.id;

                    return (
                      <div key={c.id}>
                        {/* Case row */}
                        <div className="flex flex-col sm:flex-row sm:items-center justify-between p-6 sm:p-8 hover:bg-white/5 transition-colors gap-6">
                          <div className="flex-1">
                            <div className="flex items-center gap-3 mb-2 flex-wrap">
                              <Link href={`/cases/${c.id}`} className="font-serif text-xl font-medium text-foreground hover:text-accent transition-colors underline decoration-white/20 underline-offset-4">
                                {c.title}
                              </Link>
                              <span className={`inline-flex items-center rounded-full px-3 py-1 text-[10px] font-semibold tracking-widest uppercase border ${statusCls}`}>{statusLabel}</span>
                            </div>
                            <p className="text-sm font-light text-muted-foreground flex items-center gap-2">
                              <History className="h-3.5 w-3.5" />
                              {c.payments.length > 0
                                ? `Last payment: ${format(new Date(Math.max(...c.payments.map((p) => new Date(p.createdAt).getTime()))), "d MMM yyyy")}`
                                : "No payments yet"}
                            </p>

                            {editFeeId === c.id ? (
                              <div className="flex items-center gap-2 mt-3">
                                <span className="text-sm text-muted-foreground">₹</span>
                                <input autoFocus type="number" value={editFeeValue}
                                  onChange={(e) => setEditFeeValue(e.target.value)}
                                  className="w-32 bg-white/5 border border-accent rounded-lg px-3 py-1.5 text-sm focus:outline-none"
                                  placeholder="Agreed fee" />
                                <button onClick={() => handleSaveFee(c.id)} className="text-xs text-accent border border-accent/30 rounded-lg px-3 py-1.5 hover:bg-accent/10 transition-colors">Save</button>
                                <button onClick={() => setEditFeeId(null)} className="text-xs text-muted-foreground hover:text-foreground transition-colors">Cancel</button>
                              </div>
                            ) : (
                              <button onClick={() => { setEditFeeId(c.id); setEditFeeValue(String(c.agreedFee ?? "")); }}
                                className="mt-2 text-xs text-muted-foreground hover:text-accent transition-colors underline underline-offset-4">
                                {c.agreedFee ? `Agreed: ${fmt(c.agreedFee)}` : "Set agreed fee"}
                              </button>
                            )}
                          </div>

                          <div className="flex items-center gap-6 sm:gap-8 w-full sm:w-auto flex-wrap">
                            <div>
                              <p className="text-xs text-muted-foreground uppercase tracking-widest font-semibold mb-1">Received</p>
                              <p className="font-medium text-green-400">{fmt(received)}</p>
                            </div>
                            <div>
                              <p className="text-xs text-red-400 uppercase tracking-widest font-semibold mb-1">Balance</p>
                              <p className="font-bold text-red-400">{fmt(Math.max(0, balance))}</p>
                            </div>
                            <div className="flex items-center gap-2">
                              <button onClick={() => setModalCaseId(c.id)}
                                className="flex items-center gap-1.5 text-xs font-medium text-accent border border-accent/20 rounded-full px-4 py-2 hover:bg-accent/10 transition-colors">
                                <Plus className="h-3.5 w-3.5" /> Log
                              </button>
                              {c.payments.length > 0 && (
                                <button
                                  onClick={() => setExpandedCaseId(isExpanded ? null : c.id)}
                                  className="flex items-center gap-1 text-xs text-muted-foreground border border-white/10 rounded-full px-3 py-2 hover:bg-white/5 transition-colors"
                                >
                                  {isExpanded ? <ChevronUp className="h-3.5 w-3.5" /> : <ChevronDown className="h-3.5 w-3.5" />}
                                  {c.payments.length}
                                </button>
                              )}
                            </div>
                          </div>
                        </div>

                        {/* Payment history (expandable) */}
                        {isExpanded && c.payments.length > 0 && (
                          <div className="border-t border-white/5 bg-black/20 px-8 py-4 space-y-2">
                            <p className="text-[10px] font-semibold uppercase tracking-widest text-muted-foreground mb-3">Payment History</p>
                            {[...c.payments]
                              .sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime())
                              .map((p) => (
                                <div key={p.id} className="flex items-center justify-between group rounded-xl px-4 py-2.5 hover:bg-white/5 transition-colors">
                                  <div className="flex items-center gap-4">
                                    <span className={`inline-flex items-center rounded-full px-2.5 py-0.5 text-[10px] font-semibold border ${p.status === "paid" ? "bg-green-500/10 text-green-400 border-green-500/20" : "bg-orange-500/10 text-orange-400 border-orange-500/20"}`}>
                                      {p.status}
                                    </span>
                                    <span className="text-sm font-medium text-foreground">{fmt(p.amount)}</span>
                                    <span className="text-xs text-muted-foreground font-light">{format(new Date(p.createdAt), "d MMM yyyy")}</span>
                                  </div>
                                  <button
                                    onClick={() => deletePayment(p.id)}
                                    className="p-1.5 text-muted-foreground hover:text-red-400 hover:bg-red-400/10 rounded-full transition-colors opacity-0 group-hover:opacity-100"
                                  >
                                    <Trash2 className="h-3.5 w-3.5" />
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

            {/* Forgotten Dues */}
            <div className="rounded-3xl border border-red-500/20 bg-card/60 backdrop-blur-md p-6 shadow-xl relative overflow-hidden flex flex-col">
              <div className="absolute top-0 left-0 w-full h-1 bg-gradient-to-r from-red-500/50 to-orange-500/50" />
              <div className="flex items-center gap-3 mb-6">
                <div className="h-10 w-10 rounded-full bg-red-500/10 border border-red-500/20 flex items-center justify-center shrink-0">
                  <AlertCircle className="h-5 w-5 text-red-400" />
                </div>
                <div>
                  <h3 className="font-serif text-xl font-medium text-red-400">Forgotten Dues</h3>
                  <p className="text-xs font-light text-muted-foreground mt-1">Stagnant balances &gt; 60 days</p>
                </div>
              </div>
              {forgottenDues.length === 0 ? (
                <p className="text-sm text-muted-foreground font-light py-4">No stagnant dues. All good!</p>
              ) : (
                <div className="space-y-4">
                  {forgottenDues.map((c) => {
                    const balance = (c.agreedFee ?? 0) - c.payments.filter((p) => p.status === "paid").reduce((a, p) => a + p.amount, 0);
                    return (
                      <div key={c.id} className="rounded-2xl border border-red-500/10 bg-white/5 p-5 hover:border-red-500/30 transition-colors">
                        <p className="font-medium text-foreground mb-1">{c.title}</p>
                        <div className="flex justify-between items-center mt-3">
                          <p className="text-sm font-bold text-red-400">{fmt(balance)}</p>
                          <button title="Send Reminder"
                            className="h-9 w-9 flex items-center justify-center rounded-full bg-red-500/10 text-red-400 hover:bg-red-500/20 transition-colors">
                            <Send className="h-4 w-4 ml-0.5" />
                          </button>
                        </div>
                      </div>
                    );
                  })}
                </div>
              )}
            </div>
          </div>
        </div>
      </div>

      {/* Log Payment Modal */}
      {modalCaseId && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm">
          <div className="bg-card border border-white/10 rounded-3xl shadow-2xl w-full max-w-sm">
            <div className="flex justify-between items-center p-6 border-b border-white/5">
              <h2 className="font-serif text-2xl font-medium">Log Payment</h2>
              <button onClick={() => setModalCaseId(null)} className="text-muted-foreground hover:text-foreground p-1 rounded-full hover:bg-white/5 transition-colors"><X className="h-5 w-5" /></button>
            </div>
            <form onSubmit={handleLogPayment} className="p-6 space-y-5">
              <div>
                <label className="block text-xs font-semibold uppercase tracking-widest text-muted-foreground mb-2">Case</label>
                <select value={modalCaseId} onChange={(e) => setModalCaseId(e.target.value)}
                  className="w-full bg-white/5 border border-white/10 rounded-xl px-4 py-3 text-sm focus:outline-none focus:border-accent focus:ring-1 focus:ring-accent transition-all appearance-none">
                  {cases.map((c) => <option key={c.id} value={c.id} className="bg-card">{c.title}</option>)}
                </select>
              </div>
              <div>
                <label className="block text-xs font-semibold uppercase tracking-widest text-muted-foreground mb-2">Amount Received (₹)</label>
                <input required type="number" min="1" value={payAmount} onChange={(e) => setPayAmount(e.target.value)}
                  className="w-full bg-white/5 border border-white/10 rounded-xl px-4 py-3 text-sm focus:outline-none focus:border-accent focus:ring-1 focus:ring-accent transition-all"
                  placeholder="e.g. 25000" />
              </div>
              <button type="submit" disabled={isSubmitting}
                className="w-full bg-accent text-accent-foreground font-medium py-3 rounded-xl hover:bg-accent/90 transition-colors shadow-lg shadow-accent/20 disabled:opacity-60">
                {isSubmitting ? "Saving…" : "Log Payment"}
              </button>
            </form>
          </div>
        </div>
      )}
    </>
  );
}

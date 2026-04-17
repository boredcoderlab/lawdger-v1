import { IndianRupee, AlertCircle, FileText, ChevronRight, Download, Plus } from 'lucide-react';
import Link from 'next/link';

export default function Finances() {
  return (
    <div className="p-8 pb-32">
      <div className="flex justify-between items-center mb-8">
        <div>
          <h1 className="text-3xl font-bold tracking-tight text-foreground">Finances</h1>
          <p className="text-muted-foreground mt-1">Manage your billing, invoices, and payments.</p>
        </div>
        <button className="flex items-center gap-2 bg-accent text-accent-foreground px-4 py-2 rounded-md hover:bg-accent/90 transition-colors font-medium">
          <Plus className="h-4 w-4" />
          Create Invoice
        </button>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-6 mb-8">
        <div className="rounded-xl bg-card border border-border p-6 shadow-sm">
          <div className="flex items-center justify-between mb-2">
            <p className="text-sm font-medium text-muted-foreground">Unbilled Hours</p>
            <div className="h-8 w-8 rounded-full bg-emerald-500/10 flex items-center justify-center">
              <IndianRupee className="h-4 w-4 text-emerald-500" />
            </div>
          </div>
          <h3 className="text-3xl font-bold text-foreground">₹45,000</h3>
        </div>
        
        <div className="rounded-xl bg-card border border-border p-6 shadow-sm">
          <div className="flex items-center justify-between mb-2">
            <p className="text-sm font-medium text-muted-foreground">Paid This Month</p>
            <div className="h-8 w-8 rounded-full bg-accent/10 flex items-center justify-center">
              <IndianRupee className="h-4 w-4 text-accent" />
            </div>
          </div>
          <h3 className="text-3xl font-bold text-foreground">₹1,20,000</h3>
        </div>

        <div className="rounded-xl bg-red-500/5 border border-red-500/20 p-6 shadow-sm">
          <div className="flex items-center justify-between mb-2">
            <p className="text-sm font-medium text-red-500 flex items-center gap-1">
              <AlertCircle className="h-4 w-4" /> Overdue
            </p>
          </div>
          <h3 className="text-3xl font-bold text-red-500">₹12,500</h3>
        </div>
      </div>

      <div className="rounded-xl border border-border bg-card overflow-hidden shadow-sm">
        <div className="flex items-center justify-between border-b border-border bg-muted/30 px-6 py-4">
          <h2 className="text-lg font-semibold">Recent Invoices</h2>
        </div>
        
        <div className="divide-y divide-border">
          {/* Invoice 1 */}
          <div className="flex items-center justify-between p-6 hover:bg-muted/50 transition-colors">
            <div className="flex items-center gap-4">
              <div className="h-10 w-10 rounded-lg bg-muted flex items-center justify-center shrink-0">
                <FileText className="h-5 w-5 text-muted-foreground" />
              </div>
              <div>
                <p className="font-medium text-foreground text-lg">INV-2024-042</p>
                <Link href="/cases/2" className="text-sm text-muted-foreground hover:text-accent transition-colors">TechCorp India - Arbitration</Link>
              </div>
            </div>
            <div className="flex items-center gap-6">
              <div className="text-right">
                <p className="font-bold text-lg">₹30,000</p>
                <span className="inline-flex items-center rounded-full bg-orange-500/10 px-2 py-0.5 text-xs font-medium text-orange-500 border border-orange-500/20">Pending</span>
              </div>
              <button className="text-muted-foreground hover:text-foreground transition-colors p-2">
                <Download className="h-5 w-5" />
              </button>
            </div>
          </div>

          {/* Invoice 2 */}
          <div className="flex items-center justify-between p-6 hover:bg-muted/50 transition-colors">
            <div className="flex items-center gap-4">
              <div className="h-10 w-10 rounded-lg bg-muted flex items-center justify-center shrink-0">
                <FileText className="h-5 w-5 text-muted-foreground" />
              </div>
              <div>
                <p className="font-medium text-foreground text-lg">INV-2024-041</p>
                <Link href="/cases/1" className="text-sm text-muted-foreground hover:text-accent transition-colors">Sharma v. State - Bail Application</Link>
              </div>
            </div>
            <div className="flex items-center gap-6">
              <div className="text-right">
                <p className="font-bold text-lg">₹15,000</p>
                <span className="inline-flex items-center rounded-full bg-green-500/10 px-2 py-0.5 text-xs font-medium text-green-500 border border-green-500/20">Paid</span>
              </div>
              <button className="text-muted-foreground hover:text-foreground transition-colors p-2">
                <Download className="h-5 w-5" />
              </button>
            </div>
          </div>
          
          {/* Invoice 3 */}
          <div className="flex items-center justify-between p-6 hover:bg-muted/50 transition-colors">
            <div className="flex items-center gap-4">
              <div className="h-10 w-10 rounded-lg bg-muted flex items-center justify-center shrink-0">
                <FileText className="h-5 w-5 text-muted-foreground" />
              </div>
              <div>
                <p className="font-medium text-foreground text-lg">INV-2024-040</p>
                <Link href="/cases/3" className="text-sm text-muted-foreground hover:text-accent transition-colors">Amit Gupta - Property Search</Link>
              </div>
            </div>
            <div className="flex items-center gap-6">
              <div className="text-right">
                <p className="font-bold text-lg">₹12,500</p>
                <span className="inline-flex items-center rounded-full bg-red-500/10 px-2 py-0.5 text-xs font-medium text-red-500 border border-red-500/20">Overdue</span>
              </div>
              <button className="text-muted-foreground hover:text-foreground transition-colors p-2">
                <Download className="h-5 w-5" />
              </button>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

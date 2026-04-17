import Link from 'next/link';
import { Search, Plus } from 'lucide-react';

const cases = [
  { id: 1, title: 'Sharma v. State', client: 'Rajeev Sharma', court: 'High Court', status: 'Active', updated: '2 hours ago' },
  { id: 2, title: 'TechCorp Arbitration', client: 'TechCorp India', court: 'Arbitration Tribunal', status: 'Active', updated: '1 day ago' },
  { id: 3, title: 'Gupta Property Dispute', client: 'Amit Gupta', court: 'District Court', status: 'Pending', updated: '3 days ago' },
];

export default function Cases() {
  return (
    <div className="p-8 pb-32">
      <div className="flex justify-between items-center mb-8">
        <h1 className="text-3xl font-bold tracking-tight text-foreground">Cases</h1>
        <button className="flex items-center gap-2 bg-accent text-accent-foreground px-4 py-2 rounded-md hover:bg-accent/90 transition-colors font-medium">
          <Plus className="h-4 w-4" />
          New Case
        </button>
      </div>

      <div className="mb-6 relative">
        <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-5 w-5 text-muted-foreground" />
        <input 
          type="text" 
          placeholder="Search cases by name, client, or court..." 
          className="w-full bg-card border border-border rounded-lg pl-10 pr-4 py-3 text-foreground focus:outline-none focus:ring-2 focus:ring-accent focus:border-transparent transition-all"
        />
      </div>

      <div className="grid gap-4">
        {cases.map((c) => (
          <Link key={c.id} href={`/cases/${c.id}`} className="block group">
            <div className="rounded-xl border border-border bg-card p-6 shadow-sm transition-all hover:border-accent hover:shadow-md">
              <div className="flex justify-between items-start">
                <div>
                  <h2 className="text-xl font-semibold text-foreground group-hover:text-accent transition-colors">{c.title}</h2>
                  <div className="flex items-center gap-4 mt-2 text-sm text-muted-foreground">
                    <span>{c.client}</span>
                    <span className="w-1 h-1 rounded-full bg-border"></span>
                    <span>{c.court}</span>
                  </div>
                </div>
                <div className="flex flex-col items-end gap-2">
                  <span className="inline-flex items-center rounded-full bg-green-500/10 px-2.5 py-0.5 text-xs font-medium text-green-500 border border-green-500/20">
                    {c.status}
                  </span>
                  <span className="text-xs text-muted-foreground">Updated {c.updated}</span>
                </div>
              </div>
            </div>
          </Link>
        ))}
      </div>
    </div>
  );
}

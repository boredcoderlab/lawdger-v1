import { Sparkles, Send, Mic, Paperclip } from 'lucide-react';

export default function Chat() {
  return (
    <div className="flex flex-col h-full bg-background text-foreground">
      {/* Header */}
      <div className="flex items-center justify-between border-b border-border bg-card/50 px-8 py-5 shrink-0">
        <div>
          <h1 className="text-xl font-bold tracking-tight text-foreground flex items-center gap-2">
            <Sparkles className="h-5 w-5 text-accent" /> Legal Brain
          </h1>
          <p className="text-sm text-muted-foreground mt-0.5">Your personal legal AI assistant</p>
        </div>
      </div>

      {/* Chat History */}
      <div className="flex-1 overflow-y-auto p-8 space-y-8 max-w-4xl mx-auto w-full">
        {/* Empty State / Welcome */}
        <div className="flex flex-col items-center justify-center text-center mt-20 mb-12">
          <div className="h-16 w-16 rounded-2xl bg-accent/10 flex items-center justify-center mb-6 border border-accent/20 shadow-[0_0_30px_rgba(41,151,255,0.15)]">
            <Sparkles className="h-8 w-8 text-accent" />
          </div>
          <h2 className="text-2xl font-bold mb-2">How can I help you today?</h2>
          <p className="text-muted-foreground max-w-md">
            I can analyze case files, draft legal notices, summarize hearings, or help you organize your daily tasks.
          </p>
        </div>

        {/* Suggested Prompts */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4 max-w-2xl mx-auto">
          <button className="flex flex-col text-left p-4 rounded-xl border border-border bg-card hover:bg-muted/50 transition-colors">
            <span className="font-semibold text-sm">Draft a reply</span>
            <span className="text-xs text-muted-foreground mt-1">for Sharma v. State regarding the recent notice</span>
          </button>
          <button className="flex flex-col text-left p-4 rounded-xl border border-border bg-card hover:bg-muted/50 transition-colors">
            <span className="font-semibold text-sm">Summarize the arbitration</span>
            <span className="text-xs text-muted-foreground mt-1">proceedings for TechCorp India</span>
          </button>
          <button className="flex flex-col text-left p-4 rounded-xl border border-border bg-card hover:bg-muted/50 transition-colors">
            <span className="font-semibold text-sm">What are my tasks</span>
            <span className="text-xs text-muted-foreground mt-1">that are overdue or due today?</span>
          </button>
          <button className="flex flex-col text-left p-4 rounded-xl border border-border bg-card hover:bg-muted/50 transition-colors">
            <span className="font-semibold text-sm">Generate an invoice</span>
            <span className="text-xs text-muted-foreground mt-1">for Amit Gupta's latest consultation</span>
          </button>
        </div>
      </div>

      {/* Input Area */}
      <div className="p-6 bg-background shrink-0 w-full max-w-4xl mx-auto">
        <div className="relative flex items-center bg-card border border-border rounded-2xl shadow-sm focus-within:ring-1 focus-within:ring-accent focus-within:border-accent transition-all">
          <button className="absolute left-4 text-muted-foreground hover:text-foreground transition-colors p-2">
            <Paperclip className="h-5 w-5" />
          </button>
          
          <textarea 
            placeholder="Message Legal Brain..." 
            className="w-full bg-transparent pl-14 pr-24 py-5 max-h-32 min-h-[60px] text-base focus:outline-none resize-none"
            rows={1}
          />
          
          <div className="absolute right-3 flex items-center gap-2">
            <button className="text-muted-foreground hover:text-accent transition-colors p-2">
              <Mic className="h-5 w-5" />
            </button>
            <button className="bg-accent text-white h-10 w-10 rounded-xl flex items-center justify-center hover:bg-accent/90 transition-transform hover:scale-105 shadow-sm">
              <Send className="h-4 w-4 ml-0.5" />
            </button>
          </div>
        </div>
        <p className="text-center text-xs text-muted-foreground mt-4 mb-2">
          Legal Brain can make mistakes. Consider verifying important information.
        </p>
      </div>
    </div>
  );
}

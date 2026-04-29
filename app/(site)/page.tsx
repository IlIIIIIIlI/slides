import Link from "next/link";
import { ArrowRight, Layers } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Separator } from "@/components/ui/separator";
import { RecentPresentations } from "@/components/home/recent-presentations";

const FEATURES = [
  {
    color: "#60a5fa",
    title: "Structured Ingestion",
    body: "PDF, DOCX, URL, images, transcripts — every source normalized to a citable SourceAsset with chunk-level provenance.",
  },
  {
    color: "#a78bfa",
    title: "Evidence Graph",
    body: "Every claim on every slide traces back to a source, page, and paragraph. Citations are a first-class data object.",
  },
  {
    color: "#14b8a6",
    title: "Theme Governance",
    body: "Semantic color mapping, preset catalogue, and density validators ensure consistent, auditable visual output.",
  },
];

const PIPELINE_STEPS = ["Extract", "Outline", "Draft", "Validate", "Render"];

export default function Home() {
  return (
    <main className="min-h-screen bg-background">
      <div className="max-w-screen-lg mx-auto px-6">
        {/* Hero */}
        <section className="pt-20 pb-16 text-center">
          <div className="inline-flex items-center gap-1.5 rounded-full border border-teal-500/30 bg-teal-500/10 px-3 py-1 text-xs font-medium text-teal-400 mb-8">
            <span className="w-1.5 h-1.5 rounded-full bg-teal-400" />
            Slides Drafted · Ready for QA
          </div>

          <h1 className="text-5xl sm:text-6xl font-bold tracking-[-0.035em] leading-none mb-5">
            <span className="bg-gradient-to-b from-foreground to-muted-foreground bg-clip-text text-transparent">
              From knowledge
            </span>
            <br />
            <span className="text-teal-400">to slides.</span>
          </h1>

          <p className="text-base text-muted-foreground max-w-lg mx-auto leading-relaxed mb-8">
            Structure first. Evidence grounded. Style governed.
            Convert multi-source knowledge into cite-tracked presentations with Claude.
          </p>

          <div className="flex items-center justify-center gap-3">
            <Button asChild>
              <Link href="/workspace">
                New Deck <ArrowRight className="w-3.5 h-3.5 ml-1" />
              </Link>
            </Button>
            <Button variant="outline" asChild>
              <Link href="/library">Browse Library</Link>
            </Button>
          </div>
        </section>

        <Separator />

        {/* Features */}
        <section className="py-12">
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
            {FEATURES.map((f) => (
              <Card key={f.title}>
                <CardContent className="p-5">
                  <div className="w-8 h-8 rounded-lg mb-4 flex items-center justify-center" style={{ background: `${f.color}15` }}>
                    <Layers className="w-4 h-4" style={{ color: f.color }} />
                  </div>
                  <h3 className="text-sm font-semibold mb-2">{f.title}</h3>
                  <p className="text-sm text-muted-foreground leading-relaxed">{f.body}</p>
                </CardContent>
              </Card>
            ))}
          </div>
        </section>

        <Separator />

        {/* Pipeline */}
        <section className="py-12">
          <p className="text-xs font-semibold uppercase tracking-[0.2em] text-muted-foreground mb-8 text-center">Generation Pipeline</p>
          <div className="flex items-center justify-center flex-wrap gap-y-4">
            {PIPELINE_STEPS.map((step, i) => (
              <div key={step} className="flex items-center">
                <div className="flex flex-col items-center">
                  <div className="w-7 h-7 rounded-full border border-border bg-card flex items-center justify-center mb-1.5">
                    <span className="text-[10px] font-mono text-muted-foreground">{i + 1}</span>
                  </div>
                  <span className="text-[9px] text-muted-foreground text-center whitespace-nowrap">{step}</span>
                </div>
                {i < PIPELINE_STEPS.length - 1 && (
                  <div className="w-6 h-px bg-border mx-1 mb-3" />
                )}
              </div>
            ))}
          </div>
        </section>

        <Separator />

        {/* Recent presentations */}
        <section className="py-12">
          <div className="flex items-center justify-between mb-6">
            <h2 className="text-sm font-semibold">Recent Decks</h2>
            <Button variant="ghost" size="sm" asChild className="h-7 text-xs">
              <Link href="/library">View all →</Link>
            </Button>
          </div>
          <RecentPresentations />
        </section>
      </div>

      <footer className="border-t border-border mt-4">
        <div className="max-w-screen-lg mx-auto px-6 py-5 flex items-center justify-between">
          <p className="text-xs text-muted-foreground">K2S Studio</p>
          <p className="text-xs text-muted-foreground">Next.js 15 · React 19 · Claude</p>
        </div>
      </footer>
    </main>
  );
}

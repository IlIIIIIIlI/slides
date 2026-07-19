"use client";

import { useState } from "react";
import Link from "next/link";
import { AlertCircle, Check, Play, Route } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Card, CardContent } from "@/components/ui/card";
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";

export interface CrawlSuccess {
  id: string;
  title: string;
  slideCount: number;
}

function parseLines(text: string): string[] {
  return text
    .split(/\r?\n/)
    .map((l) => l.trim())
    .filter(Boolean);
}

function clientValidate(urls: string[]): string | null {
  if (urls.length < 1) {
    return "Paste at least one https URL (one per line).";
  }
  for (const u of urls) {
    let parsed: URL;
    try {
      parsed = new URL(u);
    } catch {
      return `Invalid URL: ${u}`;
    }
    if (parsed.protocol !== "http:" && parsed.protocol !== "https:") {
      return `Only http(s) URLs are allowed: ${u}`;
    }
  }
  return null;
}

/**
 * Multi-URL product path crawl → Flip-morphing tour deck.
 * Mounted on the workspace Sources tab alongside file/URL generate.
 */
export function ProductCrawlForm({
  onCreated,
}: {
  onCreated?: (result: CrawlSuccess) => void;
}) {
  const [urlsText, setUrlsText] = useState("");
  const [title, setTitle] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [result, setResult] = useState<CrawlSuccess | null>(null);

  async function handleSubmit() {
    if (loading) return;
    setError(null);

    const urls = parseLines(urlsText);
    const validation = clientValidate(urls);
    if (validation) {
      setError(validation);
      return;
    }

    setLoading(true);
    try {
      const res = await fetch("/api/presentations/crawl", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          urls,
          title: title.trim() || undefined,
        }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        const msg =
          typeof data.error === "string"
            ? data.error
            : `Crawl failed (${res.status})`;
        const withUrl =
          typeof data.url === "string" ? `${msg} (${data.url})` : msg;
        throw new Error(withUrl);
      }
      const ok: CrawlSuccess = {
        id: data.id,
        title: data.title,
        slideCount: data.slideCount,
      };
      setResult(ok);
      onCreated?.(ok);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Crawl failed");
    } finally {
      setLoading(false);
    }
  }

  function handleReset() {
    setError(null);
    setResult(null);
    setUrlsText("");
    setTitle("");
  }

  return (
    <>
      <Card>
        <CardContent className="p-5 space-y-4">
          <div className="flex items-start gap-3">
            <div className="w-8 h-8 rounded-md bg-teal-500/15 flex items-center justify-center flex-shrink-0">
              <Route className="w-4 h-4 text-teal-400" />
            </div>
            <div className="min-w-0">
              <h3 className="text-sm font-semibold">Product path crawl</h3>
              <p className="text-xs text-muted-foreground mt-0.5">
                Paste an ordered tour (landing → feature → pricing…). Static HTML
                is extracted into slides with shared chrome morph keys — no PPTX
                required.
              </p>
            </div>
          </div>

          <div className="space-y-2">
            <label className="text-xs font-medium text-muted-foreground uppercase tracking-wider">
              URLs (one per line)
            </label>
            <Textarea
              value={urlsText}
              onChange={(e) => setUrlsText(e.target.value)}
              placeholder={"https://example.com/\nhttps://example.com/features\nhttps://example.com/pricing"}
              rows={4}
              className="text-xs font-mono min-h-[88px]"
              disabled={loading}
            />
          </div>

          <div className="space-y-2">
            <label className="text-xs font-medium text-muted-foreground uppercase tracking-wider">
              Deck title (optional)
            </label>
            <Input
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              placeholder="Product tour"
              className="h-9 text-sm"
              disabled={loading}
            />
          </div>

          {error && (
            <div className="flex items-start gap-2 rounded-lg border border-destructive/30 bg-destructive/10 px-3 py-2.5 text-sm text-destructive">
              <AlertCircle className="w-4 h-4 mt-0.5 flex-shrink-0" />
              <span>{error}</span>
            </div>
          )}

          <Button
            onClick={handleSubmit}
            disabled={loading || !urlsText.trim()}
            className="w-full gap-2"
          >
            {loading ? (
              <span className="w-3.5 h-3.5 rounded-full border border-current border-t-transparent animate-spin" />
            ) : (
              <Route className="w-4 h-4" />
            )}
            {loading ? "Crawling…" : "Crawl into tour deck"}
          </Button>
        </CardContent>
      </Card>

      <Dialog
        open={!!result}
        onOpenChange={(open) => {
          if (!open) handleReset();
        }}
      >
        <DialogContent className="sm:max-w-sm">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <div className="w-7 h-7 rounded-full bg-teal-500/15 flex items-center justify-center">
                <Check className="w-4 h-4 text-teal-400" />
              </div>
              Tour deck ready
            </DialogTitle>
          </DialogHeader>
          {result && (
            <div className="py-1">
              <p className="text-sm font-medium line-clamp-2">{result.title}</p>
              <p className="text-xs text-muted-foreground mt-1">
                {result.slideCount} slides · Flip morph enabled
              </p>
            </div>
          )}
          <DialogFooter className="gap-2">
            <Button variant="outline" size="sm" onClick={handleReset}>
              Crawl another
            </Button>
            {result && (
              <Button size="sm" asChild>
                <Link href={`/player?id=${result.id}`}>
                  <Play className="w-3.5 h-3.5 mr-1" /> Play
                </Link>
              </Button>
            )}
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
}

"use client";

import { useState, useEffect } from "react";
import Link from "next/link";
import { Play } from "lucide-react";
import { Card, CardContent, CardFooter, CardHeader } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import type { PresentationMeta } from "@/hooks/use-presentation-list";

const SOURCE_TYPE_STYLES: Record<string, string> = {
  pdf: "bg-red-500/10 text-red-400 border-red-500/20",
  url: "bg-blue-500/10 text-blue-400 border-blue-500/20",
  md: "bg-teal-500/10 text-teal-400 border-teal-500/20",
  txt: "bg-zinc-500/10 text-zinc-400 border-zinc-500/20",
};

function CardSkeleton() {
  return (
    <div className="rounded-xl border border-border p-4 space-y-3">
      <div className="flex gap-2"><Skeleton className="h-5 w-12 rounded" /><Skeleton className="h-5 w-16 rounded" /></div>
      <Skeleton className="h-4 w-full rounded" />
      <Skeleton className="h-3 w-2/3 rounded" />
    </div>
  );
}

export function RecentPresentations() {
  const [presentations, setPresentations] = useState<PresentationMeta[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetch("/api/presentations")
      .then((r) => r.json())
      .then((data) => {
        const items = Array.isArray(data) ? data : (data.presentations ?? []);
        setPresentations(items.slice(0, 3));
      })
      .catch(() => {})
      .finally(() => setLoading(false));
  }, []);

  if (loading) {
    return (
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        {[...Array(3)].map((_, i) => <CardSkeleton key={i} />)}
      </div>
    );
  }

  if (presentations.length === 0) {
    return (
      <Card>
        <CardContent className="py-10 text-center">
          <p className="text-sm text-muted-foreground">No presentations yet.</p>
          <Button size="sm" asChild className="mt-4">
            <Link href="/workspace">Generate your first deck</Link>
          </Button>
        </CardContent>
      </Card>
    );
  }

  return (
    <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
      {presentations.map((item) => {
        const sourceStyle = SOURCE_TYPE_STYLES[item.sourceType] ?? SOURCE_TYPE_STYLES.txt;
        return (
          <Card key={item.id} className="group hover:border-border/80 transition-all">
            <CardHeader className="pb-3">
              <div className="flex items-center justify-between gap-2">
                <div className="flex gap-2 flex-wrap">
                  <span className={`inline-flex items-center rounded-md border px-2 py-0.5 text-xs font-semibold ${sourceStyle}`}>
                    {item.sourceType.toUpperCase()}
                  </span>
                  <Badge variant="outline" className="text-xs">{item.audienceType}</Badge>
                </div>
                <span className="text-xs text-muted-foreground tabular-nums shrink-0">
                  {new Date(item.generatedAt).toLocaleDateString()}
                </span>
              </div>
            </CardHeader>
            <CardContent className="pb-3">
              <p className="font-medium text-sm leading-snug line-clamp-2">{item.title}</p>
              <p className="text-xs text-muted-foreground mt-1 truncate">{item.sourceName}</p>
            </CardContent>
            <CardFooter className="pt-0 flex items-center justify-between">
              <span className="text-xs text-muted-foreground">{item.slideCount} slides</span>
              <Button size="sm" variant="ghost" asChild className="h-7 px-2 gap-1.5 text-xs">
                <Link href={`/player?id=${item.id}`}>
                  <Play className="w-3 h-3" /> Play
                </Link>
              </Button>
            </CardFooter>
          </Card>
        );
      })}
    </div>
  );
}

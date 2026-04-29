"use client";

import Link from "next/link";
import { Play } from "lucide-react";
import { Card, CardHeader, CardContent, CardFooter } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import type { PresentationMeta } from "@/hooks/use-presentation-list";

const SOURCE_TYPE_STYLES: Record<string, string> = {
  pdf: "bg-red-500/10 text-red-400 border-red-500/20",
  url: "bg-blue-500/10 text-blue-400 border-blue-500/20",
  md: "bg-teal-500/10 text-teal-400 border-teal-500/20",
  txt: "bg-zinc-500/10 text-zinc-400 border-zinc-500/20",
};

export function PresentationCard({ item }: { item: PresentationMeta }) {
  const sourceStyle = SOURCE_TYPE_STYLES[item.sourceType] ?? SOURCE_TYPE_STYLES.txt;

  return (
    <Card className="group hover:border-border/80 transition-all">
      <CardHeader className="pb-3">
        <div className="flex items-start justify-between gap-2">
          <div className="flex items-center gap-2 flex-wrap">
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
            <Play className="w-3 h-3" />
            Play
          </Link>
        </Button>
      </CardFooter>
    </Card>
  );
}

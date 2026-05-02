"use client";

import { useMemo } from "react";
import Link from "next/link";
import { FileStack, Plus } from "lucide-react";
import { usePresentationList } from "@/hooks/use-presentation-list";
import { PresentationCard } from "./presentation-card";
import { FilterBar } from "./filter-bar";
import { Skeleton } from "@/components/ui/skeleton";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";

function CardSkeleton() {
  return (
    <div className="rounded-xl border border-border p-4 space-y-3">
      <div className="flex items-center justify-between">
        <div className="flex gap-2">
          <Skeleton className="h-5 w-12 rounded-md" />
          <Skeleton className="h-5 w-16 rounded-md" />
        </div>
        <Skeleton className="h-4 w-20 rounded" />
      </div>
      <Skeleton className="h-4 w-full rounded" />
      <Skeleton className="h-3 w-2/3 rounded" />
      <div className="flex items-center justify-between pt-1">
        <Skeleton className="h-3 w-14 rounded" />
        <Skeleton className="h-7 w-14 rounded" />
      </div>
    </div>
  );
}

export function LibraryContent() {
  const { presentations, filteredPresentations, loading, error, refetch, filters, setFilters, hasActiveFilters, clearFilters } = usePresentationList();

  const audienceOptions = useMemo(
    () => [...new Set(presentations.map((p) => p.audienceType))].sort(),
    [presentations]
  );
  const presetOptions = useMemo(
    () => [...new Set(presentations.map((p) => p.stylePreset))].sort(),
    [presentations]
  );

  if (error) {
    return (
      <Card className="p-8 text-center">
        <p className="text-sm text-destructive">{error}</p>
      </Card>
    );
  }

  return (
    <div className="space-y-5">
      <div className="flex items-center justify-between gap-4 flex-wrap">
        <FilterBar
          filters={filters}
          onChange={(patch) => setFilters((prev) => ({ ...prev, ...patch }))}
          hasActiveFilters={hasActiveFilters}
          onClear={clearFilters}
          audienceOptions={audienceOptions}
          presetOptions={presetOptions}
        />
        {!loading && (
          <p className="text-xs text-muted-foreground shrink-0">
            {filteredPresentations.length} of {presentations.length} decks
          </p>
        )}
      </div>

      {loading ? (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
          {Array.from({ length: 6 }).map((_, i) => <CardSkeleton key={i} />)}
        </div>
      ) : filteredPresentations.length === 0 ? (
        <Card>
          <CardContent className="flex flex-col items-center justify-center py-16 text-center gap-4">
            <div className="w-12 h-12 rounded-xl bg-muted flex items-center justify-center">
              <FileStack className="w-5 h-5 text-muted-foreground" />
            </div>
            <div>
              <p className="text-sm font-medium">
                {hasActiveFilters ? "No decks match your filters" : "No presentations yet"}
              </p>
              <p className="text-xs text-muted-foreground mt-1">
                {hasActiveFilters ? "Try clearing filters" : "Upload a document to generate your first deck"}
              </p>
            </div>
            {!hasActiveFilters && (
              <Button size="sm" asChild>
                <Link href="/workspace">
                  <Plus className="w-3.5 h-3.5 mr-1" /> New Deck
                </Link>
              </Button>
            )}
            {hasActiveFilters && (
              <Button size="sm" variant="outline" onClick={clearFilters}>Clear filters</Button>
            )}
          </CardContent>
        </Card>
      ) : (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
          {filteredPresentations.map((item) => (
            <PresentationCard key={item.id} item={item} onDeleted={refetch} />
          ))}
        </div>
      )}
    </div>
  );
}

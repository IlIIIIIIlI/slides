"use client";

import { X } from "lucide-react";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import type { PresentationFilters } from "@/hooks/use-presentation-list";

interface FilterBarProps {
  filters: PresentationFilters;
  onChange: (f: Partial<PresentationFilters>) => void;
  hasActiveFilters: boolean;
  onClear: () => void;
  audienceOptions: string[];
  presetOptions: string[];
}

export function FilterBar({ filters, onChange, hasActiveFilters, onClear, audienceOptions, presetOptions }: FilterBarProps) {
  return (
    <div className="flex flex-wrap items-center gap-2">
      <Input
        placeholder="Search decks..."
        value={filters.search}
        onChange={(e) => onChange({ search: e.target.value })}
        className="max-w-[200px] h-8 text-sm"
      />

      <Select value={filters.sourceType || "all"} onValueChange={(v) => onChange({ sourceType: v === "all" ? "" : v })}>
        <SelectTrigger className="w-[120px] h-8 text-sm">
          <SelectValue placeholder="Source" />
        </SelectTrigger>
        <SelectContent>
          <SelectItem value="all">All sources</SelectItem>
          <SelectItem value="pdf">PDF</SelectItem>
          <SelectItem value="url">URL</SelectItem>
          <SelectItem value="md">Markdown</SelectItem>
          <SelectItem value="txt">Text</SelectItem>
        </SelectContent>
      </Select>

      {audienceOptions.length > 0 && (
        <Select value={filters.audienceType || "all"} onValueChange={(v) => onChange({ audienceType: v === "all" ? "" : v })}>
          <SelectTrigger className="w-[130px] h-8 text-sm">
            <SelectValue placeholder="Audience" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All audiences</SelectItem>
            {audienceOptions.map((a) => <SelectItem key={a} value={a}>{a}</SelectItem>)}
          </SelectContent>
        </Select>
      )}

      {presetOptions.length > 0 && (
        <Select value={filters.stylePreset || "all"} onValueChange={(v) => onChange({ stylePreset: v === "all" ? "" : v })}>
          <SelectTrigger className="w-[140px] h-8 text-sm">
            <SelectValue placeholder="Style" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All styles</SelectItem>
            {presetOptions.map((p) => <SelectItem key={p} value={p}>{p}</SelectItem>)}
          </SelectContent>
        </Select>
      )}

      <Select value={filters.sortOrder} onValueChange={(v) => onChange({ sortOrder: v as PresentationFilters["sortOrder"] })}>
        <SelectTrigger className="w-[110px] h-8 text-sm">
          <SelectValue />
        </SelectTrigger>
        <SelectContent>
          <SelectItem value="newest">Newest</SelectItem>
          <SelectItem value="oldest">Oldest</SelectItem>
          <SelectItem value="title">A → Z</SelectItem>
        </SelectContent>
      </Select>

      {hasActiveFilters && (
        <Button variant="ghost" size="sm" onClick={onClear} className="h-8 px-2 gap-1 text-xs text-muted-foreground">
          <X className="w-3 h-3" /> Clear
        </Button>
      )}
    </div>
  );
}

"use client";

import { useState, useEffect, useMemo, useCallback } from "react";

export interface PresentationMeta {
  id: string;
  title: string;
  sourceName: string;
  sourceType: "pdf" | "url" | "md" | "txt";
  audienceType: string;
  stylePreset: string;
  slideCount: number;
  generatedAt: string;
}

export interface PresentationFilters {
  sourceType: string;
  audienceType: string;
  stylePreset: string;
  sortOrder: "newest" | "oldest" | "title";
  search: string;
}

const DEFAULT_FILTERS: PresentationFilters = {
  sourceType: "",
  audienceType: "",
  stylePreset: "",
  sortOrder: "newest",
  search: "",
};

export function usePresentationList() {
  const [presentations, setPresentations] = useState<PresentationMeta[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [filters, setFilters] = useState<PresentationFilters>(DEFAULT_FILTERS);

  const fetchPresentations = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const res = await fetch("/api/presentations");
      if (!res.ok) throw new Error("Failed to load presentations");
      const data = await res.json();
      setPresentations(data.presentations ?? []);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Unknown error");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchPresentations();
  }, [fetchPresentations]);

  const filteredPresentations = useMemo(() => {
    let result = [...presentations];

    if (filters.search) {
      const q = filters.search.toLowerCase();
      result = result.filter(
        (p) =>
          p.title.toLowerCase().includes(q) ||
          p.sourceName.toLowerCase().includes(q)
      );
    }
    if (filters.sourceType) {
      result = result.filter((p) => p.sourceType === filters.sourceType);
    }
    if (filters.audienceType) {
      result = result.filter((p) => p.audienceType === filters.audienceType);
    }
    if (filters.stylePreset) {
      result = result.filter((p) => p.stylePreset === filters.stylePreset);
    }

    result.sort((a, b) => {
      if (filters.sortOrder === "newest") {
        return new Date(b.generatedAt).getTime() - new Date(a.generatedAt).getTime();
      } else if (filters.sortOrder === "oldest") {
        return new Date(a.generatedAt).getTime() - new Date(b.generatedAt).getTime();
      } else {
        return a.title.localeCompare(b.title);
      }
    });

    return result;
  }, [presentations, filters]);

  const hasActiveFilters =
    !!filters.search ||
    !!filters.sourceType ||
    !!filters.audienceType ||
    !!filters.stylePreset;

  return {
    presentations,
    filteredPresentations,
    loading,
    error,
    refetch: fetchPresentations,
    filters,
    setFilters,
    hasActiveFilters,
    clearFilters: () => setFilters(DEFAULT_FILTERS),
  };
}

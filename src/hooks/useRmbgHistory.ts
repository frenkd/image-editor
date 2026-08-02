import { useCallback, useEffect, useRef, useState } from "react";
import type { Rect } from "../lib/cropMath";
import {
  blobFromSrc,
  deleteHistoryItem,
  listHistoryItems,
  newHistoryId,
  putHistoryItem,
  RMBG_HISTORY_MAX,
  updateHistoryColors,
  updateHistoryCrop,
  type ColorMode,
  type StoredCrop,
  type StoredHistoryItem,
} from "../lib/rmbgHistory";

type HistoryEntry = {
  id: string;
  createdAt: number;
  sourceUrl: string;
  cutoutUrl: string;
  colorMode: ColorMode;
  customColor: string;
  crop: Rect | null;
};

function normalizeCrop(crop: StoredCrop | null | undefined): Rect | null {
  if (!crop) return null;
  if (
    ![crop.x, crop.y, crop.width, crop.height].every((n) => Number.isFinite(n))
  ) {
    return null;
  }
  return {
    x: crop.x,
    y: crop.y,
    width: crop.width,
    height: crop.height,
  };
}

function toEntry(item: StoredHistoryItem): HistoryEntry {
  return {
    id: item.id,
    createdAt: item.createdAt,
    sourceUrl: URL.createObjectURL(item.source),
    cutoutUrl: URL.createObjectURL(item.cutout),
    colorMode: item.colorMode,
    customColor: item.customColor,
    crop: normalizeCrop(item.crop),
  };
}

function revokeEntry(entry: HistoryEntry) {
  URL.revokeObjectURL(entry.sourceUrl);
  URL.revokeObjectURL(entry.cutoutUrl);
}

export function useRmbgHistory() {
  const [entries, setEntries] = useState<HistoryEntry[]>([]);
  const [activeId, setActiveId] = useState<string | null>(null);
  const [hydrated, setHydrated] = useState(false);
  const entriesRef = useRef<HistoryEntry[]>([]);
  entriesRef.current = entries;

  useEffect(() => {
    let cancelled = false;
    listHistoryItems()
      .then((items) => {
        if (cancelled) return;
        const next = items.map(toEntry);
        setEntries(next);
        setActiveId(next[0]?.id ?? null);
        setHydrated(true);
      })
      .catch(() => {
        if (!cancelled) setHydrated(true);
      });

    return () => {
      cancelled = true;
      for (const entry of entriesRef.current) revokeEntry(entry);
    };
  }, []);

  const active = entries.find((e) => e.id === activeId) ?? null;

  const addEntry = useCallback(
    async (input: {
      sourceSrc: string;
      cutoutSrc: string;
      colorMode: ColorMode;
      customColor: string;
    }) => {
      const [source, cutout] = await Promise.all([
        blobFromSrc(input.sourceSrc),
        blobFromSrc(input.cutoutSrc),
      ]);
      const stored: StoredHistoryItem = {
        id: newHistoryId(),
        createdAt: Date.now(),
        source,
        cutout,
        colorMode: input.colorMode,
        customColor: input.customColor,
        crop: null,
      };
      await putHistoryItem(stored);
      const entry = toEntry(stored);

      setEntries((prev) => {
        const next = [entry, ...prev];
        while (next.length > RMBG_HISTORY_MAX) {
          const dropped = next.pop();
          if (dropped) revokeEntry(dropped);
        }
        return next;
      });
      setActiveId(entry.id);
      return entry;
    },
    [],
  );

  const replaceActiveCutout = useCallback(
    async (
      cutoutSrc: string,
      colors?: { colorMode: ColorMode; customColor: string },
    ) => {
      const current = entriesRef.current.find((e) => e.id === activeId);
      if (!current) return;
      const [source, cutout] = await Promise.all([
        blobFromSrc(current.sourceUrl),
        blobFromSrc(cutoutSrc),
      ]);
      const stored: StoredHistoryItem = {
        id: current.id,
        createdAt: current.createdAt,
        source,
        cutout,
        colorMode: colors?.colorMode ?? current.colorMode,
        customColor: colors?.customColor ?? current.customColor,
        crop: null,
      };
      await putHistoryItem(stored);
      const nextEntry = toEntry(stored);
      setEntries((prev) =>
        prev.map((e) => {
          if (e.id !== current.id) return e;
          revokeEntry(e);
          return nextEntry;
        }),
      );
    },
    [activeId],
  );

  const setActiveCrop = useCallback(
    (crop: Rect | null) => {
      if (!activeId) return;
      setEntries((prev) =>
        prev.map((e) => (e.id === activeId ? { ...e, crop } : e)),
      );
      void updateHistoryCrop(activeId, crop);
    },
    [activeId],
  );

  const select = useCallback((id: string) => {
    setActiveId(id);
  }, []);

  const remove = useCallback(async (id: string) => {
    await deleteHistoryItem(id);
    setEntries((prev) => {
      const target = prev.find((e) => e.id === id);
      if (target) revokeEntry(target);
      return prev.filter((e) => e.id !== id);
    });
    setActiveId((cur) => {
      if (cur !== id) return cur;
      const remaining = entriesRef.current.filter((e) => e.id !== id);
      return remaining[0]?.id ?? null;
    });
  }, []);

  const setActiveColors = useCallback(
    (colorMode: ColorMode, customColor: string) => {
      if (!activeId) return;
      setEntries((prev) =>
        prev.map((e) =>
          e.id === activeId ? { ...e, colorMode, customColor } : e,
        ),
      );
      void updateHistoryColors(activeId, colorMode, customColor);
    },
    [activeId],
  );

  return {
    hydrated,
    entries,
    active,
    activeId,
    select,
    addEntry,
    replaceActiveCutout,
    setActiveCrop,
    remove,
    setActiveColors,
  };
}

import type { VisibilityState } from "@tanstack/react-table";
import { useMemo } from "react";
import { cn } from "@/lib/utils";

interface TableColumn {
  id: string;
  getIsVisible: () => boolean;
}

interface TableInterface {
  getAllLeafColumns: () => TableColumn[];
}

interface UseStickyColumnsProps {
  columnVisibility?: VisibilityState;
  table?: TableInterface;
  loading?: boolean;
  stickyColumns?: string[];
  columnWidths?: Record<string, number>;
}

const DEFAULT_COLUMN_WIDTHS: Record<string, number> = {
  select: 50,
  date: 110,
  invoiceNumber: 130,
  name: 200,
  email: 200,
  status: 100,
  amount: 120,
};

export function useStickyColumns({
  columnVisibility,
  table,
  loading,
  stickyColumns = ["select"],
  columnWidths = DEFAULT_COLUMN_WIDTHS,
}: UseStickyColumnsProps) {
  const isVisible = (id: string) =>
    loading ||
    table
      ?.getAllLeafColumns()
      .find((col) => col.id === id)
      ?.getIsVisible() ||
    (columnVisibility && columnVisibility[id] !== false);

  const stickyPositions = useMemo(() => {
    let position = 0;
    const positions: Record<string, number> = {};

    for (const columnId of stickyColumns) {
      if (isVisible(columnId)) {
        positions[columnId] = position;
        position += columnWidths[columnId] || 100;
      }
    }

    return positions;
  }, [stickyColumns, columnWidths, isVisible]);

  const getStickyStyle = (columnId: string) => {
    const position = stickyPositions[columnId];
    return position !== undefined
      ? ({ "--sticky-left": `${position}px` } as React.CSSProperties)
      : {};
  };

  const getStickyClassName = (columnId: string, baseClassName?: string) => {
    const isSticky = stickyColumns.includes(columnId);
    return cn(baseClassName, isSticky && "md:sticky md:left-[var(--sticky-left)] md:z-10");
  };

  return {
    stickyPositions,
    getStickyStyle,
    getStickyClassName,
    isVisible,
  };
}

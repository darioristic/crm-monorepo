"use client";

import { useQuery, useQueryClient } from "@tanstack/react-query";
import { flexRender, getCoreRowModel, useReactTable } from "@tanstack/react-table";
import { AnimatePresence } from "framer-motion";
import { useEffect, useMemo, useRef, useState } from "react";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { NoResults } from "@/components/vault/empty-states";
import { VaultGetStarted } from "@/components/vault/vault-get-started";
import { VaultGridSkeleton } from "@/components/vault/vault-grid-skeleton";
import { useAuth } from "@/contexts/auth-context";
import { useDocumentFilterParams } from "@/hooks/use-document-filter-params";
import { useDocumentParams } from "@/hooks/use-document-params";
import { type DocumentWithTags, documentsApi } from "@/lib/api";
import { useDocumentsStore } from "@/store/vault-store";
import { BottomBar } from "./bottom-bar";
import { columns } from "./columns";
import { TablePagination } from "./table-pagination";

export function DataTable() {
  const _queryClient = useQueryClient();
  const { filter, hasFilters } = useDocumentFilterParams();
  const { setParams } = useDocumentParams();
  const { rowSelection, setRowSelection, clearSelection } = useDocumentsStore();
  const { user } = useAuth();

  // Pagination state
  const [page, setPage] = useState(1);
  const [pageSize, setPageSize] = useState(20);
  const prevFilterRef = useRef(filter);

  // Reset page when filters change
  useEffect(() => {
    if (JSON.stringify(prevFilterRef.current) !== JSON.stringify(filter)) {
      setPage(1);
      prevFilterRef.current = filter;
    }
  }, [filter]);

  // Calculate cursor from page
  const cursor = page > 1 ? ((page - 1) * pageSize).toString() : undefined;

  // Use semantic search when enabled and there's a query
  const useSemanticSearch = Boolean(filter.semantic && filter.q && filter.q.length >= 2);

  // Regular documents query
  const regularQuery = useQuery({
    queryKey: ["documents", filter, user?.companyId, page, pageSize],
    queryFn: async () => {
      const response = await documentsApi.getAll({
        pageSize,
        cursor,
        q: filter.q ?? undefined,
        tags: filter.tags ?? undefined,
        start: filter.start ?? undefined,
        end: filter.end ?? undefined,
      });
      return response.data;
    },
    enabled: !useSemanticSearch,
  });

  // Semantic search query
  const semanticQuery = useQuery({
    queryKey: ["documents-semantic", filter.q, pageSize],
    queryFn: async () => {
      const response = await documentsApi.semanticSearch(filter.q!, { limit: pageSize });
      return response.data;
    },
    enabled: useSemanticSearch,
  });

  const data = useSemanticSearch ? semanticQuery.data : regularQuery.data;
  const isFetching = useSemanticSearch ? semanticQuery.isFetching : regularQuery.isFetching;
  const isLoading = useSemanticSearch ? semanticQuery.isLoading : regularQuery.isLoading;

  const documents: DocumentWithTags[] = useMemo(() => {
    if (useSemanticSearch) {
      const arr = semanticQuery.data ?? [];
      return Array.isArray(arr) ? (arr as DocumentWithTags[]) : [];
    }
    const arr = regularQuery.data?.data ?? [];
    return Array.isArray(arr) ? (arr as DocumentWithTags[]) : [];
  }, [semanticQuery.data, regularQuery.data, useSemanticSearch]);

  const meta = useSemanticSearch
    ? {
        totalCount: documents.length,
        page: 1,
        pageSize,
        totalPages: 1,
        hasNextPage: false,
        hasPreviousPage: false,
      }
    : ((data as typeof regularQuery.data)?.meta ?? {
        totalCount: 0,
        page: 1,
        pageSize: 20,
        totalPages: 0,
        hasNextPage: false,
        hasPreviousPage: false,
      });

  const table = useReactTable({
    data: documents,
    columns,
    getCoreRowModel: getCoreRowModel(),
    onRowSelectionChange: setRowSelection,
    state: {
      rowSelection,
    },
    getRowId: (row) => row.id,
  });

  const selectedDocumentIds = Object.keys(rowSelection).filter((key) => rowSelection[key]);

  const handlePageChange = (newPage: number) => {
    setPage(newPage);
    clearSelection();
  };

  const handlePageSizeChange = (newPageSize: number) => {
    setPageSize(newPageSize);
    setPage(1); // Reset to first page when changing page size
    clearSelection();
  };

  if (isLoading) {
    return <VaultGridSkeleton />;
  }

  if (hasFilters && !documents?.length) {
    return <NoResults />;
  }

  if (!documents?.length && !isFetching) {
    return <VaultGetStarted />;
  }

  return (
    <div className="relative">
      <div className="rounded-md border">
        <Table>
          <TableHeader>
            {table.getHeaderGroups().map((headerGroup) => (
              <TableRow key={headerGroup.id}>
                {headerGroup.headers.map((header) => (
                  <TableHead key={header.id}>
                    {header.isPlaceholder
                      ? null
                      : flexRender(header.column.columnDef.header, header.getContext())}
                  </TableHead>
                ))}
              </TableRow>
            ))}
          </TableHeader>
          <TableBody>
            {table.getRowModel().rows?.length ? (
              table.getRowModel().rows.map((row) => (
                <TableRow
                  key={row.id}
                  data-state={row.getIsSelected() && "selected"}
                  className="cursor-pointer"
                  onClick={() => setParams({ documentId: row.original.id })}
                  draggable
                  onDragStart={(e) => {
                    e.dataTransfer.setData("application/x-document-id", row.original.id);
                    e.dataTransfer.setData(
                      "application/x-document-title",
                      row.original.title || row.original.name || "Document"
                    );
                    e.dataTransfer.effectAllowed = "link";
                  }}
                >
                  {row.getVisibleCells().map((cell) => (
                    <TableCell
                      key={cell.id}
                      onClick={(e) => {
                        if (cell.column.id === "select" || cell.column.id === "actions") {
                          e.stopPropagation();
                        }
                      }}
                    >
                      {flexRender(cell.column.columnDef.cell, cell.getContext())}
                    </TableCell>
                  ))}
                </TableRow>
              ))
            ) : (
              <TableRow>
                <TableCell colSpan={columns.length} className="h-24 text-center">
                  No results.
                </TableCell>
              </TableRow>
            )}
          </TableBody>
        </Table>
      </div>

      {/* Pagination */}
      <TablePagination
        page={meta.page}
        pageSize={meta.pageSize}
        totalCount={meta.totalCount}
        totalPages={meta.totalPages}
        onPageChange={handlePageChange}
        onPageSizeChange={handlePageSizeChange}
        isLoading={isFetching}
      />

      {/* Bottom bar for selection actions */}
      <AnimatePresence>
        {selectedDocumentIds.length > 0 && <BottomBar data={selectedDocumentIds} />}
      </AnimatePresence>
    </div>
  );
}

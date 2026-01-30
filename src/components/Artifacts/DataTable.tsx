
import React from 'react';
import {
  useReactTable,
  getCoreRowModel,
  getSortedRowModel,
  getPaginationRowModel,
  flexRender,
  SortingState,
} from '@tanstack/react-table';

type DataTableProps = {
  data: any[];
};

export const DataTable: React.FC<DataTableProps> = ({ data }) => {
  const [sorting, setSorting] = React.useState<SortingState>([]);

  // Dynamically generate columns from the first row of data
  const columns = React.useMemo(() => {
    if (data.length === 0) return [];
    return Object.keys(data[0]).map(key => ({
      accessorKey: key,
      header: key,
      cell: (info: any) => String(info.getValue()),
    }));
  }, [data]);

  const table = useReactTable({
    data,
    columns,
    state: { sorting },
    onSortingChange: setSorting,
    getCoreRowModel: getCoreRowModel(),
    getSortedRowModel: getSortedRowModel(),
    getPaginationRowModel: getPaginationRowModel(),
  });

  return (
    <div className="w-full overflow-hidden flex flex-col h-full bg-white dark:bg-[#1e1e1e] rounded-lg border border-gray-200 dark:border-white/5">
      <div className="flex-1 overflow-auto custom-scrollbar">
        <table className="min-w-full text-sm text-left">
          <thead className="bg-gray-50 dark:bg-white/5 sticky top-0 z-10 border-b border-gray-200 dark:border-white/5">
            {table.getHeaderGroups().map(headerGroup => (
              <tr key={headerGroup.id}>
                {headerGroup.headers.map(header => (
                  <th
                    key={header.id}
                    className="px-4 py-3 font-semibold text-gray-700 dark:text-gray-200 cursor-pointer hover:bg-gray-100 dark:hover:bg-white/10 transition-colors"
                    onClick={header.column.getToggleSortingHandler()}
                  >
                    <div className="flex items-center gap-1">
                      {flexRender(header.column.columnDef.header, header.getContext())}
                      {{
                        asc: ' 🔼',
                        desc: ' 🔽',
                      }[header.column.getIsSorted() as string] ?? null}
                    </div>
                  </th>
                ))}
              </tr>
            ))}
          </thead>
          <tbody className="divide-y divide-gray-100 dark:divide-white/5">
            {table.getRowModel().rows.map(row => (
              <tr key={row.id} className="hover:bg-gray-50/50 dark:hover:bg-white/[0.02]">
                {row.getVisibleCells().map(cell => (
                  <td key={cell.id} className="px-4 py-2.5 text-gray-600 dark:text-gray-400 whitespace-nowrap">
                    {flexRender(cell.column.columnDef.cell, cell.getContext())}
                  </td>
                ))}
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      
      {/* Pagination */}
      <div className="p-3 border-t border-gray-200 dark:border-white/5 flex items-center justify-between bg-gray-50 dark:bg-white/5">
        <div className="flex items-center gap-2">
           <button
            className="px-3 py-1 text-xs border rounded hover:bg-gray-100 dark:border-white/10 dark:hover:bg-white/10 disabled:opacity-50"
            onClick={() => table.previousPage()}
            disabled={!table.getCanPreviousPage()}
          >
            Previous
          </button>
          <span className="text-xs text-gray-500 dark:text-gray-400">
            Page {table.getState().pagination.pageIndex + 1} of {table.getPageCount()}
          </span>
          <button
            className="px-3 py-1 text-xs border rounded hover:bg-gray-100 dark:border-white/10 dark:hover:bg-white/10 disabled:opacity-50"
            onClick={() => table.nextPage()}
            disabled={!table.getCanNextPage()}
          >
            Next
          </button>
        </div>
        <span className="text-xs text-gray-500 dark:text-gray-400">
            {data.length} rows
        </span>
      </div>
    </div>
  );
};

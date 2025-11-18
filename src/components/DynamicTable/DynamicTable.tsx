import React, { useState, useMemo, useCallback, useEffect } from 'react';
import { invoke } from '@tauri-apps/api/tauri';
import { useSchema } from '../../contexts/SchemaContext';
import { useTheme } from '../../contexts/ThemeContext';
import { useNotifications } from '../../contexts/NotificationContext';
import TableHeader from './TableHeader';
import TableBody from './TableBody';
import TableFooter from './TableFooter';
import TableFilters from './TableFilters';
import ColumnSelector from './ColumnSelector';
import BulkActions from './BulkActions';
import { 
  TableColumn, 
  TableConfig, 
  SortConfig, 
  FilterConfig,
  BulkAction 
} from '../../types/table';

// Types
interface DynamicTableProps {
  entityName: string;
  data: any[];
  onEdit?: (item: any) => void;
  onDelete?: (id: number) => void;
  onView?: (item: any) => void;
  onSelectionChange?: (selectedIds: number[]) => void;
  config?: Partial<TableConfig>;
}

// Default table configuration
const DEFAULT_TABLE_CONFIG: TableConfig = {
  pagination: {
    enabled: true,
    pageSize: 50,
    pageSizeOptions: [10, 25, 50, 100]
  },
  sorting: {
    enabled: true,
    multiSort: false
  },
  filtering: {
    enabled: true,
    quickFilter: true,
    advancedFilter: true
  },
  selection: {
    enabled: true,
    selectAll: true
  },
  virtualization: {
    enabled: true,
    overscan: 10
  },
  columns: {
    resizable: true,
    reorderable: true,
    hideable: true
  },
  actions: {
    edit: true,
    delete: true,
    view: true,
    duplicate: true,
    export: true
  }
};

const DynamicTable: React.FC<DynamicTableProps> = ({
  entityName,
  data,
  onEdit,
  onDelete,
  onView,
  onSelectionChange,
  config = {}
}) => {
  // Merge default config with provided config
  const tableConfig = useMemo((): TableConfig => ({
    ...DEFAULT_TABLE_CONFIG,
    ...config
  }), [config]);

  // Context hooks
  const { getSchema } = useSchema();
  const { isRTL } = useTheme();
  const { showNotification } = useNotifications();

  // State management
  const [schema, setSchema] = useState<any>(null);
  const [columns, setColumns] = useState<TableColumn[]>([]);
  const [visibleColumns, setVisibleColumns] = useState<Set<string>>(new Set());
  const [sortConfig, setSortConfig] = useState<SortConfig>({});
  const [filterConfig, setFilterConfig] = useState<FilterConfig>({});
  const [currentPage, setCurrentPage] = useState(1);
  const [pageSize, setPageSize] = useState(tableConfig.pagination.pageSize);
  const [selectedRows, setSelectedRows] = useState<Set<number>>(new Set());
  const [bulkActionProgress, setBulkActionProgress] = useState<number>(0);
  const [isLoading, setIsLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState('');

  // Load schema and initialize columns
  useEffect(() => {
    initializeTable();
  }, [entityName]);

  const initializeTable = async () => {
    try {
      setIsLoading(true);
      const entitySchema = await getSchema(entityName);
      setSchema(entitySchema);

      // Initialize columns from schema
      const tableColumns = initializeColumns(entitySchema);
      setColumns(tableColumns);

      // Set initially visible columns
      const initialVisibleColumns = new Set(
        tableColumns
          .filter(col => !col.hidden)
          .map(col => col.key)
      );
      setVisibleColumns(initialVisibleColumns);

    } catch (error) {
      console.error('Error initializing table:', error);
      showNotification('error', `Failed to load table: ${error}`);
    } finally {
      setIsLoading(false);
    }
  };

  // Initialize columns from schema
  const initializeColumns = (schema: any): TableColumn[] => {
    if (!schema?.fields) return [];

    return schema.fields.map((field: any) => ({
      key: field.name,
      title: field.ui?.label || field.name,
      dataType: field.type,
      sortable: tableConfig.sorting.enabled && field.ui?.sortable !== false,
      filterable: tableConfig.filtering.enabled && field.ui?.filterable !== false,
      resizable: tableConfig.columns.resizable,
      width: field.ui?.width || 'auto',
      minWidth: field.ui?.minWidth || 100,
      maxWidth: field.ui?.maxWidth || 400,
      hidden: field.ui?.hidden || false,
      align: field.ui?.align || 'left',
      render: (value: any, row: any) => renderCell(value, field.type, row),
      // Additional metadata
      fieldConfig: field
    }));
  };

  // Cell rendering with advanced formatting
  const renderCell = useCallback((value: any, dataType: string, row: any) => {
    if (value === null || value === undefined) {
      return (
        <span className="text-gray-400 dark:text-gray-500 italic">-</span>
      );
    }

    switch (dataType) {
      case 'date':
        return (
          <span className="text-gray-700 dark:text-gray-300">
            {new Date(value).toLocaleDateString()}
          </span>
        );

      case 'datetime':
        return (
          <span className="text-gray-700 dark:text-gray-300">
            {new Date(value).toLocaleString()}
          </span>
        );

      case 'number':
        return (
          <span className="text-right font-mono text-gray-800 dark:text-gray-200">
            {typeof value === 'number' ? value.toLocaleString() : value}
          </span>
        );

      case 'currency':
        return (
          <span className={`text-right font-mono ${
            Number(value) >= 0 
              ? 'text-green-600 dark:text-green-400' 
              : 'text-red-600 dark:text-red-400'
          }`}>
            ${typeof value === 'number' ? Math.abs(value).toLocaleString(undefined, {
              minimumFractionDigits: 2,
              maximumFractionDigits: 2
            }) : value}
            {Number(value) < 0 && ' (-)'}
          </span>
        );

      case 'boolean':
        return (
          <div className="flex justify-center">
            <span className={`inline-flex items-center px-2 py-1 rounded-full text-xs font-medium ${
              value 
                ? 'bg-green-100 text-green-800 dark:bg-green-900 dark:text-green-200' 
                : 'bg-red-100 text-red-800 dark:bg-red-900 dark:text-red-200'
            }`}>
              {value ? '✓ Yes' : '✗ No'}
            </span>
          </div>
        );

      case 'image':
        return value ? (
          <div className="flex justify-center">
            <img 
              src={`file://${value}`} 
              alt=""
              className="w-12 h-12 object-cover rounded cursor-pointer hover:opacity-80 transition-opacity"
              onClick={() => handleImagePreview(value)}
            />
          </div>
        ) : (
          <span className="text-gray-400 dark:text-gray-500 text-center">No Image</span>
        );

      case 'status':
        const statusConfig = getStatusConfig(value);
        return (
          <span className={`inline-flex items-center px-2 py-1 rounded-full text-xs font-medium ${statusConfig.className}`}>
            <span className={`w-2 h-2 rounded-full mr-2 ${statusConfig.dotClassName}`}></span>
            {statusConfig.label}
          </span>
        );

      case 'tags':
        return Array.isArray(value) ? (
          <div className="flex flex-wrap gap-1">
            {value.slice(0, 3).map((tag, index) => (
              <span 
                key={index}
                className="inline-block bg-blue-100 text-blue-800 dark:bg-blue-900 dark:text-blue-200 text-xs px-2 py-1 rounded"
              >
                {tag}
              </span>
            ))}
            {value.length > 3 && (
              <span className="inline-block bg-gray-100 text-gray-600 dark:bg-gray-700 dark:text-gray-400 text-xs px-2 py-1 rounded">
                +{value.length - 3} more
              </span>
            )}
          </div>
        ) : (
          <span className="text-gray-500">-</span>
        );

      default:
        return (
          <span className="text-gray-700 dark:text-gray-300">
            {String(value)}
          </span>
        );
    }
  }, []);

  // Status configuration helper
  const getStatusConfig = (status: string) => {
    const statusMap: Record<string, { label: string; className: string; dotClassName: string }> = {
      'open': { 
        label: 'Open', 
        className: 'bg-yellow-100 text-yellow-800 dark:bg-yellow-900 dark:text-yellow-200',
        dotClassName: 'bg-yellow-500'
      },
      'closed': { 
        label: 'Closed', 
        className: 'bg-green-100 text-green-800 dark:bg-green-900 dark:text-green-200',
        dotClassName: 'bg-green-500'
      },
      'win': { 
        label: 'Win', 
        className: 'bg-green-100 text-green-800 dark:bg-green-900 dark:text-green-200',
        dotClassName: 'bg-green-500'
      },
      'loss': { 
        label: 'Loss', 
        className: 'bg-red-100 text-red-800 dark:bg-red-900 dark:text-red-200',
        dotClassName: 'bg-red-500'
      },
      'pending': { 
        label: 'Pending', 
        className: 'bg-blue-100 text-blue-800 dark:bg-blue-900 dark:text-blue-200',
        dotClassName: 'bg-blue-500'
      }
    };

    return statusMap[status] || { 
      label: status, 
      className: 'bg-gray-100 text-gray-800 dark:bg-gray-700 dark:text-gray-300',
      dotClassName: 'bg-gray-500'
    };
  };

  // Image preview handler
  const handleImagePreview = (imagePath: string) => {
    // Implementation for image preview modal
    invoke('preview_image', { path: imagePath });
  };

    // Sorting functionality
    const handleSort = useCallback((columnKey: string, direction: 'asc' | 'desc' | null) => {
      setSortConfig(prev => {
        if (!direction) {
          const newConfig = { ...prev };
          delete newConfig[columnKey];
          return newConfig;
        }
  
        if (tableConfig.sorting.multiSort) {
          return { ...prev, [columnKey]: direction };
        } else {
          return { [columnKey]: direction };
        }
      });
    }, [tableConfig.sorting.multiSort]);
  
    // Filtering functionality
    const handleFilter = useCallback((filters: FilterConfig) => {
      setFilterConfig(filters);
      setCurrentPage(1); // Reset to first page when filtering
    }, []);
  
    // Search functionality
    const handleSearch = useCallback((query: string) => {
      setSearchQuery(query);
      setCurrentPage(1);
    }, []);
  
    // Selection functionality
    const handleSelectionChange = useCallback((rowId: number, selected: boolean) => {
      setSelectedRows(prev => {
        const newSelection = new Set(prev);
        if (selected) {
          newSelection.add(rowId);
        } else {
          newSelection.delete(rowId);
        }
        
        // Notify parent component
        onSelectionChange?.(Array.from(newSelection));
        
        return newSelection;
      });
    }, [onSelectionChange]);
  
    const handleSelectAll = useCallback((selected: boolean) => {
      if (selected) {
        const allIds = processedData.map(row => row.id).filter(Boolean) as number[];
        setSelectedRows(new Set(allIds));
        onSelectionChange?.(allIds);
      } else {
        setSelectedRows(new Set());
        onSelectionChange?.([]);
      }
    }, [processedData, onSelectionChange]);
  
    // Column management
    const handleColumnVisibilityChange = useCallback((columnKey: string, visible: boolean) => {
      setVisibleColumns(prev => {
        const newVisible = new Set(prev);
        if (visible) {
          newVisible.add(columnKey);
        } else {
          newVisible.delete(columnKey);
        }
        return newVisible;
      });
    }, []);
  
    const handleColumnReorder = useCallback((fromIndex: number, toIndex: number) => {
      setColumns(prev => {
        const newColumns = [...prev];
        const [movedColumn] = newColumns.splice(fromIndex, 1);
        newColumns.splice(toIndex, 0, movedColumn);
        return newColumns;
      });
    }, []);
  
    const handleColumnResize = useCallback((columnKey: string, newWidth: number) => {
      setColumns(prev => prev.map(col => 
        col.key === columnKey 
          ? { ...col, width: newWidth }
          : col
      ));
    }, []);
  
    // Bulk actions
    const handleBulkAction = useCallback(async (action: BulkAction, selectedIds: number[]) => {
      try {
        setBulkActionProgress(0);
        
        switch (action.type) {
          case 'delete':
            // Confirm deletion
            const confirm = await invoke<boolean>('confirm_bulk_delete', { count: selectedIds.length });
            if (!confirm) return;
  
            // Perform deletion
            for (let i = 0; i < selectedIds.length; i++) {
              await invoke('delete_trade', { id: selectedIds[i] });
              setBulkActionProgress(((i + 1) / selectedIds.length) * 100);
            }
            break;
  
          case 'update':
            // Perform bulk update
            for (let i = 0; i < selectedIds.length; i++) {
              await invoke('update_trade', { 
                id: selectedIds[i], 
                updates: action.updates 
              });
              setBulkActionProgress(((i + 1) / selectedIds.length) * 100);
            }
            break;
  
          case 'export':
            const exportPath = await invoke<string>('export_trades', { 
              ids: selectedIds,
              format: action.format || 'csv'
            });
            showNotification('success', `Exported ${selectedIds.length} trades to ${exportPath}`);
            break;
  
          case 'duplicate':
            for (let i = 0; i < selectedIds.length; i++) {
              await invoke('duplicate_trade', { id: selectedIds[i] });
              setBulkActionProgress(((i + 1) / selectedIds.length) * 100);
            }
            break;
        }
  
        // Refresh data and clear selection
        setSelectedRows(new Set());
        onSelectionChange?.([]);
        showNotification('success', `Bulk action completed successfully`);
  
      } catch (error) {
        console.error('Bulk action failed:', error);
        showNotification('error', `Bulk action failed: ${error}`);
      } finally {
        setBulkActionProgress(0);
      }
    }, [showNotification, onSelectionChange]);
  
    // Process data with sorting, filtering, and pagination
    const processedData = useMemo(() => {
      if (!data.length) return [];
  
      let processed = [...data];
  
      // Apply search filter
      if (searchQuery.trim()) {
        processed = processed.filter(row =>
          columns.some(col => {
            const value = row[col.key];
            if (value === null || value === undefined) return false;
            return String(value).toLowerCase().includes(searchQuery.toLowerCase());
          })
        );
      }
  
      // Apply column filters
      if (Object.keys(filterConfig).length > 0) {
        processed = processed.filter(row => {
          return Object.entries(filterConfig).every(([columnKey, filter]) => {
            if (!filter || !filter.value) return true;
            
            const value = row[columnKey];
            if (value === null || value === undefined) return false;
  
            switch (filter.operator) {
              case 'equals':
                return value === filter.value;
              case 'contains':
                return String(value).toLowerCase().includes(String(filter.value).toLowerCase());
              case 'greaterThan':
                return Number(value) > Number(filter.value);
              case 'lessThan':
                return Number(value) < Number(filter.value);
              case 'between':
                return Number(value) >= Number(filter.value[0]) && 
                       Number(value) <= Number(filter.value[1]);
              case 'in':
                return Array.isArray(filter.value) && filter.value.includes(value);
              default:
                return true;
            }
          });
        });
      }
  
      // Apply sorting
      if (Object.keys(sortConfig).length > 0) {
        processed.sort((a, b) => {
          for (const [columnKey, direction] of Object.entries(sortConfig)) {
            const aValue = a[columnKey];
            const bValue = b[columnKey];
            
            if (aValue === bValue) continue;
            
            let comparison = 0;
            if (aValue === null || aValue === undefined) comparison = -1;
            else if (bValue === null || bValue === undefined) comparison = 1;
            else if (typeof aValue === 'string' && typeof bValue === 'string') {
              comparison = aValue.localeCompare(bValue);
            } else {
              comparison = Number(aValue) - Number(bValue);
            }
            
            if (comparison !== 0) {
              return direction === 'desc' ? -comparison : comparison;
            }
          }
          return 0;
        });
      }
  
      return processed;
    }, [data, searchQuery, filterConfig, sortConfig, columns]);
  
    // Pagination
    const paginatedData = useMemo(() => {
      if (!tableConfig.pagination.enabled) return processedData;
      
      const startIndex = (currentPage - 1) * pageSize;
      return processedData.slice(startIndex, startIndex + pageSize);
    }, [processedData, currentPage, pageSize, tableConfig.pagination.enabled]);
  
    const totalPages = Math.ceil(processedData.length / pageSize);
  
    // Available bulk actions
    const bulkActions: BulkAction[] = useMemo(() => [
      {
        id: 'delete',
        label: 'Delete Selected',
        type: 'delete',
        icon: '🗑️',
        confirm: true,
        confirmMessage: (count) => `Are you sure you want to delete ${count} items?`
      },
      {
        id: 'export-csv',
        label: 'Export as CSV',
        type: 'export',
        icon: '📊',
        format: 'csv'
      },
      {
        id: 'export-json',
        label: 'Export as JSON',
        type: 'export',
        icon: '📋',
        format: 'json'
      },
      {
        id: 'mark-win',
        label: 'Mark as Win',
        type: 'update',
        icon: '✅',
        updates: { is_win: true }
      },
      {
        id: 'mark-loss',
        label: 'Mark as Loss',
        type: 'update',
        icon: '❌',
        updates: { is_win: false }
      },
      {
        id: 'duplicate',
        label: 'Duplicate',
        type: 'duplicate',
        icon: '📝'
      }
    ], []);
  
    // Loading state
    if (isLoading) {
      return (
        <div className="flex justify-center items-center p-8">
          <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-500"></div>
          <span className="ml-3 text-gray-600 dark:text-gray-400">Loading table...</span>
        </div>
      );
    }
  
    return (
      <div className={`dynamic-table ${isRTL ? 'rtl' : 'ltr'}`}>
        {/* Table Controls */}
        <div className="mb-4 space-y-4">
          {/* Search and Filters */}
          <div className="flex flex-col sm:flex-row gap-4 justify-between">
            <div className="flex flex-1 gap-4">
              {/* Search Box */}
              {tableConfig.filtering.quickFilter && (
                <div className="flex-1 max-w-md">
                  <input
                    type="text"
                    placeholder="Search..."
                    value={searchQuery}
                    onChange={(e) => handleSearch(e.target.value)}
                    className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 dark:bg-gray-700 dark:border-gray-600"
                  />
                </div>
              )}
  
              {/* Column Selector */}
              {tableConfig.columns.hideable && (
                <ColumnSelector
                  columns={columns}
                  visibleColumns={visibleColumns}
                  onVisibilityChange={handleColumnVisibilityChange}
                  isRTL={isRTL}
                />
              )}
  
              {/* Advanced Filters */}
              {tableConfig.filtering.advancedFilter && (
                <TableFilters
                  columns={columns.filter(col => col.filterable)}
                  filters={filterConfig}
                  onFiltersChange={handleFilter}
                  isRTL={isRTL}
                />
              )}
            </div>
  
            {/* Bulk Actions */}
            {tableConfig.selection.enabled && selectedRows.size > 0 && (
              <BulkActions
                actions={bulkActions}
                selectedCount={selectedRows.size}
                onAction={handleBulkAction}
                progress={bulkActionProgress}
                isRTL={isRTL}
              />
            )}
          </div>
  
          {/* Table Info */}
          <div className="flex justify-between items-center text-sm text-gray-600 dark:text-gray-400">
            <div>
              Showing {tableConfig.pagination.enabled ? paginatedData.length : processedData.length} of{' '}
              {processedData.length} records
              {selectedRows.size > 0 && ` (${selectedRows.size} selected)`}
            </div>
            
            {tableConfig.pagination.enabled && (
              <div>
                Page {currentPage} of {totalPages}
              </div>
            )}
          </div>
        </div>
  
        {/* Table Container */}
        <div className="bg-white dark:bg-gray-800 rounded-lg shadow-md overflow-hidden">
          {/* Table */}
          <div className="overflow-x-auto">
            <table className="min-w-full divide-y divide-gray-200 dark:divide-gray-700">
              {/* Table Header */}
              <TableHeader
                columns={columns.filter(col => visibleColumns.has(col.key))}
                sortConfig={sortConfig}
                onSort={handleSort}
                onSelectAll={handleSelectAll}
                selectedCount={selectedRows.size}
                totalCount={processedData.length}
                selectionEnabled={tableConfig.selection.enabled}
                actionsEnabled={tableConfig.actions.edit || tableConfig.actions.delete || tableConfig.actions.view}
                onColumnReorder={handleColumnReorder}
                onColumnResize={handleColumnResize}
                isRTL={isRTL}
              />
  
              {/* Table Body */}
              <TableBody
                data={paginatedData}
                columns={columns.filter(col => visibleColumns.has(col.key))}
                selectedRows={selectedRows}
                onSelectionChange={handleSelectionChange}
                onEdit={onEdit}
                onDelete={onDelete}
                onView={onView}
                selectionEnabled={tableConfig.selection.enabled}
                actionsEnabled={{
                  edit: tableConfig.actions.edit,
                  delete: tableConfig.actions.delete,
                  view: tableConfig.actions.view,
                  duplicate: tableConfig.actions.duplicate
                }}
                virtualization={tableConfig.virtualization}
                isRTL={isRTL}
              />
            </table>
          </div>
  
          {/* Table Footer */}
          {tableConfig.pagination.enabled && (
            <TableFooter
              currentPage={currentPage}
              totalPages={totalPages}
              pageSize={pageSize}
              totalItems={processedData.length}
              onPageChange={setCurrentPage}
              onPageSizeChange={setPageSize}
              pageSizeOptions={tableConfig.pagination.pageSizeOptions}
              isRTL={isRTL}
            />
          )}
        </div>
  
        {/* Empty State */}
        {processedData.length === 0 && (
          <div className="text-center py-12">
            <div className="text-gray-400 dark:text-gray-500 text-6xl mb-4">📊</div>
            <h3 className="text-lg font-medium text-gray-900 dark:text-white mb-2">
              No data found
            </h3>
            <p className="text-gray-500 dark:text-gray-400 mb-4">
              {searchQuery || Object.keys(filterConfig).length > 0
                ? 'Try adjusting your search or filters'
                : 'Get started by adding your first record'}
            </p>
            {searchQuery || Object.keys(filterConfig).length > 0 ? (
              <button
                onClick={() => {
                  setSearchQuery('');
                  setFilterConfig({});
                }}
                className="px-4 py-2 bg-blue-500 text-white rounded-md hover:bg-blue-600 focus:outline-none focus:ring-2 focus:ring-blue-500"
              >
                Clear all filters
              </button>
            ) : (
              <button
                onClick={() => window.location.href = '/add-trade'}
                className="px-4 py-2 bg-green-500 text-white rounded-md hover:bg-green-600 focus:outline-none focus:ring-2 focus:ring-green-500"
              >
                Add New Trade
              </button>
            )}
          </div>
        )}
      </div>
    );
  };
  
  export default DynamicTable;
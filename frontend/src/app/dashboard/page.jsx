"use client";

import { useState, useEffect } from "react";
import {
  FileText,
  DollarSign,
  TrendingUp,
  AlertTriangle,
  Download,
  Filter,
  Search,
  RefreshCw,
  Eye,
  Edit,
  Trash2,
  CheckCircle,
  Calendar,
  Building,
} from "lucide-react";
import Link from "next/link";
import {
  getInvoices,
  getDashboardStats,
  exportInvoices,
  formatCurrency,
  formatDate,
  getConfidenceColor,
} from "../../lib/api";
import QuickStats from "../../components/dashboard/QuickStats";
import InvoiceFilters from "../../components/dashboard/InvoiceFilters";
import InvoiceList from "../../components/dashboard/InvoiceList";
import BulkActions from "../../components/dashboard/BulkActions";

export default function DashboardPage() {
  const [invoices, setInvoices] = useState([]);
  const [stats, setStats] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [filters, setFilters] = useState({
    vendor: "",
    category: "",
    needsReview: false,
    dateFrom: "",
    dateTo: "",
    amountMin: "",
    amountMax: "",
  });
  const [pagination, setPagination] = useState({
    page: 1,
    limit: 20,
    total: 0,
    pages: 0,
  });
  const [selectedInvoices, setSelectedInvoices] = useState([]);
  const [viewMode, setViewMode] = useState("list"); // list, grid

  useEffect(() => {
    loadData();
  }, [filters, pagination.page]);

  const loadData = async () => {
    try {
      setLoading(true);
      const [invoicesData, statsData] = await Promise.all([
        getInvoices({
          ...filters,
          page: pagination.page,
          limit: pagination.limit,
        }),
        getDashboardStats(),
      ]);

      setInvoices(invoicesData.invoices);
      setPagination(invoicesData.pagination);
      setStats(statsData);
      setError(null);
    } catch (err) {
      console.error("Failed to load dashboard data:", err);
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  const handleFilterChange = (newFilters) => {
    setFilters(newFilters);
    setPagination((prev) => ({ ...prev, page: 1 }));
    setSelectedInvoices([]);
  };

  const handlePageChange = (page) => {
    setPagination((prev) => ({ ...prev, page }));
    setSelectedInvoices([]);
  };

  const handleSelectInvoice = (invoiceId) => {
    setSelectedInvoices((prev) =>
      prev.includes(invoiceId)
        ? prev.filter((id) => id !== invoiceId)
        : [...prev, invoiceId]
    );
  };

  const handleSelectAll = () => {
    if (selectedInvoices.length === invoices.length) {
      setSelectedInvoices([]);
    } else {
      setSelectedInvoices(invoices.map((inv) => inv._id));
    }
  };

  const handleExport = async () => {
    try {
      await exportInvoices(filters);
    } catch (err) {
      console.error("Export failed:", err);
    }
  };

  const handleBulkAction = async (action, data) => {
    try {
      // Implementation for bulk actions
      await loadData(); // Refresh data after bulk action
      setSelectedInvoices([]);
    } catch (err) {
      console.error("Bulk action failed:", err);
    }
  };

  if (loading && !invoices.length) {
    return <DashboardSkeleton />;
  }

  return (
    <div className="max-w-7xl mx-auto space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Dashboard</h1>
          <p className="text-gray-500 mt-1">
            Manage and review your invoice processing
          </p>
        </div>
        <div className="flex space-x-3 mt-4 sm:mt-0">
          <button
            onClick={() => loadData()}
            className="btn-outline"
            disabled={loading}
          >
            <RefreshCw
              className={`w-4 h-4 mr-2 ${loading ? "animate-spin" : ""}`}
            />
            Refresh
          </button>
          <button onClick={handleExport} className="btn-secondary">
            <Download className="w-4 h-4 mr-2" />
            Export CSV
          </button>
          <Link href="/" className="btn-primary">
            <FileText className="w-4 h-4 mr-2" />
            Upload New
          </Link>
        </div>
      </div>

      {/* Quick Stats */}
      <QuickStats />

      {/* Error State */}
      {error && (
        <div className="card p-6 border-red-200 bg-red-50">
          <div className="flex items-center space-x-3">
            <AlertTriangle className="w-5 h-5 text-red-600" />
            <div>
              <h3 className="font-medium text-red-900">Error loading data</h3>
              <p className="text-red-700 text-sm">{error}</p>
              <button
                onClick={loadData}
                className="text-red-600 hover:text-red-700 text-sm font-medium mt-1"
              >
                Try again
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Filters */}
      <InvoiceFilters filters={filters} onFilterChange={handleFilterChange} />

      {/* Bulk Actions */}
      {selectedInvoices.length > 0 && (
        <BulkActions
          selectedCount={selectedInvoices.length}
          selectedInvoices={selectedInvoices}
          onBulkAction={handleBulkAction}
          onClearSelection={() => setSelectedInvoices([])}
        />
      )}

      {/* View Controls */}
      <div className="flex items-center justify-between">
        <div className="flex items-center space-x-4">
          <p className="text-sm text-gray-500">
            {pagination.total} invoice{pagination.total !== 1 ? "s" : ""} found
            {selectedInvoices.length > 0 &&
              ` • ${selectedInvoices.length} selected`}
          </p>
        </div>
        <div className="flex items-center space-x-2">
          <button
            onClick={() => setViewMode("list")}
            className={`p-2 rounded ${
              viewMode === "list"
                ? "bg-blue-100 text-blue-600"
                : "text-gray-400 hover:text-gray-600"
            }`}
          >
            <FileText className="w-4 h-4" />
          </button>
          <button
            onClick={() => setViewMode("grid")}
            className={`p-2 rounded ${
              viewMode === "grid"
                ? "bg-blue-100 text-blue-600"
                : "text-gray-400 hover:text-gray-600"
            }`}
          >
            <TrendingUp className="w-4 h-4" />
          </button>
        </div>
      </div>

      {/* Invoice List */}
      <InvoiceList
        invoices={invoices}
        selectedInvoices={selectedInvoices}
        onSelectInvoice={handleSelectInvoice}
        onSelectAll={handleSelectAll}
        viewMode={viewMode}
        loading={loading}
      />

      {/* Pagination */}
      {pagination.pages > 1 && (
        <div className="flex items-center justify-between">
          <div className="text-sm text-gray-500">
            Showing {(pagination.page - 1) * pagination.limit + 1} to{" "}
            {Math.min(pagination.page * pagination.limit, pagination.total)} of{" "}
            {pagination.total} results
          </div>
          <div className="flex space-x-2">
            <button
              onClick={() => handlePageChange(pagination.page - 1)}
              disabled={pagination.page === 1}
              className="btn-outline disabled:opacity-50"
            >
              Previous
            </button>
            {[...Array(Math.min(5, pagination.pages))].map((_, i) => {
              const page = i + 1;
              return (
                <button
                  key={page}
                  onClick={() => handlePageChange(page)}
                  className={`px-3 py-2 rounded text-sm ${
                    pagination.page === page
                      ? "bg-blue-600 text-white"
                      : "bg-white text-gray-700 hover:bg-gray-50"
                  }`}
                >
                  {page}
                </button>
              );
            })}
            <button
              onClick={() => handlePageChange(pagination.page + 1)}
              disabled={pagination.page === pagination.pages}
              className="btn-outline disabled:opacity-50"
            >
              Next
            </button>
          </div>
        </div>
      )}

      {/* Empty State */}
      {!loading && invoices.length === 0 && (
        <div className="card p-12 text-center">
          <FileText className="w-16 h-16 text-gray-300 mx-auto mb-4" />
          <h3 className="text-lg font-medium text-gray-500 mb-2">
            No invoices found
          </h3>
          <p className="text-gray-400 mb-6">
            {Object.values(filters).some((f) => f)
              ? "Try adjusting your filters or upload new invoices."
              : "Get started by uploading your first invoice."}
          </p>
          <Link href="/" className="btn-primary">
            <FileText className="w-4 h-4 mr-2" />
            Upload Invoice
          </Link>
        </div>
      )}
    </div>
  );
}

// Loading Skeleton Component
function DashboardSkeleton() {
  return (
    <div className="max-w-7xl mx-auto space-y-6">
      <div className="flex justify-between items-center">
        <div>
          <div className="h-8 bg-gray-300 rounded w-32 mb-2"></div>
          <div className="h-4 bg-gray-300 rounded w-64"></div>
        </div>
        <div className="flex space-x-3">
          <div className="h-10 bg-gray-300 rounded w-20"></div>
          <div className="h-10 bg-gray-300 rounded w-24"></div>
          <div className="h-10 bg-gray-300 rounded w-28"></div>
        </div>
      </div>

      {/* Stats Skeleton */}
      <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-4">
        {[...Array(6)].map((_, i) => (
          <div key={i} className="card p-4 animate-pulse">
            <div className="flex items-center space-x-3 mb-2">
              <div className="w-5 h-5 bg-gray-300 rounded"></div>
              <div className="h-4 bg-gray-300 rounded w-20"></div>
            </div>
            <div className="h-6 bg-gray-300 rounded w-16 mb-1"></div>
            <div className="h-3 bg-gray-300 rounded w-12"></div>
          </div>
        ))}
      </div>

      {/* List Skeleton */}
      <div className="card">
        {[...Array(5)].map((_, i) => (
          <div key={i} className="p-4 border-b border-gray-200 animate-pulse">
            <div className="flex items-center space-x-4">
              <div className="w-4 h-4 bg-gray-300 rounded"></div>
              <div className="flex-1">
                <div className="h-5 bg-gray-300 rounded w-32 mb-2"></div>
                <div className="h-4 bg-gray-300 rounded w-48"></div>
              </div>
              <div className="h-8 bg-gray-300 rounded w-20"></div>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}

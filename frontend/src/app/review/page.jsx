"use client";

import { useState, useEffect } from "react";
import {
  AlertTriangle,
  CheckCircle,
  Clock,
  Eye,
  Edit,
  FileText,
  Filter,
  Calendar,
  DollarSign,
  Building,
  ChevronRight,
  Zap,
  TrendingUp,
  RefreshCw,
  Download,
  ChevronDown,
  X,
  Plus,
  MoreVertical,
} from "lucide-react";
import Link from "next/link";
import {
  getInvoices,
  bulkActionInvoices,
  formatCurrency,
  formatDate,
  getConfidenceColor,
  getConfidenceLevel,
} from "../../lib/api";
import toast from "react-hot-toast";

export default function ReviewPage() {
  const [invoices, setInvoices] = useState([]);
  const [loading, setLoading] = useState(true);
  const [selectedInvoices, setSelectedInvoices] = useState([]);
  const [filters, setFilters] = useState({
    needsReview: true,
    lowConfidence: false,
    duplicates: false,
    highAmount: false,
  });
  const [sortBy, setSortBy] = useState("confidence");
  const [viewMode, setViewMode] = useState("review");
  const [expandedSections, setExpandedSections] = useState({
    critical: true,
    high: true,
    medium: false,
    low: false,
  });
  const [showBulkActions, setShowBulkActions] = useState(false);
  const [bulkActionLoading, setBulkActionLoading] = useState(false);

  useEffect(() => {
    loadReviewInvoices();
  }, [filters, sortBy]);

  const loadReviewInvoices = async () => {
    try {
      setLoading(true);

      const params = {};
      if (filters.needsReview) params.needsReview = true;
      if (filters.lowConfidence) params.maxConfidence = 70;
      if (filters.duplicates) params.isDuplicate = true;
      if (filters.highAmount) params.amountMin = 500;

      const data = await getInvoices({
        ...params,
        limit: 50,
        sortBy:
          sortBy === "confidence"
            ? "validationStatus.overallConfidence"
            : sortBy === "amount"
            ? "amount"
            : "date",
        sortOrder: sortBy === "confidence" ? "asc" : "desc",
      });

      setInvoices(data.invoices || []);
    } catch (error) {
      console.error("Failed to load review invoices:", error);
      toast.error("Failed to load invoices for review");
    } finally {
      setLoading(false);
    }
  };

  const getReviewPriority = (invoice) => {
    const confidence = invoice.validationStatus?.overallConfidence || 0;
    const hasIssues = invoice.validationStatus?.issues?.length > 0;
    const isDuplicate = invoice.isDuplicate;
    const isHighAmount = invoice.amount > 1000;

    if (confidence < 50 || isDuplicate) return "critical";
    if (confidence < 70 || hasIssues || isHighAmount) return "high";
    if (confidence < 80) return "medium";
    return "low";
  };

  const getPriorityConfig = (priority) => {
    const configs = {
      critical: {
        label: "Critical",
        color: "text-red-600",
        bg: "bg-red-50",
        border: "border-red-200",
        icon: AlertTriangle,
        description: "Requires immediate attention",
      },
      high: {
        label: "High",
        color: "text-orange-600",
        bg: "bg-orange-50",
        border: "border-orange-200",
        icon: AlertTriangle,
        description: "Should be reviewed soon",
      },
      medium: {
        label: "Medium",
        color: "text-yellow-600",
        bg: "bg-yellow-50",
        border: "border-yellow-200",
        icon: Clock,
        description: "Standard review needed",
      },
      low: {
        label: "Low",
        color: "text-green-600",
        bg: "bg-green-50",
        border: "border-green-200",
        icon: CheckCircle,
        description: "Low priority items",
      },
    };
    return configs[priority] || configs.low;
  };

  const filteredInvoices = invoices.filter((invoice) => {
    if (viewMode === "review") {
      return (
        invoice.validationStatus?.needsReview ||
        invoice.validationStatus?.overallConfidence < 80
      );
    }
    return true;
  });

  const priorityGroups = {
    critical: filteredInvoices.filter(
      (inv) => getReviewPriority(inv) === "critical"
    ),
    high: filteredInvoices.filter((inv) => getReviewPriority(inv) === "high"),
    medium: filteredInvoices.filter(
      (inv) => getReviewPriority(inv) === "medium"
    ),
    low: filteredInvoices.filter((inv) => getReviewPriority(inv) === "low"),
  };

  const totalNeedsReview = Object.values(priorityGroups).reduce(
    (sum, group) => sum + group.length,
    0
  );

  const handleBulkApprove = async () => {
    if (selectedInvoices.length === 0) {
      toast.error("Please select invoices to approve");
      return;
    }

    try {
      setBulkActionLoading(true);

      // Use the markReviewed action instead of a generic one
      const response = await fetch("/api/invoices/bulk-action", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          action: "markReviewed",
          invoiceIds: selectedInvoices,
        }),
      });

      if (!response.ok) {
        throw new Error("Failed to approve invoices");
      }

      toast.success(`Approved ${selectedInvoices.length} invoice(s)`);
      loadReviewInvoices();
      setSelectedInvoices([]);
      setShowBulkActions(false);
    } catch (error) {
      console.error("Failed to approve invoices:", error);
      toast.error("Failed to approve invoices");
    } finally {
      setBulkActionLoading(false);
    }
  };

  const handleBulkReject = async () => {
    if (selectedInvoices.length === 0) {
      toast.error("Please select invoices to reject");
      return;
    }

    if (
      !confirm(
        `Are you sure you want to reject ${selectedInvoices.length} selected invoice(s)? This will permanently delete them.`
      )
    ) {
      return;
    }

    try {
      setBulkActionLoading(true);
      await bulkActionInvoices("delete", selectedInvoices);
      toast.success(`Rejected ${selectedInvoices.length} invoice(s)`);
      loadReviewInvoices();
      setSelectedInvoices([]);
      setShowBulkActions(false);
    } catch (error) {
      console.error("Failed to reject invoices:", error);
      toast.error("Failed to reject invoices");
    } finally {
      setBulkActionLoading(false);
    }
  };

  const handleSelectInvoice = (invoiceId) => {
    setSelectedInvoices((prev) => {
      const newSelection = prev.includes(invoiceId)
        ? prev.filter((id) => id !== invoiceId)
        : [...prev, invoiceId];

      setShowBulkActions(newSelection.length > 0);
      return newSelection;
    });
  };

  const handleSelectAll = (invoiceIds) => {
    const allSelected = invoiceIds.every((id) => selectedInvoices.includes(id));
    if (allSelected) {
      const newSelection = selectedInvoices.filter(
        (id) => !invoiceIds.includes(id)
      );
      setSelectedInvoices(newSelection);
      setShowBulkActions(newSelection.length > 0);
    } else {
      const newSelection = [...new Set([...selectedInvoices, ...invoiceIds])];
      setSelectedInvoices(newSelection);
      setShowBulkActions(newSelection.length > 0);
    }
  };

  const toggleSection = (priority) => {
    setExpandedSections((prev) => ({
      ...prev,
      [priority]: !prev[priority],
    }));
  };

  if (loading) {
    return (
      <div className="max-w-7xl mx-auto space-y-6">
        {/* Header Skeleton */}
        <div className="flex justify-between items-center">
          <div>
            <div className="h-8 bg-gray-300 rounded w-48 mb-2 animate-pulse"></div>
            <div className="h-4 bg-gray-300 rounded w-64 animate-pulse"></div>
          </div>
          <div className="flex space-x-3">
            <div className="h-10 bg-gray-300 rounded w-20 animate-pulse"></div>
            <div className="h-10 bg-gray-300 rounded w-32 animate-pulse"></div>
          </div>
        </div>

        {/* Summary Cards Skeleton */}
        <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
          {[...Array(4)].map((_, i) => (
            <div key={i} className="card p-6 animate-pulse">
              <div className="flex items-center">
                <div className="w-8 h-8 bg-gray-300 rounded"></div>
                <div className="ml-4">
                  <div className="h-4 bg-gray-300 rounded w-20 mb-2"></div>
                  <div className="h-6 bg-gray-300 rounded w-8"></div>
                </div>
              </div>
            </div>
          ))}
        </div>

        {/* Content Skeleton */}
        <div className="space-y-6">
          {[...Array(3)].map((_, i) => (
            <div key={i} className="card p-4 animate-pulse">
              <div className="flex items-center space-x-3 mb-4">
                <div className="w-10 h-10 bg-gray-300 rounded-lg"></div>
                <div className="flex-1">
                  <div className="h-5 bg-gray-300 rounded w-48 mb-2"></div>
                  <div className="h-4 bg-gray-300 rounded w-32"></div>
                </div>
              </div>
              <div className="space-y-3">
                {[...Array(2)].map((_, j) => (
                  <div key={j} className="border rounded-lg p-4">
                    <div className="flex items-center space-x-4">
                      <div className="w-4 h-4 bg-gray-300 rounded"></div>
                      <div className="flex-1">
                        <div className="h-5 bg-gray-300 rounded w-40 mb-2"></div>
                        <div className="grid grid-cols-4 gap-4">
                          <div className="h-4 bg-gray-300 rounded"></div>
                          <div className="h-4 bg-gray-300 rounded"></div>
                          <div className="h-4 bg-gray-300 rounded"></div>
                          <div className="h-4 bg-gray-300 rounded"></div>
                        </div>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          ))}
        </div>
      </div>
    );
  }

  return (
    <div className="max-w-7xl mx-auto space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">
            Review & Approval
          </h1>
          <p className="text-gray-500 mt-1">
            Review invoices that need attention and approve for processing
          </p>
        </div>
        <div className="flex items-center space-x-3 mt-4 sm:mt-0">
          <button
            onClick={() => loadReviewInvoices()}
            className="btn-outline"
            disabled={loading}
          >
            <RefreshCw
              className={`w-4 h-4 mr-2 ${loading ? "animate-spin" : ""}`}
            />
            Refresh
          </button>
          <Link href="/dashboard" className="btn-secondary">
            View All Invoices
          </Link>
        </div>
      </div>

      {/* Summary Cards */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
        <div className="card p-6 bg-blue-50 border-0">
          <div className="flex items-center">
            <div className="flex-shrink-0">
              <FileText className="w-8 h-8 text-blue-600" />
            </div>
            <div className="ml-4">
              <p className="text-sm font-medium text-gray-600">
                Total for Review
              </p>
              <p className="text-2xl font-bold text-blue-600">
                {totalNeedsReview}
              </p>
            </div>
          </div>
        </div>

        <div className="card p-6 bg-red-50 border-0">
          <div className="flex items-center">
            <div className="flex-shrink-0">
              <AlertTriangle className="w-8 h-8 text-red-600" />
            </div>
            <div className="ml-4">
              <p className="text-sm font-medium text-gray-600">
                Critical Priority
              </p>
              <p className="text-2xl font-bold text-red-600">
                {priorityGroups.critical.length}
              </p>
            </div>
          </div>
        </div>

        <div className="card p-6 bg-orange-50 border-0">
          <div className="flex items-center">
            <div className="flex-shrink-0">
              <Clock className="w-8 h-8 text-orange-600" />
            </div>
            <div className="ml-4">
              <p className="text-sm font-medium text-gray-600">High Priority</p>
              <p className="text-2xl font-bold text-orange-600">
                {priorityGroups.high.length}
              </p>
            </div>
          </div>
        </div>

        <div className="card p-6 bg-green-50 border-0">
          <div className="flex items-center">
            <div className="flex-shrink-0">
              <CheckCircle className="w-8 h-8 text-green-600" />
            </div>
            <div className="ml-4">
              <p className="text-sm font-medium text-gray-600">Low Priority</p>
              <p className="text-2xl font-bold text-green-600">
                {priorityGroups.low.length}
              </p>
            </div>
          </div>
        </div>
      </div>

      {/* Filters and Controls */}
      <div className="card p-4">
        <div className="flex flex-col lg:flex-row lg:items-center lg:justify-between space-y-4 lg:space-y-0">
          <div className="flex flex-wrap gap-3">
            <FilterToggle
              label="Needs Review"
              active={filters.needsReview}
              onChange={(value) =>
                setFilters({ ...filters, needsReview: value })
              }
            />
            <FilterToggle
              label="Low Confidence"
              active={filters.lowConfidence}
              onChange={(value) =>
                setFilters({ ...filters, lowConfidence: value })
              }
            />
            <FilterToggle
              label="Duplicates"
              active={filters.duplicates}
              onChange={(value) =>
                setFilters({ ...filters, duplicates: value })
              }
            />
            <FilterToggle
              label="High Amount (>$500)"
              active={filters.highAmount}
              onChange={(value) =>
                setFilters({ ...filters, highAmount: value })
              }
            />
          </div>

          <div className="flex items-center space-x-4">
            <div className="flex items-center space-x-2">
              <span className="text-sm text-gray-600">View:</span>
              <select
                value={viewMode}
                onChange={(e) => setViewMode(e.target.value)}
                className="input text-sm py-1"
              >
                <option value="review">Review Queue</option>
                <option value="all">All Invoices</option>
              </select>
            </div>

            <div className="flex items-center space-x-2">
              <span className="text-sm text-gray-600">Sort by:</span>
              <select
                value={sortBy}
                onChange={(e) => setSortBy(e.target.value)}
                className="input text-sm py-1"
              >
                <option value="confidence">Confidence</option>
                <option value="amount">Amount</option>
                <option value="date">Date</option>
              </select>
            </div>
          </div>
        </div>
      </div>

      {/* Bulk Actions */}
      {showBulkActions && (
        <div className="card p-4 bg-blue-50 border-blue-200">
          <div className="flex items-center justify-between">
            <div className="flex items-center space-x-3">
              <CheckCircle className="w-5 h-5 text-blue-600" />
              <span className="font-medium text-blue-900">
                {selectedInvoices.length} invoice
                {selectedInvoices.length > 1 ? "s" : ""} selected for review
              </span>
            </div>

            <div className="flex items-center space-x-3">
              <button
                onClick={handleBulkApprove}
                disabled={bulkActionLoading}
                className="btn-primary"
              >
                {bulkActionLoading ? (
                  <div className="spinner w-4 h-4 mr-2"></div>
                ) : (
                  <CheckCircle className="w-4 h-4 mr-2" />
                )}
                Approve {selectedInvoices.length}
              </button>
              <button
                onClick={handleBulkReject}
                disabled={bulkActionLoading}
                className="btn-outline border-red-300 text-red-600 hover:bg-red-50"
              >
                <AlertTriangle className="w-4 h-4 mr-2" />
                Reject {selectedInvoices.length}
              </button>
              <button
                onClick={() => {
                  setSelectedInvoices([]);
                  setShowBulkActions(false);
                }}
                className="text-gray-600 hover:text-gray-800"
              >
                Clear Selection
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Review Queue */}
      {totalNeedsReview === 0 ? (
        <div className="card p-12 text-center">
          <CheckCircle className="w-16 h-16 text-green-500 mx-auto mb-4" />
          <h3 className="text-lg font-medium text-gray-900 mb-2">
            All Caught Up!
          </h3>
          <p className="text-gray-600 mb-6">
            No invoices currently need review. All processed invoices meet
            quality standards.
          </p>
          <div className="flex justify-center space-x-3">
            <Link href="/" className="btn-primary">
              <FileText className="w-4 h-4 mr-2" />
              Upload New Invoice
            </Link>
            <Link href="/dashboard" className="btn-outline">
              View All Invoices
            </Link>
          </div>
        </div>
      ) : (
        <div className="space-y-6">
          {Object.entries(priorityGroups).map(([priority, invoices]) => {
            if (invoices.length === 0) return null;

            const config = getPriorityConfig(priority);
            const Icon = config.icon;
            const isExpanded = expandedSections[priority];

            const invoiceIds = invoices.map((inv) => inv._id);
            const allSelected = invoiceIds.every((id) =>
              selectedInvoices.includes(id)
            );
            const someSelected = invoiceIds.some((id) =>
              selectedInvoices.includes(id)
            );

            return (
              <div
                key={priority}
                className={`card border-l-4 ${config.border}`}
              >
                <div className="p-4">
                  <div className="flex items-center justify-between">
                    <button
                      onClick={() => toggleSection(priority)}
                      className="flex items-center space-x-3 text-left flex-1"
                    >
                      <div className={`p-2 rounded-lg ${config.bg}`}>
                        <Icon className={`w-5 h-5 ${config.color}`} />
                      </div>
                      <div>
                        <h3 className={`font-medium ${config.color}`}>
                          {config.label} Priority ({invoices.length})
                        </h3>
                        <p className="text-sm text-gray-500">
                          {config.description}
                        </p>
                      </div>
                      <ChevronRight
                        className={`w-4 h-4 text-gray-400 transform transition-transform ${
                          isExpanded ? "rotate-90" : ""
                        }`}
                      />
                    </button>

                    <div className="flex items-center space-x-3">
                      <label className="flex items-center">
                        <input
                          type="checkbox"
                          checked={allSelected}
                          ref={(el) => {
                            if (el)
                              el.indeterminate = someSelected && !allSelected;
                          }}
                          onChange={() => handleSelectAll(invoiceIds)}
                          className="rounded border-gray-300 text-blue-600 focus:ring-blue-500"
                        />
                        <span className="ml-2 text-sm text-gray-600">
                          Select all
                        </span>
                      </label>
                    </div>
                  </div>

                  {isExpanded && (
                    <div className="mt-4 space-y-3">
                      {invoices.map((invoice) => {
                        const confidence =
                          invoice.validationStatus?.overallConfidence || 0;
                        const confidenceColor = getConfidenceColor(confidence);
                        const issues = invoice.validationStatus?.issues || [];
                        const isSelected = selectedInvoices.includes(
                          invoice._id
                        );

                        return (
                          <div
                            key={invoice._id}
                            className={`border rounded-lg p-4 transition-colors ${
                              isSelected
                                ? "bg-blue-50 border-blue-200"
                                : "bg-white border-gray-200 hover:border-gray-300"
                            }`}
                          >
                            <div className="flex items-start space-x-4">
                              <input
                                type="checkbox"
                                checked={isSelected}
                                onChange={() =>
                                  handleSelectInvoice(invoice._id)
                                }
                                className="mt-1 rounded border-gray-300 text-blue-600 focus:ring-blue-500"
                              />

                              <div className="flex-1">
                                <div className="flex items-start justify-between">
                                  <div className="flex-1">
                                    <div className="flex items-center space-x-3 mb-2">
                                      <h4 className="font-medium text-gray-900">
                                        {invoice.vendor}
                                      </h4>
                                      {invoice.isDuplicate && (
                                        <span className="badge-error text-xs">
                                          Duplicate
                                        </span>
                                      )}
                                      {issues.length > 0 && (
                                        <span className="badge-warning text-xs">
                                          {issues.length} issue
                                          {issues.length > 1 ? "s" : ""}
                                        </span>
                                      )}
                                    </div>

                                    <div className="grid grid-cols-2 md:grid-cols-4 gap-4 text-sm">
                                      <div className="flex items-center space-x-2">
                                        <DollarSign className="w-4 h-4 text-gray-400" />
                                        <span className="font-medium">
                                          {formatCurrency(invoice.amount)}
                                        </span>
                                      </div>
                                      <div className="flex items-center space-x-2">
                                        <Calendar className="w-4 h-4 text-gray-400" />
                                        <span>{formatDate(invoice.date)}</span>
                                      </div>
                                      <div className="flex items-center space-x-2">
                                        <Building className="w-4 h-4 text-gray-400" />
                                        <span>{invoice.category}</span>
                                      </div>
                                      <div className="flex items-center space-x-2">
                                        <TrendingUp className="w-4 h-4 text-gray-400" />
                                        <span className={confidenceColor}>
                                          {confidence}% confidence
                                        </span>
                                      </div>
                                    </div>

                                    {issues.length > 0 && (
                                      <div className="mt-3 p-2 bg-yellow-50 rounded text-sm">
                                        <p className="font-medium text-yellow-800 mb-1">
                                          Issues found:
                                        </p>
                                        <ul className="text-yellow-700 space-y-1">
                                          {issues
                                            .slice(0, 2)
                                            .map((issue, index) => (
                                              <li key={index}>• {issue}</li>
                                            ))}
                                          {issues.length > 2 && (
                                            <li>
                                              • And {issues.length - 2} more...
                                            </li>
                                          )}
                                        </ul>
                                      </div>
                                    )}
                                  </div>

                                  <div className="flex items-center space-x-2">
                                    <Link
                                      href={`/invoice/${invoice._id}?view=true`}
                                      className="text-gray-600 hover:text-blue-600"
                                      title="View details"
                                    >
                                      <Eye className="w-4 h-4" />
                                    </Link>
                                    <Link
                                      href={`/invoice/${invoice._id}`}
                                      className="text-gray-600 hover:text-blue-600"
                                      title="Edit invoice"
                                    >
                                      <Edit className="w-4 h-4" />
                                    </Link>
                                  </div>
                                </div>
                              </div>
                            </div>
                          </div>
                        );
                      })}
                    </div>
                  )}
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}

// Filter Toggle Component
function FilterToggle({ label, active, onChange }) {
  return (
    <button
      onClick={() => onChange(!active)}
      className={`px-3 py-1 rounded-full text-sm font-medium transition-colors ${
        active
          ? "bg-blue-100 text-blue-700 border border-blue-200"
          : "bg-gray-100 text-gray-600 border border-gray-200 hover:bg-gray-200"
      }`}
    >
      {label}
    </button>
  );
}

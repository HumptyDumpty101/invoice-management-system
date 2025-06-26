"use client";

import { useState } from "react";
import Link from "next/link";
import {
  Eye,
  Edit,
  Trash2,
  AlertTriangle,
  CheckCircle,
  Calendar,
  Building,
  DollarSign,
  FileText,
  MoreVertical,
  Copy,
} from "lucide-react";
import {
  formatCurrency,
  formatDate,
  getConfidenceColor,
  getConfidenceLevel,
} from "../../lib/api";

export default function InvoiceList({
  invoices,
  selectedInvoices,
  onSelectInvoice,
  onSelectAll,
  viewMode,
  loading,
}) {
  const [actionMenuOpen, setActionMenuOpen] = useState(null);

  if (loading) {
    return <InvoiceListSkeleton />;
  }

  if (viewMode === "grid") {
    return (
      <InvoiceGridView
        invoices={invoices}
        selectedInvoices={selectedInvoices}
        onSelectInvoice={onSelectInvoice}
        actionMenuOpen={actionMenuOpen}
        setActionMenuOpen={setActionMenuOpen}
      />
    );
  }

  return (
    <div className="card overflow-hidden">
      <div className="overflow-x-auto">
        <table className="min-w-full divide-y divide-gray-200">
          <thead className="bg-gray-50">
            <tr>
              <th scope="col" className="relative px-6 py-3">
                <input
                  type="checkbox"
                  className="absolute left-4 top-1/2 -mt-2 h-4 w-4 rounded border-gray-300 text-blue-600 focus:ring-blue-500"
                  checked={
                    invoices.length > 0 &&
                    selectedInvoices.length === invoices.length
                  }
                  onChange={onSelectAll}
                />
              </th>
              <th
                scope="col"
                className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider"
              >
                Invoice Details
              </th>
              <th
                scope="col"
                className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider"
              >
                Amount & Category
              </th>
              <th
                scope="col"
                className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider"
              >
                Status
              </th>
              <th
                scope="col"
                className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider"
              >
                Confidence
              </th>
              <th scope="col" className="relative px-6 py-3">
                <span className="sr-only">Actions</span>
              </th>
            </tr>
          </thead>
          <tbody className="bg-white divide-y divide-gray-200">
            {invoices.map((invoice) => (
              <InvoiceRow
                key={invoice._id}
                invoice={invoice}
                isSelected={selectedInvoices.includes(invoice._id)}
                onSelect={() => onSelectInvoice(invoice._id)}
                actionMenuOpen={actionMenuOpen}
                setActionMenuOpen={setActionMenuOpen}
              />
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}

// Individual Invoice Row Component
function InvoiceRow({
  invoice,
  isSelected,
  onSelect,
  actionMenuOpen,
  setActionMenuOpen,
}) {
  const confidenceColor = getConfidenceColor(
    invoice.validationStatus?.overallConfidence || 0
  );
  const confidenceLevel = getConfidenceLevel(
    invoice.validationStatus?.overallConfidence || 0
  );

  return (
    <tr className={`hover:bg-gray-50 ${isSelected ? "bg-blue-50" : ""}`}>
      <td className="relative px-6 py-4">
        <input
          type="checkbox"
          className="absolute left-4 top-1/2 -mt-2 h-4 w-4 rounded border-gray-300 text-blue-600 focus:ring-blue-500"
          checked={isSelected}
          onChange={onSelect}
        />
      </td>

      <td className="px-6 py-4">
        <div className="flex items-center">
          <div className="flex-shrink-0 h-10 w-10">
            <div className="h-10 w-10 rounded-full bg-blue-100 flex items-center justify-center">
              <FileText className="w-5 h-5 text-blue-600" />
            </div>
          </div>
          <div className="ml-4">
            <div className="flex items-center space-x-2">
              <div className="text-sm font-medium text-gray-900">
                {invoice.vendor}
              </div>
              {invoice.isDuplicate && (
                <span className="badge-error text-xs">Duplicate</span>
              )}
              {invoice.validationStatus?.needsReview && (
                <span className="badge-warning text-xs">Review</span>
              )}
            </div>
            <div className="text-sm text-gray-500 flex items-center space-x-4">
              <span className="flex items-center">
                <Calendar className="w-4 h-4 mr-1" />
                {formatDate(invoice.date)}
              </span>
              <span className="text-xs text-gray-400">
                ID: {invoice._id.slice(-6)}
              </span>
            </div>
          </div>
        </div>
      </td>

      <td className="px-6 py-4">
        <div className="space-y-1">
          <div className="text-sm font-medium text-gray-900 flex items-center">
            <DollarSign className="w-4 h-4 mr-1 text-green-600" />
            {formatCurrency(invoice.amount)}
          </div>
          <div className="text-sm text-gray-500 flex items-center">
            <Building className="w-4 h-4 mr-1" />
            {invoice.category}
          </div>
        </div>
      </td>

      <td className="px-6 py-4">
        <div className="flex flex-col space-y-1">
          {invoice.validationStatus?.needsReview ? (
            <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-yellow-100 text-yellow-800">
              <AlertTriangle className="w-3 h-3 mr-1" />
              Needs Review
            </span>
          ) : (
            <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-green-100 text-green-800">
              <CheckCircle className="w-3 h-3 mr-1" />
              Processed
            </span>
          )}
          {invoice.validationStatus?.issues?.length > 0 && (
            <div className="text-xs text-yellow-600">
              {invoice.validationStatus.issues.length} issue
              {invoice.validationStatus.issues.length > 1 ? "s" : ""}
            </div>
          )}
        </div>
      </td>

      <td className="px-6 py-4">
        <div className="text-center">
          <div className={`text-lg font-bold ${confidenceColor}`}>
            {invoice.validationStatus?.overallConfidence || 0}%
          </div>
          <div className="text-xs text-gray-500">{confidenceLevel}</div>
        </div>
      </td>

      <td className="px-6 py-4 text-right text-sm font-medium">
        <div className="flex items-center space-x-2">
          <Link
            href={`/invoice/${invoice._id}`}
            className="text-blue-600 hover:text-blue-900"
          >
            <Edit className="w-4 h-4" />
          </Link>
          <Link
            href={`/invoice/${invoice._id}?view=true`}
            className="text-gray-600 hover:text-gray-900"
          >
            <Eye className="w-4 h-4" />
          </Link>
          <div className="relative">
            <button
              onClick={() =>
                setActionMenuOpen(
                  actionMenuOpen === invoice._id ? null : invoice._id
                )
              }
              className="text-gray-600 hover:text-gray-900"
            >
              <MoreVertical className="w-4 h-4" />
            </button>
            {actionMenuOpen === invoice._id && (
              <ActionMenu
                invoice={invoice}
                onClose={() => setActionMenuOpen(null)}
              />
            )}
          </div>
        </div>
      </td>
    </tr>
  );
}

// Grid View Component
function InvoiceGridView({
  invoices,
  selectedInvoices,
  onSelectInvoice,
  actionMenuOpen,
  setActionMenuOpen,
}) {
  return (
    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
      {invoices.map((invoice) => (
        <InvoiceCard
          key={invoice._id}
          invoice={invoice}
          isSelected={selectedInvoices.includes(invoice._id)}
          onSelect={() => onSelectInvoice(invoice._id)}
          actionMenuOpen={actionMenuOpen}
          setActionMenuOpen={setActionMenuOpen}
        />
      ))}
    </div>
  );
}

// Invoice Card Component
function InvoiceCard({
  invoice,
  isSelected,
  onSelect,
  actionMenuOpen,
  setActionMenuOpen,
}) {
  const confidenceColor = getConfidenceColor(
    invoice.validationStatus?.overallConfidence || 0
  );

  return (
    <div
      className={`card p-6 hover:shadow-lg transition-shadow cursor-pointer ${
        isSelected ? "ring-2 ring-blue-500 bg-blue-50" : ""
      }`}
    >
      <div className="flex items-start justify-between mb-4">
        <input
          type="checkbox"
          checked={isSelected}
          onChange={onSelect}
          className="h-4 w-4 rounded border-gray-300 text-blue-600 focus:ring-blue-500"
        />
        <div className="relative">
          <button
            onClick={() =>
              setActionMenuOpen(
                actionMenuOpen === invoice._id ? null : invoice._id
              )
            }
            className="text-gray-400 hover:text-gray-600"
          >
            <MoreVertical className="w-4 h-4" />
          </button>
          {actionMenuOpen === invoice._id && (
            <ActionMenu
              invoice={invoice}
              onClose={() => setActionMenuOpen(null)}
            />
          )}
        </div>
      </div>

      <div className="space-y-4">
        {/* Vendor and Status */}
        <div>
          <h3 className="text-lg font-medium text-gray-900 truncate">
            {invoice.vendor}
          </h3>
          <div className="flex items-center space-x-2 mt-1">
            {invoice.validationStatus?.needsReview && (
              <span className="badge-warning text-xs">Needs Review</span>
            )}
            {invoice.isDuplicate && (
              <span className="badge-error text-xs">Duplicate</span>
            )}
          </div>
        </div>

        {/* Amount and Date */}
        <div className="flex items-center justify-between">
          <div className="text-2xl font-bold text-gray-900">
            {formatCurrency(invoice.amount)}
          </div>
          <div className="text-sm text-gray-500">
            {formatDate(invoice.date)}
          </div>
        </div>

        {/* Category */}
        <div className="flex items-center text-sm text-gray-600">
          <Building className="w-4 h-4 mr-2" />
          {invoice.category}
        </div>

        {/* Confidence Score */}
        <div className="flex items-center justify-between">
          <span className="text-sm text-gray-500">Confidence</span>
          <span className={`font-medium ${confidenceColor}`}>
            {invoice.validationStatus?.overallConfidence || 0}%
          </span>
        </div>

        {/* Actions */}
        <div className="flex space-x-3 pt-4 border-t border-gray-200">
          <Link
            href={`/invoice/${invoice._id}`}
            className="btn-primary flex-1 text-center"
          >
            <Edit className="w-4 h-4 mr-1" />
            Edit
          </Link>
          <Link
            href={`/invoice/${invoice._id}?view=true`}
            className="btn-outline flex-1 text-center"
          >
            <Eye className="w-4 h-4 mr-1" />
            View
          </Link>
        </div>
      </div>
    </div>
  );
}

// Action Menu Component
function ActionMenu({ invoice, onClose }) {
  const handleAction = (action) => {
    console.log(`Action: ${action} on invoice ${invoice._id}`);
    onClose();
    // Implement action logic here
  };

  return (
    <div className="absolute right-0 mt-2 w-48 bg-white rounded-md shadow-lg z-10 border border-gray-200">
      <div className="py-1">
        <button
          onClick={() => handleAction("view")}
          className="block w-full text-left px-4 py-2 text-sm text-gray-700 hover:bg-gray-100"
        >
          <Eye className="w-4 h-4 inline mr-2" />
          View Details
        </button>
        <button
          onClick={() => handleAction("edit")}
          className="block w-full text-left px-4 py-2 text-sm text-gray-700 hover:bg-gray-100"
        >
          <Edit className="w-4 h-4 inline mr-2" />
          Edit Invoice
        </button>
        <button
          onClick={() => handleAction("duplicate")}
          className="block w-full text-left px-4 py-2 text-sm text-gray-700 hover:bg-gray-100"
        >
          <Copy className="w-4 h-4 inline mr-2" />
          Duplicate
        </button>
        <div className="border-t border-gray-100"></div>
        <button
          onClick={() => handleAction("delete")}
          className="block w-full text-left px-4 py-2 text-sm text-red-600 hover:bg-red-50"
        >
          <Trash2 className="w-4 h-4 inline mr-2" />
          Delete
        </button>
      </div>
    </div>
  );
}

// Loading Skeleton
function InvoiceListSkeleton() {
  return (
    <div className="card">
      {[...Array(5)].map((_, i) => (
        <div key={i} className="p-6 border-b border-gray-200 animate-pulse">
          <div className="flex items-center space-x-4">
            <div className="w-4 h-4 bg-gray-300 rounded"></div>
            <div className="w-10 h-10 bg-gray-300 rounded-full"></div>
            <div className="flex-1">
              <div className="h-5 bg-gray-300 rounded w-32 mb-2"></div>
              <div className="h-4 bg-gray-300 rounded w-48"></div>
            </div>
            <div className="h-8 bg-gray-300 rounded w-20"></div>
            <div className="h-8 bg-gray-300 rounded w-16"></div>
          </div>
        </div>
      ))}
    </div>
  );
}

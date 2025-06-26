// frontend/components/upload/UploadResults.js
"use client";

import { useState } from "react";
import {
  CheckCircle,
  AlertTriangle,
  Eye,
  Edit,
  AlertCircle,
  TrendingUp,
  DollarSign,
  Calendar,
  Building,
} from "lucide-react";
import Link from "next/link";
import {
  formatCurrency,
  formatDate,
  getConfidenceColor,
  getConfidenceLevel,
} from "../../lib/api";

export default function UploadResults({ results }) {
  const [expandedItem, setExpandedItem] = useState(null);

  if (!results || !results.results) return null;

  const { processed, total, results: invoices, errors } = results;

  return (
    <div className="space-y-6">
      {/* Summary Card */}
      <div className="card p-6">
        <div className="flex items-center justify-between mb-4">
          <h2 className="text-xl font-semibold flex items-center">
            <CheckCircle className="w-6 h-6 text-green-600 mr-2" />
            Processing Complete
          </h2>
          <div className="flex items-center space-x-4 text-sm">
            <span className="text-green-600 font-medium">
              {processed}/{total} processed
            </span>
            {errors && errors.length > 0 && (
              <span className="text-red-600 font-medium">
                {errors.length} failed
              </span>
            )}
          </div>
        </div>

        {/* Quick Stats */}
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-6">
          <StatCard
            icon={<DollarSign className="w-5 h-5 text-green-600" />}
            label="Total Amount"
            value={formatCurrency(
              invoices.reduce((sum, inv) => sum + inv.amount, 0)
            )}
          />
          <StatCard
            icon={<Building className="w-5 h-5 text-blue-600" />}
            label="Vendors"
            value={new Set(invoices.map((inv) => inv.vendor)).size}
          />
          <StatCard
            icon={<TrendingUp className="w-5 h-5 text-purple-600" />}
            label="Avg Confidence"
            value={`${Math.round(
              invoices.reduce((sum, inv) => sum + inv.confidence, 0) /
                invoices.length
            )}%`}
          />
          <StatCard
            icon={<AlertTriangle className="w-5 h-5 text-yellow-600" />}
            label="Need Review"
            value={invoices.filter((inv) => inv.needsReview).length}
          />
        </div>

        {/* Success Message */}
        <div className="bg-green-50 border border-green-200 rounded-lg p-4">
          <div className="flex items-start space-x-3">
            <CheckCircle className="w-5 h-5 text-green-600 mt-0.5" />
            <div>
              <h3 className="font-medium text-green-900">
                Invoices processed successfully!
              </h3>
              <p className="text-green-700 text-sm mt-1">
                {processed} invoice{processed > 1 ? "s" : ""} extracted and
                categorized. You can review and edit the results below.
              </p>
            </div>
          </div>
        </div>
      </div>

      {/* Individual Results */}
      <div className="space-y-4">
        <h3 className="text-lg font-semibold">Processed Invoices</h3>

        {invoices.map((invoice, index) => (
          <InvoiceResultCard
            key={invoice.id}
            invoice={invoice}
            index={index}
            isExpanded={expandedItem === invoice.id}
            onToggleExpand={() =>
              setExpandedItem(expandedItem === invoice.id ? null : invoice.id)
            }
          />
        ))}
      </div>

      {/* Errors Section */}
      {errors && errors.length > 0 && (
        <div className="card p-6 border-red-200">
          <h3 className="text-lg font-semibold text-red-900 mb-4 flex items-center">
            <AlertCircle className="w-5 h-5 mr-2" />
            Processing Errors
          </h3>
          <div className="space-y-3">
            {errors.map((error, index) => (
              <div
                key={index}
                className="bg-red-50 border border-red-200 rounded-lg p-4"
              >
                <div className="flex items-center space-x-3">
                  <AlertCircle className="w-5 h-5 text-red-600" />
                  <div>
                    <p className="font-medium text-red-900">{error.fileName}</p>
                    <p className="text-red-700 text-sm">{error.error}</p>
                  </div>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Action Buttons */}
      <div className="flex flex-wrap gap-3">
        <Link href="/dashboard" className="btn-primary">
          <Eye className="w-4 h-4 mr-2" />
          View Dashboard
        </Link>
        <button
          onClick={() => window.location.reload()}
          className="btn-secondary"
        >
          Process More Invoices
        </button>
      </div>
    </div>
  );
}

// Individual Invoice Result Card
function InvoiceResultCard({ invoice, index, isExpanded, onToggleExpand }) {
  const confidenceColor = getConfidenceColor(invoice.confidence);
  const confidenceLevel = getConfidenceLevel(invoice.confidence);

  return (
    <div className="card p-4 hover:shadow-md transition-shadow">
      <div className="flex items-center justify-between">
        <div className="flex items-center space-x-4">
          <div className="flex-shrink-0">
            <div className="w-10 h-10 bg-blue-100 rounded-full flex items-center justify-center">
              <span className="text-blue-600 font-semibold">{index + 1}</span>
            </div>
          </div>

          <div className="flex-1">
            <div className="flex items-center space-x-3 mb-1">
              <h4 className="font-medium text-gray-900">{invoice.vendor}</h4>
              {invoice.needsReview && (
                <span className="badge-warning">Needs Review</span>
              )}
              {invoice.isDuplicate && (
                <span className="badge-error">Potential Duplicate</span>
              )}
            </div>

            <div className="flex items-center space-x-4 text-sm text-gray-600">
              <span className="flex items-center">
                <Calendar className="w-4 h-4 mr-1" />
                {formatDate(invoice.date)}
              </span>
              <span className="flex items-center">
                <DollarSign className="w-4 h-4 mr-1" />
                {formatCurrency(invoice.amount)}
              </span>
              <span className="flex items-center">
                <Building className="w-4 h-4 mr-1" />
                {invoice.category}
              </span>
            </div>
          </div>
        </div>

        <div className="flex items-center space-x-3">
          {/* Confidence Score */}
          <div className="text-center">
            <div className={`text-lg font-bold ${confidenceColor}`}>
              {invoice.confidence}%
            </div>
            <div className="text-xs text-gray-500">{confidenceLevel}</div>
          </div>

          {/* Actions */}
          <div className="flex space-x-2">
            <button
              onClick={onToggleExpand}
              className="btn-outline text-xs px-3 py-1"
            >
              {isExpanded ? "Less" : "Details"}
            </button>
            <Link
              href={`/invoice/${invoice.id}`}
              className="btn-primary text-xs px-3 py-1"
            >
              <Edit className="w-3 h-3 mr-1" />
              Edit
            </Link>
          </div>
        </div>
      </div>

      {/* Expanded Details */}
      {isExpanded && (
        <div className="mt-4 pt-4 border-t border-gray-200">
          <div className="grid md:grid-cols-2 gap-6">
            {/* Extracted Data */}
            <div>
              <h5 className="font-medium text-gray-900 mb-3">Extracted Data</h5>
              <div className="space-y-2 text-sm">
                <div className="flex justify-between">
                  <span className="text-gray-600">Vendor:</span>
                  <span className="font-medium">{invoice.vendor}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-gray-600">Date:</span>
                  <span className="font-medium">
                    {formatDate(invoice.date)}
                  </span>
                </div>
                <div className="flex justify-between">
                  <span className="text-gray-600">Amount:</span>
                  <span className="font-medium">
                    {formatCurrency(invoice.amount)}
                  </span>
                </div>
                <div className="flex justify-between">
                  <span className="text-gray-600">Category:</span>
                  <span className="font-medium">{invoice.category}</span>
                </div>
              </div>
            </div>

            {/* Category Prediction */}
            {invoice.categoryPrediction && (
              <div>
                <h5 className="font-medium text-gray-900 mb-3">
                  AI Prediction
                </h5>
                <div className="space-y-2 text-sm">
                  <div className="flex justify-between">
                    <span className="text-gray-600">Suggested:</span>
                    <span className="font-medium">
                      {invoice.categoryPrediction.name}
                    </span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-gray-600">Confidence:</span>
                    <span
                      className={`font-medium ${getConfidenceColor(
                        invoice.categoryPrediction.confidence
                      )}`}
                    >
                      {invoice.categoryPrediction.confidence}%
                    </span>
                  </div>
                  {invoice.categoryPrediction.reason && (
                    <div className="text-gray-600 text-xs mt-2">
                      {invoice.categoryPrediction.reason}
                    </div>
                  )}
                </div>
              </div>
            )}
          </div>

          {/* Issues */}
          {invoice.issues && invoice.issues.length > 0 && (
            <div className="mt-4">
              <h5 className="font-medium text-gray-900 mb-2">Issues Found</h5>
              <div className="space-y-1">
                {invoice.issues.map((issue, i) => (
                  <div
                    key={i}
                    className="flex items-center space-x-2 text-sm text-yellow-700"
                  >
                    <AlertTriangle className="w-4 h-4" />
                    <span>{issue}</span>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Processing Info */}
          <div className="mt-4 text-xs text-gray-500">
            Processing time: {invoice.processingTime}ms
            {invoice.duplicateCount > 0 && (
              <span className="ml-4">
                Found {invoice.duplicateCount} potential duplicate
                {invoice.duplicateCount > 1 ? "s" : ""}
              </span>
            )}
          </div>
        </div>
      )}
    </div>
  );
}

// Stat Card Component
function StatCard({ icon, label, value }) {
  return (
    <div className="text-center">
      <div className="flex justify-center mb-2">{icon}</div>
      <div className="text-lg font-bold text-gray-900">{value}</div>
      <div className="text-sm text-gray-500">{label}</div>
    </div>
  );
}

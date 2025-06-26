"use client";

import { useState } from "react";
import {
  Trash2,
  CheckCircle,
  Building,
  X,
  ChevronDown,
  AlertTriangle,
} from "lucide-react";
import { bulkActionInvoices, getExpenseCategories } from "../../lib/api";
import toast from "react-hot-toast";

export default function BulkActions({
  selectedCount,
  selectedInvoices,
  onBulkAction,
  onClearSelection,
}) {
  const [isActionsOpen, setIsActionsOpen] = useState(false);
  const [showCategoryModal, setShowCategoryModal] = useState(false);
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false);
  const [loading, setLoading] = useState(false);

  const handleBulkAction = async (action, data = {}) => {
    try {
      setLoading(true);
      await bulkActionInvoices(action, selectedInvoices, data);
      toast.success(
        `Successfully ${
          action === "delete" ? "deleted" : "updated"
        } ${selectedCount} invoice${selectedCount > 1 ? "s" : ""}`
      );
      onBulkAction(action, data);
    } catch (error) {
      console.error("Bulk action failed:", error);
      toast.error(error.message || "Bulk action failed");
    } finally {
      setLoading(false);
      setIsActionsOpen(false);
      setShowCategoryModal(false);
      setShowDeleteConfirm(false);
    }
  };

  return (
    <>
      <div className="card p-4 bg-blue-50 border-blue-200">
        <div className="flex items-center justify-between">
          <div className="flex items-center space-x-4">
            <div className="flex items-center space-x-2">
              <CheckCircle className="w-5 h-5 text-blue-600" />
              <span className="font-medium text-blue-900">
                {selectedCount} invoice{selectedCount > 1 ? "s" : ""} selected
              </span>
            </div>
          </div>

          <div className="flex items-center space-x-3">
            {/* Actions Dropdown */}
            <div className="relative">
              <button
                onClick={() => setIsActionsOpen(!isActionsOpen)}
                disabled={loading}
                className="btn-primary disabled:opacity-50"
              >
                Actions
                <ChevronDown className="w-4 h-4 ml-1" />
              </button>

              {isActionsOpen && (
                <div className="absolute right-0 mt-2 w-56 bg-white rounded-md shadow-lg z-20 border border-gray-200">
                  <div className="py-1">
                    <button
                      onClick={() => setShowCategoryModal(true)}
                      className="block w-full text-left px-4 py-2 text-sm text-gray-700 hover:bg-gray-100"
                    >
                      <Building className="w-4 h-4 inline mr-2" />
                      Update Category
                    </button>
                    <button
                      onClick={() => handleBulkAction("markReviewed")}
                      className="block w-full text-left px-4 py-2 text-sm text-gray-700 hover:bg-gray-100"
                    >
                      <CheckCircle className="w-4 h-4 inline mr-2" />
                      Mark as Reviewed
                    </button>
                    <div className="border-t border-gray-100"></div>
                    <button
                      onClick={() => setShowDeleteConfirm(true)}
                      className="block w-full text-left px-4 py-2 text-sm text-red-600 hover:bg-red-50"
                    >
                      <Trash2 className="w-4 h-4 inline mr-2" />
                      Delete Selected
                    </button>
                  </div>
                </div>
              )}
            </div>

            {/* Clear Selection */}
            <button
              onClick={onClearSelection}
              className="btn-outline"
              disabled={loading}
            >
              <X className="w-4 h-4 mr-1" />
              Clear
            </button>
          </div>
        </div>
      </div>

      {/* Category Update Modal */}
      {showCategoryModal && (
        <CategoryUpdateModal
          selectedCount={selectedCount}
          onConfirm={(category) =>
            handleBulkAction("updateCategory", { category })
          }
          onCancel={() => setShowCategoryModal(false)}
          loading={loading}
        />
      )}

      {/* Delete Confirmation Modal */}
      {showDeleteConfirm && (
        <DeleteConfirmModal
          selectedCount={selectedCount}
          onConfirm={() => handleBulkAction("delete")}
          onCancel={() => setShowDeleteConfirm(false)}
          loading={loading}
        />
      )}
    </>
  );
}

// Category Update Modal
function CategoryUpdateModal({ selectedCount, onConfirm, onCancel, loading }) {
  const [categories, setCategories] = useState([]);
  const [selectedCategory, setSelectedCategory] = useState("");
  const [loadingCategories, setLoadingCategories] = useState(true);

  useState(() => {
    loadCategories();
  }, []);

  const loadCategories = async () => {
    try {
      const data = await getExpenseCategories();
      setCategories(data.categories);
    } catch (error) {
      console.error("Failed to load categories:", error);
      toast.error("Failed to load categories");
    } finally {
      setLoadingCategories(false);
    }
  };

  const handleConfirm = () => {
    if (!selectedCategory) {
      toast.error("Please select a category");
      return;
    }
    onConfirm(selectedCategory);
  };

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
      <div className="bg-white rounded-lg p-6 w-full max-w-md">
        <h3 className="text-lg font-medium text-gray-900 mb-4">
          Update Category
        </h3>
        <p className="text-sm text-gray-600 mb-4">
          Select a new category for {selectedCount} selected invoice
          {selectedCount > 1 ? "s" : ""}:
        </p>

        {loadingCategories ? (
          <div className="text-center py-4">
            <div className="spinner w-6 h-6 mx-auto"></div>
          </div>
        ) : (
          <div className="mb-6">
            <select
              value={selectedCategory}
              onChange={(e) => setSelectedCategory(e.target.value)}
              className="input w-full"
              disabled={loading}
            >
              <option value="">Select a category...</option>
              {categories.map((category) => (
                <option key={category.code} value={category.code}>
                  {category.code} - {category.name}
                </option>
              ))}
            </select>
          </div>
        )}

        <div className="flex space-x-3">
          <button
            onClick={onCancel}
            disabled={loading}
            className="btn-outline flex-1"
          >
            Cancel
          </button>
          <button
            onClick={handleConfirm}
            disabled={loading || !selectedCategory}
            className="btn-primary flex-1 disabled:opacity-50"
          >
            {loading ? (
              <>
                <div className="spinner w-4 h-4 mr-2"></div>
                Updating...
              </>
            ) : (
              "Update Category"
            )}
          </button>
        </div>
      </div>
    </div>
  );
}

// Delete Confirmation Modal
function DeleteConfirmModal({ selectedCount, onConfirm, onCancel, loading }) {
  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
      <div className="bg-white rounded-lg p-6 w-full max-w-md">
        <div className="flex items-center space-x-3 mb-4">
          <div className="p-2 bg-red-100 rounded-full">
            <AlertTriangle className="w-6 h-6 text-red-600" />
          </div>
          <h3 className="text-lg font-medium text-gray-900">Delete Invoices</h3>
        </div>

        <p className="text-sm text-gray-600 mb-6">
          Are you sure you want to delete {selectedCount} selected invoice
          {selectedCount > 1 ? "s" : ""}? This action cannot be undone.
        </p>

        <div className="bg-red-50 border border-red-200 rounded-lg p-4 mb-6">
          <div className="flex items-start space-x-2">
            <AlertTriangle className="w-4 h-4 text-red-600 mt-0.5" />
            <div className="text-sm text-red-700">
              <p className="font-medium">This will permanently:</p>
              <ul className="mt-1 space-y-1">
                <li>• Delete the invoice records from the database</li>
                <li>• Remove associated uploaded files</li>
                <li>• Clear any learning data for these invoices</li>
              </ul>
            </div>
          </div>
        </div>

        <div className="flex space-x-3">
          <button
            onClick={onCancel}
            disabled={loading}
            className="btn-outline flex-1"
          >
            Cancel
          </button>
          <button
            onClick={onConfirm}
            disabled={loading}
            className="bg-red-600 text-white px-4 py-2 rounded-lg hover:bg-red-700 disabled:opacity-50 flex-1"
          >
            {loading ? (
              <>
                <div className="spinner w-4 h-4 mr-2"></div>
                Deleting...
              </>
            ) : (
              "Delete Invoices"
            )}
          </button>
        </div>
      </div>
    </div>
  );
}

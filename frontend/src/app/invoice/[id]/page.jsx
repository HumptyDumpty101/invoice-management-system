"use client";

import { useState, useEffect } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import {
  ArrowLeft,
  Save,
  Eye,
  Edit,
  AlertTriangle,
  CheckCircle,
  FileText,
  Calendar,
  DollarSign,
  Building,
  Tag,
  Clock,
  Download,
  Copy,
  Trash2,
  RefreshCw,
  Plus,
  X,
  Info,
} from "lucide-react";
import Link from "next/link";
import {
  getInvoice,
  updateInvoice,
  deleteInvoice,
  getExpenseCategories,
  predictCategory,
  formatCurrency,
  formatDate,
  formatDateTime,
  getConfidenceColor,
  getConfidenceLevel,
} from "../../../lib/api";
import toast from "react-hot-toast";

export default function InvoiceEditPage({ params }) {
  const router = useRouter();
  const searchParams = useSearchParams();
  const isViewMode = searchParams.get("view") === "true";

  const [invoice, setInvoice] = useState(null);
  const [categories, setCategories] = useState([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState(null);
  const [isEditing, setIsEditing] = useState(!isViewMode);
  const [showRawText, setShowRawText] = useState(false);
  const [formData, setFormData] = useState({});
  const [validationErrors, setValidationErrors] = useState({});
  const [categoryPrediction, setCategoryPrediction] = useState(null);
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false);

  useEffect(() => {
    if (params.id) {
      loadInvoice(params.id);
      loadCategories();
    }
  }, [params.id]);

  const loadInvoice = async (id) => {
    try {
      setLoading(true);
      const data = await getInvoice(id);
      setInvoice(data);
      setFormData({
        vendor: data.vendor,
        date: new Date(data.date).toISOString().split("T")[0],
        amount: data.amount,
        category: data.category,
        extractedData: {
          lineItems: data.extractedData?.lineItems || [],
          tax: data.extractedData?.tax || 0,
          subtotal: data.extractedData?.subtotal || 0,
        },
      });
      setError(null);
    } catch (err) {
      console.error("Failed to load invoice:", err);
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  const loadCategories = async () => {
    try {
      const data = await getExpenseCategories();
      setCategories(data.categories);
    } catch (error) {
      console.error("Failed to load categories:", error);
    }
  };

  const handlePredictCategory = async () => {
    if (!formData.vendor) return;

    try {
      const prediction = await predictCategory(
        formData.vendor,
        formData.amount
      );
      setCategoryPrediction(prediction.prediction);
      if (prediction.prediction) {
        setFormData((prev) => ({
          ...prev,
          category: prediction.prediction.category,
        }));
        toast.success(`Category predicted: ${prediction.prediction.name}`);
      }
    } catch (error) {
      console.error("Failed to predict category:", error);
      toast.error("Failed to predict category");
    }
  };

  const validateForm = () => {
    const errors = {};
    const warnings = [];

    // CHANGED: Much more lenient validation - mostly just required field checks
    if (!formData.vendor?.trim()) {
      errors.vendor = "Vendor name is required";
    } else if (formData.vendor.trim().length > 200) {
      warnings.push("Vendor name is very long");
    }

    if (!formData.date) {
      errors.date = "Date is required";
    } else {
      // CHANGED: More lenient date validation
      const selectedDate = new Date(formData.date);
      const fiveYearsAgo = new Date();
      fiveYearsAgo.setFullYear(fiveYearsAgo.getFullYear() - 5);
      const twoYearsFromNow = new Date();
      twoYearsFromNow.setFullYear(twoYearsFromNow.getFullYear() + 2);

      if (selectedDate < fiveYearsAgo) {
        warnings.push("Date is over 5 years old - please verify");
      } else if (selectedDate > twoYearsFromNow) {
        warnings.push("Date is over 2 years in the future - please verify");
      }
    }

    if (!formData.amount || formData.amount <= 0) {
      errors.amount = "Amount must be greater than 0";
    } else {
      // CHANGED: Only warn for extreme amounts, don't block
      if (formData.amount > 1000000) {
        warnings.push("Amount is very large - please verify");
      }
      if (formData.amount < 0.01) {
        warnings.push("Amount is very small - please verify");
      }
    }

    if (!formData.category) {
      errors.category = "Category is required";
    }

    // CHANGED: Business logic warnings only, no blocking
    if (formData.vendor && formData.amount) {
      const vendor = formData.vendor.toLowerCase();

      // Food service warning (not blocking)
      const foodKeywords = [
        "restaurant",
        "cafe",
        "bistro",
        "starbucks",
        "mcdonald",
        "food",
      ];
      const isFood = foodKeywords.some((keyword) => vendor.includes(keyword));
      if (isFood && formData.amount > 1000) {
        warnings.push(
          "High amount for food/restaurant - please verify this is correct"
        );
      }

      // Subscription service warning (not blocking)
      const subscriptionServices = [
        "midjourney",
        "netflix",
        "spotify",
        "adobe",
        "microsoft",
      ];
      const isSubscription = subscriptionServices.some((service) =>
        vendor.includes(service)
      );
      if (isSubscription && formData.amount > 1000) {
        warnings.push("High amount for subscription service - please verify");
      }
    }

    setValidationErrors(errors);

    // FIXED: Use toast methods that actually exist in react-hot-toast
    if (warnings.length > 0) {
      warnings.forEach((warning) => {
        // Use toast.error with custom styling or toast() with options instead of toast.warning
        toast(warning, {
          duration: 4000,
          icon: "⚠️",
          style: {
            background: "#fef3c7",
            color: "#92400e",
            border: "1px solid #f59e0b",
          },
        });
      });
    }

    return Object.keys(errors).length === 0; // Only block for required fields and basic format issues
  };

  const handleSave = async () => {
    if (!validateForm()) {
      toast.error("Please fix validation errors");
      return;
    }

    try {
      setSaving(true);
      const updatedInvoice = await updateInvoice(invoice._id, formData);
      setInvoice(updatedInvoice.invoice);
      setIsEditing(false);
      toast.success("Invoice updated successfully");
    } catch (error) {
      console.error("Failed to save invoice:", error);
      toast.error(error.message || "Failed to save invoice");
    } finally {
      setSaving(false);
    }
  };

  const handleDelete = async () => {
    try {
      await deleteInvoice(invoice._id);
      toast.success("Invoice deleted successfully");
      router.push("/dashboard");
    } catch (error) {
      console.error("Failed to delete invoice:", error);
      toast.error(error.message || "Failed to delete invoice");
    }
  };

  const addLineItem = () => {
    setFormData((prev) => ({
      ...prev,
      extractedData: {
        ...prev.extractedData,
        lineItems: [
          ...prev.extractedData.lineItems,
          { description: "", amount: 0, quantity: 1 },
        ],
      },
    }));
  };

  const updateLineItem = (index, field, value) => {
    setFormData((prev) => ({
      ...prev,
      extractedData: {
        ...prev.extractedData,
        lineItems: prev.extractedData.lineItems.map((item, i) =>
          i === index ? { ...item, [field]: value } : item
        ),
      },
    }));
  };

  const removeLineItem = (index) => {
    setFormData((prev) => ({
      ...prev,
      extractedData: {
        ...prev.extractedData,
        lineItems: prev.extractedData.lineItems.filter((_, i) => i !== index),
      },
    }));
  };

  // Loading State
  if (loading) {
    return (
      <div className="max-w-4xl mx-auto space-y-6">
        <div className="flex justify-between items-center">
          <div className="flex items-center space-x-4">
            <div className="h-10 bg-gray-300 rounded w-32 animate-pulse"></div>
            <div>
              <div className="h-8 bg-gray-300 rounded w-48 mb-2 animate-pulse"></div>
              <div className="h-4 bg-gray-300 rounded w-64 animate-pulse"></div>
            </div>
          </div>
        </div>

        <div className="grid lg:grid-cols-3 gap-6">
          <div className="lg:col-span-2 space-y-6">
            {[...Array(3)].map((_, i) => (
              <div key={i} className="card p-6 animate-pulse">
                <div className="h-6 bg-gray-300 rounded w-48 mb-4"></div>
                <div className="grid grid-cols-2 gap-4">
                  <div className="h-20 bg-gray-300 rounded"></div>
                  <div className="h-20 bg-gray-300 rounded"></div>
                </div>
              </div>
            ))}
          </div>

          <div className="space-y-6">
            {[...Array(4)].map((_, i) => (
              <div key={i} className="card p-4 animate-pulse">
                <div className="h-5 bg-gray-300 rounded w-32 mb-3"></div>
                <div className="space-y-2">
                  <div className="h-4 bg-gray-300 rounded"></div>
                  <div className="h-4 bg-gray-300 rounded w-3/4"></div>
                  <div className="h-4 bg-gray-300 rounded w-1/2"></div>
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>
    );
  }

  // Error State
  if (error) {
    return (
      <div className="max-w-4xl mx-auto">
        <div className="card p-12 text-center">
          <AlertTriangle className="w-16 h-16 text-red-500 mx-auto mb-4" />
          <h3 className="text-lg font-medium text-gray-900 mb-2">
            Failed to Load Invoice
          </h3>
          <p className="text-gray-600 mb-6">{error}</p>
          <div className="flex justify-center space-x-3">
            <button
              onClick={() => loadInvoice(params.id)}
              className="btn-primary"
            >
              <RefreshCw className="w-4 h-4 mr-2" />
              Try Again
            </button>
            <Link href="/dashboard" className="btn-outline">
              <ArrowLeft className="w-4 h-4 mr-2" />
              Back to Dashboard
            </Link>
          </div>
        </div>
      </div>
    );
  }

  // Not Found State
  if (!invoice) {
    return (
      <div className="max-w-4xl mx-auto">
        <div className="card p-12 text-center">
          <FileText className="w-16 h-16 text-gray-300 mx-auto mb-4" />
          <h3 className="text-lg font-medium text-gray-900 mb-2">
            Invoice Not Found
          </h3>
          <p className="text-gray-600 mb-6">
            The invoice you're looking for doesn't exist or may have been
            deleted.
          </p>
          <Link href="/dashboard" className="btn-primary">
            <ArrowLeft className="w-4 h-4 mr-2" />
            Back to Dashboard
          </Link>
        </div>
      </div>
    );
  }

  const confidence = invoice.validationStatus?.overallConfidence || 0;
  const confidenceColor = getConfidenceColor(confidence);
  const confidenceLevel = getConfidenceLevel(confidence);
  const needsReview = invoice.validationStatus?.needsReview;
  const issues = invoice.validationStatus?.issues || [];

  return (
    <div className="max-w-4xl mx-auto space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center space-x-4">
          <Link href="/dashboard" className="btn-outline">
            <ArrowLeft className="w-4 h-4 mr-2" />
            Back to Dashboard
          </Link>
          <div>
            <h1 className="text-2xl font-bold text-gray-900">
              {isEditing ? "Edit Invoice" : "Invoice Details"}
            </h1>
            <p className="text-gray-500">
              ID: {invoice._id.slice(-8)} • {formatDateTime(invoice.createdAt)}
            </p>
          </div>
        </div>

        <div className="flex items-center space-x-3">
          {!isEditing && (
            <button
              onClick={() => setIsEditing(true)}
              className="btn-secondary"
            >
              <Edit className="w-4 h-4 mr-2" />
              Edit
            </button>
          )}

          {isEditing && (
            <>
              <button
                onClick={() => setIsEditing(false)}
                className="btn-outline"
                disabled={saving}
              >
                Cancel
              </button>
              <button
                onClick={handleSave}
                disabled={saving}
                className="btn-primary"
              >
                {saving ? (
                  <>
                    <div className="spinner w-4 h-4 mr-2"></div>
                    Saving...
                  </>
                ) : (
                  <>
                    <Save className="w-4 h-4 mr-2" />
                    Save Changes
                  </>
                )}
              </button>
            </>
          )}

          <button
            onClick={() => setShowDeleteConfirm(true)}
            className="text-red-600 hover:text-red-700"
          >
            <Trash2 className="w-4 h-4" />
          </button>
        </div>
      </div>

      {/* Status Banner */}
      {!needsReview && confidence >= 80 ? (
        <div className="card p-4 bg-green-50 border-green-200">
          <div className="flex items-center space-x-3">
            <CheckCircle className="w-5 h-5 text-green-600" />
            <div>
              <h3 className="font-medium text-green-900">
                Invoice Processed Successfully
              </h3>
              <p className="text-green-700 text-sm">
                High confidence extraction ({confidence}%) with no critical
                issues detected.
              </p>
            </div>
          </div>
        </div>
      ) : (
        <div className="card p-4 bg-blue-50 border-blue-200">
          {" "}
          {/* CHANGED: Blue instead of yellow for less alarming */}
          <div className="flex items-start space-x-3">
            <Info className="w-5 h-5 text-blue-600 mt-0.5" />{" "}
            {/* CHANGED: Info instead of warning icon */}
            <div className="flex-1">
              <h3 className="font-medium text-blue-900">Review Recommended</h3>{" "}
              {/* CHANGED: Softer language */}
              <p className="text-blue-700 text-sm mb-2">
                This invoice has been flagged for review (Confidence:{" "}
                {confidence}%).
              </p>
              {issues.length > 0 && (
                <div className="space-y-1">
                  <p className="text-blue-700 text-sm font-medium">
                    Notes found:
                  </p>
                  <ul className="list-disc list-inside space-y-1">
                    {issues.map((issue, index) => (
                      <li key={index} className="text-blue-700 text-sm">
                        {issue}
                      </li>
                    ))}
                  </ul>
                </div>
              )}
            </div>
          </div>
        </div>
      )}

      <div className="grid lg:grid-cols-3 gap-6">
        {/* Main Content */}
        <div className="lg:col-span-2 space-y-6">
          {/* Basic Information */}
          <div className="card p-6">
            <h2 className="text-lg font-medium text-gray-900 mb-4">
              Invoice Information
            </h2>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Vendor Name *
                </label>
                {isEditing ? (
                  <div>
                    <input
                      type="text"
                      value={formData.vendor}
                      onChange={(e) =>
                        setFormData((prev) => ({
                          ...prev,
                          vendor: e.target.value,
                        }))
                      }
                      className={`input ${
                        validationErrors.vendor ? "border-red-300" : ""
                      }`}
                      placeholder="Enter vendor name"
                    />
                    {validationErrors.vendor && (
                      <p className="text-red-600 text-sm mt-1">
                        {validationErrors.vendor}
                      </p>
                    )}
                  </div>
                ) : (
                  <p className="text-gray-900 font-medium">{invoice.vendor}</p>
                )}
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Date *
                </label>
                {isEditing ? (
                  <div>
                    <input
                      type="date"
                      value={formData.date}
                      onChange={(e) =>
                        setFormData((prev) => ({
                          ...prev,
                          date: e.target.value,
                        }))
                      }
                      className={`input ${
                        validationErrors.date ? "border-red-300" : ""
                      }`}
                    />
                    {validationErrors.date && (
                      <p className="text-red-600 text-sm mt-1">
                        {validationErrors.date}
                      </p>
                    )}
                  </div>
                ) : (
                  <p className="text-gray-900 font-medium">
                    {formatDate(invoice.date)}
                  </p>
                )}
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Amount *
                </label>
                {isEditing ? (
                  <div>
                    <input
                      type="number"
                      min="0"
                      step="0.01"
                      value={formData.amount}
                      onChange={(e) =>
                        setFormData((prev) => ({
                          ...prev,
                          amount: parseFloat(e.target.value) || 0,
                        }))
                      }
                      className={`input ${
                        validationErrors.amount ? "border-red-300" : ""
                      }`}
                      placeholder="0.00"
                    />
                    {validationErrors.amount && (
                      <p className="text-red-600 text-sm mt-1">
                        {validationErrors.amount}
                      </p>
                    )}
                  </div>
                ) : (
                  <p className="text-gray-900 font-medium text-xl">
                    {formatCurrency(invoice.amount)}
                  </p>
                )}
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Category *
                </label>
                {isEditing ? (
                  <div>
                    <div className="flex space-x-2">
                      <select
                        value={formData.category}
                        onChange={(e) =>
                          setFormData((prev) => ({
                            ...prev,
                            category: e.target.value,
                          }))
                        }
                        className={`input flex-1 ${
                          validationErrors.category ? "border-red-300" : ""
                        }`}
                      >
                        <option value="">Select category...</option>
                        {categories.map((category) => (
                          <option key={category.code} value={category.code}>
                            {category.code} - {category.name}
                          </option>
                        ))}
                      </select>
                      <button
                        onClick={handlePredictCategory}
                        className="btn-outline px-3"
                        title="Predict category"
                      >
                        <RefreshCw className="w-4 h-4" />
                      </button>
                    </div>
                    {validationErrors.category && (
                      <p className="text-red-600 text-sm mt-1">
                        {validationErrors.category}
                      </p>
                    )}
                    {categoryPrediction && (
                      <div className="mt-2 p-2 bg-blue-50 rounded text-sm">
                        <p className="text-blue-700">
                          <strong>AI Suggestion:</strong>{" "}
                          {categoryPrediction.name}(
                          {categoryPrediction.confidence}% confidence)
                        </p>
                        {categoryPrediction.reason && (
                          <p className="text-blue-600 text-xs mt-1">
                            {categoryPrediction.reason}
                          </p>
                        )}
                      </div>
                    )}
                  </div>
                ) : (
                  <div>
                    <p className="text-gray-900 font-medium">
                      {invoice.category}
                    </p>
                    {categories.find((c) => c.code === invoice.category) && (
                      <p className="text-gray-500 text-sm">
                        {
                          categories.find((c) => c.code === invoice.category)
                            .name
                        }
                      </p>
                    )}
                  </div>
                )}
              </div>
            </div>
          </div>

          {/* Line Items */}
          <div className="card p-6">
            <div className="flex items-center justify-between mb-4">
              <h2 className="text-lg font-medium text-gray-900">Line Items</h2>
              {isEditing && (
                <button onClick={addLineItem} className="btn-outline text-sm">
                  <Plus className="w-4 h-4 mr-1" />
                  Add Item
                </button>
              )}
            </div>

            {formData.extractedData.lineItems.length === 0 ? (
              <div className="text-center py-8 text-gray-500">
                <FileText className="w-12 h-12 mx-auto mb-2 text-gray-300" />
                <p>No line items extracted</p>
                {isEditing && (
                  <button onClick={addLineItem} className="btn-primary mt-3">
                    Add First Item
                  </button>
                )}
              </div>
            ) : (
              <div className="space-y-3">
                {formData.extractedData.lineItems.map((item, index) => (
                  <div
                    key={index}
                    className="flex items-center space-x-3 p-3 bg-gray-50 rounded"
                  >
                    <div className="flex-1">
                      {isEditing ? (
                        <input
                          type="text"
                          value={item.description}
                          onChange={(e) =>
                            updateLineItem(index, "description", e.target.value)
                          }
                          className="input text-sm"
                          placeholder="Item description"
                        />
                      ) : (
                        <p className="text-gray-900">{item.description}</p>
                      )}
                    </div>

                    <div className="w-20">
                      {isEditing ? (
                        <input
                          type="number"
                          min="1"
                          value={item.quantity}
                          onChange={(e) =>
                            updateLineItem(
                              index,
                              "quantity",
                              parseInt(e.target.value) || 1
                            )
                          }
                          className="input text-sm text-center"
                          placeholder="Qty"
                        />
                      ) : (
                        <p className="text-gray-600 text-center">
                          {item.quantity}
                        </p>
                      )}
                    </div>

                    <div className="w-24">
                      {isEditing ? (
                        <input
                          type="number"
                          min="0"
                          step="0.01"
                          value={item.amount}
                          onChange={(e) =>
                            updateLineItem(
                              index,
                              "amount",
                              parseFloat(e.target.value) || 0
                            )
                          }
                          className="input text-sm text-right"
                          placeholder="0.00"
                        />
                      ) : (
                        <p className="text-gray-900 text-right font-medium">
                          {formatCurrency(item.amount)}
                        </p>
                      )}
                    </div>

                    {isEditing && (
                      <button
                        onClick={() => removeLineItem(index)}
                        className="text-red-600 hover:text-red-700"
                      >
                        <Trash2 className="w-4 h-4" />
                      </button>
                    )}
                  </div>
                ))}
              </div>
            )}
          </div>

          {/* Tax and Totals */}
          <div className="card p-6">
            <h2 className="text-lg font-medium text-gray-900 mb-4">Totals</h2>

            <div className="space-y-4">
              <div className="flex justify-between items-center">
                <span className="text-gray-600">Line Items Total:</span>
                <span className="font-medium">
                  {formatCurrency(
                    formData.extractedData.lineItems.reduce(
                      (sum, item) => sum + item.amount * (item.quantity || 1),
                      0
                    )
                  )}
                </span>
              </div>

              <div className="flex justify-between items-center">
                <span className="text-gray-600">Subtotal:</span>
                {isEditing ? (
                  <input
                    type="number"
                    min="0"
                    step="0.01"
                    value={formData.extractedData.subtotal}
                    onChange={(e) =>
                      setFormData((prev) => ({
                        ...prev,
                        extractedData: {
                          ...prev.extractedData,
                          subtotal: parseFloat(e.target.value) || 0,
                        },
                      }))
                    }
                    className="input w-24 text-right"
                  />
                ) : (
                  <span className="font-medium">
                    {formatCurrency(formData.extractedData.subtotal)}
                  </span>
                )}
              </div>

              <div className="flex justify-between items-center">
                <span className="text-gray-600">Tax:</span>
                {isEditing ? (
                  <input
                    type="number"
                    min="0"
                    step="0.01"
                    value={formData.extractedData.tax}
                    onChange={(e) =>
                      setFormData((prev) => ({
                        ...prev,
                        extractedData: {
                          ...prev.extractedData,
                          tax: parseFloat(e.target.value) || 0,
                        },
                      }))
                    }
                    className="input w-24 text-right"
                  />
                ) : (
                  <span className="font-medium">
                    {formatCurrency(formData.extractedData.tax)}
                  </span>
                )}
              </div>

              <div className="border-t pt-4">
                <div className="flex justify-between items-center">
                  <span className="text-gray-900 font-medium">
                    Total Amount:
                  </span>
                  <span className="text-xl font-bold text-gray-900">
                    {formatCurrency(formData.amount)}
                  </span>
                </div>
              </div>
            </div>
          </div>
        </div>

        {/* Sidebar */}
        <div className="space-y-6">
          {/* Confidence Score */}
          <div className="card p-4">
            <h3 className="font-medium text-gray-700 mb-3">Confidence Score</h3>
            <div className="text-center">
              <div className={`text-3xl font-bold ${confidenceColor} mb-1`}>
                {confidence}%
              </div>
              <div className="text-sm text-gray-500 mb-3">
                {confidenceLevel}
              </div>
              <div className="w-full bg-gray-200 rounded-full h-2">
                <div
                  className={`h-2 rounded-full ${
                    confidence >= 80
                      ? "bg-green-500"
                      : confidence >= 60
                      ? "bg-yellow-500"
                      : "bg-red-500"
                  }`}
                  style={{ width: `${confidence}%` }}
                />
              </div>
            </div>
          </div>

          {/* File Information */}
          <div className="card p-4">
            <h3 className="font-medium text-gray-700 mb-3">File Information</h3>
            <div className="space-y-2 text-sm">
              <div className="flex justify-between">
                <span className="text-gray-600">Original Name:</span>
                <span className="text-gray-900 truncate ml-2">
                  {invoice.fileMetadata?.originalName}
                </span>
              </div>
              <div className="flex justify-between">
                <span className="text-gray-600">Type:</span>
                <span className="text-gray-900 uppercase">
                  {invoice.fileMetadata?.fileType}
                </span>
              </div>
              <div className="flex justify-between">
                <span className="text-gray-600">Size:</span>
                <span className="text-gray-900">
                  {((invoice.fileMetadata?.fileSize || 0) / 1024).toFixed(1)} KB
                </span>
              </div>
              <div className="flex justify-between">
                <span className="text-gray-600">Pages:</span>
                <span className="text-gray-900">
                  {invoice.fileMetadata?.pageCount || 1}
                </span>
              </div>
              {invoice.fileMetadata?.ocrConfidence && (
                <div className="flex justify-between">
                  <span className="text-gray-600">OCR Confidence:</span>
                  <span className="text-gray-900">
                    {invoice.fileMetadata.ocrConfidence}%
                  </span>
                </div>
              )}
            </div>
          </div>

          {/* Processing Details */}
          <div className="card p-4">
            <h3 className="font-medium text-gray-700 mb-3">
              Processing Details
            </h3>
            <div className="space-y-2 text-sm">
              <div className="flex justify-between">
                <span className="text-gray-600">Method:</span>
                <span className="text-gray-900 capitalize">
                  {invoice.processingMetadata?.extractionMethod}
                </span>
              </div>
              <div className="flex justify-between">
                <span className="text-gray-600">Processing Time:</span>
                <span className="text-gray-900">
                  {invoice.processingMetadata?.processingTime}ms
                </span>
              </div>
              <div className="flex justify-between">
                <span className="text-gray-600">Version:</span>
                <span className="text-gray-900">
                  {invoice.processingMetadata?.version}
                </span>
              </div>
              <div className="flex justify-between">
                <span className="text-gray-600">User Corrected:</span>
                <span
                  className={
                    invoice.userCorrected ? "text-yellow-600" : "text-green-600"
                  }
                >
                  {invoice.userCorrected ? "Yes" : "No"}
                </span>
              </div>
              <div className="flex justify-between">
                <span className="text-gray-600">Created:</span>
                <span className="text-gray-900">
                  {formatDate(invoice.createdAt)}
                </span>
              </div>
              {invoice.updatedAt !== invoice.createdAt && (
                <div className="flex justify-between">
                  <span className="text-gray-600">Updated:</span>
                  <span className="text-gray-900">
                    {formatDate(invoice.updatedAt)}
                  </span>
                </div>
              )}
            </div>
          </div>

          {/* Potential Duplicates */}
          {invoice.potentialDuplicates &&
            invoice.potentialDuplicates.length > 0 && (
              <div className="card p-4">
                <h3 className="font-medium text-gray-700 mb-3 flex items-center">
                  <AlertTriangle className="w-4 h-4 mr-2 text-yellow-500" />
                  Potential Duplicates
                </h3>
                <div className="space-y-3">
                  {invoice.potentialDuplicates.slice(0, 3).map((duplicate) => (
                    <div
                      key={duplicate.id}
                      className="border border-yellow-200 rounded p-3 bg-yellow-50"
                    >
                      <div className="text-sm">
                        <p className="font-medium text-gray-900">
                          {duplicate.vendor}
                        </p>
                        <p className="text-gray-600">
                          {duplicate.formattedAmount} •{" "}
                          {duplicate.formattedDate}
                        </p>
                        <Link
                          href={`/invoice/${duplicate.id}`}
                          className="text-blue-600 hover:text-blue-700 text-xs"
                        >
                          View details →
                        </Link>
                      </div>
                    </div>
                  ))}
                  {invoice.potentialDuplicates.length > 3 && (
                    <p className="text-sm text-gray-500">
                      And {invoice.potentialDuplicates.length - 3} more
                      potential duplicates
                    </p>
                  )}
                </div>
              </div>
            )}

          {/* Raw Text */}
          <div className="card p-4">
            <button
              onClick={() => setShowRawText(!showRawText)}
              className="w-full text-left flex items-center justify-between"
            >
              <span className="font-medium text-gray-700">
                Raw Extracted Text
              </span>
              <Eye className="w-4 h-4" />
            </button>
            {showRawText && (
              <div className="mt-3 p-3 bg-gray-50 rounded text-sm max-h-64 overflow-y-auto">
                <pre className="whitespace-pre-wrap text-gray-600">
                  {invoice.rawText}
                </pre>
              </div>
            )}
          </div>
        </div>
      </div>

      {/* Delete Confirmation Modal */}
      {showDeleteConfirm && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
          <div className="bg-white rounded-lg p-6 w-full max-w-md">
            <div className="flex items-center space-x-3 mb-4">
              <div className="p-2 bg-red-100 rounded-full">
                <AlertTriangle className="w-6 h-6 text-red-600" />
              </div>
              <h3 className="text-lg font-medium text-gray-900">
                Delete Invoice
              </h3>
            </div>

            <p className="text-sm text-gray-600 mb-6">
              Are you sure you want to delete this invoice? This action cannot
              be undone and will permanently remove:
            </p>

            <div className="bg-red-50 border border-red-200 rounded-lg p-4 mb-6">
              <div className="flex items-start space-x-2">
                <AlertTriangle className="w-4 h-4 text-red-600 mt-0.5" />
                <div className="text-sm text-red-700">
                  <ul className="space-y-1">
                    <li>• Invoice record and all extracted data</li>
                    <li>• Associated uploaded file</li>
                    <li>• Processing history and corrections</li>
                    <li>• Any learning data from this invoice</li>
                  </ul>
                </div>
              </div>
            </div>

            <div className="flex space-x-3">
              <button
                onClick={() => setShowDeleteConfirm(false)}
                className="btn-outline flex-1"
              >
                Cancel
              </button>
              <button
                onClick={handleDelete}
                className="bg-red-600 text-white px-4 py-2 rounded-lg hover:bg-red-700 flex-1 font-medium"
              >
                <Trash2 className="w-4 h-4 mr-2" />
                Delete Invoice
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

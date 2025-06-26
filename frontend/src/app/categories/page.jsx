"use client";

import { useState, useEffect } from "react";
import {
  Building,
  Plus,
  Edit,
  Trash2,
  Search,
  Tag,
  Info,
  AlertCircle,
  CheckCircle,
  DollarSign,
  FileText,
  Save,
  X,
} from "lucide-react";
import {
  getCategories,
  createCategory,
  updateCategory,
  deleteCategory,
  formatCurrency,
} from "../../lib/api";
import toast from "react-hot-toast";

export default function CategoriesPage() {
  const [categories, setCategories] = useState([]);
  const [groupedCategories, setGroupedCategories] = useState({});
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [searchTerm, setSearchTerm] = useState("");
  const [showAddModal, setShowAddModal] = useState(false);
  const [editingCategory, setEditingCategory] = useState(null);
  const [selectedGroup, setSelectedGroup] = useState("all");

  useEffect(() => {
    loadCategories();
  }, []);

  const loadCategories = async () => {
    try {
      setLoading(true);
      const data = await getCategories();
      setCategories(data.categories);
      setGroupedCategories(data.grouped);
      setError(null);
    } catch (err) {
      console.error("Failed to load categories:", err);
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  const handleAddCategory = async (categoryData) => {
    try {
      await createCategory(categoryData);
      toast.success("Category created successfully");
      loadCategories();
      setShowAddModal(false);
    } catch (error) {
      console.error("Failed to create category:", error);
      toast.error(error.message || "Failed to create category");
    }
  };

  const handleUpdateCategory = async (code, categoryData) => {
    try {
      await updateCategory(code, categoryData);
      toast.success("Category updated successfully");
      loadCategories();
      setEditingCategory(null);
    } catch (error) {
      console.error("Failed to update category:", error);
      toast.error(error.message || "Failed to update category");
    }
  };

  const handleDeleteCategory = async (code) => {
    if (!confirm("Are you sure you want to delete this category?")) return;

    try {
      await deleteCategory(code);
      toast.success("Category deleted successfully");
      loadCategories();
    } catch (error) {
      console.error("Failed to delete category:", error);
      toast.error(error.message || "Failed to delete category");
    }
  };

  const filteredCategories = categories.filter((category) => {
    const matchesSearch =
      category.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
      category.code.includes(searchTerm) ||
      category.description?.toLowerCase().includes(searchTerm.toLowerCase());

    const matchesGroup =
      selectedGroup === "all" ||
      (selectedGroup === "assets" && category.code.startsWith("1")) ||
      (selectedGroup === "liabilities" && category.code.startsWith("2")) ||
      (selectedGroup === "equity" && category.code.startsWith("3")) ||
      (selectedGroup === "revenue" && category.code.startsWith("4")) ||
      (selectedGroup === "expenses" && category.code.startsWith("5"));

    return matchesSearch && matchesGroup;
  });

  if (loading) {
    return <CategoriesPageSkeleton />;
  }

  return (
    <div className="max-w-6xl mx-auto space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">
            Category Management
          </h1>
          <p className="text-gray-500 mt-1">
            Manage your chart of accounts and expense categories
          </p>
        </div>
        <div className="mt-4 sm:mt-0">
          <button onClick={() => setShowAddModal(true)} className="btn-primary">
            <Plus className="w-4 h-4 mr-2" />
            Add Category
          </button>
        </div>
      </div>

      {/* Error State */}
      {error && (
        <div className="card p-6 border-red-200 bg-red-50">
          <div className="flex items-center space-x-3">
            <AlertCircle className="w-5 h-5 text-red-600" />
            <div>
              <h3 className="font-medium text-red-900">
                Error loading categories
              </h3>
              <p className="text-red-700 text-sm">{error}</p>
              <button
                onClick={loadCategories}
                className="text-red-600 hover:text-red-700 text-sm font-medium mt-1"
              >
                Try again
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Overview Cards */}
      <div className="grid grid-cols-1 md:grid-cols-3 lg:grid-cols-6 gap-4">
        {Object.entries(groupedCategories).map(([type, typeCategories]) => (
          <CategoryTypeCard
            key={type}
            type={type}
            count={typeCategories?.length || 0}
            isSelected={selectedGroup === type}
            onClick={() =>
              setSelectedGroup(selectedGroup === type ? "all" : type)
            }
          />
        ))}
      </div>

      {/* Filters and Search */}
      <div className="card p-4">
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between space-y-4 sm:space-y-0">
          <div className="relative flex-1 max-w-md">
            <Search className="w-4 h-4 absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400" />
            <input
              type="text"
              placeholder="Search categories..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="input pl-10"
            />
          </div>
          <div className="flex items-center space-x-4 text-sm text-gray-500">
            <span>{filteredCategories.length} categories</span>
            {selectedGroup !== "all" && (
              <button
                onClick={() => setSelectedGroup("all")}
                className="text-blue-600 hover:text-blue-700"
              >
                View all
              </button>
            )}
          </div>
        </div>
      </div>

      {/* Categories List */}
      <div className="grid gap-4">
        {filteredCategories.map((category) => (
          <CategoryCard
            key={category.code}
            category={category}
            isEditing={editingCategory === category.code}
            onEdit={() => setEditingCategory(category.code)}
            onSave={(data) => handleUpdateCategory(category.code, data)}
            onCancel={() => setEditingCategory(null)}
            onDelete={() => handleDeleteCategory(category.code)}
          />
        ))}
      </div>

      {/* Empty State */}
      {filteredCategories.length === 0 && !loading && (
        <div className="card p-12 text-center">
          <Building className="w-16 h-16 text-gray-300 mx-auto mb-4" />
          <h3 className="text-lg font-medium text-gray-500 mb-2">
            No categories found
          </h3>
          <p className="text-gray-400 mb-6">
            {searchTerm || selectedGroup !== "all"
              ? "Try adjusting your search or filters."
              : "Get started by adding your first category."}
          </p>
          {!searchTerm && selectedGroup === "all" && (
            <button
              onClick={() => setShowAddModal(true)}
              className="btn-primary"
            >
              <Plus className="w-4 h-4 mr-2" />
              Add Category
            </button>
          )}
        </div>
      )}

      {/* Add Category Modal */}
      {showAddModal && (
        <AddCategoryModal
          onSave={handleAddCategory}
          onCancel={() => setShowAddModal(false)}
        />
      )}

      {/* Chart of Accounts Info */}
      <div className="card p-6 bg-blue-50 border-blue-200">
        <div className="flex items-start space-x-3">
          <Info className="w-5 h-5 text-blue-600 mt-0.5" />
          <div>
            <h3 className="font-medium text-blue-900 mb-2">
              Chart of Accounts Structure
            </h3>
            <div className="text-sm text-blue-700 space-y-1">
              <p>
                <strong>1000-1999:</strong> Assets (Cash, Equipment, Inventory)
              </p>
              <p>
                <strong>2000-2999:</strong> Liabilities (Loans, Credit Cards,
                Accounts Payable)
              </p>
              <p>
                <strong>3000-3999:</strong> Equity (Owner Investment, Retained
                Earnings)
              </p>
              <p>
                <strong>4000-4999:</strong> Revenue (Sales, Service Income)
              </p>
              <p>
                <strong>5000-6999:</strong> Expenses (Office Supplies, Travel,
                Professional Services)
              </p>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

// Category Type Card Component
function CategoryTypeCard({ type, count, isSelected, onClick }) {
  const typeInfo = {
    assets: {
      icon: DollarSign,
      label: "Assets",
      color: "text-green-600",
      bg: "bg-green-50",
    },
    liabilities: {
      icon: AlertCircle,
      label: "Liabilities",
      color: "text-red-600",
      bg: "bg-red-50",
    },
    equity: {
      icon: Building,
      label: "Equity",
      color: "text-purple-600",
      bg: "bg-purple-50",
    },
    revenue: {
      icon: CheckCircle,
      label: "Revenue",
      color: "text-blue-600",
      bg: "bg-blue-50",
    },
    expenses: {
      icon: FileText,
      label: "Expenses",
      color: "text-orange-600",
      bg: "bg-orange-50",
    },
  };

  const info = typeInfo[type] || {
    icon: Tag,
    label: type,
    color: "text-gray-600",
    bg: "bg-gray-50",
  };
  const Icon = info.icon;

  return (
    <button
      onClick={onClick}
      className={`card p-4 text-left transition-all ${
        isSelected ? "ring-2 ring-blue-500 bg-blue-50" : "hover:shadow-md"
      }`}
    >
      <div className={`p-2 rounded-lg ${info.bg} w-fit mb-3`}>
        <Icon className={`w-5 h-5 ${info.color}`} />
      </div>
      <div className="text-lg font-bold text-gray-900">{count}</div>
      <div className="text-sm text-gray-500">{info.label}</div>
    </button>
  );
}

// Category Card Component
function CategoryCard({
  category,
  isEditing,
  onEdit,
  onSave,
  onCancel,
  onDelete,
}) {
  const [editData, setEditData] = useState({
    name: category.name,
    description: category.description || "",
  });

  const handleSave = () => {
    if (!editData.name.trim()) {
      toast.error("Category name is required");
      return;
    }
    onSave(editData);
  };

  const getCategoryTypeInfo = (code) => {
    const firstDigit = code.charAt(0);
    const types = {
      1: { label: "Asset", color: "text-green-600", bg: "bg-green-50" },
      2: { label: "Liability", color: "text-red-600", bg: "bg-red-50" },
      3: { label: "Equity", color: "text-purple-600", bg: "bg-purple-50" },
      4: { label: "Revenue", color: "text-blue-600", bg: "bg-blue-50" },
      5: { label: "Expense", color: "text-orange-600", bg: "bg-orange-50" },
    };
    return (
      types[firstDigit] || {
        label: "Other",
        color: "text-gray-600",
        bg: "bg-gray-50",
      }
    );
  };

  const typeInfo = getCategoryTypeInfo(category.code);

  return (
    <div className="card p-6">
      <div className="flex items-start justify-between">
        <div className="flex items-start space-x-4 flex-1">
          <div className={`p-2 rounded-lg ${typeInfo.bg}`}>
            <Tag className={`w-5 h-5 ${typeInfo.color}`} />
          </div>

          <div className="flex-1">
            {isEditing ? (
              <div className="space-y-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    Category Name
                  </label>
                  <input
                    type="text"
                    value={editData.name}
                    onChange={(e) =>
                      setEditData({ ...editData, name: e.target.value })
                    }
                    className="input"
                    placeholder="Enter category name"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    Description
                  </label>
                  <textarea
                    value={editData.description}
                    onChange={(e) =>
                      setEditData({ ...editData, description: e.target.value })
                    }
                    className="input"
                    rows={2}
                    placeholder="Enter category description"
                  />
                </div>
                <div className="flex space-x-3">
                  <button onClick={handleSave} className="btn-primary">
                    <Save className="w-4 h-4 mr-1" />
                    Save
                  </button>
                  <button onClick={onCancel} className="btn-outline">
                    <X className="w-4 h-4 mr-1" />
                    Cancel
                  </button>
                </div>
              </div>
            ) : (
              <div>
                <div className="flex items-center space-x-3 mb-2">
                  <h3 className="text-lg font-medium text-gray-900">
                    {category.name}
                  </h3>
                  <span
                    className={`badge ${typeInfo.bg} ${typeInfo.color} border-0`}
                  >
                    {category.code}
                  </span>
                  <span
                    className={`badge ${typeInfo.bg} ${typeInfo.color} border-0`}
                  >
                    {typeInfo.label}
                  </span>
                  {category.isDefault && (
                    <span className="badge-primary">Default</span>
                  )}
                </div>
                {category.description && (
                  <p className="text-gray-600 text-sm mb-3">
                    {category.description}
                  </p>
                )}
                <div className="flex items-center space-x-4 text-sm text-gray-500">
                  <span>Code: {category.code}</span>
                  <span>Type: {typeInfo.label}</span>
                </div>
              </div>
            )}
          </div>
        </div>

        {!isEditing && (
          <div className="flex items-center space-x-2">
            <button
              onClick={onEdit}
              className="text-gray-600 hover:text-blue-600"
              title="Edit category"
            >
              <Edit className="w-4 h-4" />
            </button>
            {!category.isDefault && (
              <button
                onClick={onDelete}
                className="text-gray-600 hover:text-red-600"
                title="Delete category"
              >
                <Trash2 className="w-4 h-4" />
              </button>
            )}
          </div>
        )}
      </div>
    </div>
  );
}

// Add Category Modal
function AddCategoryModal({ onSave, onCancel }) {
  const [formData, setFormData] = useState({
    code: "",
    name: "",
    description: "",
  });
  const [errors, setErrors] = useState({});

  const validateForm = () => {
    const newErrors = {};

    if (!formData.code.trim()) {
      newErrors.code = "Category code is required";
    } else if (!/^\d{4}$/.test(formData.code)) {
      newErrors.code = "Category code must be a 4-digit number";
    }

    if (!formData.name.trim()) {
      newErrors.name = "Category name is required";
    }

    setErrors(newErrors);
    return Object.keys(newErrors).length === 0;
  };

  const handleSave = () => {
    if (validateForm()) {
      onSave(formData);
    }
  };

  const getCategoryType = (code) => {
    const firstDigit = code.charAt(0);
    const types = {
      1: "Assets",
      2: "Liabilities",
      3: "Equity",
      4: "Revenue",
      5: "Expenses",
    };
    return types[firstDigit] || "Unknown";
  };

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
      <div className="bg-white rounded-lg p-6 w-full max-w-md">
        <h3 className="text-lg font-medium text-gray-900 mb-6">
          Add New Category
        </h3>

        <div className="space-y-4">
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              Category Code *
            </label>
            <input
              type="text"
              value={formData.code}
              onChange={(e) =>
                setFormData({ ...formData, code: e.target.value })
              }
              className={`input ${errors.code ? "border-red-300" : ""}`}
              placeholder="e.g., 5150"
              maxLength={4}
            />
            {errors.code && (
              <p className="text-red-600 text-sm mt-1">{errors.code}</p>
            )}
            {formData.code && !errors.code && (
              <p className="text-gray-500 text-sm mt-1">
                Type: {getCategoryType(formData.code)}
              </p>
            )}
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              Category Name *
            </label>
            <input
              type="text"
              value={formData.name}
              onChange={(e) =>
                setFormData({ ...formData, name: e.target.value })
              }
              className={`input ${errors.name ? "border-red-300" : ""}`}
              placeholder="e.g., Office Equipment"
            />
            {errors.name && (
              <p className="text-red-600 text-sm mt-1">{errors.name}</p>
            )}
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              Description
            </label>
            <textarea
              value={formData.description}
              onChange={(e) =>
                setFormData({ ...formData, description: e.target.value })
              }
              className="input"
              rows={3}
              placeholder="Describe what expenses belong in this category"
            />
          </div>
        </div>

        <div className="flex space-x-3 mt-6">
          <button onClick={onCancel} className="btn-outline flex-1">
            Cancel
          </button>
          <button onClick={handleSave} className="btn-primary flex-1">
            <Plus className="w-4 h-4 mr-1" />
            Add Category
          </button>
        </div>
      </div>
    </div>
  );
}

// Loading Skeleton
function CategoriesPageSkeleton() {
  return (
    <div className="max-w-6xl mx-auto space-y-6">
      <div className="flex justify-between items-center">
        <div>
          <div className="h-8 bg-gray-300 rounded w-48 mb-2"></div>
          <div className="h-4 bg-gray-300 rounded w-64"></div>
        </div>
        <div className="h-10 bg-gray-300 rounded w-32"></div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-3 lg:grid-cols-6 gap-4">
        {[...Array(6)].map((_, i) => (
          <div key={i} className="card p-4 animate-pulse">
            <div className="w-10 h-10 bg-gray-300 rounded-lg mb-3"></div>
            <div className="h-6 bg-gray-300 rounded w-8 mb-1"></div>
            <div className="h-4 bg-gray-300 rounded w-16"></div>
          </div>
        ))}
      </div>

      <div className="card p-4">
        <div className="h-10 bg-gray-300 rounded w-64"></div>
      </div>

      {[...Array(5)].map((_, i) => (
        <div key={i} className="card p-6 animate-pulse">
          <div className="flex items-start space-x-4">
            <div className="w-10 h-10 bg-gray-300 rounded-lg"></div>
            <div className="flex-1">
              <div className="h-6 bg-gray-300 rounded w-48 mb-2"></div>
              <div className="h-4 bg-gray-300 rounded w-64 mb-2"></div>
              <div className="h-4 bg-gray-300 rounded w-32"></div>
            </div>
          </div>
        </div>
      ))}
    </div>
  );
}

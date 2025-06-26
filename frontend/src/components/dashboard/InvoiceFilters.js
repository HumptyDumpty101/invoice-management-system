"use client";

import { useState, useEffect } from "react";
import {
  Filter,
  Search,
  X,
  Calendar,
  DollarSign,
  Building,
  AlertTriangle,
  ChevronDown,
} from "lucide-react";
import { getExpenseCategories } from "../../lib/api";

export default function InvoiceFilters({ filters, onFilterChange }) {
  const [isExpanded, setIsExpanded] = useState(false);
  const [categories, setCategories] = useState([]);
  const [tempFilters, setTempFilters] = useState(filters);

  useEffect(() => {
    loadCategories();
  }, []);

  useEffect(() => {
    setTempFilters(filters);
  }, [filters]);

  const loadCategories = async () => {
    try {
      const data = await getExpenseCategories();
      setCategories(data.categories);
    } catch (error) {
      console.error("Failed to load categories:", error);
    }
  };

  const handleFilterChange = (key, value) => {
    const newFilters = { ...tempFilters, [key]: value };
    setTempFilters(newFilters);
    onFilterChange(newFilters);
  };

  const clearFilters = () => {
    const emptyFilters = {
      vendor: "",
      category: "",
      needsReview: false,
      dateFrom: "",
      dateTo: "",
      amountMin: "",
      amountMax: "",
    };
    setTempFilters(emptyFilters);
    onFilterChange(emptyFilters);
  };

  const hasActiveFilters = Object.values(filters).some(
    (value) => value !== "" && value !== false
  );

  return (
    <div className="card p-4">
      <div className="flex items-center justify-between mb-4">
        <div className="flex items-center space-x-3">
          <Filter className="w-5 h-5 text-gray-600" />
          <h3 className="font-medium text-gray-900">Filters</h3>
          {hasActiveFilters && (
            <span className="badge-primary text-xs">
              {
                Object.values(filters).filter((v) => v !== "" && v !== false)
                  .length
              }{" "}
              active
            </span>
          )}
        </div>
        <div className="flex items-center space-x-2">
          {hasActiveFilters && (
            <button
              onClick={clearFilters}
              className="text-sm text-red-600 hover:text-red-700 flex items-center"
            >
              <X className="w-4 h-4 mr-1" />
              Clear all
            </button>
          )}
          <button
            onClick={() => setIsExpanded(!isExpanded)}
            className="btn-outline text-sm px-3 py-2"
          >
            {isExpanded ? "Less" : "More"} filters
            <ChevronDown
              className={`w-4 h-4 ml-1 transform transition-transform ${
                isExpanded ? "rotate-180" : ""
              }`}
            />
          </button>
        </div>
      </div>

      <div className="space-y-4">
        {/* Quick Filters */}
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
          {/* Vendor Search */}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              Vendor
            </label>
            <div className="relative">
              <Search className="w-4 h-4 absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400" />
              <input
                type="text"
                placeholder="Search vendors..."
                value={tempFilters.vendor}
                onChange={(e) => handleFilterChange("vendor", e.target.value)}
                className="input pl-10"
              />
            </div>
          </div>

          {/* Category Filter */}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              Category
            </label>
            <div className="relative">
              <Building className="w-4 h-4 absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400" />
              <select
                value={tempFilters.category}
                onChange={(e) => handleFilterChange("category", e.target.value)}
                className="input pl-10"
              >
                <option value="">All categories</option>
                {categories.map((category) => (
                  <option key={category.code} value={category.code}>
                    {category.code} - {category.name}
                  </option>
                ))}
              </select>
            </div>
          </div>

          {/* Date From */}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              From Date
            </label>
            <div className="relative">
              <Calendar className="w-4 h-4 absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400" />
              <input
                type="date"
                value={tempFilters.dateFrom}
                onChange={(e) => handleFilterChange("dateFrom", e.target.value)}
                className="input pl-10"
              />
            </div>
          </div>

          {/* Date To */}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              To Date
            </label>
            <div className="relative">
              <Calendar className="w-4 h-4 absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400" />
              <input
                type="date"
                value={tempFilters.dateTo}
                onChange={(e) => handleFilterChange("dateTo", e.target.value)}
                className="input pl-10"
              />
            </div>
          </div>
        </div>

        {/* Advanced Filters */}
        {isExpanded && (
          <div className="pt-4 border-t border-gray-200">
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
              {/* Amount Range */}
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Min Amount
                </label>
                <div className="relative">
                  <DollarSign className="w-4 h-4 absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400" />
                  <input
                    type="number"
                    placeholder="0.00"
                    min="0"
                    step="0.01"
                    value={tempFilters.amountMin}
                    onChange={(e) =>
                      handleFilterChange("amountMin", e.target.value)
                    }
                    className="input pl-10"
                  />
                </div>
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Max Amount
                </label>
                <div className="relative">
                  <DollarSign className="w-4 h-4 absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400" />
                  <input
                    type="number"
                    placeholder="999.99"
                    min="0"
                    step="0.01"
                    value={tempFilters.amountMax}
                    onChange={(e) =>
                      handleFilterChange("amountMax", e.target.value)
                    }
                    className="input pl-10"
                  />
                </div>
              </div>

              {/* Review Status */}
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Review Status
                </label>
                <div className="flex items-center space-x-4">
                  <label className="flex items-center">
                    <input
                      type="checkbox"
                      checked={tempFilters.needsReview}
                      onChange={(e) =>
                        handleFilterChange("needsReview", e.target.checked)
                      }
                      className="rounded border-gray-300 text-blue-600 focus:ring-blue-500"
                    />
                    <span className="ml-2 text-sm text-gray-700 flex items-center">
                      <AlertTriangle className="w-4 h-4 mr-1 text-yellow-500" />
                      Needs Review
                    </span>
                  </label>
                </div>
              </div>
            </div>

            {/* Quick Filter Buttons */}
            <div className="mt-4 flex flex-wrap gap-2">
              <QuickFilterButton
                label="Today"
                onClick={() => {
                  const today = new Date().toISOString().split("T")[0];
                  handleFilterChange("dateFrom", today);
                  handleFilterChange("dateTo", today);
                }}
              />
              <QuickFilterButton
                label="This Week"
                onClick={() => {
                  const today = new Date();
                  const weekStart = new Date(
                    today.setDate(today.getDate() - today.getDay())
                  );
                  const weekEnd = new Date(
                    today.setDate(today.getDate() - today.getDay() + 6)
                  );
                  handleFilterChange(
                    "dateFrom",
                    weekStart.toISOString().split("T")[0]
                  );
                  handleFilterChange(
                    "dateTo",
                    weekEnd.toISOString().split("T")[0]
                  );
                }}
              />
              <QuickFilterButton
                label="This Month"
                onClick={() => {
                  const now = new Date();
                  const monthStart = new Date(
                    now.getFullYear(),
                    now.getMonth(),
                    1
                  );
                  const monthEnd = new Date(
                    now.getFullYear(),
                    now.getMonth() + 1,
                    0
                  );
                  handleFilterChange(
                    "dateFrom",
                    monthStart.toISOString().split("T")[0]
                  );
                  handleFilterChange(
                    "dateTo",
                    monthEnd.toISOString().split("T")[0]
                  );
                }}
              />
              <QuickFilterButton
                label="Last 30 Days"
                onClick={() => {
                  const today = new Date();
                  const thirtyDaysAgo = new Date(
                    today.setDate(today.getDate() - 30)
                  );
                  handleFilterChange(
                    "dateFrom",
                    thirtyDaysAgo.toISOString().split("T")[0]
                  );
                  handleFilterChange(
                    "dateTo",
                    new Date().toISOString().split("T")[0]
                  );
                }}
              />
              <QuickFilterButton
                label="High Amount (>$100)"
                onClick={() => {
                  handleFilterChange("amountMin", "100");
                }}
              />
              <QuickFilterButton
                label="Office Supplies"
                onClick={() => {
                  handleFilterChange("category", "5010");
                }}
              />
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

// Quick Filter Button Component
function QuickFilterButton({ label, onClick }) {
  return (
    <button
      onClick={onClick}
      className="px-3 py-1 text-xs bg-gray-100 text-gray-700 rounded-full hover:bg-gray-200 transition-colors"
    >
      {label}
    </button>
  );
}

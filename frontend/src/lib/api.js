import axios from "axios";

const API_BASE_URL =
  process.env.NEXT_PUBLIC_API_URL || "http://localhost:5000/api";

// Create axios instance with default config
const api = axios.create({
  baseURL: API_BASE_URL,
  timeout: 30000, // 30 seconds for file uploads
  headers: {
    "Content-Type": "application/json",
  },
});

// Response interceptor for error handling
api.interceptors.response.use(
  (response) => response,
  (error) => {
    console.error("API Error:", error);

    if (error.response) {
      // Server responded with error status
      const message =
        error.response.data?.message ||
        error.response.data?.error ||
        "An error occurred";
      throw new Error(message);
    } else if (error.request) {
      // Request was made but no response received
      throw new Error("Network error - please check your connection");
    } else {
      // Something else happened
      throw new Error(error.message || "An unexpected error occurred");
    }
  }
);

// Upload Functions
export async function uploadInvoices(formData, onProgress) {
  try {
    const response = await api.post("/upload", formData, {
      headers: {
        "Content-Type": "multipart/form-data",
      },
      onUploadProgress: (progressEvent) => {
        const percentCompleted = Math.round(
          (progressEvent.loaded * 100) / progressEvent.total
        );
        onProgress?.({
          percent: percentCompleted,
          status: percentCompleted === 100 ? "processing" : "uploading",
        });
      },
    });

    return response.data;
  } catch (error) {
    throw error;
  }
}

export async function getUploadStatus() {
  const response = await api.get("/upload/status");
  return response.data;
}

// Invoice Functions
export async function getInvoices(params = {}) {
  const response = await api.get("/invoices", { params });
  return response.data;
}

export async function getInvoice(id) {
  const response = await api.get(`/invoices/${id}`);
  return response.data;
}

export async function updateInvoice(id, data) {
  const response = await api.put(`/invoices/${id}`, data);
  return response.data;
}

export async function deleteInvoice(id) {
  const response = await api.delete(`/invoices/${id}`);
  return response.data;
}

export async function markInvoiceAsDuplicate(id, originalId) {
  const response = await api.post(`/invoices/${id}/mark-duplicate`, {
    originalId,
  });
  return response.data;
}

export async function getInvoiceDuplicates(id) {
  const response = await api.get(`/invoices/${id}/duplicates`);
  return response.data;
}

export async function bulkActionInvoices(action, invoiceIds, data = {}) {
  const response = await api.post("/invoices/bulk-action", {
    action,
    invoiceIds,
    data,
  });
  return response.data;
}

// Category Functions
export async function getCategories() {
  const response = await api.get("/categories");
  return response.data;
}

export async function getExpenseCategories() {
  const response = await api.get("/categories/expenses");
  return response.data;
}

export async function getCategory(code) {
  const response = await api.get(`/categories/${code}`);
  return response.data;
}

export async function createCategory(categoryData) {
  const response = await api.post("/categories", categoryData);
  return response.data;
}

export async function updateCategory(code, categoryData) {
  const response = await api.put(`/categories/${code}`, categoryData);
  return response.data;
}

export async function deleteCategory(code) {
  const response = await api.delete(`/categories/${code}`);
  return response.data;
}

export async function predictCategory(vendor, amount) {
  const params = amount ? { amount } : {};
  const response = await api.get(
    `/categories/predict/${encodeURIComponent(vendor)}`,
    { params }
  );
  return response.data;
}

// Dashboard Functions
export async function getDashboardStats(period = "30") {
  const response = await api.get("/dashboard/stats", {
    params: { period },
  });
  return response.data;
}

export async function exportInvoices(params = {}) {
  const response = await api.get("/dashboard/export", {
    params: { ...params, format: "csv" },
    responseType: "blob",
  });

  // Create download link
  const url = window.URL.createObjectURL(new Blob([response.data]));
  const link = document.createElement("a");
  link.href = url;
  link.download = `invoices-${new Date().toISOString().split("T")[0]}.csv`;
  document.body.appendChild(link);
  link.click();
  link.remove();
  window.URL.revokeObjectURL(url);

  return true;
}

export async function getAnalytics(type, period = "90") {
  const response = await api.get(`/dashboard/analytics/${type}`, {
    params: { period },
  });
  return response.data;
}

// Health Check
export async function checkHealth() {
  const response = await api.get("/health");
  return response.data;
}

// Utility Functions
export function formatCurrency(amount) {
  return new Intl.NumberFormat("en-US", {
    style: "currency",
    currency: "USD",
  }).format(amount);
}

export function formatDate(date) {
  return new Date(date).toLocaleDateString("en-US", {
    year: "numeric",
    month: "short",
    day: "numeric",
  });
}

export function formatDateTime(date) {
  return new Date(date).toLocaleString("en-US", {
    year: "numeric",
    month: "short",
    day: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  });
}

export function getConfidenceColor(confidence) {
  if (confidence >= 80) return "text-green-600";
  if (confidence >= 60) return "text-yellow-600";
  return "text-red-600";
}

export function getConfidenceLevel(confidence) {
  if (confidence >= 80) return "High";
  if (confidence >= 60) return "Medium";
  return "Low";
}

export function getCategoryDisplayName(categoryCode, categories = []) {
  const category = categories.find((c) => c.code === categoryCode);
  return category ? category.name : `Category ${categoryCode}`;
}

// File validation utilities
export function validateFileType(file) {
  const allowedTypes = ["application/pdf", "image/jpeg", "image/png"];
  return allowedTypes.includes(file.type);
}

export function validateFileSize(file, maxSizeMB = 10) {
  return file.size <= maxSizeMB * 1024 * 1024;
}

export function getFileExtension(filename) {
  return filename.split(".").pop().toLowerCase();
}

export function isImageFile(file) {
  return file.type.startsWith("image/");
}

export function isPDFFile(file) {
  return file.type === "application/pdf";
}

// Error handling utilities
export function getErrorMessage(error) {
  if (typeof error === "string") return error;
  if (error?.message) return error.message;
  if (error?.response?.data?.message) return error.response.data.message;
  if (error?.response?.data?.error) return error.response.data.error;
  return "An unexpected error occurred";
}

export function isNetworkError(error) {
  return (
    error?.code === "NETWORK_ERROR" ||
    error?.message?.includes("Network Error") ||
    !error?.response
  );
}

// Local storage utilities (for settings, preferences, etc.)
export function saveToLocalStorage(key, data) {
  try {
    localStorage.setItem(key, JSON.stringify(data));
    return true;
  } catch (error) {
    console.error("Failed to save to localStorage:", error);
    return false;
  }
}

export function loadFromLocalStorage(key, defaultValue = null) {
  try {
    const data = localStorage.getItem(key);
    return data ? JSON.parse(data) : defaultValue;
  } catch (error) {
    console.error("Failed to load from localStorage:", error);
    return defaultValue;
  }
}

export function removeFromLocalStorage(key) {
  try {
    localStorage.removeItem(key);
    return true;
  } catch (error) {
    console.error("Failed to remove from localStorage:", error);
    return false;
  }
}

// API status check
export async function checkAPIStatus() {
  try {
    await checkHealth();
    return { status: "online", message: "API is responding" };
  } catch (error) {
    return {
      status: "offline",
      message: getErrorMessage(error),
      isNetworkError: isNetworkError(error),
    };
  }
}

export async function markInvoiceAsReviewed(id) {
  const response = await api.patch(`/invoices/${id}/mark-reviewed`);
  return response.data;
}

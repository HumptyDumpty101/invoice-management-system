"use client";

import { useState, useEffect } from "react";
import {
  FileText,
  DollarSign,
  TrendingUp,
  AlertTriangle,
  Clock,
  CheckCircle,
} from "lucide-react";
import { getDashboardStats, formatCurrency } from "../../lib/api";

export default function QuickStats() {
  const [stats, setStats] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  useEffect(() => {
    loadStats();
  }, []);

  const loadStats = async () => {
    try {
      setLoading(true);
      const data = await getDashboardStats("7"); // Last 7 days
      setStats(data);
    } catch (err) {
      console.error("Failed to load stats:", err);
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  if (loading) {
    return <StatsLoading />;
  }

  if (error) {
    return <StatsError error={error} onRetry={loadStats} />;
  }

  if (!stats) {
    return <StatsEmpty />;
  }

  const { summary } = stats;

  return (
    <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-4">
      <StatCard
        icon={<FileText className="w-5 h-5 text-blue-600" />}
        label="Total Invoices"
        value={summary.totalInvoices || 0}
        subtitle="All time"
        color="blue"
      />

      <StatCard
        icon={<DollarSign className="w-5 h-5 text-green-600" />}
        label="Total Amount"
        value={formatCurrency(summary.totalAmount || 0)}
        subtitle="All time"
        color="green"
      />

      {/* <StatCard
        icon={<Clock className="w-5 h-5 text-purple-600" />}
        label="This Week"
        value={summary.periodInvoices || 0}
        subtitle={`${formatCurrency(summary.periodAmount || 0)}`}
        color="purple"
      /> */}

      <StatCard
        icon={<TrendingUp className="w-5 h-5 text-indigo-600" />}
        label="Average"
        value={formatCurrency(summary.avgAmount || 0)}
        subtitle="Per invoice"
        color="indigo"
      />

      <StatCard
        icon={<AlertTriangle className="w-5 h-5 text-yellow-600" />}
        label="Need Review"
        value={summary.needsReview || 0}
        subtitle="Require attention"
        color="yellow"
      />

      <StatCard
        icon={<CheckCircle className="w-5 h-5 text-emerald-600" />}
        label="Processed"
        value={`${Math.round(
          ((summary.totalInvoices - summary.needsReview) /
            Math.max(summary.totalInvoices, 1)) *
            100
        )}%`}
        subtitle="Success rate"
        color="emerald"
      />
    </div>
  );
}

// Individual Stat Card
function StatCard({ icon, label, value, subtitle, color }) {
  const colorClasses = {
    blue: "bg-blue-50 border-blue-200",
    green: "bg-green-50 border-green-200",
    purple: "bg-purple-50 border-purple-200",
    indigo: "bg-indigo-50 border-indigo-200",
    yellow: "bg-yellow-50 border-yellow-200",
    emerald: "bg-emerald-50 border-emerald-200",
  };

  return (
    <div
      className={`card p-4 ${
        colorClasses[color] || "bg-gray-50 border-gray-200"
      } hover:shadow-md transition-shadow`}
    >
      <div className="flex items-center space-x-3 mb-2">
        {icon}
        <span className="text-sm font-medium text-gray-700">{label}</span>
      </div>
      <div className="space-y-1">
        <div className="text-lg font-bold text-gray-900">{value}</div>
        <div className="text-xs text-gray-500">{subtitle}</div>
      </div>
    </div>
  );
}

// Loading State
function StatsLoading() {
  return (
    <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-4">
      {[...Array(6)].map((_, i) => (
        <div key={i} className="card p-4 animate-pulse">
          <div className="flex items-center space-x-3 mb-2">
            <div className="w-5 h-5 bg-gray-300 rounded"></div>
            <div className="h-4 bg-gray-300 rounded w-20"></div>
          </div>
          <div className="space-y-1">
            <div className="h-6 bg-gray-300 rounded w-16"></div>
            <div className="h-3 bg-gray-300 rounded w-12"></div>
          </div>
        </div>
      ))}
    </div>
  );
}

// Error State
function StatsError({ error, onRetry }) {
  return (
    <div className="card p-6 border-red-200 bg-red-50">
      <div className="flex items-center space-x-3">
        <AlertTriangle className="w-5 h-5 text-red-600" />
        <div>
          <h3 className="font-medium text-red-900">
            Failed to load statistics
          </h3>
          <p className="text-red-700 text-sm">{error}</p>
          <button
            onClick={onRetry}
            className="text-red-600 hover:text-red-700 text-sm font-medium mt-1"
          >
            Try again
          </button>
        </div>
      </div>
    </div>
  );
}

// Empty State
function StatsEmpty() {
  return (
    <div className="card p-6 text-center">
      <FileText className="w-12 h-12 text-gray-300 mx-auto mb-3" />
      <h3 className="text-lg font-medium text-gray-500 mb-1">No data yet</h3>
      <p className="text-gray-400 text-sm">
        Upload your first invoice to see statistics
      </p>
    </div>
  );
}

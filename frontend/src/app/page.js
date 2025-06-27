// frontend/app/page.js
"use client";

import { useState } from "react";
import {
  Upload,
  FileText,
  TrendingUp,
  AlertCircle,
  CheckCircle,
} from "lucide-react";
import SingleUpload from "../components/upload/SingleUpload";
import UploadResults from "../components/upload/UploadResults";
import QuickStats from "../components/dashboard/QuickStats";

export default function HomePage() {
  const [uploadResults, setUploadResults] = useState(null);
  const [isUploading, setIsUploading] = useState(false);

  const handleUploadSuccess = (results) => {
    setUploadResults(results);
    setIsUploading(false);
  };

  const handleUploadStart = () => {
    setIsUploading(true);
    setUploadResults(null);
  };

  const handleUploadError = (error) => {
    setIsUploading(false);
    console.error("Upload error:", error);
  };

  return (
    <div className="max-w-6xl mx-auto space-y-8">
      {/* Header */}
      <div className="text-center space-y-4">
        <div className="flex items-center justify-center space-x-3">
          <div className="p-3 bg-blue-100 rounded-full">
            <FileText className="w-8 h-8 text-blue-600" />
          </div>
          <h1 className="text-4xl font-bold text-gradient">
            Invoice Management System
          </h1>
        </div>
        <p className="text-lg text-gray-600 max-w-2xl mx-auto">
          Upload your invoices and let AI extract, categorize, and organize them
          automatically. Reduce manual processing time from hours to minutes.
        </p>
      </div>

      {/* Quick Stats */}
      <QuickStats />

      {/* Upload Section */}
      <div className="grid lg:grid-cols-2 gap-8">
        {/* Upload Component */}
        <div className="space-y-6">
          <div className="card p-6">
            <div className="flex items-center space-x-3 mb-6">
              <Upload className="w-6 h-6 text-blue-600" />
              <h2 className="text-xl font-semibold">Upload Invoices</h2>
            </div>

            <SingleUpload
              onUploadStart={handleUploadStart}
              onUploadSuccess={handleUploadSuccess}
              onUploadError={handleUploadError}
              isUploading={isUploading}
            />
          </div>

          {/* Features List */}
          <div className="card p-6">
            <h3 className="text-lg font-semibold mb-4 flex items-center">
              <TrendingUp className="w-5 h-5 text-green-600 mr-2" />
              Key Features
            </h3>
            <div className="space-y-3">
              <FeatureItem
                icon={<CheckCircle className="w-4 h-4 text-green-500" />}
                text="Automatic text extraction from PDFs and images"
              />
              <FeatureItem
                icon={<CheckCircle className="w-4 h-4 text-green-500" />}
                text="Smart category prediction with learning system"
              />
              <FeatureItem
                icon={<CheckCircle className="w-4 h-4 text-green-500" />}
                text="Duplicate detection and validation"
              />
              <FeatureItem
                icon={<CheckCircle className="w-4 h-4 text-green-500" />}
                text="Export to QuickBooks-compatible CSV"
              />
              <FeatureItem
                icon={<AlertCircle className="w-4 h-4 text-blue-500" />}
                text="Confidence scoring and review workflow"
              />
            </div>
          </div>
        </div>

        {/* Results Section */}
        <div className="space-y-6">
          {uploadResults ? (
            <UploadResults results={uploadResults} />
          ) : (
            <div className="card p-6">
              <div className="text-center py-12">
                <FileText className="w-16 h-16 text-gray-300 mx-auto mb-4" />
                <h3 className="text-lg font-medium text-gray-500 mb-2">
                  Ready to Process
                </h3>
                <p className="text-gray-400">
                  Upload an invoice to see extracted data and processing results
                </p>
              </div>
            </div>
          )}

          {/* Processing Status */}
          {isUploading && (
            <div className="card p-6">
              <div className="text-center py-8">
                <div className="spinner w-8 h-8 mx-auto mb-4 text-blue-600"></div>
                <h3 className="text-lg font-medium text-gray-700 mb-2">
                  Processing Invoice...
                </h3>
                <p className="text-gray-500">
                  Extracting text, parsing data, and predicting categories
                </p>
              </div>
            </div>
          )}
        </div>
      </div>

      {/* How It Works Section */}
      <div className="card p-8">
        <h2 className="text-2xl font-bold text-center mb-8">How It Works</h2>
        <div className="grid md:grid-cols-4 gap-6">
          <ProcessStep
            step="1"
            title="Upload"
            description="Drop your PDF or image invoice files"
            icon={<Upload className="w-6 h-6" />}
            color="bg-blue-500"
          />
          <ProcessStep
            step="2"
            title="Extract"
            description="AI reads and extracts key data automatically"
            icon={<FileText className="w-6 h-6" />}
            color="bg-green-500"
          />
          <ProcessStep
            step="3"
            title="Categorize"
            description="Smart system suggests appropriate expense categories"
            icon={<TrendingUp className="w-6 h-6" />}
            color="bg-purple-500"
          />
          <ProcessStep
            step="4"
            title="Export"
            description="Download clean CSV for your accounting software"
            icon={<CheckCircle className="w-6 h-6" />}
            color="bg-orange-500"
          />
        </div>
      </div>

      {/* Sample Data Info */}
      {/* <div className="card p-6 bg-gradient-to-r from-blue-50 to-purple-50 border-blue-200">
        <div className="flex items-start space-x-4">
          <div className="p-2 bg-blue-100 rounded-full">
            <AlertCircle className="w-5 h-5 text-blue-600" />
          </div>
          <div>
            <h3 className="font-semibold text-blue-900 mb-2">
              Try with Sample Data
            </h3>
            <p className="text-blue-700 mb-3">
              Test the system with our sample invoices to see different
              extraction scenarios:
            </p>
            <div className="grid sm:grid-cols-2 gap-2 text-sm">
              <div className="flex items-center space-x-2">
                <CheckCircle className="w-4 h-4 text-green-600" />
                <span>High-quality PDF invoices</span>
              </div>
              <div className="flex items-center space-x-2">
                <AlertCircle className="w-4 h-4 text-yellow-600" />
                <span>Poor-quality receipt photos</span>
              </div>
              <div className="flex items-center space-x-2">
                <FileText className="w-4 h-4 text-blue-600" />
                <span>Multi-page utility bills</span>
              </div>
              <div className="flex items-center space-x-2">
                <TrendingUp className="w-4 h-4 text-purple-600" />
                <span>Various vendor formats</span>
              </div>
            </div>
          </div>
        </div>
      </div> */}
    </div>
  );
}

// Helper Components
function FeatureItem({ icon, text }) {
  return (
    <div className="flex items-center space-x-3">
      {icon}
      <span className="text-gray-700">{text}</span>
    </div>
  );
}

function ProcessStep({ step, title, description, icon, color }) {
  return (
    <div className="text-center group">
      <div
        className={`${color} w-12 h-12 rounded-full flex items-center justify-center text-white mx-auto mb-4 group-hover:scale-110 transition-transform`}
      >
        {icon}
      </div>
      <div
        className={`${color} text-white text-sm font-bold w-6 h-6 rounded-full flex items-center justify-center mx-auto mb-2`}
      >
        {step}
      </div>
      <h3 className="font-semibold text-gray-900 mb-2">{title}</h3>
      <p className="text-gray-600 text-sm">{description}</p>
    </div>
  );
}

"use client";

import { useState, useCallback } from "react";
import { useDropzone } from "react-dropzone";
import { Upload, File, X, AlertCircle, CheckCircle, Clock } from "lucide-react";
import toast from "react-hot-toast";
import { uploadInvoices } from "../../lib/api";

export default function SingleUpload({
  onUploadStart,
  onUploadSuccess,
  onUploadError,
  isUploading,
}) {
  const [selectedFiles, setSelectedFiles] = useState([]);
  const [uploadProgress, setUploadProgress] = useState({});

  const onDrop = useCallback((acceptedFiles, rejectedFiles) => {
    // Handle rejected files
    if (rejectedFiles.length > 0) {
      rejectedFiles.forEach(({ file, errors }) => {
        errors.forEach((error) => {
          if (error.code === "file-too-large") {
            toast.error(`${file.name} is too large. Maximum size is 10MB.`);
          } else if (error.code === "file-invalid-type") {
            toast.error(`${file.name} is not a supported file type.`);
          } else {
            toast.error(`Error with ${file.name}: ${error.message}`);
          }
        });
      });
    }

    // Add accepted files
    if (acceptedFiles.length > 0) {
      const newFiles = acceptedFiles.map((file) => ({
        file,
        id: Math.random().toString(36).substr(2, 9),
        preview: file.type.startsWith("image/")
          ? URL.createObjectURL(file)
          : null,
      }));

      setSelectedFiles((prev) => [...prev, ...newFiles]);
      toast.success(`${acceptedFiles.length} file(s) selected`);
    }
  }, []);

  const { getRootProps, getInputProps, isDragActive } = useDropzone({
    onDrop,
    accept: {
      "application/pdf": [".pdf"],
      "image/jpeg": [".jpg", ".jpeg"],
      "image/png": [".png"],
    },
    maxSize: 10 * 1024 * 1024, // 10MB
    maxFiles: 5,
    disabled: isUploading,
  });

  const removeFile = (fileId) => {
    setSelectedFiles((prev) => {
      const updated = prev.filter((f) => f.id !== fileId);
      const removedFile = prev.find((f) => f.id === fileId);
      if (removedFile?.preview) {
        URL.revokeObjectURL(removedFile.preview);
      }
      return updated;
    });
  };

  const handleUpload = async () => {
    if (selectedFiles.length === 0) {
      toast.error("Please select files to upload");
      return;
    }

    onUploadStart?.();

    try {
      const formData = new FormData();
      selectedFiles.forEach(({ file }) => {
        formData.append("invoices", file);
      });

      const results = await uploadInvoices(formData, (progress) => {
        setUploadProgress(progress);
      });

      // Clean up previews
      selectedFiles.forEach(({ preview }) => {
        if (preview) URL.revokeObjectURL(preview);
      });

      setSelectedFiles([]);
      setUploadProgress({});

      onUploadSuccess?.(results);
      toast.success(`Successfully processed ${results.processed} invoice(s)`);
    } catch (error) {
      console.error("Upload error:", error);
      onUploadError?.(error);
      toast.error(error.message || "Upload failed");
    }
  };

  const clearAll = () => {
    selectedFiles.forEach(({ preview }) => {
      if (preview) URL.revokeObjectURL(preview);
    });
    setSelectedFiles([]);
  };

  return (
    <div className="space-y-4">
      {/* Drop Zone */}
      <div
        {...getRootProps()}
        className={`
          upload-zone cursor-pointer
          ${isDragActive ? "active" : ""}
          ${isUploading ? "opacity-50 cursor-not-allowed" : ""}
        `}
      >
        <input {...getInputProps()} />
        <div className="space-y-4">
          <div className="flex justify-center">
            <Upload
              className={`w-12 h-12 ${
                isDragActive ? "text-blue-500" : "text-gray-400"
              }`}
            />
          </div>

          <div className="text-center">
            <p className="text-lg font-medium text-gray-700 mb-2">
              {isDragActive ? "Drop files here" : "Upload Invoice Files"}
            </p>
            <p className="text-gray-500 mb-4">
              Drag & drop or click to select PDF, JPG, or PNG files
            </p>
            <div className="flex flex-wrap justify-center gap-4 text-sm text-gray-400">
              <span>• Max 10MB per file</span>
              <span>• Up to 5 files</span>
              <span>• PDF, JPG, PNG supported</span>
            </div>
          </div>
        </div>
      </div>

      {/* Selected Files */}
      {selectedFiles.length > 0 && (
        <div className="space-y-3">
          <div className="flex items-center justify-between">
            <h3 className="font-medium text-gray-700">
              Selected Files ({selectedFiles.length})
            </h3>
            <button
              onClick={clearAll}
              disabled={isUploading}
              className="text-red-600 hover:text-red-700 text-sm disabled:opacity-50"
            >
              Clear All
            </button>
          </div>

          <div className="space-y-2">
            {selectedFiles.map(({ file, id, preview }) => (
              <FileItem
                key={id}
                file={file}
                preview={preview}
                onRemove={() => removeFile(id)}
                disabled={isUploading}
                progress={uploadProgress[id]}
              />
            ))}
          </div>
        </div>
      )}

      {/* Upload Button */}
      {selectedFiles.length > 0 && (
        <div className="flex space-x-3">
          <button
            onClick={handleUpload}
            disabled={isUploading}
            className="btn-primary flex-1 disabled:opacity-50"
          >
            {isUploading ? (
              <>
                <div className="spinner w-4 h-4 mr-2"></div>
                Processing...
              </>
            ) : (
              <>
                <Upload className="w-4 h-4 mr-2" />
                Upload & Process {selectedFiles.length} File
                {selectedFiles.length > 1 ? "s" : ""}
              </>
            )}
          </button>
        </div>
      )}

      {/* Upload Tips */}
      <div className="bg-blue-50 border border-blue-200 rounded-lg p-4">
        <div className="flex items-start space-x-3">
          <AlertCircle className="w-5 h-5 text-blue-600 mt-0.5" />
          <div>
            <h4 className="font-medium text-blue-900 mb-2">
              Tips for Best Results
            </h4>
            <ul className="text-sm text-blue-700 space-y-1">
              <li>• Ensure text is clearly visible and not blurry</li>
              <li>• For photos, use good lighting and avoid shadows</li>
              <li>• Make sure the entire invoice is captured</li>
              <li>• PDF files generally provide better accuracy than images</li>
            </ul>
          </div>
        </div>
      </div>
    </div>
  );
}

// File Item Component
function FileItem({ file, preview, onRemove, disabled, progress }) {
  const formatFileSize = (bytes) => {
    if (bytes === 0) return "0 Bytes";
    const k = 1024;
    const sizes = ["Bytes", "KB", "MB", "GB"];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return parseFloat((bytes / Math.pow(k, i)).toFixed(1)) + " " + sizes[i];
  };

  const getFileIcon = () => {
    if (file.type === "application/pdf") {
      return <File className="w-5 h-5 text-red-500" />;
    } else if (file.type.startsWith("image/")) {
      return preview ? (
        <img src={preview} alt="" className="w-8 h-8 object-cover rounded" />
      ) : (
        <File className="w-5 h-5 text-blue-500" />
      );
    }
    return <File className="w-5 h-5 text-gray-500" />;
  };

  const getStatusIcon = () => {
    if (progress?.status === "processing") {
      return <Clock className="w-4 h-4 text-yellow-500" />;
    } else if (progress?.status === "completed") {
      return <CheckCircle className="w-4 h-4 text-green-500" />;
    } else if (progress?.status === "error") {
      return <AlertCircle className="w-4 h-4 text-red-500" />;
    }
    return null;
  };

  return (
    <div className="flex items-center space-x-3 p-3 bg-gray-50 rounded-lg">
      <div className="flex-shrink-0">{getFileIcon()}</div>

      <div className="flex-1 min-w-0">
        <div className="flex items-center space-x-2">
          <p className="text-sm font-medium text-gray-900 truncate">
            {file.name}
          </p>
          {getStatusIcon()}
        </div>
        <p className="text-xs text-gray-500">{formatFileSize(file.size)}</p>

        {/* Progress Bar */}
        {progress && (
          <div className="mt-2">
            <div className="w-full bg-gray-200 rounded-full h-1">
              <div
                className="bg-blue-600 h-1 rounded-full transition-all"
                style={{ width: `${progress.percent || 0}%` }}
              />
            </div>
            <p className="text-xs text-gray-500 mt-1">
              {progress.status === "processing" && "Processing..."}
              {progress.status === "completed" && "Completed"}
              {progress.status === "error" && "Error occurred"}
            </p>
          </div>
        )}
      </div>

      <button
        onClick={onRemove}
        disabled={disabled}
        className="flex-shrink-0 p-1 text-gray-400 hover:text-red-500 disabled:opacity-50"
      >
        <X className="w-4 h-4" />
      </button>
    </div>
  );
}

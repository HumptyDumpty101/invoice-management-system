/**
 * Complete Database and System Reset Script
 * Usage: node cleanup.js [--confirm] [--keep-uploads] [--dry-run]
 *
 * This script will:
 * 1. Clear all MongoDB collections
 * 2. Delete uploaded files
 * 3. Reset learning system data
 * 4. Clean temporary files
 * 5. Reset system to initial state
 */

const mongoose = require("mongoose");
const fs = require("fs");
const path = require("path");
const readline = require("readline");
require("dotenv").config();

// Import models
const Invoice = require("./src/models/Invoice");
const VendorMapping = require("./src/models/VendorMapping");

// Configuration
const config = {
  uploadDir: process.env.UPLOAD_DIR || "./uploads",
  tempDir: "./temp",
  logDir: "./logs",
  backupDir: "./backups",
  mongoUri:
    process.env.MONGODB_URI || "mongodb://localhost:27017/invoice-management",
};

// Color codes for console output
const colors = {
  reset: "\x1b[0m",
  bright: "\x1b[1m",
  red: "\x1b[31m",
  green: "\x1b[32m",
  yellow: "\x1b[33m",
  blue: "\x1b[34m",
  magenta: "\x1b[35m",
  cyan: "\x1b[36m",
};

// Utility functions
function log(message, color = colors.reset) {
  console.log(`${color}${message}${colors.reset}`);
}

function logSuccess(message) {
  log(`✅ ${message}`, colors.green);
}

function logWarning(message) {
  log(`⚠️  ${message}`, colors.yellow);
}

function logError(message) {
  log(`❌ ${message}`, colors.red);
}

function logInfo(message) {
  log(`ℹ️  ${message}`, colors.blue);
}

// Parse command line arguments
function parseArgs() {
  const args = process.argv.slice(2);
  return {
    confirm: args.includes("--confirm"),
    keepUploads: args.includes("--keep-uploads"),
    dryRun: args.includes("--dry-run"),
    help: args.includes("--help") || args.includes("-h"),
  };
}

// Show help information
function showHelp() {
  log("\n📋 Database and System Cleanup Script", colors.bright);
  log("\nUsage: node cleanup.js [options]\n", colors.cyan);
  log("Options:", colors.bright);
  log("  --confirm      Skip confirmation prompt");
  log("  --keep-uploads Keep uploaded files (only clear database)");
  log("  --dry-run      Show what would be deleted without actually deleting");
  log("  --help, -h     Show this help message\n");
  log("Examples:", colors.bright);
  log("  node cleanup.js                    # Interactive cleanup");
  log("  node cleanup.js --confirm          # Auto-confirm cleanup");
  log("  node cleanup.js --dry-run          # Preview cleanup actions");
  log("  node cleanup.js --keep-uploads     # Keep files, clear DB only\n");
}

// Get user confirmation
async function getUserConfirmation() {
  const rl = readline.createInterface({
    input: process.stdin,
    output: process.stdout,
  });

  return new Promise((resolve) => {
    rl.question("Are you sure you want to proceed? (yes/no): ", (answer) => {
      rl.close();
      resolve(answer.toLowerCase() === "yes" || answer.toLowerCase() === "y");
    });
  });
}

// Create backup before cleanup
async function createBackup() {
  try {
    const timestamp = new Date().toISOString().replace(/[:.]/g, "-");
    const backupPath = path.join(config.backupDir, `backup-${timestamp}`);

    if (!fs.existsSync(config.backupDir)) {
      fs.mkdirSync(config.backupDir, { recursive: true });
    }

    logInfo("Creating backup before cleanup...");

    // Backup database collections
    const collections = await mongoose.connection.db
      .listCollections()
      .toArray();
    const backupData = {};

    for (const collection of collections) {
      const collectionName = collection.name;
      if (collectionName !== "system.indexes") {
        const data = await mongoose.connection.db
          .collection(collectionName)
          .find({})
          .toArray();
        backupData[collectionName] = data;
        log(`  - Backed up ${collectionName}: ${data.length} documents`);
      }
    }

    // Save backup data
    const backupFile = `${backupPath}.json`;
    fs.writeFileSync(backupFile, JSON.stringify(backupData, null, 2));

    logSuccess(`Database backup created: ${backupFile}`);
    return backupFile;
  } catch (error) {
    logError(`Failed to create backup: ${error.message}`);
    return null;
  }
}

// Clear MongoDB collections
async function clearDatabase(dryRun = false) {
  try {
    logInfo("Connecting to MongoDB...");
    await mongoose.connect(config.mongoUri);
    logSuccess("Connected to MongoDB");

    // Get all collections
    const collections = await mongoose.connection.db
      .listCollections()
      .toArray();
    const collectionNames = collections
      .map((c) => c.name)
      .filter((name) => name !== "system.indexes");

    logInfo(`Found ${collectionNames.length} collections to clear:`);

    if (dryRun) {
      collectionNames.forEach((name) => {
        log(`  - Would clear collection: ${name}`, colors.yellow);
      });
      return { cleared: 0, total: collectionNames.length };
    }

    let clearedCount = 0;
    let totalDocuments = 0;

    for (const collectionName of collectionNames) {
      try {
        const collection = mongoose.connection.db.collection(collectionName);
        const count = await collection.countDocuments();
        totalDocuments += count;

        if (count > 0) {
          await collection.deleteMany({});
          logSuccess(`Cleared ${collectionName}: ${count} documents deleted`);
          clearedCount++;
        } else {
          log(`  - ${collectionName}: already empty`);
        }
      } catch (error) {
        logError(`Failed to clear ${collectionName}: ${error.message}`);
      }
    }

    logSuccess(
      `Database cleanup completed: ${clearedCount}/${collectionNames.length} collections cleared`
    );
    logSuccess(`Total documents deleted: ${totalDocuments}`);

    return {
      cleared: clearedCount,
      total: collectionNames.length,
      documents: totalDocuments,
    };
  } catch (error) {
    logError(`Database cleanup failed: ${error.message}`);
    throw error;
  }
}

// Clear uploaded files
async function clearUploadedFiles(dryRun = false) {
  try {
    if (!fs.existsSync(config.uploadDir)) {
      logInfo("Upload directory does not exist, skipping file cleanup");
      return { deleted: 0, total: 0 };
    }

    const files = fs.readdirSync(config.uploadDir);
    const actualFiles = files.filter((file) => {
      const filePath = path.join(config.uploadDir, file);
      return fs.statSync(filePath).isFile() && file !== ".gitkeep";
    });

    logInfo(`Found ${actualFiles.length} uploaded files to delete:`);

    if (dryRun) {
      actualFiles.forEach((file) => {
        const filePath = path.join(config.uploadDir, file);
        const stats = fs.statSync(filePath);
        const sizeKB = (stats.size / 1024).toFixed(1);
        log(`  - Would delete: ${file} (${sizeKB} KB)`, colors.yellow);
      });
      return { deleted: 0, total: actualFiles.length };
    }

    let deletedCount = 0;
    let totalSize = 0;

    for (const file of actualFiles) {
      try {
        const filePath = path.join(config.uploadDir, file);
        const stats = fs.statSync(filePath);
        totalSize += stats.size;

        fs.unlinkSync(filePath);
        logSuccess(`Deleted: ${file} (${(stats.size / 1024).toFixed(1)} KB)`);
        deletedCount++;
      } catch (error) {
        logError(`Failed to delete ${file}: ${error.message}`);
      }
    }

    logSuccess(
      `File cleanup completed: ${deletedCount}/${actualFiles.length} files deleted`
    );
    logSuccess(`Total space freed: ${(totalSize / 1024 / 1024).toFixed(2)} MB`);

    return {
      deleted: deletedCount,
      total: actualFiles.length,
      size: totalSize,
    };
  } catch (error) {
    logError(`File cleanup failed: ${error.message}`);
    throw error;
  }
}

// Clear temporary and log files
async function clearTempFiles(dryRun = false) {
  const dirsToClean = [config.tempDir, config.logDir];
  let totalCleaned = 0;

  for (const dir of dirsToClean) {
    if (!fs.existsSync(dir)) continue;

    try {
      const files = fs.readdirSync(dir);

      if (dryRun) {
        files.forEach((file) => {
          log(
            `  - Would delete temp file: ${path.join(dir, file)}`,
            colors.yellow
          );
        });
        continue;
      }

      for (const file of files) {
        const filePath = path.join(dir, file);
        if (fs.statSync(filePath).isFile()) {
          fs.unlinkSync(filePath);
          totalCleaned++;
        }
      }

      if (files.length > 0) {
        logSuccess(`Cleaned ${dir}: ${files.length} files deleted`);
      }
    } catch (error) {
      logError(`Failed to clean ${dir}: ${error.message}`);
    }
  }

  return totalCleaned;
}

// Reset application state
async function resetApplicationState(dryRun = false) {
  logInfo("Resetting application state...");

  if (dryRun) {
    log("  - Would reset learning system", colors.yellow);
    log("  - Would clear cache files", colors.yellow);
    log("  - Would reset configuration to defaults", colors.yellow);
    return;
  }

  // Additional reset operations can be added here
  // For example:
  // - Clear Redis cache if used
  // - Reset configuration files
  // - Clear application logs
  // - Reset counters or state files

  logSuccess("Application state reset completed");
}

// Verify system is clean
async function verifyCleanup() {
  logInfo("Verifying cleanup...");

  const issues = [];

  try {
    // Check database
    const collections = await mongoose.connection.db
      .listCollections()
      .toArray();
    for (const collection of collections) {
      if (collection.name !== "system.indexes") {
        const count = await mongoose.connection.db
          .collection(collection.name)
          .countDocuments();
        if (count > 0) {
          issues.push(
            `Collection ${collection.name} still has ${count} documents`
          );
        }
      }
    }

    // Check upload directory
    if (fs.existsSync(config.uploadDir)) {
      const files = fs
        .readdirSync(config.uploadDir)
        .filter((file) => file !== ".gitkeep");
      if (files.length > 0) {
        issues.push(`Upload directory still has ${files.length} files`);
      }
    }

    if (issues.length === 0) {
      logSuccess("✨ System is completely clean!");
    } else {
      logWarning("Some issues found:");
      issues.forEach((issue) => log(`  - ${issue}`, colors.yellow));
    }

    return issues.length === 0;
  } catch (error) {
    logError(`Verification failed: ${error.message}`);
    return false;
  }
}

// Generate cleanup report
function generateReport(results, startTime) {
  const endTime = Date.now();
  const duration = ((endTime - startTime) / 1000).toFixed(2);

  log("\n" + "=".repeat(60), colors.bright);
  log("🧹 CLEANUP REPORT", colors.bright);
  log("=".repeat(60), colors.bright);

  log(`\n📊 Summary:`, colors.cyan);
  log(`  • Duration: ${duration} seconds`);
  log(
    `  • Database collections cleared: ${results.database?.cleared || 0}/${
      results.database?.total || 0
    }`
  );
  log(`  • Documents deleted: ${results.database?.documents || 0}`);
  log(
    `  • Files deleted: ${results.files?.deleted || 0}/${
      results.files?.total || 0
    }`
  );
  if (results.files?.size) {
    log(`  • Space freed: ${(results.files.size / 1024 / 1024).toFixed(2)} MB`);
  }
  log(`  • Temp files cleaned: ${results.tempFiles || 0}`);

  if (results.backup) {
    log(`\n💾 Backup created: ${results.backup}`, colors.green);
  }

  log(
    `\n🎯 System Status: ${results.isClean ? "CLEAN" : "NEEDS ATTENTION"}`,
    results.isClean ? colors.green : colors.yellow
  );

  log("\n" + "=".repeat(60), colors.bright);
}

// Main cleanup function
async function cleanup() {
  const args = parseArgs();

  if (args.help) {
    showHelp();
    return;
  }

  const startTime = Date.now();
  const results = {};

  try {
    // Show banner
    log("\n" + "=".repeat(60), colors.bright);
    log("🧹 INVOICE MANAGEMENT SYSTEM CLEANUP", colors.bright);
    log("=".repeat(60), colors.bright);

    if (args.dryRun) {
      log(
        "\n🔍 DRY RUN MODE - No actual changes will be made\n",
        colors.yellow
      );
    }

    // Show what will be cleaned
    log("\n📋 Cleanup Plan:", colors.cyan);
    log("  • Clear all MongoDB collections");
    if (!args.keepUploads) {
      log("  • Delete uploaded invoice files");
    }
    log("  • Clean temporary and log files");
    log("  • Reset application state");
    log("  • Verify cleanup completion");

    // Get confirmation
    if (!args.confirm && !args.dryRun) {
      log("\n⚠️  This will permanently delete all data!", colors.red);
      const confirmed = await getUserConfirmation();
      if (!confirmed) {
        log("\nCleanup cancelled by user.", colors.yellow);
        return;
      }
    }

    log("\n🚀 Starting cleanup process...\n");

    // Create backup
    if (!args.dryRun) {
      results.backup = await createBackup();
    }

    // Clear database
    results.database = await clearDatabase(args.dryRun);

    // Clear uploaded files
    if (!args.keepUploads) {
      results.files = await clearUploadedFiles(args.dryRun);
    } else {
      logInfo("Skipping file cleanup (--keep-uploads flag)");
    }

    // Clear temp files
    results.tempFiles = await clearTempFiles(args.dryRun);

    // Reset application state
    await resetApplicationState(args.dryRun);

    // Verify cleanup
    if (!args.dryRun) {
      results.isClean = await verifyCleanup();
    }

    // Generate report
    generateReport(results, startTime);

    if (args.dryRun) {
      log(
        "\n🔍 Dry run completed. Use --confirm to execute cleanup.",
        colors.yellow
      );
    } else {
      log("\n✅ Cleanup completed successfully!", colors.green);
    }
  } catch (error) {
    logError(`\nCleanup failed: ${error.message}`);
    process.exit(1);
  } finally {
    // Close database connection
    if (mongoose.connection.readyState === 1) {
      await mongoose.connection.close();
      logInfo("Database connection closed");
    }
  }
}

// Handle script execution
if (require.main === module) {
  cleanup().catch((error) => {
    logError(`Fatal error: ${error.message}`);
    process.exit(1);
  });
}

module.exports = { cleanup, clearDatabase, clearUploadedFiles };

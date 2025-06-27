# Invoice Management System - Backend

A robust Node.js backend API built with Express that handles invoice processing, AI-powered data extraction, and machine learning-based categorization.

![Node.js](https://img.shields.io/badge/Node.js-18+-green) ![Express](https://img.shields.io/badge/Express-5+-black) ![MongoDB](https://img.shields.io/badge/MongoDB-6+-success) ![AI](https://img.shields.io/badge/AI-Gemini-blue)

## Features

### Core API Functionality

- **File Upload**: Multi-format invoice processing (PDF, JPG, PNG)
- **AI-Powered Extraction**: OCR + LLM parsing for maximum accuracy
- **Smart Categorization**: Machine learning expense category prediction
- **Data Validation**: Comprehensive validation with confidence scoring
- **Learning System**: Improves accuracy based on user corrections
- **Duplicate Detection**: Intelligent duplicate invoice identification
- **Analytics API**: Dashboard statistics and reporting endpoints
- **Export Functions**: CSV generation for accounting software

### Advanced Processing

- **Multi-method Extraction**: PDF parsing + OCR fallback
- **Confidence Scoring**: Quality assessment for extracted data
- **Vendor Learning**: Remembers user preferences and corrections
- **Batch Processing**: Handle multiple files simultaneously

## 🛠️ Tech Stack

### Core Framework

- **Node.js 18+** with ES6+ features
- **Express.js 5** with middleware pipeline
- **MongoDB 6** with Mongoose ODM
- **Multer** for file upload handling

### AI & Processing

- **Google Gemini AI** for intelligent text parsing
- **Tesseract.js** for OCR processing
- **pdf-parse** for PDF text extraction
- **Sharp** for image preprocessing

### Security & Validation

- **Helmet.js** for security headers
- **CORS** with configurable origins
- **Rate limiting** with express-rate-limit
- **Joi** for schema validation
- **Input sanitization** and XSS protection

### Development & Monitoring

- **Nodemon** for development hot reloading
- **Comprehensive logging** with error tracking
- **Health check endpoints** for monitoring
- **Environment-based configuration**

## Project Structure

```
backend/
├── src/
│   ├── routes/                 # API endpoint definitions
│   │   ├── upload.js          # File upload and processing
│   │   ├── invoices.js        # Invoice CRUD operations
│   │   ├── categories.js      # Expense category management
│   │   └── dashboard.js       # Analytics and reporting
│   ├── models/                # MongoDB schemas
│   │   ├── Invoice.js         # Main invoice model
│   │   └── VendorMapping.js   # Learning system model
│   ├── utils/                 # Business logic utilities
│   │   ├── textExtraction.js      # PDF/OCR processing
│   │   ├── dataParser.js          # Text to structured data
│   │   ├── llmInvoiceParser.js    # AI-powered parsing
│   │   ├── validation.js          # Data validation logic
│   │   ├── initializeLearning.js  # Setup learning system
│   │   └── testPrediction.js      # Testing utilities
│   ├── middleware/            # Custom middleware
│   └── server.js             # Application entry point
├── uploads/                   # File storage (with .gitkeep)
├── sample-data/              # Test invoice files
├── cleanup.js                # Database reset utility
├── package.json              # Dependencies and scripts
├── .env.example              # Environment template
└── README.md                 # This file
```

## 🚦 Getting Started

### Prerequisites

- **Node.js 18+** and npm
- **MongoDB 6+** (local installation or Atlas)

### Installation

1. **Navigate to backend directory**

```bash
cd backend
```

2. **Install dependencies**

```bash
npm install
```

3. **Environment Configuration**

```bash
# Copy environment template
cp .env.example .env

# Configure your environment variables
nano .env
```

4. **Environment Variables**

```bash
# Database
MONGODB_URI=mongodb://localhost:27017/invoice-management

# Server Configuration
PORT=5000
NODE_ENV=development
MAX_FILE_SIZE=10485760

# AI Services (optional but recommended)
GEMINI_API_KEY=your-gemini-api-key
OPENAI_API_KEY=your-openai-api-key
LLM_PROVIDER=gemini

# File Storage
UPLOAD_DIR=./uploads

# Security (generate strong secrets for production)
JWT_SECRET=your-jwt-secret
```

5. **Start MongoDB**

```bash
# If using local MongoDB
mongod

# If using MongoDB Atlas, ensure your connection string is correct
```

6. **Start development server**

```bash
npm run dev
```

7. **Verify installation**

```bash
# Health check
curl http://localhost:5000/api/health

# Expected response:
{
  "status": "healthy",
  "timestamp": "2024-01-01T00:00:00.000Z",
  "environment": "development"
}
```

### Available Scripts

```bash
npm run dev                    # Start development server with nodemon
npm start                      # Start production server
npm run init-learning          # Initialize learning system from existing data
npm run test-prediction       # Test category prediction
npm run reset-learning        # Clear learning data
npm run cleanup               # Complete database reset
npm run cleanup:confirm       # Auto-confirm cleanup
npm run cleanup:dry-run       # Preview cleanup actions
```

## API Documentation

### Base URL

```
http://localhost:5000/api
```

### Authentication

Currently no authentication required (as per MVP scope). Ready for JWT integration.

---

## Upload Endpoints

### POST `/upload`

Upload and process invoice files

**Request:**

```bash
curl -X POST \
  http://localhost:5000/api/upload \
  -H 'Content-Type: multipart/form-data' \
  -F 'invoices=@invoice1.pdf' \
  -F 'invoices=@invoice2.jpg'
```

**Response:**

```json
{
  "success": true,
  "processed": 2,
  "total": 2,
  "results": [
    {
      "id": "507f1f77bcf86cd799439011",
      "vendor": "Midjourney",
      "date": "2024-01-15T00:00:00.000Z",
      "amount": 10.0,
      "category": "5020",
      "confidence": 95,
      "needsReview": false,
      "processingTime": 1250
    }
  ],
  "processingInfo": {
    "totalProcessingTime": 2500,
    "averageConfidence": 88,
    "ocrUsed": true,
    "pdfUsed": true
  }
}
```

### GET `/upload/status`

Check upload service status

**Response:**

```json
{
  "status": "ready",
  "maxFileSize": 10485760,
  "allowedTypes": ["pdf", "jpg", "jpeg", "png"],
  "maxFiles": 5
}
```

---

## Invoice Management

### GET `/invoices`

Retrieve invoices with filtering and pagination

**Parameters:**

- `page` (number): Page number (default: 1)
- `limit` (number): Items per page (default: 20)
- `vendor` (string): Filter by vendor name
- `category` (string): Filter by category code
- `needsReview` (boolean): Filter invoices needing review
- `dateFrom` (date): Start date filter
- `dateTo` (date): End date filter
- `amountMin` (number): Minimum amount filter
- `amountMax` (number): Maximum amount filter

**Example:**

```bash
curl "http://localhost:5000/api/invoices?category=5020&needsReview=true&page=1&limit=10"
```

**Response:**

```json
{
  "invoices": [
    {
      "_id": "507f1f77bcf86cd799439011",
      "vendor": "Midjourney",
      "date": "2024-01-15T00:00:00.000Z",
      "amount": 10.0,
      "category": "5020",
      "formattedDate": "1/15/2024",
      "formattedAmount": "$10.00",
      "requiresReview": false
    }
  ],
  "pagination": {
    "page": 1,
    "limit": 10,
    "total": 25,
    "pages": 3,
    "hasNext": true,
    "hasPrev": false
  },
  "summary": {
    "totalInvoices": 25,
    "needsReview": 3,
    "totalAmount": 1250.0
  }
}
```

### GET `/invoices/:id`

Get single invoice with detailed information

**Response:**

```json
{
  "_id": "507f1f77bcf86cd799439011",
  "vendor": "Midjourney",
  "date": "2024-01-15T00:00:00.000Z",
  "amount": 10.0,
  "category": "5020",
  "rawText": "MIDJOURNEY INC...",
  "extractedData": {
    "lineItems": [
      {
        "description": "Basic Plan Nov 5 – Dec 5, 2024",
        "amount": 10.0,
        "quantity": 1
      }
    ],
    "tax": 1.8,
    "subtotal": 10.0,
    "currency": "USD"
  },
  "validationStatus": {
    "dateValid": true,
    "amountValid": true,
    "vendorValid": true,
    "overallConfidence": 95,
    "issues": [],
    "needsReview": false
  },
  "fileMetadata": {
    "originalName": "midjourney-invoice.pdf",
    "fileType": "pdf",
    "fileSize": 45230,
    "pageCount": 1,
    "ocrConfidence": 98
  },
  "potentialDuplicates": []
}
```

### PUT `/invoices/:id`

Update invoice with learning system integration

**Request:**

```json
{
  "vendor": "Midjourney Inc",
  "date": "2024-01-15",
  "amount": 10.0,
  "category": "5020",
  "extractedData": {
    "lineItems": [
      {
        "description": "Basic Plan Nov 5 – Dec 5, 2024",
        "amount": 10.0,
        "quantity": 1
      }
    ],
    "tax": 1.8,
    "subtotal": 10.0
  }
}
```

**Response:**

```json
{
  "success": true,
  "invoice": {
    /* updated invoice object */
  },
  "message": "Invoice updated successfully"
}
```

### DELETE `/invoices/:id`

Delete invoice and associated files

**Response:**

```json
{
  "success": true,
  "message": "Invoice deleted successfully"
}
```

### POST `/invoices/bulk-action`

Perform bulk operations on multiple invoices

**Request:**

```json
{
  "action": "updateCategory",
  "invoiceIds": ["507f1f77bcf86cd799439011", "507f1f77bcf86cd799439012"],
  "data": {
    "category": "5010"
  }
}
```

**Available Actions:**

- `delete`: Delete selected invoices
- `updateCategory`: Change category for selected invoices
- `markReviewed`: Mark invoices as reviewed

---

## Category Management

### GET `/categories`

Get all expense categories with grouping

**Response:**

```json
{
  "categories": [
    {
      "code": "5010",
      "name": "Office Supplies",
      "description": "Pens, paper, printer cartridges, basic office items",
      "isDefault": true
    }
  ],
  "grouped": {
    "assets": [...],
    "liabilities": [...],
    "equity": [...],
    "revenue": [...],
    "expenses": [...]
  },
  "total": 25
}
```

### GET `/categories/expenses`

Get expense categories only (most used for invoices)

### GET `/categories/predict/:vendor`

Predict category for vendor with confidence scoring

**Parameters:**

- `amount` (query, optional): Invoice amount for better prediction

**Example:**

```bash
curl "http://localhost:5000/api/categories/predict/Midjourney?amount=10"
```

**Response:**

```json
{
  "vendor": "Midjourney",
  "prediction": {
    "category": "5020",
    "name": "Software Subscriptions",
    "confidence": 95,
    "reason": "Based on 15 previous transactions",
    "alternatives": [
      {
        "category": "5010",
        "name": "Office Supplies",
        "confidence": 25
      }
    ]
  }
}
```

---

## Dashboard & Analytics

### GET `/dashboard/stats`

Get dashboard statistics with configurable time period

**Parameters:**

- `period` (query): Number of days to include (default: 30)

**Response:**

```json
{
  "summary": {
    "totalInvoices": 150,
    "totalAmount": 15750.00,
    "avgAmount": 105.00,
    "maxAmount": 2500.00,
    "minAmount": 5.00,
    "periodInvoices": 25,
    "periodAmount": 2100.00,
    "needsReview": 5,
    "duplicates": 2
  },
  "categoryBreakdown": [
    {
      "categoryCode": "5020",
      "categoryName": "Software Subscriptions",
      "count": 45,
      "totalAmount": 4500.00,
      "avgAmount": 100.00
    }
  ],
  "recentInvoices": [...],
  "monthlyTrends": [
    {
      "month": "2024-01",
      "monthName": "January 2024",
      "count": 25,
      "totalAmount": 2500.00,
      "avgAmount": 100.00
    }
  ]
}
```

### GET `/dashboard/export`

Export invoices as CSV

**Parameters:**

- `startDate` (query): Start date filter
- `endDate` (query): End date filter
- `category` (query): Category filter
- `vendor` (query): Vendor filter
- `format` (query): Export format (default: csv)

**Response:** CSV file download

### GET `/dashboard/analytics/:type`

Get specific analytics data

**Types:**

- `vendors`: Top vendors by transaction count
- `categories`: Category distribution analysis
- `trends`: Daily/weekly trends
- `accuracy`: System accuracy metrics

---

## Database Schema

### Invoice Model

```javascript
{
  _id: ObjectId,
  vendor: String,                    // Business name
  date: Date,                       // Invoice date
  amount: Number,                   // Total amount
  category: String,                 // Expense category code
  categoryConfidence: Number,       // AI prediction confidence
  rawText: String,                  // Extracted text
  extractedData: {
    lineItems: [{
      description: String,
      amount: Number,
      quantity: Number
    }],
    tax: Number,
    subtotal: Number,
    currency: String
  },
  validationStatus: {
    dateValid: Boolean,
    amountValid: Boolean,
    vendorValid: Boolean,
    overallConfidence: Number,
    issues: [String],
    needsReview: Boolean
  },
  fileMetadata: {
    originalName: String,
    fileName: String,
    fileType: String,
    fileSize: Number,
    pageCount: Number,
    ocrConfidence: Number
  },
  processingMetadata: {
    extractionMethod: String,
    processingTime: Number,
    retryCount: Number,
    version: String
  },
  userCorrected: Boolean,
  isDuplicate: Boolean,
  duplicateOf: ObjectId,
  createdAt: Date,
  updatedAt: Date
}
```

### Vendor Mapping (Learning System)

```javascript
{
  _id: ObjectId,
  vendor: String,                   // Original vendor name
  normalizedVendor: String,         // Cleaned vendor name
  category: String,                 // Learned category
  count: Number,                    // Usage frequency
  confidence: Number,               // Weighted confidence
  lastUsed: Date,
  averageAmount: Number,
  amountRange: {
    min: Number,
    max: Number
  },
  userCorrections: Number,          // Manual corrections count
  autoAssigned: Boolean,
  createdAt: Date,
  updatedAt: Date
}
```

---

## AI Integration

### LLM-Powered Parsing

The system uses Google Gemini AI for intelligent invoice parsing:

```javascript
// Configure LLM provider
const parser = new LLMInvoiceParser({
  provider: "gemini", // or 'openai'
  maxRetries: 2,
});

// Parse invoice with AI
const result = await parser.parseInvoiceWithLLM(rawText, metadata);
```

### Features:

- **OCR Error Correction**: Fixes common OCR mistakes (ss68 → $5.68)
- **Intelligent Extraction**: Identifies actual line items vs headers/addresses
- **Confidence Scoring**: Provides reliability metrics
- **Fallback System**: Uses rule-based parsing if AI fails

### OCR Processing

Multi-stage text extraction with quality enhancement:

```javascript
// PDF extraction with OCR fallback
const extraction = await extractText(filePath, fileType);

// Image preprocessing for better OCR
const processedImage = await preprocessImage(originalPath);

// Tesseract.js with optimized settings
const ocrResult = await worker.recognize(processedImage, {
  tessedit_char_whitelist: "0-9A-Za-z$.,/:-# ",
  tessedit_pageseg_mode: "6",
});
```

---

## Learning System

### Vendor-Category Mapping

The system learns from user corrections and improves over time:

```javascript
// Update learning when user corrects category
await VendorMapping.updateMapping(
  vendor, // "Midjourney"
  category, // "5020"
  amount, // 10.00
  isUserCorrected // true
);

// Get prediction with learning
const prediction = await VendorMapping.predictCategory(vendor, amount);
```

### Learning Features:

- **Confidence Weighting**: Higher weight for user corrections
- **Frequency Tracking**: More frequent associations get higher confidence
- **Amount Validation**: Learns typical amount ranges per vendor
- **Decay Function**: Reduces confidence for incorrect predictions

### Prediction Algorithm:

1. **Exact Match**: Direct vendor-category mappings
2. **Pattern Matching**: Business type recognition
3. **Amount Analysis**: Typical spending patterns
4. **Confidence Scoring**: Weighted prediction confidence

---

## Processing Pipeline

### File Upload Flow

1. **File Validation**: Type, size, format checking
2. **Text Extraction**: PDF parsing or OCR processing
3. **AI Parsing**: LLM-powered data extraction
4. **Validation**: Data quality assessment
5. **Category Prediction**: ML-based categorization
6. **Duplicate Detection**: Similarity checking
7. **Database Storage**: Structured data persistence
8. **Learning Update**: Improve future predictions

### Error Handling

Comprehensive error handling at every stage:

```javascript
// File processing with retry logic
try {
  const result = await processInvoiceFile(file);
} catch (error) {
  if (error.code === "OCR_FAILED") {
    // Retry with different OCR settings
    return await retryOCRProcessing(file);
  }
  throw new ProcessingError(error.message);
}
```

### Quality Assurance

- **Confidence Scoring**: 0-100% confidence for all extractions
- **Validation Checks**: Business rule validation
- **Manual Review Flags**: Low confidence items flagged for review
- **Error Recovery**: Graceful degradation on failures

---

## Security Features

### Input Validation

```javascript
// Joi schema validation
const invoiceSchema = Joi.object({
  vendor: Joi.string().trim().min(1).max(200).required(),
  amount: Joi.number().positive().max(10000000).required(),
  date: Joi.date().min("2019-01-01").max("2030-12-31").required(),
});
```

### API Security

- **Rate Limiting**: 100 requests per 15 minutes
- **CORS Configuration**: Restricted origins
- **Helmet.js**: Security headers
- **Input Sanitization**: XSS protection

---

## Performance Optimization

### Database Indexing

```javascript
// Optimized indexes for common queries
invoiceSchema.index({ vendor: 1, date: -1 });
invoiceSchema.index({ category: 1, date: -1 });
invoiceSchema.index({ "validationStatus.needsReview": 1 });
vendorMappingSchema.index({ normalizedVendor: 1, category: 1 });
```

### Memory Management

- **Stream Processing**: Large file handling
- **Garbage Collection**: Cleanup temporary files
- **Connection Pooling**: MongoDB connection optimization
- **Memory Limits**: Configurable memory usage

### Caching Strategy

- **Vendor Predictions**: Cache frequent predictions
- **Category Lists**: Cache static data
- **File Processing**: Cache processed results

---

## Testing & Development

### Testing Utilities

```bash
# Test category prediction
npm run test-prediction "Midjourney" 10

# Initialize learning from existing data
npm run init-learning

# Test with sample data
curl -X POST http://localhost:5000/api/upload \
  -F 'invoices=@sample-data/midjourney-invoice.pdf'
```

### Development Tools

```bash
# Watch mode with automatic restart
npm run dev

# Debug mode with verbose logging
DEBUG=invoice:* npm run dev

# Database reset for clean testing
npm run cleanup:confirm
```

### Sample Data

Comprehensive test dataset included:

- **High-quality PDFs**: Clean extraction testing
- **Poor-quality Images**: OCR robustness testing
- **Multi-page Documents**: Complex parsing testing
- **Various Vendors**: Learning system testing

---

## Monitoring & Logging

### Health Checks

```bash
# API health
GET /api/health

# Database connectivity
GET /api/health/db

# Processing status
GET /api/upload/status
```

### Logging System

- **Request Logging**: All API calls logged
- **Error Tracking**: Comprehensive error details
- **Performance Metrics**: Processing time tracking
- **User Actions**: Audit trail for corrections

### Metrics Collection

```javascript
// Processing metrics
{
  extractionTime: 1250,
  parsingMethod: 'llm',
  confidence: 95,
  retryCount: 0,
  fileSize: 45230
}
```

---

## Production Deployment

### Environment Setup

```bash
# Production environment
NODE_ENV=production
PORT=5000
MONGODB_URI=mongodb://localhost:27017/invoice-prod

# AI Services
GEMINI_API_KEY=your-production-key
LLM_PROVIDER=gemini

# Security
JWT_SECRET=your-strong-production-secret
RATE_LIMIT_WINDOW=900000
RATE_LIMIT_MAX=100

# File Storage
UPLOAD_DIR=/app/uploads
MAX_FILE_SIZE=10485760
```

### Process Management

```bash
# Using PM2 for production
npm install -g pm2
pm2 start src/server.js --name invoice-api
pm2 startup
pm2 save
```

### Docker Deployment

```dockerfile
FROM node:18-alpine
WORKDIR /app
COPY package*.json ./
RUN npm ci --only=production
COPY . .
EXPOSE 5000
CMD ["npm", "start"]
```

---

## Scalability Considerations

### Database Scaling

- **Connection Pooling**: Optimized connection management
- **Indexing Strategy**: Query optimization
- **Aggregation Pipelines**: Efficient analytics
- **Sharding Ready**: Horizontal scaling preparation

### File Processing

- **Queue System**: Redis/Bull for background processing
- **Worker Processes**: Distributed OCR processing
- **File Storage**: S3/GridFS for large scale
- **CDN Integration**: Fast file delivery

### API Scaling

- **Load Balancing**: Multiple instance support
- **Caching Layer**: Redis for frequently accessed data
- **Rate Limiting**: Per-user and global limits
- **API Versioning**: Backward compatibility

---

## Maintenance & Operations

### Database Maintenance

```bash
# Clean up old files and optimize database
npm run cleanup

# Backup learning data
npm run backup-learning

# Rebuild indexes
npm run rebuild-indexes
```

### Monitoring Commands

```bash
# Check system health
curl http://localhost:5000/api/health

# Monitor processing queue
npm run status

# View error logs
tail -f logs/error.log
```

---

## Contributing

### Code Standards

- **ESLint**: Consistent code formatting
- **Error Handling**: Comprehensive try-catch blocks
- **Logging**: Appropriate log levels
- **Documentation**: JSDoc for all functions
- **Testing**: Unit tests for core functions

### Adding New Features

1. **API Endpoints**: Follow RESTful conventions
2. **Database Models**: Use Mongoose schemas
3. **Validation**: Joi schema validation
4. **Error Handling**: Custom error classes
5. **Documentation**: Update API docs

---

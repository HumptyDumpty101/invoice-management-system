# Invoice Management System - Frontend

A modern React frontend built with Next.js 15 that provides an intuitive interface for invoice processing, management, and analytics.

![Next.js](https://img.shields.io/badge/Next.js-15-black) ![React](https://img.shields.io/badge/React-19-blue) ![Tailwind](https://img.shields.io/badge/Tailwind-4-cyan) ![TypeScript](https://img.shields.io/badge/TypeScript-Ready-blue)

## Features

### Core Functionality

- **Drag & Drop Upload**: Multi-file invoice upload with progress tracking
- **Real-time Dashboard**: Live statistics and invoice management
- **Advanced Filtering**: Search and filter invoices by multiple criteria
- **Invoice Editing**: In-line editing with validation and confidence scoring
- **Analytics**: Visual charts and spending insights
- **Category Management**: Expense category configuration
- **Review Workflow**: Streamlined approval process for flagged invoices
- **Export Functions**: CSV export for accounting software

### User Experience

- **Responsive Design**: Works seamlessly on desktop, tablet, and mobile
- **Modern UI**: Clean, professional interface with Tailwind CSS
- **Real-time Updates**: Live processing status and progress indicators
- **Smart Notifications**: Toast notifications for user feedback
- **Accessibility**: Semantic HTML and keyboard navigation support

## 🛠️ Tech Stack

### Core Framework

- **Next.js 15** with App Router
- **React 19** with modern hooks
- **Tailwind CSS 4** for styling
- **Lucide React** for icons

### State Management & Data

- **React Context** for global state
- **Custom Hooks** for data fetching
- **Axios** for HTTP client with interceptors
- **React Hot Toast** for notifications

### File Handling

- **React Dropzone** for file uploads
- **Progress Tracking** with real-time updates
- **File Validation** with type and size checks
- **Multiple File Support** (up to 5 files)

### Components & UI

- **Modular Components** with clear separation of concerns
- **Reusable Utilities** for formatting and validation
- **Custom Hooks** for business logic
- **Responsive Grid Layouts** with CSS Grid and Flexbox

## Project Structure

```
frontend/
├── src/
│   ├── app/                    # Next.js App Router
│   │   ├── page.js            # Home/Upload page
│   │   ├── dashboard/         # Dashboard functionality
│   │   ├── invoice/[id]/      # Individual invoice editing
│   │   ├── categories/        # Category management
│   │   ├── review/            # Review workflow
│   │   ├── layout.js          # Root layout with navigation
│   │   └── globals.css        # Global styles and utilities
│   ├── components/            # Reusable React components
│   │   ├── dashboard/         # Dashboard-specific components
│   │   │   ├── QuickStats.js         # Statistics cards
│   │   │   ├── InvoiceList.js        # Invoice listing with grid/list views
│   │   │   ├── InvoiceFilters.js     # Advanced filtering interface
│   │   │   └── BulkActions.js        # Bulk operations (delete, categorize)
│   │   ├── upload/            # File upload components
│   │   │   ├── SingleUpload.js       # Main upload interface
│   │   │   └── UploadResults.js      # Processing results display
│   │   └── shared/            # Shared components
│   │       └── Navigation.js         # Main navigation bar
│   ├── lib/                   # Utilities and API client
│   │   └── api.js            # Complete API client with error handling
│   ├── jsconfig.json         # Path aliases configuration
│   ├── next.config.mjs       # Next.js configuration
│   ├── package.json          # Dependencies and scripts
│   ├── postcss.config.mjs    # PostCSS configuration
│   └── tailwind.config.js    # Tailwind CSS configuration
└── README.md                 # This file
```

## Getting Started

### Prerequisites

- **Node.js 18+** and npm
- **Backend server** running on port 5000

### Installation

1. **Navigate to frontend directory**

```bash
cd frontend
```

2. **Install dependencies**

```bash
npm install
```

3. **Environment Configuration**

```bash
# Create environment file (optional)
cp .env.example .env.local

# Configure API URL (defaults to http://localhost:5000)
NEXT_PUBLIC_API_URL=http://localhost:5000
```

4. **Start development server**

```bash
npm run dev
```

5. **Access application**

```
http://localhost:3000
```

### Available Scripts

```bash
npm run dev          # Start development server with hot reloading
npm run build        # Build for production
npm run start        # Start production server
npm run lint         # Run ESLint for code quality
```

## Component Architecture

### Page Components

- **`app/page.js`**: Main upload interface with feature showcase
- **`app/dashboard/page.jsx`**: Complete invoice management dashboard
- **`app/invoice/[id]/page.jsx`**: Detailed invoice editing with validation
- **`app/categories/page.jsx`**: Expense category management
- **`app/review/page.jsx`**: Review workflow for flagged invoices

### Reusable Components

#### Upload System

```javascript
// Single file upload with drag & drop
<SingleUpload
  onUploadStart={handleStart}
  onUploadSuccess={handleSuccess}
  onUploadError={handleError}
  isUploading={uploading}
/>

// Display processing results
<UploadResults results={uploadResults} />
```

#### Dashboard Components

```javascript
// Real-time statistics
<QuickStats />

// Advanced filtering
<InvoiceFilters
  filters={filters}
  onFilterChange={setFilters}
/>

// Invoice listing with grid/list views
<InvoiceList
  invoices={invoices}
  selectedInvoices={selected}
  onSelectInvoice={handleSelect}
  viewMode="grid"
/>

// Bulk operations
<BulkActions
  selectedCount={selected.length}
  selectedInvoices={selected}
  onBulkAction={handleBulkAction}
/>
```

## 🔌 API Integration

### API Client (`lib/api.js`)

Complete API client with error handling, interceptors, and utility functions:

```javascript
// File upload with progress tracking
await uploadInvoices(formData, (progress) => {
  setUploadProgress(progress);
});

// Invoice management
const invoices = await getInvoices({
  page: 1,
  category: "5010",
  needsReview: true,
});

// Category prediction
const prediction = await predictCategory(vendor, amount);

// Dashboard analytics
const stats = await getDashboardStats("30");

// Export functionality
await exportInvoices({
  startDate: "2024-01-01",
  endDate: "2024-12-31",
});
```

### Error Handling

- **Global Error Interceptor**: Handles network errors and API responses
- **Toast Notifications**: User-friendly error messages
- **Retry Logic**: Automatic retry for transient failures
- **Graceful Degradation**: Fallback behavior for offline scenarios

## Styling & Design

### Tailwind CSS Configuration

Custom utility classes and design system:

```css
/* Component styles in globals.css */
.card {
  @apply bg-white rounded-lg border border-gray-200 shadow-sm;
}

.btn-primary {
  @apply bg-blue-600 text-white px-4 py-2 rounded-lg hover:bg-blue-700 
         disabled:opacity-50 transition-colors;
}

.input {
  @apply w-full px-3 py-2 border border-gray-300 rounded-lg 
         focus:ring-2 focus:ring-blue-500 focus:border-blue-500;
}
```

### Design System

- **Color Palette**: Professional blue/gray theme
- **Typography**: Inter font with proper hierarchy
- **Spacing**: Consistent 4px grid system
- **Components**: Reusable button, input, and card styles
- **Icons**: Lucide React icon library

### Responsive Design

- **Mobile-first**: Optimized for mobile devices
- **Breakpoints**: Tailwind's standard responsive breakpoints
- **Grid Layouts**: CSS Grid and Flexbox for complex layouts
- **Touch-friendly**: Appropriate touch targets for mobile

## State Management

### Local State Patterns

```javascript
// Invoice editing with optimistic updates
const [invoice, setInvoice] = useState(null);
const [formData, setFormData] = useState({});
const [validationErrors, setValidationErrors] = useState({});

// Dashboard with loading and error states
const [invoices, setInvoices] = useState([]);
const [loading, setLoading] = useState(true);
const [error, setError] = useState(null);
```

### Global State (Context)

- **User Preferences**: Theme, view modes, filters
- **API Status**: Connection status, rate limits
- **Cache Management**: Recently viewed invoices

## Advanced Features

### File Upload System

- **Multiple File Types**: PDF, JPG, PNG support
- **File Validation**: Type, size, and format checking
- **Progress Tracking**: Real-time upload and processing progress
- **Error Recovery**: Retry failed uploads
- **Preview Generation**: Image previews for uploaded files

### Invoice Management

- **Inline Editing**: Edit invoices without page refresh
- **Validation System**: Real-time form validation with confidence scoring
- **Bulk Operations**: Select multiple invoices for batch actions
- **Duplicate Detection**: Visual indicators for potential duplicates
- **Category Prediction**: AI-powered expense categorization

### Dashboard Analytics

- **Real-time Statistics**: Live invoice counts and totals
- **Filtering System**: Advanced search and filter options
- **Export Functions**: CSV export with custom date ranges
- **View Modes**: Grid and list views for invoice display

### Review Workflow

- **Priority Sorting**: Critical, high, medium, low priority items
- **Confidence Scoring**: Visual indicators for data quality
- **Batch Approval**: Approve or reject multiple invoices
- **Issue Tracking**: Detailed validation issues and warnings

## Testing & Quality

### Code Quality

- **ESLint Configuration**: Next.js recommended rules
- **Component Standards**: Consistent naming and structure
- **Error Boundaries**: Graceful error handling
- **Performance**: Optimized re-renders and memory usage

### Browser Support

- **Modern Browsers**: Chrome, Firefox, Safari, Edge
- **Mobile Browsers**: iOS Safari, Chrome Mobile
- **Feature Detection**: Progressive enhancement

## Performance Optimization

### Next.js Features

- **App Router**: Modern routing with layouts and loading states
- **Static Generation**: Pre-rendered pages where possible
- **Image Optimization**: Automatic image optimization
- **Code Splitting**: Automatic route-based code splitting

### Custom Optimizations

- **Lazy Loading**: Components loaded on demand
- **Memoization**: React.memo for expensive components
- **Virtual Scrolling**: For large invoice lists
- **Debounced Search**: Optimized search input handling

## Mobile Experience

### Responsive Features

- **Touch Gestures**: Swipe actions for mobile
- **Mobile Navigation**: Collapsible sidebar menu
- **Upload Optimization**: Camera capture for receipts
- **Offline Support**: Basic offline functionality

### Progressive Web App

- **Service Worker**: Caching for offline access
- **App Manifest**: Install as native app
- **Push Notifications**: Background sync notifications

## Development Tools

### Hot Reloading

- **Fast Refresh**: Instant component updates
- **Error Overlay**: Development error display
- **Source Maps**: Easy debugging

### Development Utilities

```javascript
// Debug logging
console.log("Upload progress:", progress);

// Error tracking
console.error("API Error:", error);

// Performance monitoring
console.time("Invoice processing");
```

## Production Deployment

### Build Process

```bash
npm run build        # Create production build
npm run start        # Start production server
```

### Environment Variables

```bash
NEXT_PUBLIC_API_URL=https://api.yourdomain.com
NEXT_PUBLIC_SENTRY_DSN=your-sentry-dsn
```

### Deployment Platforms

- **Vercel**: Optimal for Next.js (recommended)
- **Netlify**: Static site deployment
- **AWS S3**: Static hosting with CloudFront
- **Docker**: Container deployment

## Future Enhancements

### Planned Features

- [ ] **Dark Mode**: Theme switching capability
- [ ] **Offline Support**: Progressive Web App features
- [ ] **Advanced Charts**: More detailed analytics and reporting
- [ ] **Keyboard Shortcuts**: Power user productivity features
- [ ] **Mobile App**: React Native companion app

### Technical Improvements

- [ ] **TypeScript Migration**: Full type safety
- [ ] **Testing Suite**: Jest and React Testing Library
- [ ] **Performance Monitoring**: Real User Monitoring (RUM)
- [ ] **Accessibility Audit**: WCAG 2.1 AA compliance
- [ ] **Internationalization**: Multi-language support

## 🤝 Contributing

### Development Guidelines

1. **Follow ESLint rules** for consistent code style
2. **Use semantic commits** for clear change history
3. **Test responsiveness** on multiple screen sizes
4. **Validate accessibility** with screen readers
5. **Document new components** with JSDoc comments

### Component Standards

```javascript
/**
 * InvoiceCard - Displays invoice summary with actions
 * @param {Object} invoice - Invoice data object
 * @param {Function} onEdit - Edit callback function
 * @param {Function} onDelete - Delete callback function
 */
export default function InvoiceCard({ invoice, onEdit, onDelete }) {
  // Component implementation
}
```

---

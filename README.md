# AESTHETX LIFESTYLE — Production Clothing E-Commerce Platform

> "Buying clothes is cheaper than therapy"

A complete, production-grade clothing e-commerce web application with customer shopping, dynamic clothing catalog, size & color variants matrix, Cash on Delivery (COD) checkout, real-time shipment tracking, customer accounts, and an administrative portal connected to **Firebase (Auth, Firestore, Storage)**.

---

## 🛍️ Project Overview

- **Brand Name**: AESTHETX LIFESTYLE
- **Business Phone / WhatsApp**: `01708943242`
- **Business Email**: `badhonrefaz@gmail.com`
- **Facebook**: `https://www.facebook.com/share/1MBQboEuDz/`
- **Currency**: Bangladeshi Taka (`৳` BDT)
- **Timezone**: `Asia/Dhaka`
- **Delivery Coverage**: All 64 Districts in Bangladesh (Cash on Delivery)
- **Official Logo**: Embedded directly from the official branding asset.
- **Color Palette**: Forest Green (`#1E3A2F`), Terracotta (`#C85A32`), Warm Cream (`#FAF8F5`), Sage Green (`#748D80`).

---

## 🛠️ Technology Stack

- **Frontend Framework**: React 19 + TypeScript + Vite
- **Styling**: Tailwind CSS v4 with centralized design tokens & CSS variables
- **Backend / BaaS**: Firebase Web SDK (v11)
  - **Firebase Authentication**: Email/Password and Google sign-in
  - **Cloud Firestore**: Real-time scalable NoSQL database
  - **Firebase Storage**: Product photography and banner storage with automatic client-side compression and DataURL fallback
- **Icons**: Lucide React
- **Celebration Animations**: Canvas Confetti

---

## 📁 Project Structure

```text
├── index.html                   # Entry HTML with brand fonts & OpenGraph tags
├── package.json                 # Project dependencies
├── metadata.json                # AI Studio application metadata
├── .env.example                 # Environment variables specification
├── public/
│   └── assets/aistudio/         # Official store logo asset
└── src/
    ├── types/                   # TypeScript interfaces (Product, Order, Variant, etc.)
    ├── firebase/
    │   ├── config.ts            # Firebase app, auth, db, and storage initialization
    │   ├── db.ts                # Firestore queries & CRUD functions
    │   └── storage.ts           # Canvas image compression & upload service
    ├── context/
    │   ├── AuthContext.tsx      # Customer & Admin authentication state
    │   ├── CartContext.tsx      # Shopping bag, variants validation & coupons
    │   ├── WishlistContext.tsx  # Customer saved items
    │   └── SettingsContext.tsx  # Dynamic store branding & delivery rates
    ├── components/
    │   └── common/
    │       ├── AnnouncementBar.tsx # Top bar with hotline and delivery notices
    │       ├── Navbar.tsx          # Responsive navigation & search
    │       ├── Footer.tsx          # Store details, trust badges, policies
    │       ├── MobileNavigation.tsx# Thumb-friendly bottom app bar
    │       ├── ProductCard.tsx     # Clothing card with size/color chips
    │       ├── EmptyState.tsx      # Clean UI when database collections are empty
    │       ├── LoadingSkeleton.tsx # Skeleton loaders
    │       └── SizeChartModal.tsx  # Interactive size & measurement guide
    ├── pages/
    │   ├── HomePage.tsx            # Hero banner, categories, new arrivals
    │   ├── ShopPage.tsx            # Catalog with filters & mobile bottom sheet
    │   ├── ProductDetailPage.tsx   # Gallery, variant stock check, buy now, reviews
    │   ├── CartPage.tsx            # Cart breakdown & coupon application
    │   ├── CheckoutPage.tsx        # Bangladesh address form & COD checkout
    │   ├── OrderConfirmationPage.tsx # Receipt invoice & print functionality
    │   ├── TrackOrderPage.tsx      # Live step-by-step order tracking timeline
    │   ├── WishlistPage.tsx        # Saved products grid
    │   ├── AccountPage.tsx         # Customer profile & past orders
    │   ├── StaticInfoPage.tsx      # About, Contact, Policies, Size guide, FAQ
    │   ├── NotFoundPage.tsx        # 404 page
    │   └── admin/
    │       ├── AdminAuthGate.tsx   # Enforces Administrator UID/Email check
    │       ├── AdminLayout.tsx     # Desktop sidebar + mobile drawer
    │       ├── AdminDashboard.tsx  # 100% REAL analytics + setup guidance
    │       ├── AdminProducts.tsx   # Products table, search, category filter
    │       ├── AdminProductForm.tsx# Multi-photo upload, sizes, color swatches, variant stock matrix
    │       ├── AdminCategories.tsx # Collections management
    │       ├── AdminOrders.tsx     # Order statuses, customer notes, invoices
    │       ├── AdminInventory.tsx  # Inline variant stock restocker
    │       ├── AdminCustomers.tsx  # Customer spendings & order count
    │       ├── AdminCoupons.tsx    # Percentage & fixed discount codes
    │       ├── AdminDelivery.tsx   # Inside Dhaka / Outside Dhaka rates
    │       ├── AdminBanners.tsx    # Homepage banners manager
    │       ├── AdminPages.tsx      # Policy and content editor
    │       ├── AdminReviews.tsx    # Customer review moderation
    │       ├── AdminSettings.tsx   # Store information & Firestore init
    │       ├── AdminAuditLogs.tsx  # Security audit trail
    │       └── AdminPortal.tsx     # Master admin routing controller
    ├── App.tsx                     # Top-level router & state provider tree
    ├── main.tsx                    # React DOM entry
    └── index.css                   # Tailwind v4 import & centralized tokens
```

---

## 🔒 Security Architecture

1. **Strict Admin Verification**:
   - Access to `/admin` is locked behind `AdminAuthGate`.
   - The user must be signed in with Firebase Authentication.
   - The user's UID must match the configured admin UID (`7dFGhk3ntrNxH4fA3bZerczN92B3`) or admin email (`bad01303228889@gmail.com`) or have custom claim `admin: true`.
   - Unauthorized attempts show an opaque "Access Denied" screen with no internal secrets or database IDs revealed.

2. **Price & Order Integrity**:
   - Customer orders calculate subtotals from verified unit prices in state.
   - Stock quantities are subtracted from Firestore documents using batch transactions.
   - Customer orders are stored with individual timestamps and full audit records.

---

## ⚙️ Environment Variables

Create `.env` based on `.env.example`:

```env
VITE_FIREBASE_API_KEY=AIzaSyAXgNUHQQgglDF3WN720-s9D7-YsYZhwO0
VITE_FIREBASE_AUTH_DOMAIN=aesthetx-lifestyle.firebaseapp.com
VITE_FIREBASE_PROJECT_ID=aesthetx-lifestyle
VITE_FIREBASE_STORAGE_BUCKET=aesthetx-lifestyle.firebasestorage.app
VITE_FIREBASE_MESSAGING_SENDER_ID=858750870059
VITE_FIREBASE_APP_ID=1:858750870059:web:26dad449a1d821ea39c06e

VITE_ADMIN_UID=7dFGhk3ntrNxH4fA3bZerczN92B3
VITE_ADMIN_EMAIL=bad01303228889@gmail.com
```

---

## 🚀 How to Run Locally

```bash
# 1. Install dependencies
npm install

# 2. Start the local development server
npm run dev
```

Visit `http://localhost:3000` for the storefront, or `http://localhost:3000/#/admin` for the admin portal.

---

## 📦 Firestore Collections

| Collection | Description |
|---|---|
| `products` | Clothing items, variant matrix, size chips, photography, prices |
| `categories` | Product collections (T-Shirts, Shirts, Panjabi, Pants) |
| `orders` | Customer orders, shipping address, order items, timeline status |
| `users` | Customer profiles, order totals, spending |
| `coupons` | Promo codes, percentage/fixed discounts, minimum order threshold |
| `deliveryZones` | Delivery fees (Inside Dhaka: ৳80, Outside Dhaka: ৳150) |
| `banners` | Homepage promotional banners |
| `settings` | General store settings document (`general`) |
| `pages` | Static content pages (`about`, `contact`, `terms`, `privacy-policy`, etc.) |
| `reviews` | Customer product reviews (subject to admin approval) |
| `auditLogs` | Security audit trail of administrative modifications |

---

## 🔑 Recommended Firestore Security Rules

Deploy the following rules in your Firebase Console (`Firestore Database` -> `Rules`):

```javascript
rules_version = '2';
service cloud.firestore {
  match /databases/{database}/documents {
    
    function isAdmin() {
      return request.auth != null && (
        request.auth.uid == '7dFGhk3ntrNxH4fA3bZerczN92B3' ||
        request.auth.token.email == 'bad01303228889@gmail.com' ||
        request.auth.token.admin == true
      );
    }
    
    // Public read for active products and categories
    match /products/{id} {
      allow read: if true;
      allow write: if isAdmin();
    }
    
    match /categories/{id} {
      allow read: if true;
      allow write: if isAdmin();
    }
    
    match /banners/{id} {
      allow read: if true;
      allow write: if isAdmin();
    }
    
    match /deliveryZones/{id} {
      allow read: if true;
      allow write: if isAdmin();
    }
    
    match /settings/{id} {
      allow read: if true;
      allow write: if isAdmin();
    }
    
    match /pages/{id} {
      allow read: if true;
      allow write: if isAdmin();
    }
    
    match /coupons/{id} {
      allow read: if true;
      allow write: if isAdmin();
    }
    
    match /reviews/{id} {
      allow read: if resource.data.approved == true || isAdmin();
      allow create: if request.resource.data.approved == false;
      allow update, delete: if isAdmin();
    }
    
    // Orders: Anyone can create an order, customers can read their own, admin can do everything
    match /orders/{id} {
      allow create: if true;
      allow read: if isAdmin() || (request.auth != null && resource.data.customerId == request.auth.uid);
      allow update, delete: if isAdmin();
    }
    
    // User profile
    match /users/{userId} {
      allow read, write: if request.auth != null && (request.auth.uid == userId || isAdmin());
    }
    
    // Audit logs
    match /auditLogs/{id} {
      allow read, write: if isAdmin();
    }
  }
}
```

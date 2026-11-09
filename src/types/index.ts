export type OrderStatus =
  | 'Pending'
  | 'Confirmed'
  | 'Processing'
  | 'Packed'
  | 'Shipped'
  | 'Delivered'
  | 'Cancelled'
  | 'Returned'
  | 'Refunded'
  | 'Wrong Delivery';

export type PaymentMethod = 'Cash on Delivery' | 'Online Payment' | 'bKash' | 'Nagad';
export type PaymentStatus = 'Pending' | 'Paid' | 'Failed' | 'Refunded';

export type PaymentVerificationStatus =
  | 'PENDING'
  | 'VERIFIED'
  | 'FAILED'
  | 'MANUAL_REVIEW';

export interface PaymentVerificationDetails {
  provider: 'bKash' | 'Nagad';
  mode: 'sandbox' | 'live';
  status: PaymentVerificationStatus;
  trxId: string;
  senderNumber?: string;
  amountExpected: number;
  amountPaid: number;
  verifiedAt: string;
  providerTransactionId?: string;
  providerStatusMessage?: string;
  providerRawResponse?: any;
  failureReason?: string;
  isDuplicateFlagged?: boolean;
  merchantWallet?: string;
}

export interface ProductSpecification {
  key: string;
  value: string;
}

export interface ProductVariant {
  id: string;
  name?: string; // e.g. "128GB - Graphite" or "Size 42 - Brown"
  sku: string;
  size?: string;
  colorName?: string;
  colorCode?: string;
  stock: number;
  price?: number; // optional variant override
  attributes?: Record<string, string>;
}

export interface ProductColor {
  name: string;
  hexCode: string;
  imageUrl?: string;
}

export type VariantSystemType = 'none' | 'clothing' | 'custom';

export interface Product {
  id: string;
  name: string;
  slug: string;
  sku: string;
  description: string;
  shortDescription?: string;
  category: string;
  categorySlug?: string;
  subcategory?: string;
  brand?: string;
  model?: string;
  warranty?: string;
  dimensions?: string;
  unit?: string; // e.g. "Piece", "Kg", "Set", "Pack"
  gender?: 'Men' | 'Women' | 'Unisex' | 'Kids' | string;
  fabric?: string;
  images: string[];
  thumbnail: string;
  price: number;
  salePrice?: number;
  costPrice?: number; // Admin only
  discountPercent?: number;
  
  // Flexible Variant System
  variantType?: VariantSystemType; // 'none' = simple, 'clothing' = size/color, 'custom' = custom option
  customOptionName?: string; // e.g. "Storage Capacity" or "Weight" or "Size"
  customOptionValues?: string[]; // e.g. ["128GB", "256GB", "512GB"]
  customOption2Name?: string;
  customOption2Values?: string[];

  sizes: string[];
  colors: ProductColor[];
  variants: ProductVariant[];
  specifications?: ProductSpecification[];
  totalStock: number;
  weight?: string;
  tags: string[];
  featured: boolean;
  newArrival: boolean;
  bestSeller: boolean;
  active: boolean;
  seoTitle?: string;
  seoDescription?: string;
  createdAt: any;
  updatedAt: any;
}

export interface Category {
  id: string;
  name: string;
  slug: string;
  description?: string;
  image?: string;
  subcategories?: string[];
  active: boolean;
  sortOrder: number;
  createdAt?: any;
  updatedAt?: any;
}

export interface CartItem {
  productId: string;
  name: string;
  slug: string;
  image: string;
  price: number;
  originalPrice?: number;
  selectedSize?: string;
  selectedColor?: string;
  selectedVariantTitle?: string;
  selectedVariantId?: string;
  quantity: number;
  maxStock: number;
}

export interface OrderItem {
  productId: string;
  name: string;
  image: string;
  selectedSize?: string;
  selectedColor?: string;
  selectedVariantTitle?: string;
  variantId?: string;
  quantity: number;
  price: number;
  total: number;
}

export interface ShippingAddress {
  fullName: string;
  phone: string;
  email?: string;
  fullAddress: string;
  division: string;
  district: string;
  upazilaOrArea: string;
  deliveryNotes?: string;
  zoneId?: string;
  zoneName?: string;
}

export interface Order {
  id: string;
  orderNumber: string;
  customerId?: string;
  customerName: string;
  customerPhone: string;
  customerEmail?: string;
  items: OrderItem[];
  subtotal: number;
  discount: number;
  couponCode?: string;
  deliveryCharge: number;
  total: number;
  paymentMethod: PaymentMethod;
  paymentStatus: PaymentStatus;
  paymentSenderNumber?: string;
  paymentTrxId?: string;
  paymentAccountType?: 'personal' | 'merchant' | 'agent' | string;
  paymentNote?: string;
  paymentVerificationStatus?: PaymentVerificationStatus;
  paymentVerification?: PaymentVerificationDetails;
  orderStatus: OrderStatus;
  shippingAddress: ShippingAddress;
  customerNote?: string;
  adminNotes?: string[];
  isWrongDelivery?: boolean;
  wrongDeliveryReportedAt?: any;
  wrongDeliveryReason?: string;
  deliveredAt?: any;
  purgeAt?: any;
  createdAt: any;
  updatedAt: any;
  timeline?: {
    status: OrderStatus;
    timestamp: any;
    note?: string;
  }[];
}

export interface Coupon {
  id: string;
  code: string;
  discountType: 'percentage' | 'fixed';
  discountAmount: number;
  minOrderAmount: number;
  maxDiscount?: number;
  expiryDate?: string;
  usageLimit?: number;
  timesUsed: number;
  active: boolean;
  createdAt?: any;
}

export interface DeliveryZone {
  id: string;
  name: string;
  charge: number;
  minOrderForFreeDelivery?: number;
  estimatedDays?: string;
  active: boolean;
  sortOrder: number;
}

export interface Banner {
  id: string;
  title: string;
  subtitle?: string;
  tagline?: string;
  buttonText: string;
  buttonLink: string;
  image: string;
  mobileImage?: string;
  active: boolean;
  sortOrder: number;
  createdAt?: any;
  updatedAt?: any;
}

export interface Review {
  id: string;
  productId: string;
  productName?: string;
  customerId: string;
  customerDisplayName: string;
  rating: number;
  comment: string;
  approved: boolean;
  verifiedPurchase: boolean;
  createdAt: any;
}

export interface CustomerUser {
  uid: string;
  email: string;
  displayName: string;
  phone?: string;
  address?: ShippingAddress;
  totalOrders?: number;
  totalSpent?: number;
  disabled?: boolean;
  createdAt: any;
}

export interface SiteSettings {
  storeName: string;
  tagline: string;
  phone: string;
  email: string;
  whatsapp: string;
  address: string;
  facebook: string;
  instagram: string;
  tiktok: string;
  youtube: string;
  currency: string;
  deliveryArea: string;
  timezone: string;
  announcementBar?: {
    enabled: boolean;
    text: string;
    link?: string;
  };
  freeDeliveryThreshold?: number;
  defaultDeliveryInsideDhaka: number;
  defaultDeliveryOutsideDhaka: number;
  deliveryEstimatedDhaka?: string;
  deliveryEstimatedOutside?: string;
  // bKash & Nagad Payment Gateway Settings
  bkashEnabled?: boolean;
  bkashNumber?: string;
  bkashType?: 'personal' | 'merchant' | 'agent';
  bkashInstructions?: string;
  nagadEnabled?: boolean;
  nagadNumber?: string;
  nagadType?: 'personal' | 'merchant' | 'agent';
  nagadInstructions?: string;
  orderPrefix: string;
  maintenanceMode: boolean;
  logoUrl?: string;
  settingsUpdatedAt?: number;
}

export interface StaticPage {
  slug: string;
  title: string;
  content: string;
  updatedAt: any;
}

export interface AuditLog {
  id: string;
  adminUid: string;
  adminEmail?: string;
  action: string;
  target: string;
  details?: string;
  timestamp: any;
}

export type AIStatusMode = 'active' | 'paused' | 'disabled' | 'error';

export interface SupportSettings {
  aiAssistantEnabled: boolean; // Must be false initially!
  aiStatusMode?: AIStatusMode; // 'active' | 'paused' | 'disabled' | 'error'
  customerChatEnabled: boolean;
  humanSupportEnabled: boolean;
  autoOrderInquiryEnabled?: boolean;
  autoInventoryAlerts?: boolean;
  requireAdminApprovalForActions?: boolean;
  welcomeMessage?: string;
  updatedAt?: any;
}

export interface AIKnowledgeBase {
  storeOverview: string;
  shippingInfo: string;
  paymentMethods: string;
  returnPolicy: string;
  faqList: Array<{ question: string; answer: string }>;
  customNotes?: string;
  updatedAt?: any;
}

export interface AIApprovalAction {
  id: string;
  actionType:
    | 'order_cancellation'
    | 'order_refund'
    | 'order_status_override'
    | 'price_change'
    | 'inventory_adjust'
    | 'escalate_complaint';
  targetId: string; // e.g. orderId or productId
  targetReference?: string; // e.g. orderNumber or productName
  requestedBy: 'ai_assistant';
  customerSessionId?: string;
  customerName?: string;
  reason: string;
  payload: Record<string, any>; // proposed diff
  status: 'pending' | 'approved' | 'rejected';
  adminDecisionNotes?: string;
  reviewedBy?: string;
  reviewedAt?: any;
  createdAt: any;
}

export interface AINotification {
  id: string;
  type:
    | 'low_stock'
    | 'unanswered_chat'
    | 'pending_approval'
    | 'wrong_delivery'
    | 'stalled_order'
    | 'system_alert';
  title: string;
  message: string;
  severity: 'low' | 'medium' | 'high' | 'critical';
  targetTab?: string;
  targetId?: string;
  isRead: boolean;
  createdAt: any;
}

export interface AIDailyReport {
  id: string;
  dateString: string;
  generatedAt: any;
  summary: string;
  metrics: {
    totalRevenue: number;
    totalOrders: number;
    deliveredOrders: number;
    pendingOrders: number;
    lowStockCount: number;
    totalConversations: number;
    aiResolvedCount: number;
    humanEscalatedCount: number;
  };
  insights: string[];
  recommendations: string[];
}

export interface SupportConversation {
  id: string;
  sessionId: string;
  customerName?: string;
  customerPhone?: string;
  customerEmail?: string;
  status: 'open' | 'resolved';
  isTakenOverByAdmin: boolean;
  lastMessage: string;
  lastSender: 'customer' | 'admin' | 'ai' | 'system';
  unreadByAdmin: boolean;
  unreadByCustomer: boolean;
  createdAt: any;
  updatedAt: any;
}

export interface SupportMessage {
  id: string;
  conversationId: string;
  sessionId: string;
  sender: 'customer' | 'admin' | 'ai' | 'system';
  senderName?: string;
  text: string;
  recommendedProducts?: Array<{
    id: string;
    name: string;
    price: number;
    salePrice?: number;
    image: string;
    category?: string;
    totalStock?: number;
    slug?: string;
  }>;
  createdAt: any;
}

export interface AIActivityLog {
  id: string;
  conversationId: string;
  query: string;
  response: string;
  status: 'success' | 'escalated_to_human' | 'fallback';
  timestamp: any;
}


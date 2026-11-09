import type { Order, OrderStatus } from '../types';

export interface DeliveryEstimate {
  orderDateFormatted: string;
  startDateFormatted: string;
  endDateFormatted: string;
  windowFormatted: string;
  relativeTimeText: string;
  relativeTimeTextBn: string;
  durationLabel: string;
  durationLabelBn: string;
  isInsideDhaka: boolean;
  progressPercent: number;
  currentStepIndex: number;
  stepDescription: string;
  stepDescriptionBn: string;
  isCompleted: boolean;
  isCancelled: boolean;
}

/**
 * Checks whether an address is within Dhaka city/district
 */
export function isDhakaAddress(district?: string, division?: string, fullAddress?: string): boolean {
  const target = `${district || ''} ${division || ''} ${fullAddress || ''}`.toLowerCase();
  return (
    target.includes('dhaka') ||
    target.includes('ঢাকা') ||
    target.includes('mirpur') ||
    target.includes('uttara') ||
    target.includes('gulshan') ||
    target.includes('dhanmondi') ||
    target.includes('banani') ||
    target.includes('motijheel') ||
    target.includes('mohammadpur')
  );
}

/**
 * Formats a Date object into readable format, e.g. "26 Oct 2026"
 */
function formatDate(date: Date): string {
  const options: Intl.DateTimeFormatOptions = {
    day: 'numeric',
    month: 'short',
    year: 'numeric'
  };
  return date.toLocaleDateString('en-GB', options);
}

/**
 * Calculates delivery timeline, estimated arrival window, and remaining time
 * based on order placement date and delivery destination.
 */
export function calculateEstimatedDelivery(order: Order): DeliveryEstimate {
  // 1. Resolve order creation date
  let orderDate = new Date();
  if (order.createdAt) {
    if (typeof order.createdAt.toDate === 'function') {
      orderDate = order.createdAt.toDate();
    } else if (order.createdAt.seconds) {
      orderDate = new Date(order.createdAt.seconds * 1000);
    } else if (typeof order.createdAt === 'string' || typeof order.createdAt === 'number') {
      const parsed = new Date(order.createdAt);
      if (!isNaN(parsed.getTime())) {
        orderDate = parsed;
      }
    }
  }

  // 2. Check location (Inside Dhaka vs Outside Dhaka)
  const isInsideDhaka = isDhakaAddress(
    order.shippingAddress?.district,
    order.shippingAddress?.division,
    order.shippingAddress?.fullAddress
  );

  // Inside Dhaka: 24 - 48 Hours (1 - 2 Days)
  // Outside Dhaka: 48 - 96 Hours (2 - 4 Days)
  const minDays = isInsideDhaka ? 1 : 2;
  const maxDays = isInsideDhaka ? 2 : 4;

  const startDate = new Date(orderDate.getTime() + minDays * 24 * 60 * 60 * 1000);
  const endDate = new Date(orderDate.getTime() + maxDays * 24 * 60 * 60 * 1000);

  const startDateFormatted = formatDate(startDate);
  const endDateFormatted = formatDate(endDate);
  const windowFormatted = `${startDateFormatted} – ${endDateFormatted}`;

  const now = new Date();
  const msRemaining = endDate.getTime() - now.getTime();
  const hoursRemaining = Math.round(msRemaining / (1000 * 60 * 60));
  const daysRemaining = Math.ceil(msRemaining / (1000 * 60 * 60 * 24));

  // Determine relative time text
  let relativeTimeText = '';
  let relativeTimeTextBn = '';

  const isCompleted = order.orderStatus === 'Delivered';
  const isCancelled = order.orderStatus === 'Cancelled' || order.orderStatus === 'Returned' || order.orderStatus === 'Refunded';

  if (isCompleted) {
    relativeTimeText = 'Package Delivered';
    relativeTimeTextBn = 'Package Delivered';
  } else if (isCancelled) {
    relativeTimeText = `Order ${order.orderStatus}`;
    relativeTimeTextBn = `Order ${order.orderStatus}`;
  } else if (order.orderStatus === 'Shipped') {
    relativeTimeText = 'Out for delivery / Expected within 24 hours';
    relativeTimeTextBn = 'Out for delivery / Expected within 24 hours';
  } else if (daysRemaining > 1) {
    relativeTimeText = `Expected in ~${daysRemaining} days (${windowFormatted})`;
    relativeTimeTextBn = `Expected in ~${daysRemaining} days (${windowFormatted})`;
  } else if (daysRemaining === 1 || hoursRemaining <= 24) {
    relativeTimeText = `Expected Tomorrow (${endDateFormatted})`;
    relativeTimeTextBn = `Expected Tomorrow (${endDateFormatted})`;
  } else if (daysRemaining <= 0) {
    relativeTimeText = 'Expected Today / In transit';
    relativeTimeTextBn = 'Expected Today / In transit';
  } else {
    relativeTimeText = `${minDays}–${maxDays} Business Days`;
    relativeTimeTextBn = `${minDays}–${maxDays} Business Days`;
  }

  // 3. Status Progress & Explanations
  const stepMap: Record<OrderStatus, { step: number; percent: number; desc: string; descBn: string }> = {
    Pending: {
      step: 1,
      percent: 15,
      desc: 'Order received. Our warehouse is preparing your items for packaging.',
      descBn: 'Order received. Our warehouse is preparing your items for packaging.'
    },
    Confirmed: {
      step: 2,
      percent: 35,
      desc: 'Order confirmed and verified. Preparing for packaging.',
      descBn: 'Order confirmed and verified. Preparing for packaging.'
    },
    Processing: {
      step: 3,
      percent: 50,
      desc: 'Items under quality check and packaging.',
      descBn: 'Items under quality check and packaging.'
    },
    Packed: {
      step: 4,
      percent: 65,
      desc: 'Parcel packed securely and waiting for courier dispatch.',
      descBn: 'Parcel packed securely and waiting for courier dispatch.'
    },
    Shipped: {
      step: 5,
      percent: 85,
      desc: 'Parcel handed over to courier. On the way to your delivery hub.',
      descBn: 'Parcel handed over to courier. On the way to your delivery hub.'
    },
    Delivered: {
      step: 6,
      percent: 100,
      desc: 'Parcel successfully handed over to customer. Thank you!',
      descBn: 'Parcel successfully handed over to customer. Thank you!'
    },
    Cancelled: {
      step: 0,
      percent: 0,
      desc: 'Order has been cancelled.',
      descBn: 'Order has been cancelled.'
    },
    Returned: {
      step: 0,
      percent: 0,
      desc: 'Order has been returned.',
      descBn: 'Order has been returned.'
    },
    Refunded: {
      step: 0,
      percent: 0,
      desc: 'Payment refunded for this order.',
      descBn: 'Payment refunded for this order.'
    },
    'Wrong Delivery': {
      step: 0,
      percent: 0,
      desc: 'Order delivery error reported. Quarantined in verification holding archive.',
      descBn: 'Order delivery error reported. Quarantined in verification holding archive.'
    }
  };

  const currentInfo = stepMap[order.orderStatus] || stepMap.Pending;

  return {
    orderDateFormatted: formatDate(orderDate),
    startDateFormatted,
    endDateFormatted,
    windowFormatted,
    relativeTimeText,
    relativeTimeTextBn,
    durationLabel: isInsideDhaka ? 'Dhaka Express (24–48 Hours)' : 'Nationwide Delivery (2–4 Days)',
    durationLabelBn: isInsideDhaka ? 'Dhaka Express (24–48 Hours)' : 'Nationwide Delivery (2–4 Days)',
    isInsideDhaka,
    progressPercent: currentInfo.percent,
    currentStepIndex: currentInfo.step,
    stepDescription: currentInfo.desc,
    stepDescriptionBn: currentInfo.descBn,
    isCompleted,
    isCancelled
  };
}

import React, { useEffect, useState } from 'react';
import { getStaticPage } from '../firebase/db';
import { useSettings } from '../context/SettingsContext';
import { Phone, Mail, MessageCircle, MapPin, ShieldCheck, Truck, ArrowLeft } from 'lucide-react';
import { SizeChartModal } from '../components/common/SizeChartModal';

interface StaticInfoPageProps {
  slug: string;
  onNavigate: (path: string) => void;
}

export const StaticInfoPage: React.FC<StaticInfoPageProps> = ({ slug, onNavigate }) => {
  const { settings } = useSettings();
  const [content, setContent] = useState<string | null>(null);
  const [title, setTitle] = useState<string>('');
  const [loading, setLoading] = useState(true);
  const [sizeModalOpen, setSizeModalOpen] = useState(false);

  useEffect(() => {
    async function loadPage() {
      setLoading(true);
      try {
        const pageData = await getStaticPage(slug);
        if (pageData) {
          setTitle(pageData.title);
          setContent(pageData.content);
        } else {
          // Defaults based on actual store information
          const defaults = getDefaultStaticContent(slug, settings);
          setTitle(defaults.title);
          setContent(defaults.content);
        }
      } catch (err) {
        const defaults = getDefaultStaticContent(slug, settings);
        setTitle(defaults.title);
        setContent(defaults.content);
      } finally {
        setLoading(false);
      }
    }

    loadPage();
    window.scrollTo({ top: 0, behavior: 'smooth' });
  }, [slug, settings]);

  return (
    <div className="max-w-4xl mx-auto px-4 sm:px-6 py-10 sm:py-16">
      <button
        onClick={() => onNavigate('/')}
        className="inline-flex items-center gap-1.5 text-xs font-bold text-[#1E3A2F] hover:text-[#C85A32] mb-6 cursor-pointer"
      >
        <ArrowLeft className="w-4 h-4" />
        <span>Back to Home</span>
      </button>

      <div className="bg-white border border-[#E5DFD7] rounded-3xl p-6 sm:p-10 shadow-xs">
        <h1 className="text-2xl sm:text-4xl font-extrabold text-[#1A1E1C] mb-4 pb-4 border-b border-[#EFEBE5]">
          {title}
        </h1>

        {loading ? (
          <div className="space-y-4 animate-pulse">
            <div className="h-4 bg-[#EDE7DC] rounded w-3/4" />
            <div className="h-4 bg-[#EDE7DC] rounded w-full" />
            <div className="h-4 bg-[#EDE7DC] rounded w-5/6" />
          </div>
        ) : (
          <div className="prose prose-stone max-w-none text-xs sm:text-sm text-[#1A1E1C] leading-relaxed whitespace-pre-line space-y-4">
            {content}

            {slug === 'contact' && (
              <div className="pt-8 mt-8 border-t border-[#EFEBE5] grid grid-cols-1 sm:grid-cols-2 gap-4 not-prose">
                <a
                  href={`tel:${settings.phone}`}
                  className="flex items-center gap-3 p-4 rounded-2xl bg-[#FAF8F5] border border-[#E5DFD7] hover:border-[#1E3A2F] transition-all"
                >
                  <div className="w-10 h-10 rounded-xl bg-[#1E3A2F] text-white flex items-center justify-center shrink-0">
                    <Phone className="w-5 h-5" />
                  </div>
                  <div>
                    <span className="text-xs text-[#626C66] block">Phone Hotline</span>
                    <strong className="text-sm text-[#1A1E1C]">{settings.phone}</strong>
                  </div>
                </a>

                <a
                  href={`https://wa.me/88${settings.whatsapp.replace(/[^0-9]/g, '')}`}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="flex items-center gap-3 p-4 rounded-2xl bg-[#FAF8F5] border border-[#E5DFD7] hover:border-[#16A34A] transition-all"
                >
                  <div className="w-10 h-10 rounded-xl bg-[#16A34A] text-white flex items-center justify-center shrink-0">
                    <MessageCircle className="w-5 h-5" />
                  </div>
                  <div>
                    <span className="text-xs text-[#626C66] block">WhatsApp Support</span>
                    <strong className="text-sm text-[#1A1E1C]">{settings.whatsapp}</strong>
                  </div>
                </a>

                <a
                  href={`mailto:${settings.email}`}
                  className="flex items-center gap-3 p-4 rounded-2xl bg-[#FAF8F5] border border-[#E5DFD7] hover:border-[#1E3A2F] transition-all"
                >
                  <div className="w-10 h-10 rounded-xl bg-[#1E3A2F] text-white flex items-center justify-center shrink-0">
                    <Mail className="w-5 h-5" />
                  </div>
                  <div>
                    <span className="text-xs text-[#626C66] block">Email Support</span>
                    <strong className="text-sm text-[#1A1E1C] truncate">{settings.email}</strong>
                  </div>
                </a>

                {settings.facebook && (
                  <a
                    href={settings.facebook}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="flex items-center gap-3 p-4 rounded-2xl bg-[#FAF8F5] border border-[#E5DFD7] hover:border-[#1877F2] transition-all"
                  >
                    <div className="w-10 h-10 rounded-xl bg-[#1877F2] text-white flex items-center justify-center shrink-0">
                      <ShieldCheck className="w-5 h-5" />
                    </div>
                    <div>
                      <span className="text-xs text-[#626C66] block">Facebook Page</span>
                      <strong className="text-sm text-[#1A1E1C]">Visit Facebook</strong>
                    </div>
                  </a>
                )}
              </div>
            )}

            {slug === 'size-guide' && (
              <div className="pt-4 not-prose">
                <button
                  onClick={() => setSizeModalOpen(true)}
                  className="px-6 py-3 bg-[#1E3A2F] hover:bg-[#162B23] text-white rounded-xl text-xs font-bold transition-all shadow-md cursor-pointer"
                >
                  Open Interactive Size Table & Measurement Guide
                </button>
              </div>
            )}
          </div>
        )}
      </div>

      <SizeChartModal
        isOpen={sizeModalOpen}
        onClose={() => setSizeModalOpen(false)}
      />
    </div>
  );
};

function getDefaultStaticContent(slug: string, settings: any): { title: string; content: string } {
  switch (slug) {
    case 'about':
      return {
        title: `About ${settings.storeName}`,
        content: `Welcome to ${settings.storeName}!

"${settings.tagline}"

We are a Bangladeshi fashion & lifestyle brand focused on modern streetwear, premium casual wear, panjabis, and daily wardrobe essentials. We believe in high-grade fabrics, meticulous stitching, and contemporary cuts tailored specifically for standard Bangladeshi fits.

Our promise:
• Genuine, high-quality materials
• Transparent pricing with zero hidden charges
• Nationwide delivery covering all 64 districts
• Cash on Delivery so you can verify your order with total peace of mind.`
      };

    case 'contact':
      return {
        title: 'Contact Us',
        content: `We're here to help you with size consultations, order queries, or delivery updates.

Store Hours: 10:00 AM – 10:00 PM (Daily)
Delivery Coverage: All 64 Districts in Bangladesh

Reach out directly using any of our verified communication channels below:`
      };

    case 'shipping-policy':
      return {
        title: 'Shipping & Delivery Policy',
        content: `We provide door-to-door delivery across all 64 districts in Bangladesh.

Delivery Zones & Charges:
• Inside Dhaka City: ৳${settings.defaultDeliveryInsideDhaka} (Delivered within 1–2 business days)
• Outside Dhaka / All Bangladesh: ৳${settings.defaultDeliveryOutsideDhaka} (Delivered within 2–4 business days)

Payment Method:
Cash on Delivery (COD) is supported for all orders. You pay the courier delivery officer when you receive your package.

Tracking:
Once your package is dispatched, you can track its live progress anytime using our Track Order portal with your Order ID and phone number.`
      };

    case 'return-policy':
      return {
        title: 'Return & Exchange Policy',
        content: `At ${settings.storeName}, your satisfaction is our priority.

7-Day Easy Exchange Policy:
If you receive an item with an incorrect size, color, or a manufacturing defect, you can request an exchange within 7 days of delivery.

Conditions for Exchange:
1. The product must be unworn, unwashed, and in its original packaging with tags intact.
2. Please inform our support team via WhatsApp (${settings.whatsapp}) or Hotline (${settings.phone}) within 7 days.
3. For sizing swaps, standard courier charges apply unless the mistake was on our part.`
      };

    case 'privacy-policy':
      return {
        title: 'Privacy Policy',
        content: `Your privacy is important to us.

1. Information We Collect:
When you place an order, we collect your name, phone number, delivery address, and optional email solely to fulfill your shipment and provide order updates.

2. Security of Your Information:
We do not sell, rent, or trade your personal information to third parties. Customer passwords and credentials are securely managed by Firebase Authentication and never stored in plaintext.

3. Inquiries:
For any privacy questions or data deletion requests, contact us at ${settings.email}.`
      };

    case 'terms':
      return {
        title: 'Terms & Conditions',
        content: `Welcome to ${settings.storeName}. By shopping on this website, you agree to the following terms:

1. Orders and Availability:
All orders placed on our website are subject to stock availability and address confirmation. We reserve the right to cancel orders with incorrect or unreachable contact details.

2. Cash on Delivery Commitment:
Please ensure someone is available at the provided delivery address to receive the parcel and make the cash payment.

3. Pricing & Currency:
All prices are displayed in Bangladeshi Taka (৳ BDT) inclusive of applicable taxes unless specified otherwise.`
      };

    case 'size-guide':
      return {
        title: 'Sizing Guide',
        content: `Finding the perfect fit is key to looking and feeling great.

Our garments are tailored for standard Bangladesh sizing. If you prefer a relaxed or streetwear oversized silhouette, we recommend sizing up one size.

Click the button below to view our detailed measurement chart for Chest, Length, and Sleeve in both Inches and Centimeters.`
      };

    case 'faq':
      return {
        title: 'Frequently Asked Questions',
        content: `Q: Do you offer Cash on Delivery?
A: Yes! We provide Cash on Delivery across all 64 districts in Bangladesh.

Q: How long does delivery take?
A: Inside Dhaka takes 1–2 business days. Outside Dhaka takes 2–4 business days.

Q: What if the size doesn't fit?
A: We offer a hassle-free 7-day size exchange guarantee. Just WhatsApp us at ${settings.whatsapp}.

Q: Can I track my order?
A: Yes! Enter your Order Number and phone number on our "Track Order" page anytime.`
      };

    default:
      return {
        title: 'Store Information',
        content: `Welcome to ${settings.storeName}.`
      };
  }
}

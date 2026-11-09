import React from 'react';
import { Phone, Mail, MapPin, MessageCircle, ShieldCheck, Truck, RefreshCw, Facebook, Info, PhoneCall } from 'lucide-react';
import { useSettings } from '../../context/SettingsContext';

interface FooterProps {
  onNavigate: (path: string) => void;
}

export const Footer: React.FC<FooterProps> = ({ onNavigate }) => {
  const { settings } = useSettings();

  const logoSrc = settings.logoUrl || '/assets/aistudio/WhatsApp_Image_2026-08-24_at_3.13.47_PM_75b34fce.jpeg';

  return (
    <footer className="bg-[#162B23] text-[#EDE7DC] pt-14 pb-24 lg:pb-12 border-t border-[#1E3A2F]">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        {/* Top Trust Banner */}
        <div className="grid grid-cols-2 md:grid-cols-4 gap-6 pb-12 border-b border-[#254437]">
          <div className="flex items-start gap-3">
            <div className="w-10 h-10 rounded-full bg-[#1E3A2F] border border-[#2D5042] flex items-center justify-center text-[#8FA89B] shrink-0">
              <Truck className="w-5 h-5" />
            </div>
            <div>
              <h4 className="text-sm font-bold text-white">Nationwide Delivery</h4>
              <p className="text-xs text-stone-300 mt-0.5">Prompt delivery across all 64 districts</p>
            </div>
          </div>

          <div className="flex items-start gap-3">
            <div className="w-10 h-10 rounded-full bg-[#1E3A2F] border border-[#2D5042] flex items-center justify-center text-[#C85A32] shrink-0">
              <ShieldCheck className="w-5 h-5" />
            </div>
            <div>
              <h4 className="text-sm font-bold text-white">Cash on Delivery</h4>
              <p className="text-xs text-stone-300 mt-0.5">Pay conveniently upon receiving your items</p>
            </div>
          </div>

          <div className="flex items-start gap-3">
            <div className="w-10 h-10 rounded-full bg-[#1E3A2F] border border-[#2D5042] flex items-center justify-center text-[#8FA89B] shrink-0">
              <RefreshCw className="w-5 h-5" />
            </div>
            <div>
              <h4 className="text-sm font-bold text-white">7-Day Easy Exchange</h4>
              <p className="text-xs text-stone-300 mt-0.5">Hassle-free size & color swaps</p>
            </div>
          </div>

          <div className="flex items-start gap-3">
            <div className="w-10 h-10 rounded-full bg-[#1E3A2F] border border-[#2D5042] flex items-center justify-center text-[#C85A32] shrink-0">
              <MessageCircle className="w-5 h-5" />
            </div>
            <div>
              <h4 className="text-sm font-bold text-white">Dedicated Support</h4>
              <p className="text-xs text-stone-300 mt-0.5">Call or WhatsApp our team anytime</p>
            </div>
          </div>
        </div>

        {/* Main Footer Links */}
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-5 gap-8 py-12 border-b border-[#254437]">
          {/* Brand Info */}
          <div className="lg:col-span-2 space-y-4">
            <div className="bg-white p-2.5 rounded-xl inline-block shadow-sm">
              <img
                src={logoSrc}
                alt={settings.storeName}
                className="h-16 w-auto object-contain"
              />
            </div>
            <p className="text-xs font-semibold tracking-wider text-[#C85A32] uppercase">
              {settings.tagline}
            </p>
            <p className="text-sm text-stone-300 leading-relaxed max-w-sm">
              Discover premium fashion crafted for modern lifestyle. Shop high-end t-shirts, shirts, panjabis, and everyday essentials delivered directly to your doorstep.
            </p>

            {/* Social Links */}
            <div className="flex items-center gap-3 pt-2">
              {settings.facebook && (
                <a
                  href={settings.facebook}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="w-9 h-9 rounded-full bg-[#1E3A2F] hover:bg-[#C85A32] text-white flex items-center justify-center transition-colors"
                  title="Facebook Page"
                >
                  <Facebook className="w-4 h-4" />
                </a>
              )}
              {settings.whatsapp && (
                <a
                  href={`https://wa.me/88${settings.whatsapp.replace(/[^0-9]/g, '')}`}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="w-9 h-9 rounded-full bg-[#1E3A2F] hover:bg-[#16A34A] text-white flex items-center justify-center transition-colors"
                  title="WhatsApp"
                >
                  <MessageCircle className="w-4 h-4" />
                </a>
              )}
            </div>

            {/* Clean Recognizable Icon-Based Quick Links: About Us & Contact */}
            <div className="pt-2 flex flex-wrap items-center gap-2">
              <button
                onClick={() => onNavigate('/about')}
                className="inline-flex items-center gap-2 px-3 py-1.5 rounded-xl bg-[#1E3A2F] hover:bg-[#C85A32] text-xs font-semibold text-white border border-[#2D5042] transition-colors cursor-pointer group"
                title="Learn more About Us"
                aria-label="About Us"
              >
                <Info className="w-4 h-4 text-[#8FA89B] group-hover:text-white transition-colors" />
                <span>About Us</span>
              </button>

              <button
                onClick={() => onNavigate('/contact')}
                className="inline-flex items-center gap-2 px-3 py-1.5 rounded-xl bg-[#1E3A2F] hover:bg-[#16A34A] text-xs font-semibold text-white border border-[#2D5042] transition-colors cursor-pointer group"
                title="Contact Customer Support"
                aria-label="Contact Us"
              >
                <PhoneCall className="w-4 h-4 text-[#8FA89B] group-hover:text-white transition-colors" />
                <span>Contact Us</span>
              </button>
            </div>
          </div>

          {/* Quick Links */}
          <div className="space-y-3">
            <h4 className="text-sm font-bold text-white uppercase tracking-wider">Shopping</h4>
            <ul className="space-y-2 text-sm text-stone-300">
              <li>
                <button
                  onClick={() => onNavigate('/shop')}
                  className="hover:text-white transition-colors cursor-pointer"
                >
                  All Products
                </button>
              </li>
              <li>
                <button
                  onClick={() => onNavigate('/shop?filter=newArrival')}
                  className="hover:text-white transition-colors cursor-pointer"
                >
                  New Arrivals
                </button>
              </li>
              <li>
                <button
                  onClick={() => onNavigate('/shop?filter=featured')}
                  className="hover:text-white transition-colors cursor-pointer"
                >
                  Featured Collection
                </button>
              </li>
              <li>
                <button
                  onClick={() => onNavigate('/my-orders')}
                  className="hover:text-white transition-colors cursor-pointer text-[#C85A32] font-semibold"
                >
                  My Orders & Tracking
                </button>
              </li>
              <li>
                <button
                  onClick={() => onNavigate('/track-order')}
                  className="hover:text-white transition-colors cursor-pointer"
                >
                  Track Your Order
                </button>
              </li>
              <li>
                <button
                  onClick={() => onNavigate('/wishlist')}
                  className="hover:text-white transition-colors cursor-pointer"
                >
                  My Wishlist
                </button>
              </li>
            </ul>
          </div>

          {/* Customer Support */}
          <div className="space-y-3">
            <h4 className="text-sm font-bold text-white uppercase tracking-wider">Customer Care</h4>
            <ul className="space-y-2 text-sm text-stone-300">
              <li>
                <button
                  onClick={() => onNavigate('/size-guide')}
                  className="hover:text-white transition-colors cursor-pointer"
                >
                  Size Guide & Chart
                </button>
              </li>
              <li>
                <button
                  onClick={() => onNavigate('/shipping-policy')}
                  className="hover:text-white transition-colors cursor-pointer"
                >
                  Shipping & Delivery
                </button>
              </li>
              <li>
                <button
                  onClick={() => onNavigate('/return-policy')}
                  className="hover:text-white transition-colors cursor-pointer"
                >
                  Return & Exchange Policy
                </button>
              </li>
              <li>
                <button
                  onClick={() => onNavigate('/faq')}
                  className="hover:text-white transition-colors cursor-pointer"
                >
                  FAQs
                </button>
              </li>
              <li>
                <button
                  onClick={() => onNavigate('/privacy-policy')}
                  className="hover:text-white transition-colors cursor-pointer"
                >
                  Privacy Policy
                </button>
              </li>
              <li>
                <button
                  onClick={() => onNavigate('/terms')}
                  className="hover:text-white transition-colors cursor-pointer"
                >
                  Terms & Conditions
                </button>
              </li>
            </ul>
          </div>

          {/* Contact Details */}
          <div className="space-y-3">
            <h4 className="text-sm font-bold text-white uppercase tracking-wider">Contact Store</h4>
            <div className="space-y-3 text-sm text-stone-300">
              <a
                href={`tel:${settings.phone}`}
                className="flex items-center gap-2.5 hover:text-white transition-colors"
              >
                <Phone className="w-4 h-4 text-[#C85A32] shrink-0" />
                <span>{settings.phone}</span>
              </a>

              <a
                href={`mailto:${settings.email}`}
                className="flex items-center gap-2.5 hover:text-white transition-colors truncate"
              >
                <Mail className="w-4 h-4 text-[#8FA89B] shrink-0" />
                <span className="truncate">{settings.email}</span>
              </a>

              <a
                href={`https://wa.me/88${settings.whatsapp.replace(/[^0-9]/g, '')}`}
                target="_blank"
                rel="noopener noreferrer"
                className="flex items-center gap-2.5 hover:text-white transition-colors"
              >
                <MessageCircle className="w-4 h-4 text-[#16A34A] shrink-0" />
                <span>WhatsApp: {settings.whatsapp}</span>
              </a>

              <div className="flex items-start gap-2.5 text-stone-400 text-xs">
                <MapPin className="w-4 h-4 text-stone-400 shrink-0 mt-0.5" />
                <span>Bangladesh Nationwide Delivery Network</span>
              </div>
            </div>
          </div>
        </div>

        {/* Bottom Copyright & Admin link */}
        <div className="pt-8 flex flex-col sm:flex-row items-center justify-between text-xs text-stone-400 gap-4">
          <p>© {new Date().getFullYear()} {settings.storeName}. All rights reserved.</p>

          <div className="flex items-center gap-4">
            <span className="text-stone-500">Secure COD Payment Across Bangladesh</span>
            <span>•</span>
            <button
              onClick={() => onNavigate('/admin')}
              className="text-stone-400 hover:text-white transition-colors cursor-pointer"
            >
              Staff Portal
            </button>
          </div>
        </div>
      </div>
    </footer>
  );
};

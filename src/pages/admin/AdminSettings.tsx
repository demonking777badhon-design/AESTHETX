import React, { useState, useEffect } from 'react';
import {
  Settings,
  Save,
  Check,
  RotateCcw,
  Sparkles,
  AlertCircle,
  Truck,
  CreditCard,
  Smartphone,
  Info,
  DollarSign
} from 'lucide-react';
import { useSettings } from '../../context/SettingsContext';
import { logAdminAction } from '../../firebase/db';
import { useAuth } from '../../context/AuthContext';
import type { SiteSettings } from '../../types';

export const AdminSettings: React.FC = () => {
  const { currentUser } = useAuth();
  const { settings, updateSettings, initializeDefaults } = useSettings();

  const [form, setForm] = useState<SiteSettings>({ ...settings });
  const [saving, setSaving] = useState(false);
  const [savedNotice, setSavedNotice] = useState(false);
  const [saveError, setSaveError] = useState('');
  const [instantNotice, setInstantNotice] = useState('');
  const [togglingGateway, setTogglingGateway] = useState<'bkash' | 'nagad' | null>(null);
  const [bootstrapping, setBootstrapping] = useState(false);

  useEffect(() => {
    setForm({ ...settings });
  }, [settings]);

  const handleChange = (key: keyof SiteSettings, value: any) => {
    setForm((prev) => ({ ...prev, [key]: value }));
  };

  const handleInstantGatewayToggle = async (
    key: 'bkashEnabled' | 'nagadEnabled',
    nextValue: boolean
  ) => {
    const providerLabel = key === 'bkashEnabled' ? 'bKash' : 'Nagad';
    setTogglingGateway(key === 'bkashEnabled' ? 'bkash' : 'nagad');
    setSaveError('');
    setForm((prev) => ({ ...prev, [key]: nextValue }));
    try {
      await updateSettings({ [key]: nextValue });
      await logAdminAction(
        nextValue ? 'PAYMENT_GATEWAY_ENABLED' : 'PAYMENT_GATEWAY_DISABLED',
        `${providerLabel} Payment Gateway`,
        `${providerLabel} payment option turned ${nextValue ? 'ON' : 'OFF'} from Store Settings`,
        currentUser?.uid,
        currentUser?.email || undefined
      );
      setInstantNotice(
        nextValue
          ? `${providerLabel} পেমেন্ট চালু করা হয়েছে এবং চেকআউটে যুক্ত হয়েছে।`
          : `${providerLabel} পেমেন্ট বন্ধ করা হয়েছে এবং চেকআউট থেকে সরানো হয়েছে।`
      );
      setTimeout(() => setInstantNotice(''), 3500);
    } catch (err: any) {
      console.warn('Gateway toggle error:', err);
      setSaveError(err?.message || `Failed to update ${providerLabel} status.`);
    } finally {
      setTogglingGateway(null);
    }
  };

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault();
    setSaving(true);
    setSaveError('');
    try {
      await updateSettings(form);
      await logAdminAction(
        'SETTINGS_UPDATED',
        'Store Settings & Payment Configuration',
        `Inside Dhaka: ৳${form.defaultDeliveryInsideDhaka}, Outside: ৳${form.defaultDeliveryOutsideDhaka}, bKash: ${form.bkashEnabled !== false ? 'ON' : 'OFF'}, Nagad: ${form.nagadEnabled !== false ? 'ON' : 'OFF'}`,
        currentUser?.uid,
        currentUser?.email || undefined
      );

      setSavedNotice(true);
      setTimeout(() => setSavedNotice(false), 2500);
    } catch (err: any) {
      console.warn('Settings save error:', err);
      setSaveError(err?.message || 'সেটিংস সেভ করতে সমস্যা হয়েছে।');
    } finally {
      setSaving(false);
    }
  };

  const handleInitializeDefaults = async () => {
    if (
      window.confirm(
        'Initialize default configuration in Firestore? This will save official store settings, Bangladesh delivery charges (Inside Dhaka: ৳80, Outside Dhaka: ৳150), and bKash/Nagad settings. It will NOT create any mock products or fake orders.'
      )
    ) {
      setBootstrapping(true);
      try {
        await initializeDefaults();
        setForm({ ...settings });
        alert('Store configuration documents successfully created in Firestore!');
      } catch (err) {
        console.warn('Initialization notice:', err);
      } finally {
        setBootstrapping(false);
      }
    }
  };

  return (
    <div className="space-y-8 max-w-4xl mx-auto">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-black text-[#1A1E1C]">Store Settings (স্টোর সেটিংস)</h1>
          <p className="text-xs text-[#626C66] mt-0.5">
            ডেলিভারি চার্জ, বিকাশ ও নগদ পেমেন্ট গেটওয়ে, কন্টাক্ট হটলাইন এবং সাধারণ সেটিংস পরিচালনা করুন।
          </p>
        </div>

        <button
          onClick={handleInitializeDefaults}
          disabled={bootstrapping}
          className="inline-flex items-center gap-2 px-4 py-2.5 bg-[#FAF8F5] border border-[#E5DFD7] hover:border-[#1E3A2F] text-[#1E3A2F] rounded-xl text-xs font-bold transition-all shadow-xs cursor-pointer"
        >
          <Sparkles className="w-4 h-4 text-[#C85A32]" />
          <span>{bootstrapping ? 'Writing Docs...' : 'Initialize Store Config in Firestore'}</span>
        </button>
      </div>

      {instantNotice && (
        <div className="bg-emerald-50 border border-emerald-200 text-emerald-900 rounded-xl px-4 py-3 text-xs font-bold flex items-center gap-2 shadow-xs">
          <Check className="w-4 h-4 text-emerald-600 shrink-0" />
          <span>{instantNotice}</span>
        </div>
      )}

      {saveError && (
        <div className="bg-red-50 border border-red-200 text-red-800 rounded-xl px-4 py-3 text-xs font-bold flex items-center gap-2 shadow-xs">
          <AlertCircle className="w-4 h-4 text-red-600 shrink-0" />
          <span>{saveError}</span>
        </div>
      )}

      <form onSubmit={handleSave} className="space-y-6">
        {/* Delivery Charges Section (ডেলিভারি চার্জ এডিট করার অপশন) */}
        <div className="bg-white border-2 border-[#1E3A2F]/20 rounded-2xl p-6 shadow-xs space-y-5">
          <div className="flex items-center justify-between pb-3 border-b border-[#EFEBE5]">
            <div className="flex items-center gap-2.5">
              <div className="w-8 h-8 rounded-lg bg-[#1E3A2F]/10 text-[#1E3A2F] flex items-center justify-center">
                <Truck className="w-4 h-4" />
              </div>
              <div>
                <h2 className="text-sm font-black text-[#1A1E1C]">
                  ডেলিভারি চার্জ কনফিগারেশন (Delivery Charges)
                </h2>
                <p className="text-[11px] text-[#626C66]">
                  চেকআউট এবং ডেলিভারি জোনের রেট এখান থেকে সরাসরি এডিট ও নিয়ন্ত্রণ করুন
                </p>
              </div>
            </div>
            <span className="text-[10px] font-bold bg-emerald-100 text-emerald-800 px-2 py-0.5 rounded-full border border-emerald-300">
              Live Checkout Sync
            </span>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            {/* Inside Dhaka Fee */}
            <div className="bg-[#FAF8F5] p-4 rounded-xl border border-[#E5DFD7] space-y-2">
              <label className="text-xs font-bold text-[#1A1E1C] flex items-center justify-between">
                <span>ঢাকার ভেতরে ডেলিভারি চার্জ (Inside Dhaka)</span>
                <span className="text-[11px] font-black text-[#1E3A2F]">৳{form.defaultDeliveryInsideDhaka ?? 80}</span>
              </label>
              <div className="relative">
                <span className="absolute left-3 top-1/2 -translate-y-1/2 text-xs font-bold text-[#626C66]">
                  ৳
                </span>
                <input
                  type="number"
                  min="0"
                  step="1"
                  value={form.defaultDeliveryInsideDhaka ?? 80}
                  onChange={(e) => handleChange('defaultDeliveryInsideDhaka', Number(e.target.value))}
                  className="w-full bg-white border border-[#E5DFD7] rounded-xl pl-8 pr-3 py-2.5 text-xs font-bold text-[#1A1E1C] focus:outline-hidden focus:border-[#1E3A2F]"
                  required
                />
              </div>
              <div>
                <label className="text-[10px] font-bold text-[#626C66] block mb-1">
                  ঢাকার ভেতরে আনুমানিক ডেলিভারি সময়
                </label>
                <input
                  type="text"
                  placeholder="e.g. 1-2 Business Days (১-২ দিন)"
                  value={form.deliveryEstimatedDhaka || ''}
                  onChange={(e) => handleChange('deliveryEstimatedDhaka', e.target.value)}
                  className="w-full bg-white border border-[#E5DFD7] rounded-lg p-2 text-xs text-[#1A1E1C] focus:outline-hidden focus:border-[#1E3A2F]"
                />
              </div>
            </div>

            {/* Outside Dhaka Fee */}
            <div className="bg-[#FAF8F5] p-4 rounded-xl border border-[#E5DFD7] space-y-2">
              <label className="text-xs font-bold text-[#1A1E1C] flex items-center justify-between">
                <span>ঢাকার বাইরে ডেলিভারি চার্জ (Outside Dhaka)</span>
                <span className="text-[11px] font-black text-[#1E3A2F]">৳{form.defaultDeliveryOutsideDhaka ?? 150}</span>
              </label>
              <div className="relative">
                <span className="absolute left-3 top-1/2 -translate-y-1/2 text-xs font-bold text-[#626C66]">
                  ৳
                </span>
                <input
                  type="number"
                  min="0"
                  step="1"
                  value={form.defaultDeliveryOutsideDhaka ?? 150}
                  onChange={(e) => handleChange('defaultDeliveryOutsideDhaka', Number(e.target.value))}
                  className="w-full bg-white border border-[#E5DFD7] rounded-xl pl-8 pr-3 py-2.5 text-xs font-bold text-[#1A1E1C] focus:outline-hidden focus:border-[#1E3A2F]"
                  required
                />
              </div>
              <div>
                <label className="text-[10px] font-bold text-[#626C66] block mb-1">
                  ঢাকার বাইরে আনুমানিক ডেলিভারি সময়
                </label>
                <input
                  type="text"
                  placeholder="e.g. 2-4 Business Days (২-৪ দিন)"
                  value={form.deliveryEstimatedOutside || ''}
                  onChange={(e) => handleChange('deliveryEstimatedOutside', e.target.value)}
                  className="w-full bg-white border border-[#E5DFD7] rounded-lg p-2 text-xs text-[#1A1E1C] focus:outline-hidden focus:border-[#1E3A2F]"
                />
              </div>
            </div>
          </div>

          {/* Free Delivery Threshold */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 pt-1">
            <div>
              <label className="text-xs font-bold text-[#1A1E1C] block mb-1">
                ফ্রি ডেলিভারির সর্বনিম্ন অর্ডার মূল্য (Free Delivery Above ৳)
              </label>
              <div className="relative">
                <span className="absolute left-3 top-1/2 -translate-y-1/2 text-xs font-bold text-[#626C66]">
                  ৳
                </span>
                <input
                  type="number"
                  min="0"
                  placeholder="2500 (0 দিলে নিষ্ক্রিয়)"
                  value={form.freeDeliveryThreshold ?? ''}
                  onChange={(e) => handleChange('freeDeliveryThreshold', Number(e.target.value))}
                  className="w-full bg-[#FAF8F5] border border-[#E5DFD7] rounded-xl pl-8 pr-3 py-2.5 text-xs text-[#1A1E1C] focus:outline-hidden focus:border-[#1E3A2F]"
                />
              </div>
              <span className="text-[10px] text-[#626C66] mt-0.5 block">
                এই পরিমাণের বেশি অর্ডারে স্বয়ংক্রিয়ভাবে ডেলিভারি চার্জ ০ (ফ্রি) হয়ে যাবে।
              </span>
            </div>

            <div className="bg-emerald-50 border border-emerald-200 rounded-xl p-3 flex items-start gap-2.5 text-xs text-emerald-900">
              <Info className="w-4 h-4 text-emerald-700 shrink-0 mt-0.5" />
              <div>
                <span className="font-bold block">অটো সিংক সুবিধা:</span>
                <span className="text-[11px] text-emerald-800">
                  এখানে ডেলিভারি চার্জ পরিবর্তন করে &ldquo;Save Settings&rdquo; চাপলে গ্রাহকের চেকআউট পেজে নতুন ডেলিভারি রেট সঙ্গে সঙ্গে কার্যকর হয়ে যাবে।
                </span>
              </div>
            </div>
          </div>
        </div>

        {/* bKash Payment Gateway Settings (বিকাশ পেমেন্ট কনফিগারেশন) */}
        <div className="bg-white border-2 border-[#E2136E]/20 rounded-2xl p-6 shadow-xs space-y-4">
          <div className="flex items-center justify-between pb-3 border-b border-[#EFEBE5]">
            <div className="flex items-center gap-2.5">
              <div className="w-8 h-8 rounded-lg bg-[#E2136E]/10 text-[#E2136E] font-black flex items-center justify-center text-xs tracking-tighter">
                bK
              </div>
              <div>
                <h2 className="text-sm font-black text-[#1A1E1C] flex items-center gap-2">
                  <span>বিকাশ পেমেন্ট গেটওয়ে (bKash Payment)</span>
                  <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-[#E2136E] text-white">
                    bKash
                  </span>
                </h2>
                <p className="text-[11px] text-[#626C66]">
                  গ্রাহকের চেকআউটে বিকাশ পেমেন্ট অপশন ও ওয়ালেট নম্বর কনফিগার করুন
                </p>
              </div>
            </div>

            {/* Toggle Enable/Disable */}
            <button
              type="button"
              role="switch"
              aria-checked={form.bkashEnabled !== false}
              disabled={togglingGateway === 'bkash'}
              onClick={() =>
                handleInstantGatewayToggle('bkashEnabled', !(form.bkashEnabled !== false))
              }
              className="flex items-center gap-2.5 cursor-pointer select-none focus:outline-hidden"
            >
              <span
                className={`relative inline-flex h-6 w-11 shrink-0 rounded-full border-2 border-transparent transition-colors duration-200 ease-in-out ${
                  form.bkashEnabled !== false ? 'bg-[#E2136E]' : 'bg-stone-300'
                }`}
              >
                <span
                  className={`pointer-events-none inline-block h-5 w-5 transform rounded-full bg-white shadow-sm ring-0 transition duration-200 ease-in-out ${
                    form.bkashEnabled !== false ? 'translate-x-5' : 'translate-x-0'
                  }`}
                />
              </span>
              <span
                className={`text-xs font-bold px-2.5 py-0.5 rounded-full ${
                  form.bkashEnabled !== false
                    ? 'bg-emerald-100 text-emerald-800'
                    : 'bg-rose-100 text-rose-800'
                }`}
              >
                {form.bkashEnabled !== false ? 'সক্রিয় (ON)' : 'বন্ধ (OFF)'}
              </span>
            </button>
          </div>

          {form.bkashEnabled === false && (
            <div className="bg-rose-50 border border-rose-200 rounded-xl p-3 text-xs text-rose-800 flex items-center gap-2">
              <AlertCircle className="w-4 h-4 text-rose-600 shrink-0" />
              <span>
                বিকাশ পেমেন্ট বর্তমানে <strong>বন্ধ (OFF)</strong> আছে। গ্রাহকের চেকআউট পেজে বিকাশ অপশনটি দেখানো হবে না।
              </span>
            </div>
          )}

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            {/* bKash Wallet Number */}
            <div>
              <label className="text-xs font-bold text-[#1A1E1C] block mb-1">
                বিকাশ অ্যাকাউন্ট নম্বর (bKash Wallet Number) <span className="text-red-500">*</span>
              </label>
              <input
                type="tel"
                placeholder="01708943242"
                value={form.bkashNumber || ''}
                onChange={(e) => handleChange('bkashNumber', e.target.value)}
                className="w-full bg-[#FAF8F5] border border-[#E5DFD7] rounded-xl p-3 text-xs font-bold font-mono text-[#1A1E1C] focus:outline-hidden focus:border-[#E2136E]"
              />
              <span className="text-[10px] text-[#626C66] mt-0.5 block">
                গ্রাহক চেকআউটে এই নম্বরে টাকা পাঠাবে।
              </span>
            </div>

            {/* bKash Account Type */}
            <div>
              <label className="text-xs font-bold text-[#1A1E1C] block mb-1">
                অ্যাকাউন্ট টাইপ (Account Type)
              </label>
              <select
                value={form.bkashType || 'personal'}
                onChange={(e) => handleChange('bkashType', e.target.value)}
                className="w-full bg-[#FAF8F5] border border-[#E5DFD7] rounded-xl p-3 text-xs font-bold text-[#1A1E1C] focus:outline-hidden focus:border-[#E2136E] cursor-pointer"
              >
                <option value="personal">পার্সোনাল (Personal - Send Money)</option>
                <option value="merchant">মার্চেন্ট (Merchant - Make Payment)</option>
                <option value="agent">এজেন্ট (Agent - Cash In)</option>
              </select>
            </div>
          </div>

          {/* bKash Instructions */}
          <div>
            <label className="text-xs font-bold text-[#1A1E1C] block mb-1">
              গ্রাহকের জন্য বিকাশ পেমেন্ট নির্দেশিকা (Instructions)
            </label>
            <textarea
              rows={2}
              value={form.bkashInstructions || ''}
              onChange={(e) => handleChange('bkashInstructions', e.target.value)}
              placeholder="বিকাশ অ্যাপ অথবা *247# ডায়াল করে উল্লেখিত নম্বরে Send Money করুন। পেমেন্ট শেষে TrxID নিচে লিখুন..."
              className="w-full bg-[#FAF8F5] border border-[#E5DFD7] rounded-xl p-3 text-xs text-[#1A1E1C] focus:outline-hidden focus:border-[#E2136E]"
            />
          </div>
        </div>

        {/* Nagad Payment Gateway Settings (নগদ পেমেন্ট কনফিগারেশন) */}
        <div className="bg-white border-2 border-[#F7941D]/20 rounded-2xl p-6 shadow-xs space-y-4">
          <div className="flex items-center justify-between pb-3 border-b border-[#EFEBE5]">
            <div className="flex items-center gap-2.5">
              <div className="w-8 h-8 rounded-lg bg-[#F7941D]/10 text-[#F7941D] font-black flex items-center justify-center text-xs tracking-tighter">
                নগদ
              </div>
              <div>
                <h2 className="text-sm font-black text-[#1A1E1C] flex items-center gap-2">
                  <span>নগদ পেমেন্ট গেটওয়ে (Nagad Payment)</span>
                  <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-[#F7941D] text-white">
                    Nagad
                  </span>
                </h2>
                <p className="text-[11px] text-[#626C66]">
                  গ্রাহকের চেকআউটে নগদ পেমেন্ট অপশন ও ওয়ালেট নম্বর কনফিগার করুন
                </p>
              </div>
            </div>

            {/* Toggle Enable/Disable */}
            <button
              type="button"
              role="switch"
              aria-checked={form.nagadEnabled !== false}
              disabled={togglingGateway === 'nagad'}
              onClick={() =>
                handleInstantGatewayToggle('nagadEnabled', !(form.nagadEnabled !== false))
              }
              className="flex items-center gap-2.5 cursor-pointer select-none focus:outline-hidden"
            >
              <span
                className={`relative inline-flex h-6 w-11 shrink-0 rounded-full border-2 border-transparent transition-colors duration-200 ease-in-out ${
                  form.nagadEnabled !== false ? 'bg-[#F7941D]' : 'bg-stone-300'
                }`}
              >
                <span
                  className={`pointer-events-none inline-block h-5 w-5 transform rounded-full bg-white shadow-sm ring-0 transition duration-200 ease-in-out ${
                    form.nagadEnabled !== false ? 'translate-x-5' : 'translate-x-0'
                  }`}
                />
              </span>
              <span
                className={`text-xs font-bold px-2.5 py-0.5 rounded-full ${
                  form.nagadEnabled !== false
                    ? 'bg-emerald-100 text-emerald-800'
                    : 'bg-rose-100 text-rose-800'
                }`}
              >
                {form.nagadEnabled !== false ? 'সক্রিয় (ON)' : 'বন্ধ (OFF)'}
              </span>
            </button>
          </div>

          {form.nagadEnabled === false && (
            <div className="bg-rose-50 border border-rose-200 rounded-xl p-3 text-xs text-rose-800 flex items-center gap-2">
              <AlertCircle className="w-4 h-4 text-rose-600 shrink-0" />
              <span>
                নগদ পেমেন্ট বর্তমানে <strong>বন্ধ (OFF)</strong> আছে। গ্রাহকের চেকআউট পেজে নগদ অপশনটি দেখানো হবে না।
              </span>
            </div>
          )}

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            {/* Nagad Wallet Number */}
            <div>
              <label className="text-xs font-bold text-[#1A1E1C] block mb-1">
                নগদ অ্যাকাউন্ট নম্বর (Nagad Wallet Number) <span className="text-red-500">*</span>
              </label>
              <input
                type="tel"
                placeholder="01708943242"
                value={form.nagadNumber || ''}
                onChange={(e) => handleChange('nagadNumber', e.target.value)}
                className="w-full bg-[#FAF8F5] border border-[#E5DFD7] rounded-xl p-3 text-xs font-bold font-mono text-[#1A1E1C] focus:outline-hidden focus:border-[#F7941D]"
              />
              <span className="text-[10px] text-[#626C66] mt-0.5 block">
                গ্রাহক চেকআউটে এই নম্বরে নগদ পেমেন্ট পাঠাবে।
              </span>
            </div>

            {/* Nagad Account Type */}
            <div>
              <label className="text-xs font-bold text-[#1A1E1C] block mb-1">
                অ্যাকাউন্ট টাইপ (Account Type)
              </label>
              <select
                value={form.nagadType || 'personal'}
                onChange={(e) => handleChange('nagadType', e.target.value)}
                className="w-full bg-[#FAF8F5] border border-[#E5DFD7] rounded-xl p-3 text-xs font-bold text-[#1A1E1C] focus:outline-hidden focus:border-[#F7941D] cursor-pointer"
              >
                <option value="personal">পার্সোনাল (Personal - Send Money)</option>
                <option value="merchant">মার্চেন্ট (Merchant - Payment)</option>
                <option value="agent">এজেন্ট (Agent - Cash In)</option>
              </select>
            </div>
          </div>

          {/* Nagad Instructions */}
          <div>
            <label className="text-xs font-bold text-[#1A1E1C] block mb-1">
              গ্রাহকের জন্য নগদ পেমেন্ট নির্দেশিকা (Instructions)
            </label>
            <textarea
              rows={2}
              value={form.nagadInstructions || ''}
              onChange={(e) => handleChange('nagadInstructions', e.target.value)}
              placeholder="নগদ অ্যাপ অথবা *167# ডায়াল করে উল্লেখিত নম্বরে Send Money করুন। পেমেন্ট শেষে TrxID নিচে লিখুন..."
              className="w-full bg-[#FAF8F5] border border-[#E5DFD7] rounded-xl p-3 text-xs text-[#1A1E1C] focus:outline-hidden focus:border-[#F7941D]"
            />
          </div>
        </div>

        {/* Branding & Identity */}
        <div className="bg-white border border-[#E5DFD7] rounded-2xl p-6 shadow-xs space-y-4">
          <h2 className="text-sm font-bold text-[#1A1E1C] pb-3 border-b border-[#EFEBE5]">
            Brand Identity (ব্র্যান্ড পরিচয়)
          </h2>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div>
              <label className="text-xs font-bold text-[#1A1E1C] block mb-1">Store Name</label>
              <input
                type="text"
                value={form.storeName}
                onChange={(e) => handleChange('storeName', e.target.value)}
                className="w-full bg-[#FAF8F5] border border-[#E5DFD7] rounded-xl p-3 text-xs font-bold text-[#1A1E1C]"
                required
              />
            </div>

            <div>
              <label className="text-xs font-bold text-[#1A1E1C] block mb-1">Tagline</label>
              <input
                type="text"
                value={form.tagline}
                onChange={(e) => handleChange('tagline', e.target.value)}
                className="w-full bg-[#FAF8F5] border border-[#E5DFD7] rounded-xl p-3 text-xs text-[#1A1E1C]"
              />
            </div>
          </div>

          <div>
            <label className="text-xs font-bold text-[#1A1E1C] block mb-1">Logo URL</label>
            <input
              type="text"
              value={form.logoUrl || ''}
              onChange={(e) => handleChange('logoUrl', e.target.value)}
              className="w-full bg-[#FAF8F5] border border-[#E5DFD7] rounded-xl p-3 text-xs text-[#1A1E1C]"
            />
          </div>
        </div>

        {/* Contact Channels */}
        <div className="bg-white border border-[#E5DFD7] rounded-2xl p-6 shadow-xs space-y-4">
          <h2 className="text-sm font-bold text-[#1A1E1C] pb-3 border-b border-[#EFEBE5]">
            Contact Channels (বাংলাদেশ কন্টাক্ট চ্যানেল)
          </h2>

          <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
            <div>
              <label className="text-xs font-bold text-[#1A1E1C] block mb-1">Business Phone</label>
              <input
                type="text"
                value={form.phone}
                onChange={(e) => handleChange('phone', e.target.value)}
                className="w-full bg-[#FAF8F5] border border-[#E5DFD7] rounded-xl p-3 text-xs text-[#1A1E1C]"
                required
              />
            </div>

            <div>
              <label className="text-xs font-bold text-[#1A1E1C] block mb-1">WhatsApp Number</label>
              <input
                type="text"
                value={form.whatsapp}
                onChange={(e) => handleChange('whatsapp', e.target.value)}
                className="w-full bg-[#FAF8F5] border border-[#E5DFD7] rounded-xl p-3 text-xs text-[#1A1E1C]"
                required
              />
            </div>

            <div>
              <label className="text-xs font-bold text-[#1A1E1C] block mb-1">Business Email</label>
              <input
                type="email"
                value={form.email}
                onChange={(e) => handleChange('email', e.target.value)}
                className="w-full bg-[#FAF8F5] border border-[#E5DFD7] rounded-xl p-3 text-xs text-[#1A1E1C]"
                required
              />
            </div>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div>
              <label className="text-xs font-bold text-[#1A1E1C] block mb-1">Facebook Page URL</label>
              <input
                type="url"
                value={form.facebook}
                onChange={(e) => handleChange('facebook', e.target.value)}
                className="w-full bg-[#FAF8F5] border border-[#E5DFD7] rounded-xl p-3 text-xs text-[#1A1E1C]"
              />
            </div>

            <div>
              <label className="text-xs font-bold text-[#1A1E1C] block mb-1">Store Address</label>
              <input
                type="text"
                value={form.address}
                onChange={(e) => handleChange('address', e.target.value)}
                className="w-full bg-[#FAF8F5] border border-[#E5DFD7] rounded-xl p-3 text-xs text-[#1A1E1C]"
              />
            </div>
          </div>
        </div>

        {/* E-Commerce Operations */}
        <div className="bg-white border border-[#E5DFD7] rounded-2xl p-6 shadow-xs space-y-4">
          <h2 className="text-sm font-bold text-[#1A1E1C] pb-3 border-b border-[#EFEBE5]">
            অন্যান্য সেটিংস (Store Parameters)
          </h2>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div>
              <label className="text-xs font-bold text-[#1A1E1C] block mb-1">Currency Symbol</label>
              <input
                type="text"
                value={form.currency}
                onChange={(e) => handleChange('currency', e.target.value)}
                className="w-full bg-[#FAF8F5] border border-[#E5DFD7] rounded-xl p-3 text-xs font-bold text-[#1A1E1C]"
              />
            </div>

            <div>
              <label className="text-xs font-bold text-[#1A1E1C] block mb-1">Order Prefix</label>
              <input
                type="text"
                value={form.orderPrefix}
                onChange={(e) => handleChange('orderPrefix', e.target.value)}
                className="w-full bg-[#FAF8F5] border border-[#E5DFD7] rounded-xl p-3 text-xs font-mono uppercase text-[#1A1E1C]"
              />
            </div>
          </div>

          <div>
            <label className="text-xs font-bold text-[#1A1E1C] block mb-1">
              Top Announcement Text
            </label>
            <input
              type="text"
              value={form.announcementBar?.text || ''}
              onChange={(e) =>
                setForm((prev) => ({
                  ...prev,
                  announcementBar: {
                    enabled: Boolean(prev.announcementBar?.enabled),
                    text: e.target.value
                  }
                }))
              }
              className="w-full bg-[#FAF8F5] border border-[#E5DFD7] rounded-xl p-3 text-xs text-[#1A1E1C]"
            />
          </div>
        </div>

        {/* Submit */}
        <div className="flex justify-end sticky bottom-6 z-20">
          <button
            type="submit"
            disabled={saving}
            className="px-8 py-3.5 bg-[#1E3A2F] hover:bg-[#162B23] text-white rounded-xl text-xs font-bold transition-all shadow-lg flex items-center gap-2 cursor-pointer disabled:opacity-50"
          >
            {savedNotice ? (
              <>
                <Check className="w-4 h-4 text-emerald-300" />
                <span>সব সেটিংস সফলভাবে সেভ হয়েছে! (Saved!)</span>
              </>
            ) : (
              <>
                <Save className="w-4 h-4" />
                <span>{saving ? 'আপডেট হচ্ছে...' : 'সেটিংস সংরক্ষণ করুন (Save Settings)'}</span>
              </>
            )}
          </button>
        </div>
      </form>
    </div>
  );
};

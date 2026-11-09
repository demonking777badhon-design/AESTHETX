import React, { useState, useEffect } from 'react';
import {
  BookOpen,
  Save,
  Plus,
  Trash2,
  HelpCircle,
  Truck,
  CreditCard,
  RotateCcw,
  Sparkles,
  CheckCircle2,
  RefreshCw,
  Info
} from 'lucide-react';
import { getAIKnowledgeBase, saveAIKnowledgeBase, DEFAULT_AI_KNOWLEDGE_BASE } from '../../../firebase/db';
import type { AIKnowledgeBase } from '../../../types';

interface AIKnowledgeBaseTabProps {
  onShowToast: (msg: string) => void;
}

export const AIKnowledgeBaseTab: React.FC<AIKnowledgeBaseTabProps> = ({ onShowToast }) => {
  const [kb, setKb] = useState<AIKnowledgeBase>(DEFAULT_AI_KNOWLEDGE_BASE);
  const [isLoading, setIsLoading] = useState(true);
  const [isSaving, setIsSaving] = useState(false);
  const [newQuestion, setNewQuestion] = useState('');
  const [newAnswer, setNewAnswer] = useState('');
  const [activeCard, setActiveCard] = useState<'all' | 'shipping' | 'return' | 'faq'>('all');

  useEffect(() => {
    loadKnowledgeBase();
  }, []);

  const loadKnowledgeBase = async () => {
    setIsLoading(true);
    try {
      const data = await getAIKnowledgeBase();
      setKb(data);
    } catch (err) {
      console.error('Error loading AI knowledge base:', err);
    } finally {
      setIsLoading(false);
    }
  };

  const handleSave = async () => {
    setIsSaving(true);
    try {
      await saveAIKnowledgeBase(kb);
      onShowToast('AI Knowledge Base successfully saved and synced with Assistant!');
    } catch (err) {
      console.error('Error saving AI knowledge base:', err);
      onShowToast('Failed to save knowledge base.');
    } finally {
      setIsSaving(false);
    }
  };

  const handleAddFaq = () => {
    if (!newQuestion.trim() || !newAnswer.trim()) {
      onShowToast('Please provide both question and answer.');
      return;
    }

    const updatedFaqs = [
      ...kb.faqList,
      { question: newQuestion.trim(), answer: newAnswer.trim() }
    ];

    setKb({ ...kb, faqList: updatedFaqs });
    setNewQuestion('');
    setNewAnswer('');
    onShowToast('FAQ added. Remember to click "Save Knowledge Base" to apply.');
  };

  const handleDeleteFaq = (index: number) => {
    const updatedFaqs = kb.faqList.filter((_, idx) => idx !== index);
    setKb({ ...kb, faqList: updatedFaqs });
  };

  if (isLoading) {
    return (
      <div className="bg-white border border-[#E5DFD7] rounded-2xl p-12 text-center">
        <RefreshCw className="w-6 h-6 animate-spin text-[#1E3A2F] mx-auto mb-2" />
        <p className="text-xs text-stone-500">Loading AI Knowledge Base...</p>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Header with Save Button */}
      <div className="bg-white border border-[#E5DFD7] rounded-2xl p-5 sm:p-6 shadow-xs flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <div className="flex items-center gap-2">
            <BookOpen className="w-5 h-5 text-[#1E3A2F]" />
            <h2 className="text-lg font-black text-[#1A1E1C]">
              AI Knowledge Base & Policy Center
            </h2>
          </div>
          <p className="text-xs text-stone-500 mt-1">
            Edit the exact policies, delivery fees, payment terms, and FAQs that the AI Assistant uses when talking to customers.
          </p>
        </div>

        <button
          onClick={handleSave}
          disabled={isSaving}
          className="inline-flex items-center justify-center gap-2 px-5 py-2.5 bg-[#1E3A2F] text-white rounded-xl text-xs font-bold hover:bg-[#2D5042] transition-colors shadow-xs cursor-pointer disabled:opacity-50"
        >
          {isSaving ? (
            <RefreshCw className="w-4 h-4 animate-spin" />
          ) : (
            <Save className="w-4 h-4" />
          )}
          <span>{isSaving ? 'Saving...' : 'Save Knowledge Base'}</span>
        </button>
      </div>

      {/* Editor Grid */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* 1. Store Overview & Brand Voice */}
        <div className="bg-white border border-[#E5DFD7] rounded-2xl p-5 shadow-xs space-y-3">
          <div className="flex items-center gap-2 pb-2 border-b border-stone-100">
            <Sparkles className="w-4 h-4 text-[#1E3A2F]" />
            <h3 className="text-xs font-black uppercase tracking-wider text-[#1A1E1C]">
              Store Overview & Brand Persona
            </h3>
          </div>
          <label className="text-[11px] font-bold text-stone-600 block">
            Brand Summary & Tagline
          </label>
          <textarea
            rows={3}
            value={kb.storeOverview}
            onChange={(e) => setKb({ ...kb, storeOverview: e.target.value })}
            className="w-full text-xs p-3 rounded-xl border border-stone-200 focus:border-[#1E3A2F] focus:ring-1 focus:ring-[#1E3A2F] outline-hidden bg-[#FAF8F5]"
            placeholder="Describe the brand voice, location, and essence..."
          />
        </div>

        {/* 2. Shipping & Delivery Rules */}
        <div className="bg-white border border-[#E5DFD7] rounded-2xl p-5 shadow-xs space-y-3">
          <div className="flex items-center gap-2 pb-2 border-b border-stone-100">
            <Truck className="w-4 h-4 text-emerald-600" />
            <h3 className="text-xs font-black uppercase tracking-wider text-[#1A1E1C]">
              Shipping Charges & Timelines
            </h3>
          </div>
          <label className="text-[11px] font-bold text-stone-600 block">
            Delivery Coverage & Fees (Inside/Outside Dhaka)
          </label>
          <textarea
            rows={3}
            value={kb.shippingInfo}
            onChange={(e) => setKb({ ...kb, shippingInfo: e.target.value })}
            className="w-full text-xs p-3 rounded-xl border border-stone-200 focus:border-[#1E3A2F] focus:ring-1 focus:ring-[#1E3A2F] outline-hidden bg-[#FAF8F5]"
            placeholder="Inside Dhaka ৳70-80, Outside Dhaka ৳120-150..."
          />
        </div>

        {/* 3. Payment Methods */}
        <div className="bg-white border border-[#E5DFD7] rounded-2xl p-5 shadow-xs space-y-3">
          <div className="flex items-center gap-2 pb-2 border-b border-stone-100">
            <CreditCard className="w-4 h-4 text-blue-600" />
            <h3 className="text-xs font-black uppercase tracking-wider text-[#1A1E1C]">
              Payment Methods & Instructions
            </h3>
          </div>
          <label className="text-[11px] font-bold text-stone-600 block">
            Accepted Methods (COD, bKash, Nagad)
          </label>
          <textarea
            rows={3}
            value={kb.paymentMethods}
            onChange={(e) => setKb({ ...kb, paymentMethods: e.target.value })}
            className="w-full text-xs p-3 rounded-xl border border-stone-200 focus:border-[#1E3A2F] focus:ring-1 focus:ring-[#1E3A2F] outline-hidden bg-[#FAF8F5]"
            placeholder="Cash on Delivery, bKash, Nagad..."
          />
        </div>

        {/* 4. Return & Exchange Policy */}
        <div className="bg-white border border-[#E5DFD7] rounded-2xl p-5 shadow-xs space-y-3">
          <div className="flex items-center gap-2 pb-2 border-b border-stone-100">
            <RotateCcw className="w-4 h-4 text-purple-600" />
            <h3 className="text-xs font-black uppercase tracking-wider text-[#1A1E1C]">
              Return, Replacement & Refund Policy
            </h3>
          </div>
          <label className="text-[11px] font-bold text-stone-600 block">
            Conditions & Time Limit (e.g. 7 Days Replacement)
          </label>
          <textarea
            rows={3}
            value={kb.returnPolicy}
            onChange={(e) => setKb({ ...kb, returnPolicy: e.target.value })}
            className="w-full text-xs p-3 rounded-xl border border-stone-200 focus:border-[#1E3A2F] focus:ring-1 focus:ring-[#1E3A2F] outline-hidden bg-[#FAF8F5]"
            placeholder="7-day hassle-free replacement with intact tags..."
          />
        </div>

        {/* 5. Custom Directives / Urgent Announcements */}
        <div className="bg-white border border-[#E5DFD7] rounded-2xl p-5 shadow-xs space-y-3 lg:col-span-2">
          <div className="flex items-center gap-2 pb-2 border-b border-stone-100">
            <Info className="w-4 h-4 text-amber-600" />
            <h3 className="text-xs font-black uppercase tracking-wider text-[#1A1E1C]">
              Special Directives & Urgent Announcements
            </h3>
          </div>
          <label className="text-[11px] font-bold text-stone-600 block">
            Temporary notice (e.g., Eid delivery cutoffs, storm delays, holiday hours)
          </label>
          <textarea
            rows={2}
            value={kb.customNotes || ''}
            onChange={(e) => setKb({ ...kb, customNotes: e.target.value })}
            className="w-full text-xs p-3 rounded-xl border border-stone-200 focus:border-[#1E3A2F] focus:ring-1 focus:ring-[#1E3A2F] outline-hidden bg-[#FAF8F5]"
            placeholder="e.g. Orders placed after 28th will be shipped post-holiday..."
          />
        </div>
      </div>

      {/* 6. Frequently Asked Questions (FAQ) Manager */}
      <div className="bg-white border border-[#E5DFD7] rounded-2xl p-5 sm:p-6 shadow-xs space-y-4">
        <div className="flex items-center justify-between pb-3 border-b border-stone-100">
          <div className="flex items-center gap-2">
            <HelpCircle className="w-4 h-4 text-[#1E3A2F]" />
            <h3 className="text-sm font-black text-[#1A1E1C]">
              AI Trained FAQs ({kb.faqList.length})
            </h3>
          </div>
          <span className="text-[11px] text-stone-500 font-medium">
            AI uses these exact answers for matching customer inquiries
          </span>
        </div>

        {/* Existing FAQ items */}
        <div className="space-y-3">
          {kb.faqList.map((faq, index) => (
            <div
              key={index}
              className="p-3.5 rounded-xl border border-stone-200 bg-[#FAF8F5] flex items-start justify-between gap-3"
            >
              <div className="space-y-1 flex-1">
                <span className="text-xs font-bold text-stone-900 block">
                  Q: {faq.question}
                </span>
                <p className="text-xs text-stone-600">
                  A: {faq.answer}
                </p>
              </div>

              <button
                onClick={() => handleDeleteFaq(index)}
                className="p-1.5 text-stone-400 hover:text-red-600 hover:bg-red-50 rounded-lg transition-colors cursor-pointer"
                title="Delete this FAQ"
              >
                <Trash2 className="w-4 h-4" />
              </button>
            </div>
          ))}
        </div>

        {/* Add New FAQ Card */}
        <div className="p-4 rounded-xl border-2 border-dashed border-stone-200 bg-stone-50/50 space-y-3">
          <h4 className="text-xs font-bold text-stone-800">Add New FAQ to Knowledge Base</h4>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
            <input
              type="text"
              value={newQuestion}
              onChange={(e) => setNewQuestion(e.target.value)}
              placeholder="Question (e.g. Do you have physical stores in Chittagong?)"
              className="text-xs p-2.5 rounded-xl border border-stone-200 bg-white focus:border-[#1E3A2F] outline-hidden"
            />
            <input
              type="text"
              value={newAnswer}
              onChange={(e) => setNewAnswer(e.target.value)}
              placeholder="Answer (e.g. Currently we operate exclusively online with delivery across Bangladesh.)"
              className="text-xs p-2.5 rounded-xl border border-stone-200 bg-white focus:border-[#1E3A2F] outline-hidden"
            />
          </div>
          <button
            onClick={handleAddFaq}
            className="inline-flex items-center gap-1.5 px-3.5 py-2 bg-stone-800 hover:bg-black text-white text-xs font-bold rounded-xl transition-colors cursor-pointer"
          >
            <Plus className="w-3.5 h-3.5" />
            <span>Add FAQ</span>
          </button>
        </div>
      </div>
    </div>
  );
};

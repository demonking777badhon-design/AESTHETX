import React, { useEffect, useState } from 'react';
import { FileText, Save, Check, ExternalLink } from 'lucide-react';
import { getStaticPage, saveStaticPage, logAdminAction } from '../../firebase/db';
import { useAuth } from '../../context/AuthContext';

const PAGES_LIST = [
  { slug: 'about', label: 'About Us' },
  { slug: 'contact', label: 'Contact Information' },
  { slug: 'shipping-policy', label: 'Shipping & Delivery Policy' },
  { slug: 'return-policy', label: 'Return & Exchange Policy' },
  { slug: 'privacy-policy', label: 'Privacy Policy' },
  { slug: 'terms', label: 'Terms & Conditions' },
  { slug: 'size-guide', label: 'Size Guide & Chart' },
  { slug: 'faq', label: 'Frequently Asked Questions' }
];

export const AdminPages: React.FC = () => {
  const { currentUser } = useAuth();
  const [selectedSlug, setSelectedSlug] = useState('about');
  const [title, setTitle] = useState('');
  const [content, setContent] = useState('');
  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [savedSuccess, setSavedSuccess] = useState(false);

  const loadPageContent = async (slug: string) => {
    setLoading(true);
    setSavedSuccess(false);
    try {
      const pageData = await getStaticPage(slug);
      if (pageData) {
        setTitle(pageData.title);
        setContent(pageData.content);
      } else {
        const matching = PAGES_LIST.find((p) => p.slug === slug);
        setTitle(matching?.label || 'Information Page');
        setContent('');
      }
    } catch (err) {
      console.warn('Error loading page:', err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadPageContent(selectedSlug);
  }, [selectedSlug]);

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault();
    setSaving(true);
    try {
      await saveStaticPage(selectedSlug, {
        title: title.trim(),
        content: content.trim()
      });

      await logAdminAction(
        'PAGE_UPDATED',
        selectedSlug,
        `Title: ${title}`,
        currentUser?.uid,
        currentUser?.email || undefined
      );

      setSavedSuccess(true);
      setTimeout(() => setSavedSuccess(false), 2500);
    } catch (err) {
      console.warn('Error saving page:', err);
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-black text-[#1A1E1C]">Content & Policy Pages</h1>
          <p className="text-xs text-[#626C66] mt-0.5">
            Customize official store policies, size guidance, and company story.
          </p>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-4 gap-6">
        {/* Left: Pages list */}
        <div className="lg:col-span-1 bg-white border border-[#E5DFD7] rounded-2xl p-4 shadow-xs space-y-1">
          <span className="text-xs font-bold uppercase tracking-wider text-[#1A1E1C] block mb-3 px-2">
            Store Pages
          </span>
          {PAGES_LIST.map((page) => (
            <button
              key={page.slug}
              onClick={() => setSelectedSlug(page.slug)}
              className={`w-full text-left px-3 py-2.5 rounded-xl text-xs font-semibold transition-all ${
                selectedSlug === page.slug
                  ? 'bg-[#1E3A2F] text-white font-bold shadow-xs'
                  : 'text-[#1A1E1C] hover:bg-stone-50'
              }`}
            >
              {page.label}
            </button>
          ))}
        </div>

        {/* Right: Content Editor */}
        <div className="lg:col-span-3">
          <form
            onSubmit={handleSave}
            className="bg-white border border-[#E5DFD7] rounded-2xl p-6 shadow-xs space-y-4"
          >
            <div className="flex items-center justify-between pb-3 border-b border-[#EFEBE5]">
              <h2 className="text-sm font-bold text-[#1A1E1C]">
                Editing: <span className="text-[#1E3A2F] font-black">/{selectedSlug}</span>
              </h2>

              <button
                type="submit"
                disabled={saving || loading}
                className="px-5 py-2 bg-[#1E3A2F] hover:bg-[#162B23] text-white rounded-xl text-xs font-bold transition-all shadow-xs flex items-center gap-1.5 cursor-pointer disabled:opacity-50"
              >
                {savedSuccess ? (
                  <>
                    <Check className="w-3.5 h-3.5 text-emerald-300" />
                    <span>Saved Live!</span>
                  </>
                ) : (
                  <>
                    <Save className="w-3.5 h-3.5" />
                    <span>{saving ? 'Saving...' : 'Publish Content'}</span>
                  </>
                )}
              </button>
            </div>

            <div>
              <label className="text-xs font-bold text-[#1A1E1C] block mb-1">Page Title</label>
              <input
                type="text"
                value={title}
                onChange={(e) => setTitle(e.target.value)}
                className="w-full bg-[#FAF8F5] border border-[#E5DFD7] rounded-xl p-3 text-xs font-bold text-[#1A1E1C]"
                required
              />
            </div>

            <div>
              <label className="text-xs font-bold text-[#1A1E1C] block mb-1">
                Body Content (Plain Text or Markdown)
              </label>
              <textarea
                rows={14}
                value={content}
                onChange={(e) => setContent(e.target.value)}
                className="w-full bg-[#FAF8F5] border border-[#E5DFD7] rounded-xl p-4 text-xs font-sans leading-relaxed text-[#1A1E1C] focus:outline-hidden focus:border-[#1E3A2F]"
                placeholder="Write your policy or story here..."
              />
            </div>
          </form>
        </div>
      </div>
    </div>
  );
};

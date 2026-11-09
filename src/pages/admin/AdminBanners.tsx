import React, { useEffect, useState } from 'react';
import { Image as ImageIcon, Plus, Edit, Trash2, Upload, Check, AlertCircle, Loader2 } from 'lucide-react';
import { getBanners, saveBanner, deleteBanner, logAdminAction } from '../../firebase/db';
import { uploadProductImage } from '../../firebase/storage';
import type { Banner } from '../../types';
import { TableSkeleton } from '../../components/common/LoadingSkeleton';
import { ConfirmDeleteModal } from '../../components/common/ConfirmDeleteModal';
import { useAuth } from '../../context/AuthContext';

export const AdminBanners: React.FC = () => {
  const { currentUser } = useAuth();
  const [banners, setBanners] = useState<Banner[]>([]);
  const [loading, setLoading] = useState(true);
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [editingBanner, setEditingBanner] = useState<Banner | null>(null);
  const [deleteTarget, setDeleteTarget] = useState<Banner | null>(null);
  const [deleting, setDeleting] = useState(false);

  // Form Fields
  const [title, setTitle] = useState('');
  const [subtitle, setSubtitle] = useState('');
  const [tagline, setTagline] = useState('');
  const [buttonText, setButtonText] = useState('Shop Now');
  const [buttonLink, setButtonLink] = useState('/shop');
  const [image, setImage] = useState('');
  const [active, setActive] = useState(true);
  const [sortOrder, setSortOrder] = useState(1);
  const [saving, setSaving] = useState(false);
  const [uploadingImage, setUploadingImage] = useState(false);
  const [uploadProgress, setUploadProgress] = useState<number | null>(null);
  const [feedback, setFeedback] = useState<{ type: 'error' | 'success'; text: string } | null>(null);

  const loadData = async () => {
    setLoading(true);
    try {
      const data = await getBanners(false);
      setBanners(data);
    } catch (err) {
      console.warn('Error loading banners:', err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadData();

    const handleUpdate = () => {
      loadData();
    };

    window.addEventListener('aesthetx-banners-updated', handleUpdate);
    return () => {
      window.removeEventListener('aesthetx-banners-updated', handleUpdate);
    };
  }, []);

  const openCreateModal = () => {
    setEditingBanner(null);
    setTitle('');
    setSubtitle('');
    setTagline('SPECIAL OFFER');
    setButtonText('Shop Now');
    setButtonLink('/shop');
    setImage('');
    setActive(true);
    setSortOrder(banners.length + 1);
    setFeedback(null);
    setIsModalOpen(true);
  };

  const openEditModal = (b: Banner) => {
    setEditingBanner(b);
    setTitle(b.title);
    setSubtitle(b.subtitle || '');
    setTagline(b.tagline || '');
    setButtonText(b.buttonText);
    setButtonLink(b.buttonLink);
    setImage(b.image || '');
    setActive(b.active);
    setSortOrder(b.sortOrder || 1);
    setFeedback(null);
    setIsModalOpen(true);
  };

  const handleImageUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    if (!e.target.files || e.target.files.length === 0) return;
    const file = e.target.files[0];

    setUploadingImage(true);
    setUploadProgress(20);
    setFeedback(null);

    try {
      const url = await uploadProductImage(file, 'banners', (prog) => {
        setUploadProgress(prog);
      });

      setImage(url);
      setFeedback({ type: 'success', text: 'Banner image uploaded and ready!' });
    } catch (err: any) {
      console.warn('Banner upload error:', err);
      setFeedback({ type: 'error', text: 'Image upload failed. You can also paste an image URL directly.' });
    } finally {
      setUploadingImage(false);
      setUploadProgress(null);
    }
  };

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!title.trim()) {
      setFeedback({ type: 'error', text: 'Banner title is required.' });
      return;
    }

    if (!image.trim()) {
      setFeedback({ type: 'error', text: 'Please upload an image or provide an image URL for the banner.' });
      return;
    }

    setSaving(true);
    setFeedback(null);

    try {
      const payload: Partial<Banner> = {
        title: title.trim(),
        subtitle: subtitle.trim(),
        tagline: tagline.trim(),
        buttonText: buttonText.trim(),
        buttonLink: buttonLink.trim() || '/shop',
        image: image.trim(),
        active,
        sortOrder: Number(sortOrder)
      };

      await saveBanner(payload, editingBanner?.id);

      await logAdminAction(
        editingBanner ? 'BANNER_UPDATED' : 'BANNER_CREATED',
        title.trim(),
        `Link: ${buttonLink}`,
        currentUser?.uid,
        currentUser?.email || undefined
      );

      await loadData();
      setIsModalOpen(false);
    } catch (err: any) {
      console.error('Error saving banner:', err);
      setFeedback({ type: 'error', text: err.message || 'Failed to save banner to database.' });
    } finally {
      setSaving(false);
    }
  };

  const handleOpenDelete = (b: Banner) => {
    setDeleteTarget(b);
  };

  const handleConfirmDelete = async () => {
    if (!deleteTarget) return;
    setDeleting(true);
    try {
      const idToDelete = deleteTarget.id;
      await deleteBanner(idToDelete);
      setBanners((prev) => prev.filter((b) => b.id !== idToDelete));
      await logAdminAction(
        'BANNER_DELETED',
        deleteTarget.title,
        `Banner ID: ${idToDelete}`,
        currentUser?.uid,
        currentUser?.email || undefined
      );
      setDeleteTarget(null);
    } catch (err: any) {
      console.error('Error deleting banner:', err);
    } finally {
      setDeleting(false);
    }
  };

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-black text-[#1A1E1C]">Homepage Hero Banners</h1>
          <p className="text-xs text-[#626C66] mt-0.5">
            Configure promotional sliders and marketplace campaigns for the storefront.
          </p>
        </div>

        <button
          onClick={openCreateModal}
          className="inline-flex items-center gap-2 px-4 py-2.5 bg-[#1E3A2F] hover:bg-[#162B23] text-white rounded-xl text-xs font-bold transition-all shadow-md cursor-pointer"
        >
          <Plus className="w-4 h-4" />
          <span>Add Hero Banner</span>
        </button>
      </div>

      {loading ? (
        <TableSkeleton rows={2} />
      ) : banners.length > 0 ? (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          {banners.map((b) => (
            <div
              key={b.id}
              className="bg-white border border-[#E5DFD7] rounded-2xl overflow-hidden shadow-xs flex flex-col justify-between"
            >
              <div className="aspect-[16/7] bg-[#FAF8F5] relative overflow-hidden">
                {b.image ? (
                  <img src={b.image} alt={b.title} className="w-full h-full object-cover" />
                ) : (
                  <div className="w-full h-full flex items-center justify-center text-stone-400">
                    <ImageIcon className="w-8 h-8" />
                  </div>
                )}
                <span
                  className={`absolute top-3 left-3 px-2.5 py-0.5 rounded text-[10px] font-bold uppercase tracking-wider ${
                    b.active
                      ? 'bg-[#1E3A2F] text-white shadow-xs'
                      : 'bg-stone-800 text-stone-300'
                  }`}
                >
                  {b.active ? 'Active' : 'Draft'}
                </span>
              </div>

              <div className="p-5 space-y-3">
                <div>
                  <span className="text-[10px] font-bold uppercase tracking-wider text-[#C85A32]">
                    {b.tagline || 'Campaign'}
                  </span>
                  <h3 className="text-base font-extrabold text-[#1A1E1C]">{b.title}</h3>
                  <p className="text-xs text-[#626C66] line-clamp-2 mt-0.5">{b.subtitle}</p>
                </div>

                <div className="flex items-center justify-between pt-3 border-t border-[#EFEBE5] text-xs">
                  <span className="text-[#626C66]">
                    Button: <strong>{b.buttonText}</strong> → <span className="font-mono">{b.buttonLink}</span>
                  </span>

                  <div className="flex items-center gap-2">
                    <button
                      onClick={() => openEditModal(b)}
                      className="p-1.5 text-stone-600 hover:text-[#1E3A2F] hover:bg-stone-100 rounded-lg cursor-pointer"
                      title="Edit banner"
                    >
                      <Edit className="w-4 h-4" />
                    </button>
                    <button
                      onClick={() => handleOpenDelete(b)}
                      className="p-1.5 text-stone-400 hover:text-red-600 hover:bg-red-50 rounded-lg cursor-pointer transition-colors"
                      title="Delete banner"
                    >
                      <Trash2 className="w-4 h-4" />
                    </button>
                  </div>
                </div>
              </div>
            </div>
          ))}
        </div>
      ) : (
        <div className="bg-white border border-[#E5DFD7] rounded-2xl p-10 text-center space-y-3">
          <ImageIcon className="w-8 h-8 text-stone-400 mx-auto" />
          <h3 className="font-bold text-base text-[#1A1E1C]">No Custom Banners Yet</h3>
          <p className="text-xs text-[#626C66] max-w-sm mx-auto">
            The homepage currently uses the clean official brand hero. Create custom banners here anytime.
          </p>
          <button
            onClick={openCreateModal}
            className="inline-flex items-center gap-1.5 px-4 py-2 bg-[#1E3A2F] text-white rounded-xl text-xs font-bold"
          >
            <Plus className="w-3.5 h-3.5" />
            <span>Create First Banner</span>
          </button>
        </div>
      )}

      {/* Banner Modal */}
      {isModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-xs">
          <div className="bg-white rounded-3xl max-w-lg w-full p-6 sm:p-8 shadow-2xl border border-[#E5DFD7] space-y-4 max-h-[90vh] overflow-y-auto">
            <h3 className="text-lg font-black text-[#1A1E1C]">
              {editingBanner ? 'Edit Banner' : 'Create Banner'}
            </h3>

            {feedback && (
              <div
                className={`p-3 rounded-xl text-xs flex items-center gap-2 ${
                  feedback.type === 'error'
                    ? 'bg-red-50 border border-red-200 text-red-700'
                    : 'bg-emerald-50 border border-emerald-200 text-emerald-800'
                }`}
              >
                {feedback.type === 'error' ? (
                  <AlertCircle className="w-4 h-4 shrink-0" />
                ) : (
                  <Check className="w-4 h-4 shrink-0" />
                )}
                <span>{feedback.text}</span>
              </div>
            )}

            <form onSubmit={handleSave} className="space-y-4">
              <div>
                <label className="text-xs font-bold text-[#1A1E1C] block mb-1">
                  Banner Title <span className="text-red-500">*</span>
                </label>
                <input
                  type="text"
                  placeholder="e.g. Mega Electronics & Lifestyle Sale"
                  value={title}
                  onChange={(e) => setTitle(e.target.value)}
                  className="w-full bg-[#FAF8F5] border border-[#E5DFD7] rounded-xl p-3 text-xs text-[#1A1E1C] focus:outline-hidden focus:border-[#1E3A2F]"
                  required
                />
              </div>

              <div>
                <label className="text-xs font-bold text-[#1A1E1C] block mb-1">Tagline Pill</label>
                <input
                  type="text"
                  placeholder="e.g. UP TO 50% OFF"
                  value={tagline}
                  onChange={(e) => setTagline(e.target.value)}
                  className="w-full bg-[#FAF8F5] border border-[#E5DFD7] rounded-xl p-3 text-xs text-[#1A1E1C]"
                />
              </div>

              <div>
                <label className="text-xs font-bold text-[#1A1E1C] block mb-1">Subtitle</label>
                <textarea
                  rows={2}
                  placeholder="Explore top gadgets, clothing, decor and everyday essentials with cash on delivery..."
                  value={subtitle}
                  onChange={(e) => setSubtitle(e.target.value)}
                  className="w-full bg-[#FAF8F5] border border-[#E5DFD7] rounded-xl p-3 text-xs text-[#1A1E1C]"
                />
              </div>

              {/* Banner Image with live preview */}
              <div>
                <label className="text-xs font-bold text-[#1A1E1C] block mb-1">
                  Banner Image <span className="text-red-500">*</span>
                </label>

                {image ? (
                  <div className="relative aspect-[16/7] rounded-xl overflow-hidden border border-[#E5DFD7] mb-2 bg-[#FAF8F5]">
                    <img src={image} alt="Banner Preview" className="w-full h-full object-cover" />
                    <button
                      type="button"
                      onClick={() => setImage('')}
                      className="absolute top-2 right-2 p-1.5 bg-red-600 text-white rounded-lg text-xs font-bold shadow-md hover:bg-red-700"
                      title="Remove image"
                    >
                      <Trash2 className="w-3.5 h-3.5" />
                    </button>
                  </div>
                ) : null}

                <div className="flex gap-2">
                  <input
                    type="url"
                    placeholder="Paste image URL or click button to upload file"
                    value={image}
                    onChange={(e) => setImage(e.target.value)}
                    className="flex-1 bg-[#FAF8F5] border border-[#E5DFD7] rounded-xl p-2.5 text-xs text-[#1A1E1C]"
                  />
                  <label className="px-3.5 py-2.5 bg-[#1E3A2F] text-white hover:bg-[#162B23] rounded-xl cursor-pointer flex items-center gap-1.5 text-xs font-bold transition-colors">
                    {uploadingImage ? (
                      <Loader2 className="w-4 h-4 animate-spin" />
                    ) : (
                      <Upload className="w-4 h-4" />
                    )}
                    <span>{uploadingImage ? `${uploadProgress || 50}%` : 'Upload'}</span>
                    <input
                      type="file"
                      accept="image/*"
                      onChange={handleImageUpload}
                      disabled={uploadingImage}
                      className="hidden"
                    />
                  </label>
                </div>

                {/* Banner Presets */}
                <div className="mt-2 flex flex-wrap items-center gap-1.5">
                  <span className="text-[10px] text-[#626C66] font-semibold">Recommended Presets:</span>
                  {[
                    { label: 'Marketplace Hero', url: 'https://images.unsplash.com/photo-1441986300917-64674bd600d8?auto=format&fit=crop&w=1200&q=80' },
                    { label: 'Fashion Trend', url: 'https://images.unsplash.com/photo-1483985988355-763728e1935b?auto=format&fit=crop&w=1200&q=80' },
                    { label: 'Electronics & Audio', url: 'https://images.unsplash.com/photo-1550009158-9ebf69173e03?auto=format&fit=crop&w=1200&q=80' },
                    { label: 'Smart Gadgets', url: 'https://images.unsplash.com/photo-1519389950473-47ba0277781c?auto=format&fit=crop&w=1200&q=80' },
                    { label: 'Footwear & Streetwear', url: 'https://images.unsplash.com/photo-1552346154-21d32810aba3?auto=format&fit=crop&w=1200&q=80' }
                  ].map((preset, idx) => (
                    <button
                      key={idx}
                      type="button"
                      onClick={() => setImage(preset.url)}
                      className="px-2 py-0.5 rounded bg-stone-100 hover:bg-[#1E3A2F] hover:text-white text-[10px] text-[#1A1E1C] transition-colors cursor-pointer"
                    >
                      {preset.label}
                    </button>
                  ))}
                </div>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="text-xs font-bold text-[#1A1E1C] block mb-1">Button Text</label>
                  <input
                    type="text"
                    value={buttonText}
                    onChange={(e) => setButtonText(e.target.value)}
                    className="w-full bg-[#FAF8F5] border border-[#E5DFD7] rounded-xl p-2.5 text-xs text-[#1A1E1C]"
                  />
                </div>

                <div>
                  <label className="text-xs font-bold text-[#1A1E1C] block mb-1">Button Target Link</label>
                  <input
                    type="text"
                    placeholder="/shop or /category/electronics"
                    value={buttonLink}
                    onChange={(e) => setButtonLink(e.target.value)}
                    className="w-full bg-[#FAF8F5] border border-[#E5DFD7] rounded-xl p-2.5 text-xs text-[#1A1E1C]"
                  />
                </div>
              </div>

              <div>
                <label className="text-xs font-bold text-[#1A1E1C] block mb-1">Sort Order</label>
                <input
                  type="number"
                  min="1"
                  value={sortOrder}
                  onChange={(e) => setSortOrder(Number(e.target.value))}
                  className="w-full bg-[#FAF8F5] border border-[#E5DFD7] rounded-xl p-2.5 text-xs text-[#1A1E1C]"
                />
              </div>

              <label className="flex items-center gap-2 cursor-pointer text-xs font-bold text-[#1A1E1C]">
                <input
                  type="checkbox"
                  checked={active}
                  onChange={(e) => setActive(e.target.checked)}
                  className="w-4 h-4 text-[#1E3A2F] rounded accent-[#1E3A2F]"
                />
                <span>Active on homepage</span>
              </label>

              <div className="flex gap-2 pt-2">
                <button
                  type="button"
                  onClick={() => setIsModalOpen(false)}
                  className="flex-1 py-3 bg-[#FAF8F5] border border-[#E5DFD7] text-[#1A1E1C] rounded-xl text-xs font-bold cursor-pointer"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={saving || uploadingImage}
                  className="flex-1 py-3 bg-[#1E3A2F] hover:bg-[#162B23] text-white rounded-xl text-xs font-bold disabled:opacity-50 cursor-pointer shadow-md"
                >
                  {saving ? 'Saving...' : 'Save Banner'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Confirm Delete Modal */}
      <ConfirmDeleteModal
        isOpen={!!deleteTarget}
        title="Delete Hero Banner?"
        itemName={deleteTarget?.title}
        message="Are you sure you want to permanently remove this banner? It will be removed immediately from the storefront hero slider."
        confirmLabel="Confirm Delete"
        loading={deleting}
        onConfirm={handleConfirmDelete}
        onCancel={() => setDeleteTarget(null)}
      />
    </div>
  );
};

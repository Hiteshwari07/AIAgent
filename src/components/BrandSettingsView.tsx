import React, { useState } from 'react';
import { CompanyBrandProfile, PosterLanguage } from '../types';
import { Save, Upload, Check, Trash2 } from 'lucide-react';

interface BrandSettingsViewProps {
  brandProfile: CompanyBrandProfile;
  onSaveBrand: (profile: CompanyBrandProfile) => Promise<void>;
}

export const BrandSettingsView: React.FC<BrandSettingsViewProps> = ({
  brandProfile,
  onSaveBrand,
}) => {
  const [form, setForm] = useState<CompanyBrandProfile>(brandProfile);
  const [saving, setSaving] = useState(false);
  const [savedNotice, setSavedNotice] = useState(false);

  const handleLogoUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = (ev) => {
      if (typeof ev.target?.result === 'string') {
        setForm((prev) => ({ ...prev, logoDataUrl: ev.target!.result as string }));
      }
    };
    reader.readAsDataURL(file);
  };

  const handleSave = async () => {
    setSaving(true);
    setSavedNotice(false);
    try {
      await onSaveBrand(form);
      setSavedNotice(true);
      setTimeout(() => setSavedNotice(false), 3000);
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="max-w-3xl mx-auto space-y-6">
      <div>
        <h2 className="text-xl font-bold font-display text-white tracking-tight">
          Company Brand Settings
        </h2>
        <p className="text-sm text-slate-400 mt-1">
          Brand identity saved here is automatically applied to newly generated posters. Empty fields are never invented or fabricated on designs.
        </p>
      </div>

      <div className="bg-[#111827] border border-slate-800 rounded-xl p-6 space-y-5">
        {/* Logo Row */}
        <div className="flex flex-wrap items-center justify-between gap-4 pb-5 border-b border-slate-800">
          <div className="flex items-center gap-4">
            <div className="w-16 h-16 rounded-xl bg-[#0B0F19] border border-slate-800 flex items-center justify-center overflow-hidden p-2">
              {form.logoDataUrl ? (
                <img src={form.logoDataUrl} alt="Company Logo" className="max-w-full max-h-full object-contain" />
              ) : (
                <span className="text-[11px] text-slate-500 font-mono-tabular">NO LOGO</span>
              )}
            </div>
            <div>
              <div className="text-sm font-semibold text-white">Company Logo</div>
              <div className="text-xs text-slate-400">PNG or SVG with transparent background works best.</div>
            </div>
          </div>

          <div className="flex items-center gap-2">
            {form.logoDataUrl && (
              <button
                type="button"
                onClick={() => setForm((p) => ({ ...p, logoDataUrl: '' }))}
                className="flex items-center gap-1 px-3 py-1.5 rounded-lg bg-slate-800 hover:bg-slate-700 text-rose-300 text-xs transition"
              >
                <Trash2 className="w-3.5 h-3.5" />
                <span>Remove</span>
              </button>
            )}
            <label className="flex items-center gap-1.5 px-3.5 py-2 rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-100 text-xs font-semibold cursor-pointer transition">
              <Upload className="w-3.5 h-3.5 text-amber-400" />
              <span>Upload Logo</span>
              <input type="file" accept="image/*" onChange={handleLogoUpload} className="hidden" />
            </label>
          </div>
        </div>

        {/* Core Identity */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <div>
            <label className="text-xs font-semibold text-slate-300 block mb-1">Company Name</label>
            <input
              type="text"
              value={form.companyName}
              onChange={(e) => setForm({ ...form, companyName: e.target.value })}
              placeholder="e.g. Apex Digital Solutions Pvt. Ltd."
              className="w-full bg-[#0B0F19] border border-slate-800 rounded-lg px-3 py-2 text-sm text-white focus:outline-none focus:border-amber-500"
            />
          </div>
          <div>
            <label className="text-xs font-semibold text-slate-300 block mb-1">Company Tagline</label>
            <input
              type="text"
              value={form.tagline}
              onChange={(e) => setForm({ ...form, tagline: e.target.value })}
              placeholder="e.g. Engineering Scalable Cloud Systems"
              className="w-full bg-[#0B0F19] border border-slate-800 rounded-lg px-3 py-2 text-sm text-white focus:outline-none focus:border-amber-500"
            />
          </div>
          <div>
            <label className="text-xs font-semibold text-slate-300 block mb-1">Website</label>
            <input
              type="text"
              value={form.website}
              onChange={(e) => setForm({ ...form, website: e.target.value })}
              placeholder="e.g. https://yourcompany.com"
              className="w-full bg-[#0B0F19] border border-slate-800 rounded-lg px-3 py-2 text-sm text-white focus:outline-none focus:border-amber-500"
            />
          </div>
          <div>
            <label className="text-xs font-semibold text-slate-300 block mb-1">Business Email</label>
            <input
              type="email"
              value={form.email}
              onChange={(e) => setForm({ ...form, email: e.target.value })}
              placeholder="e.g. hello@yourcompany.com"
              className="w-full bg-[#0B0F19] border border-slate-800 rounded-lg px-3 py-2 text-sm text-white focus:outline-none focus:border-amber-500"
            />
          </div>
          <div>
            <label className="text-xs font-semibold text-slate-300 block mb-1">Phone Number</label>
            <input
              type="text"
              value={form.phone}
              onChange={(e) => setForm({ ...form, phone: e.target.value })}
              placeholder="Optional contact phone"
              className="w-full bg-[#0B0F19] border border-slate-800 rounded-lg px-3 py-2 text-sm text-white focus:outline-none focus:border-amber-500"
            />
          </div>
          <div>
            <label className="text-xs font-semibold text-slate-300 block mb-1">Office Address</label>
            <input
              type="text"
              value={form.address}
              onChange={(e) => setForm({ ...form, address: e.target.value })}
              placeholder="Optional city or studio address"
              className="w-full bg-[#0B0F19] border border-slate-800 rounded-lg px-3 py-2 text-sm text-white focus:outline-none focus:border-amber-500"
            />
          </div>
        </div>

        {/* Palette & Default Language */}
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-4 pt-2 border-t border-slate-800">
          <div>
            <label className="text-xs font-semibold text-slate-300 block mb-1">Primary Accent</label>
            <div className="flex items-center gap-2 bg-[#0B0F19] border border-slate-800 rounded-lg px-2.5 py-1.5">
              <input
                type="color"
                value={form.primaryColor}
                onChange={(e) => setForm({ ...form, primaryColor: e.target.value })}
                className="w-6 h-6 bg-transparent border-0 cursor-pointer"
              />
              <span className="text-xs font-mono-tabular text-slate-300">{form.primaryColor}</span>
            </div>
          </div>
          <div>
            <label className="text-xs font-semibold text-slate-300 block mb-1">Base Surface</label>
            <div className="flex items-center gap-2 bg-[#0B0F19] border border-slate-800 rounded-lg px-2.5 py-1.5">
              <input
                type="color"
                value={form.secondaryColor}
                onChange={(e) => setForm({ ...form, secondaryColor: e.target.value })}
                className="w-6 h-6 bg-transparent border-0 cursor-pointer"
              />
              <span className="text-xs font-mono-tabular text-slate-300">{form.secondaryColor}</span>
            </div>
          </div>
          <div>
            <label className="text-xs font-semibold text-slate-300 block mb-1">Highlight Tint</label>
            <div className="flex items-center gap-2 bg-[#0B0F19] border border-slate-800 rounded-lg px-2.5 py-1.5">
              <input
                type="color"
                value={form.accentColor}
                onChange={(e) => setForm({ ...form, accentColor: e.target.value })}
                className="w-6 h-6 bg-transparent border-0 cursor-pointer"
              />
              <span className="text-xs font-mono-tabular text-slate-300">{form.accentColor}</span>
            </div>
          </div>
          <div>
            <label className="text-xs font-semibold text-slate-300 block mb-1">Default Language</label>
            <select
              value={form.defaultLanguage}
              onChange={(e) => setForm({ ...form, defaultLanguage: e.target.value as PosterLanguage })}
              className="w-full bg-[#0B0F19] border border-slate-800 rounded-lg px-2.5 py-2 text-xs text-white focus:outline-none focus:border-amber-500"
            >
              <option value="english">English</option>
              <option value="hindi">Hindi</option>
              <option value="gujarati">Gujarati</option>
            </select>
          </div>
        </div>

        <div className="flex items-center justify-between pt-2">
          <div className="text-xs text-emerald-400 flex items-center gap-1.5">
            {savedNotice && (
              <>
                <Check className="w-4 h-4" />
                <span>Brand profile saved and active for new posters.</span>
              </>
            )}
          </div>
          <button
            type="button"
            onClick={handleSave}
            disabled={saving}
            className="flex items-center gap-2 px-5 py-2 rounded-lg bg-amber-500 hover:bg-amber-400 text-slate-950 font-bold text-xs transition disabled:opacity-50"
          >
            <Save className="w-3.5 h-3.5" />
            <span>{saving ? 'Saving...' : 'Save Brand Profile'}</span>
          </button>
        </div>
      </div>
    </div>
  );
};

import React from 'react';
import { CATEGORY_CATALOG, TEST_SHOWCASES } from '../presets';
import { PosterCategory, PosterConfig } from '../types';
import { ArrowRight, Sparkles } from 'lucide-react';

interface CategoryGalleryViewProps {
  category: PosterCategory;
  onStartSubCategory: (category: PosterCategory, subCategory: string) => void;
  onLoadShowcase: (poster: PosterConfig) => void;
}

export const CategoryGalleryView: React.FC<CategoryGalleryViewProps> = ({
  category,
  onStartSubCategory,
  onLoadShowcase,
}) => {
  const entry = CATEGORY_CATALOG.find((c) => c.category === category) || CATEGORY_CATALOG[0];
  const matchingShowcases = TEST_SHOWCASES.filter((p) => p.category === category);

  return (
    <div className="max-w-5xl mx-auto space-y-6">
      <div className="flex flex-wrap items-end justify-between gap-4 border-b border-slate-800 pb-4">
        <div>
          <h2 className="text-xl font-bold font-display text-white tracking-tight">
            {entry.label} Posters
          </h2>
          <p className="text-sm text-slate-400 mt-1">{entry.description}</p>
        </div>
        <button
          type="button"
          onClick={() => onStartSubCategory(category, entry.subCategories[0])}
          className="flex items-center gap-2 px-4 py-2 rounded-lg bg-amber-500 hover:bg-amber-400 text-slate-950 font-bold text-xs transition"
        >
          <Sparkles className="w-3.5 h-3.5" />
          <span>Custom {entry.label} Brief</span>
        </button>
      </div>

      {/* Sub-Category Starters */}
      <div>
        <div className="text-xs font-semibold uppercase tracking-wider text-slate-400 mb-3">
          Select Sub-Category Template Brief ({entry.subCategories.length})
        </div>
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
          {entry.subCategories.map((sub, idx) => (
            <button
              key={sub}
              type="button"
              onClick={() => onStartSubCategory(category, sub)}
              className="group p-4 rounded-xl bg-[#111827] border border-slate-800 hover:border-amber-500/60 text-left transition flex items-center justify-between gap-3"
            >
              <div>
                <div className="text-[11px] font-mono-tabular text-slate-500">
                  {String(idx + 1).padStart(2, '0')} · {entry.label}
                </div>
                <div className="text-sm font-semibold text-slate-100 mt-1 group-hover:text-amber-300 transition">
                  {sub}
                </div>
              </div>
              <ArrowRight className="w-4 h-4 text-slate-500 group-hover:text-amber-400 shrink-0 transition" />
            </button>
          ))}
        </div>
      </div>

      {/* Pre-built Live Studio Presets for this Category */}
      {matchingShowcases.length > 0 && (
        <div className="pt-2">
          <div className="text-xs font-semibold uppercase tracking-wider text-slate-400 mb-3">
            Ready-to-Edit Studio Presets
          </div>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {matchingShowcases.map((preset) => (
              <div
                key={preset.id}
                className="p-4 rounded-xl bg-[#111827] border border-slate-800 flex items-center justify-between gap-4"
              >
                <div>
                  <div className="text-sm font-bold text-white">{preset.title}</div>
                  <div className="text-xs text-slate-400 mt-1 font-mono-tabular">
                    {preset.subCategory} · {preset.language?.toUpperCase()} · {preset.aspectRatio}
                  </div>
                </div>
                <button
                  type="button"
                  onClick={() => onLoadShowcase(preset)}
                  className="px-3.5 py-2 rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-100 text-xs font-semibold transition shrink-0"
                >
                  Open in Studio
                </button>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
};

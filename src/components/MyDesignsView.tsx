import React, { useState } from 'react';
import { PosterConfig, SavedDesignItem } from '../types';
import { Trash2, Send, FolderOpen, Search } from 'lucide-react';

interface MyDesignsViewProps {
  designs: SavedDesignItem[];
  onLoadDesign: (poster: PosterConfig) => void;
  onPublishDesign: (poster: PosterConfig) => void;
  onDeleteDesign: (id: string) => Promise<void>;
}

export const MyDesignsView: React.FC<MyDesignsViewProps> = ({
  designs,
  onLoadDesign,
  onPublishDesign,
  onDeleteDesign,
}) => {
  const [query, setQuery] = useState('');

  const filtered = designs.filter((d) => {
    const q = query.trim().toLowerCase();
    if (!q) return true;
    return (
      d.name.toLowerCase().includes(q) ||
      d.subCategory.toLowerCase().includes(q) ||
      d.category.toLowerCase().includes(q)
    );
  });

  return (
    <div className="max-w-5xl mx-auto space-y-5">
      <div className="flex flex-wrap items-end justify-between gap-4 border-b border-slate-800 pb-4">
        <div>
          <h2 className="text-xl font-bold font-display text-white tracking-tight">My Saved Designs</h2>
          <p className="text-sm text-slate-400 mt-1">
            Re-open any saved corporate, tech, marketing, or festive artwork in the Studio Editor or publish directly to social channels.
          </p>
        </div>

        <div className="relative w-64">
          <Search className="w-4 h-4 text-slate-500 absolute left-3 top-1/2 -translate-y-1/2" />
          <input
            type="text"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Filter saved posters..."
            className="w-full bg-[#111827] border border-slate-800 rounded-lg pl-9 pr-3 py-2 text-xs text-white focus:outline-none focus:border-amber-500"
          />
        </div>
      </div>

      {filtered.length === 0 ? (
        <div className="bg-[#111827] border border-slate-800 rounded-xl p-10 text-center space-y-2">
          <div className="text-sm font-semibold text-slate-300">No saved posters found</div>
          <p className="text-xs text-slate-500">
            Click &ldquo;Save to My Designs&rdquo; below the Canvas Studio to store campaigns here for quick reuse.
          </p>
        </div>
      ) : (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
          {filtered.map((item) => {
            const bgVar =
              item.poster.backgroundImages[item.poster.activeVariationIndex] ||
              item.poster.backgroundImages[0];
            return (
              <div
                key={item.id}
                className="bg-[#111827] border border-slate-800 rounded-xl overflow-hidden flex flex-col"
              >
                <div className="relative h-40 bg-slate-950 overflow-hidden border-b border-slate-800">
                  {bgVar?.imageUrl && (
                    <img
                      src={bgVar.imageUrl}
                      alt={item.name}
                      className="w-full h-full object-cover opacity-75"
                      referrerPolicy="no-referrer"
                    />
                  )}
                  <div className="absolute inset-0 bg-gradient-to-t from-slate-950 via-slate-950/40 to-transparent p-3 flex flex-col justify-end">
                    <div className="text-[10px] font-mono-tabular text-amber-400 uppercase">
                      {item.subCategory} · {item.language} · {item.poster.aspectRatio}
                    </div>
                    <div className="text-sm font-bold text-white line-clamp-1">
                      {item.poster.headline.text}
                    </div>
                  </div>
                </div>

                <div className="p-3.5 space-y-3 flex-1 flex flex-col justify-between">
                  <div>
                    <div className="text-xs font-semibold text-slate-200 truncate">{item.name}</div>
                    <div className="text-[11px] font-mono-tabular text-slate-500 mt-0.5">
                      Saved {item.savedAt.slice(0, 10)}
                    </div>
                  </div>

                  <div className="flex items-center gap-2">
                    <button
                      type="button"
                      onClick={() => onLoadDesign(item.poster)}
                      className="flex-1 flex items-center justify-center gap-1.5 py-1.5 rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-100 text-xs font-semibold transition"
                    >
                      <FolderOpen className="w-3.5 h-3.5 text-amber-400" />
                      <span>Open</span>
                    </button>
                    <button
                      type="button"
                      onClick={() => onPublishDesign(item.poster)}
                      className="flex-1 flex items-center justify-center gap-1.5 py-1.5 rounded-lg bg-amber-500 hover:bg-amber-400 text-slate-950 text-xs font-bold transition"
                    >
                      <Send className="w-3.5 h-3.5" />
                      <span>Publish</span>
                    </button>
                    <button
                      type="button"
                      onClick={() => onDeleteDesign(item.id)}
                      className="p-1.5 rounded-lg bg-slate-900 hover:bg-rose-950/60 text-slate-400 hover:text-rose-400 border border-slate-800 transition"
                      title="Delete Design"
                    >
                      <Trash2 className="w-3.5 h-3.5" />
                    </button>
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
};

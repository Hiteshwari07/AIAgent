import React from 'react';
import { PosterConfig, SceneVariation } from '../types';
import { CheckCircle2, AlertCircle, RefreshCw, Sparkles } from 'lucide-react';
import { buildOverlayPatternSvgUrl, resolvePosterDesignTheme } from '../utils/posterDesignSystem';

interface SideBySidePickerProps {
  poster: PosterConfig;
  onSelectVariation: (index: number) => void;
  onRegenerateAll: () => void;
  isGenerating: boolean;
}

export const SideBySidePicker: React.FC<SideBySidePickerProps> = ({
  poster,
  onSelectVariation,
  onRegenerateAll,
  isGenerating,
}) => {
  return (
    <div className="w-full bg-[#111827] border border-slate-800 rounded-xl p-3.5">
      <div className="flex items-center justify-between mb-3 px-1">
        <div className="flex items-center gap-2">
          <Sparkles className="w-4 h-4 text-amber-400" />
          <h2 className="text-sm font-bold font-display text-white tracking-tight">
            3 Creative Concept Variations
          </h2>
        </div>

        <button
          type="button"
          onClick={onRegenerateAll}
          disabled={isGenerating}
          className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-200 text-xs font-semibold border border-slate-700 disabled:opacity-50 transition"
        >
          <RefreshCw className={`w-3.5 h-3.5 text-amber-400 ${isGenerating ? 'animate-spin' : ''}`} />
          <span>{isGenerating ? 'Generating 3 Concepts...' : 'Regenerate 3 Concepts'}</span>
        </button>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
        {poster.backgroundImages.map((sceneVar: SceneVariation, index: number) => {
          const isSelected = poster.activeVariationIndex === index;
          const layout = sceneVar.layoutStyle || poster.layoutStyle || 'centered_editorial';
          const layoutLabel = layout.replace('_', ' ');
          const cardTheme = resolvePosterDesignTheme(poster, index);
          const cardPatternUrl = buildOverlayPatternSvgUrl(cardTheme, index);
          const isProcedural = (sceneVar.imageUrl || '').startsWith('data:image/svg+xml');

          return (
            <button
              key={sceneVar.id || index}
              type="button"
              onClick={() => onSelectVariation(index)}
              className={`group relative rounded-lg border overflow-hidden cursor-pointer transition-all flex flex-col bg-[#0B0F19] text-left ${
                isSelected
                  ? 'border-amber-500 ring-1 ring-amber-500/40'
                  : 'border-slate-800 hover:border-slate-600'
              }`}
            >
              <div
                className="relative h-32 w-full overflow-hidden"
                style={{
                  background: `linear-gradient(145deg, ${cardTheme.secondary} 0%, ${cardTheme.surfaceDeep} 100%)`,
                }}
              >
                {sceneVar.imageUrl && (
                  <img
                    src={sceneVar.imageUrl}
                    alt={sceneVar.conceptTitle || `Concept ${index + 1}`}
                    className="w-full h-full object-cover transition-transform duration-300 group-hover:scale-105"
                    style={{ opacity: isProcedural ? 0.9 : 0.34 }}
                    referrerPolicy="no-referrer"
                  />
                )}
                <div
                  className="absolute inset-0 pointer-events-none"
                  style={{
                    background: `radial-gradient(circle at 80% 25%, ${cardTheme.accent}35, ${cardTheme.secondary}AA 82%)`,
                  }}
                />
                <img
                  src={cardPatternUrl}
                  alt=""
                  aria-hidden="true"
                  className="absolute inset-0 w-full h-full object-cover pointer-events-none opacity-95"
                />

                <div
                  className={`absolute inset-0 flex flex-col justify-between p-3 pointer-events-none ${
                    layout === 'executive_left'
                      ? 'items-start text-left border-l-[3px]'
                      : layout === 'split_frame'
                      ? 'items-start text-left justify-end'
                      : 'items-center text-center'
                  }`}
                  style={
                    layout === 'executive_left'
                      ? { borderColor: cardTheme.primary }
                      : undefined
                  }
                >
                  <div className="flex items-center gap-1.5">
                    <span
                      className="w-2.5 h-2.5 rounded-xs border border-white/25"
                      style={{ backgroundColor: cardTheme.primary }}
                    />
                    <span
                      className="w-2 h-2 rounded-full"
                      style={{ backgroundColor: cardTheme.accent }}
                    />
                    <span className="text-[10px] font-mono-tabular uppercase text-slate-200 drop-shadow">
                      {layout === 'split_frame' ? 'Glass Panel' : layoutLabel}
                    </span>
                  </div>

                  <div
                    className={`text-xs font-extrabold text-white line-clamp-2 leading-tight drop-shadow ${
                      layout === 'split_frame'
                        ? 'w-full border rounded-md px-2 py-1.5'
                        : ''
                    }`}
                    style={
                      layout === 'split_frame'
                        ? {
                            backgroundColor: `${cardTheme.surfaceDeep}E6`,
                            borderColor: `${cardTheme.primary}55`,
                          }
                        : undefined
                    }
                  >
                    {sceneVar.headlineText || poster.headline.text}
                  </div>
                </div>
              </div>

              <div className="p-2.5 flex items-center justify-between gap-2 text-xs border-t border-slate-800/80 w-full">
                <div className="truncate">
                  <span className={`font-semibold ${isSelected ? 'text-amber-300' : 'text-slate-200'}`}>
                    {sceneVar.conceptTitle || `Concept ${String.fromCharCode(65 + index)}`}
                  </span>
                </div>

                <div className="flex items-center gap-1 text-[11px] font-mono-tabular shrink-0">
                  {sceneVar.qualityPassed ? (
                    <span className="flex items-center gap-1 text-emerald-400">
                      <CheckCircle2 className="w-3 h-3" />
                      <span>{isSelected ? 'Active' : 'Clean'}</span>
                    </span>
                  ) : (
                    <span className="flex items-center gap-1 text-amber-400">
                      <AlertCircle className="w-3 h-3" />
                      <span>Review</span>
                    </span>
                  )}
                </div>
              </div>
            </button>
          );
        })}
      </div>
    </div>
  );
};

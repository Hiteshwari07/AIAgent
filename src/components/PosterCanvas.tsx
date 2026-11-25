import React, { useMemo, useRef } from 'react';
import { PosterConfig } from '../types';
import { Eye, EyeOff, Download, Send, BookmarkPlus, ShieldCheck } from 'lucide-react';
import { buildOverlayPatternSvgUrl, resolvePosterDesignTheme } from '../utils/posterDesignSystem';

interface PosterCanvasProps {
  poster: PosterConfig;
  showSafeMargins: boolean;
  onToggleSafeMargins: () => void;
  onOpenPublish?: () => void;
  onOpenExport?: () => void;
  onSaveDesign?: () => void;
  onOpenQualityGate?: () => void;
  isSavingDesign?: boolean;
}

export const PosterCanvas: React.FC<PosterCanvasProps> = ({
  poster,
  showSafeMargins,
  onToggleSafeMargins,
  onOpenPublish,
  onOpenExport,
  onSaveDesign,
  onOpenQualityGate,
  isSavingDesign = false,
}) => {
  const containerRef = useRef<HTMLDivElement>(null);

  const activeVar = poster.backgroundImages[poster.activeVariationIndex] || poster.backgroundImages[0];
  const bgUrl = activeVar?.imageUrl || '';
  const isProceduralBg = bgUrl.startsWith('data:image/svg+xml');
  const layoutStyle = poster.layoutStyle || activeVar?.layoutStyle || 'centered_editorial';
  const designTheme = useMemo(() => resolvePosterDesignTheme(poster), [poster]);
  const patternSvgUrl = useMemo(
    () => buildOverlayPatternSvgUrl(designTheme, poster.activeVariationIndex || 0),
    [designTheme, poster.activeVariationIndex]
  );

  const primaryHex = designTheme.primary;
  const secondaryHex = designTheme.secondary;
  const accentHex = designTheme.accent;
  const deepHex = designTheme.surfaceDeep;

  const isExecutiveLeft = layoutStyle === 'executive_left';
  const isSplitFrame = layoutStyle === 'split_frame';
  const isCentered = layoutStyle === 'centered_editorial';
  const isLeftAligned = isExecutiveLeft || isSplitFrame;
  const isLandscape = poster.aspectRatio === '16:9';
  const isStory = poster.aspectRatio === '9:16';

  const isHiringPattern = designTheme.pattern === 'talent_matrix';
  const isOrbitPattern = designTheme.pattern === 'growth_orbit';
  const isTechPattern = designTheme.pattern === 'tech_circuit' || designTheme.pattern === 'neural_mesh';
  const isFestivePattern = designTheme.pattern === 'festive_mandala' || designTheme.pattern === 'celebration_crest';
  const isSpotlightPattern = designTheme.pattern === 'stage_spotlight';

  const aspectRatioClass =
    poster.aspectRatio === '9:16'
      ? 'aspect-[9/16] w-[330px]'
      : poster.aspectRatio === '4:5'
      ? 'aspect-[4/5] w-[420px]'
      : poster.aspectRatio === '16:9'
      ? 'aspect-[16/9] w-[540px]'
      : 'aspect-square w-[480px]';

  const getHeadlineGradientClass = (style: string) => {
    switch (style) {
      case 'silver':
        return 'text-silver-gradient drop-shadow-[0_4px_14px_rgba(0,0,0,0.92)]';
      case 'rose_gold':
        return 'text-rose-gold-gradient drop-shadow-[0_4px_14px_rgba(0,0,0,0.92)]';
      case 'emerald':
        return 'text-emerald-gradient drop-shadow-[0_4px_14px_rgba(0,0,0,0.92)]';
      case 'white':
        return 'text-white drop-shadow-[0_4px_14px_rgba(0,0,0,0.92)]';
      case 'gold':
      default:
        return 'text-gold-gradient drop-shadow-[0_4px_16px_rgba(0,0,0,0.95)]';
    }
  };

  const contactParts = [
    poster.companyInfo?.website,
    poster.companyInfo?.email,
    poster.companyInfo?.phone,
  ]
    .map((v) => (v || '').trim())
    .filter(Boolean);

  const showFooterBar = Boolean(
    poster.companyInfo?.showContactBar && (contactParts.length > 0 || poster.companyInfo?.tagline)
  );
  const highlights = Array.isArray(poster.highlights)
    ? poster.highlights.filter(Boolean).slice(0, isLandscape ? 2 : 4)
    : [];

  const isFestiveCategory =
    poster.category === 'festival' || poster.occasion === 'sale' || poster.occasion === 'diwali';
  const useScallopedSeal =
    poster.offerBadge.visible &&
    poster.offerBadge.style === 'scalloped_gold' &&
    isFestiveCategory &&
    !isExecutiveLeft &&
    !isSplitFrame &&
    !isLandscape;

  const scrimBackgroundImage = isExecutiveLeft
    ? `linear-gradient(108deg, ${secondaryHex}E8 0%, ${secondaryHex}C4 54%, ${deepHex}75 100%)`
    : isSplitFrame
    ? `linear-gradient(180deg, ${secondaryHex}7A 0%, ${secondaryHex}52 38%, ${deepHex}E8 100%)`
    : `radial-gradient(circle at 50% 42%, ${secondaryHex}44 0%, ${deepHex}E0 86%)`;

  const renderBadgeTag = () => {
    if (!poster.offerBadge.visible || !poster.offerBadge.text) return null;
    if (useScallopedSeal) {
      return (
        <div
          className="absolute z-20 select-none"
          style={{
            left: `${poster.offerBadge.x}%`,
            top: `${poster.offerBadge.y}%`,
            transform: `translate(-50%, -50%) rotate(${poster.offerBadge.rotation || 0}deg)`,
            width: `${92 * (poster.offerBadge.size || 1)}px`,
            height: `${92 * (poster.offerBadge.size || 1)}px`,
          }}
        >
          <svg viewBox="0 0 100 100" className="w-full h-full drop-shadow-[0_8px_20px_rgba(0,0,0,0.7)]">
            <defs>
              <linearGradient id="scallopGold" x1="0%" y1="0%" x2="100%" y2="100%">
                <stop offset="0%" stopColor="#FFF2B2" />
                <stop offset="50%" stopColor="#E6C260" />
                <stop offset="100%" stopColor="#B38612" />
              </linearGradient>
              <linearGradient id="scallopRed" x1="0%" y1="0%" x2="100%" y2="100%">
                <stop offset="0%" stopColor="#881337" />
                <stop offset="100%" stopColor="#26030D" />
              </linearGradient>
            </defs>
            <path
              d="M 50,0 C 53,7 62,5 68,10 C 74,15 72,24 79,28 C 86,32 93,28 97,36 C 101,44 95,50 97,58 C 99,66 92,72 87,78 C 82,84 80,93 72,96 C 64,99 58,93 50,100 C 42,93 36,99 28,96 C 20,93 18,84 13,78 C 8,72 1,66 3,58 C 5,50 -1,44 3,36 C 7,28 14,32 21,28 C 28,24 26,15 32,10 C 38,5 47,7 50,0 Z"
              fill="url(#scallopGold)"
            />
            <circle cx="50" cy="50" r="39" fill="url(#scallopRed)" stroke="url(#scallopGold)" strokeWidth="2" />
            <text
              x="50"
              y={poster.offerBadge.subtext ? '46' : '54'}
              fontFamily="'Montserrat', 'Noto Sans Devanagari', sans-serif"
              fontWeight="900"
              fontSize="15"
              fill="#FFF"
              textAnchor="middle"
            >
              {poster.offerBadge.text}
            </text>
            {poster.offerBadge.subtext && (
              <text
                x="50"
                y="63"
                fontFamily="'Noto Sans Devanagari', 'Montserrat', sans-serif"
                fontWeight="700"
                fontSize="8"
                fill="#FDE047"
                textAnchor="middle"
              >
                {poster.offerBadge.subtext}
              </text>
            )}
          </svg>
        </div>
      );
    }

    return (
      <div
        className="absolute z-30 top-[6%] right-[6.5%] px-3 py-1.5 rounded-md backdrop-blur-md border text-right select-none shadow-lg"
        style={{
          backgroundColor: `${deepHex}E6`,
          borderColor: `${primaryHex}88`,
        }}
      >
        <div className="text-[10px] font-black text-white tracking-[0.14em] uppercase leading-tight">
          {poster.offerBadge.text}
        </div>
        {poster.offerBadge.subtext && (
          <div
            className="text-[8px] font-bold uppercase tracking-[0.16em] mt-0.5 leading-tight"
            style={{ color: primaryHex }}
          >
            {poster.offerBadge.subtext}
          </div>
        )}
      </div>
    );
  };

  const renderCtaButton = (inline = false) => {
    if (!poster.ctaButton.visible || !poster.ctaButton.text) return null;
    const isGold = poster.ctaButton.style === 'gold_pill';
    const isGlass = poster.ctaButton.style === 'glass_border';
    const bgStyle =
      poster.ctaButton.style === 'solid_crimson'
        ? { background: 'linear-gradient(135deg, #E11D48, #BE123C)', color: '#FFFFFF' }
        : poster.ctaButton.style === 'emerald_luxury'
        ? { background: 'linear-gradient(135deg, #059669, #047857)', color: '#FFFFFF' }
        : poster.ctaButton.style === 'neon_accent'
        ? { background: `linear-gradient(135deg, ${accentHex}, ${primaryHex})`, color: '#06101E' }
        : isGlass
        ? { backgroundColor: `${deepHex}D9`, border: `1.5px solid ${primaryHex}`, color: '#FFFFFF' }
        : { backgroundColor: primaryHex, color: '#090D16' };

    return (
      <div
        className={`${
          inline ? 'mt-3.5' : `absolute z-20 ${isLeftAligned ? 'left-[6.5%]' : 'left-1/2 -translate-x-1/2'}`
        } select-none`}
        style={inline ? undefined : { top: `${Math.min(poster.ctaButton.yOffset, showFooterBar ? 82 : 88)}%` }}
      >
        <div
          className={`inline-flex items-center gap-2 px-5 py-2 font-extrabold uppercase tracking-[0.12em] text-[10.5px] shadow-xl ${
            isExecutiveLeft || isSplitFrame ? 'rounded-md' : 'rounded-full'
          }`}
          style={bgStyle}
        >
          <span>{poster.ctaButton.text}</span>
          <span aria-hidden="true" className="text-xs leading-none">
            →
          </span>
        </div>
      </div>
    );
  };

  const renderStructuredHighlights = (inCard = false) => {
    if (highlights.length === 0 || isLandscape) return null;

    if (inCard) {
      return (
        <div className="mt-3 grid grid-cols-1 sm:grid-cols-2 gap-2 pt-2.5 border-t border-white/12">
          {highlights.map((pt, idx) => (
            <div
              key={idx}
              className="flex items-center gap-2 px-2.5 py-1.5 rounded-md border text-[10px] font-semibold text-slate-100 leading-snug"
              style={{
                backgroundColor: `${secondaryHex}B5`,
                borderColor: `${accentHex}44`,
                borderLeftWidth: isTechPattern || isHiringPattern ? '3px' : '1px',
                borderLeftColor: idx % 2 === 0 ? primaryHex : accentHex,
              }}
            >
              {(isOrbitPattern || isHiringPattern) && (
                <span
                  className="text-[9px] font-mono-tabular font-black shrink-0"
                  style={{ color: primaryHex }}
                >
                  {String(idx + 1).padStart(2, '0')}
                </span>
              )}
              {!isOrbitPattern && !isHiringPattern && (
                <span
                  className="w-1.5 h-1.5 rounded-full shrink-0"
                  style={{ backgroundColor: accentHex }}
                />
              )}
              <span className="truncate">{pt}</span>
            </div>
          ))}
        </div>
      );
    }

    if (isExecutiveLeft) {
      return (
        <div className="mt-3.5 space-y-1.5 max-w-[96%]">
          {highlights.map((pt, idx) => (
            <div
              key={idx}
              className="flex items-center gap-2.5 px-3 py-1.5 rounded-md border backdrop-blur-sm text-[10.5px] font-semibold text-slate-100 shadow-sm"
              style={{
                backgroundColor: `${deepHex}BD`,
                borderColor: `${primaryHex}36`,
                borderLeftWidth: '3px',
                borderLeftColor: idx % 2 === 0 ? primaryHex : accentHex,
              }}
            >
              <span
                className="text-[9px] font-mono-tabular font-black shrink-0"
                style={{ color: accentHex }}
              >
                {isOrbitPattern || designTheme.pattern === 'executive_grid'
                  ? String(idx + 1).padStart(2, '0')
                  : '▸'}
              </span>
              <span className="leading-snug">{pt}</span>
            </div>
          ))}
        </div>
      );
    }

    // Centered editorial highlights as structured sleek pills
    return (
      <div className="mt-3 flex flex-wrap justify-center gap-1.5 max-w-[92%] mx-auto">
        {highlights.map((pt, idx) => (
          <div
            key={idx}
            className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full border backdrop-blur-sm text-[10px] font-semibold text-slate-100"
            style={{
              backgroundColor: `${deepHex}C4`,
              borderColor: `${primaryHex}48`,
            }}
          >
            <span
              className="w-1.5 h-1.5 rounded-full shrink-0"
              style={{ backgroundColor: idx % 2 === 0 ? primaryHex : accentHex }}
            />
            <span>{pt}</span>
          </div>
        ))}
      </div>
    );
  };

  const headlineFontSize = isLandscape
    ? `clamp(1.1rem, ${Math.min(poster.headline.size, 34) * 0.56}px, 1.8rem)`
    : isSplitFrame
    ? `clamp(1.15rem, ${poster.headline.size * 0.54}px, 1.95rem)`
    : `clamp(1.25rem, ${poster.headline.size * 0.6}px, 2.25rem)`;

  return (
    <div className="flex flex-col items-center justify-center relative w-full">
      {/* Top Studio Metadata Bar */}
      <div className="flex items-center justify-between w-full max-w-[540px] mb-2.5 px-1 text-xs text-slate-400">
        <div className="flex items-center gap-2 font-mono-tabular">
          <span className="font-semibold text-slate-200 capitalize">
            {poster.subCategory || poster.occasion.replace(/_/g, ' ')}
          </span>
          <span className="text-slate-600">·</span>
          <span>{poster.aspectRatio}</span>
          <span className="text-slate-600">·</span>
          <span className="text-amber-400 capitalize">{layoutStyle.replace('_', ' ')}</span>
        </div>

        <button
          type="button"
          onClick={onToggleSafeMargins}
          className={`flex items-center gap-1.5 px-2.5 py-1 rounded text-[11px] font-medium border transition ${
            showSafeMargins
              ? 'bg-amber-500/15 text-amber-300 border-amber-500/40'
              : 'bg-slate-900 text-slate-400 border-slate-800 hover:text-white'
          }`}
        >
          {showSafeMargins ? <Eye className="w-3 h-3 text-amber-400" /> : <EyeOff className="w-3 h-3" />}
          <span>6% Margins</span>
        </button>
      </div>

      {/* Main Composite Poster Viewport */}
      <div
        ref={containerRef}
        id="postpilot-live-canvas"
        className={`relative overflow-hidden rounded-xl border border-slate-800 select-none transition-all ${aspectRatioClass}`}
        style={{
          background: `linear-gradient(148deg, ${secondaryHex} 0%, ${deepHex} 100%)`,
          boxShadow: '0 24px 60px -15px rgba(0, 0, 0, 0.85)',
        }}
      >
        {/* Background Atmospheric Gradient + AI / Procedural Scene */}
        <div className="absolute inset-0 z-0">
          {/* Category Theme Ambient Glow */}
          <div
            className="absolute inset-0 pointer-events-none"
            style={{
              background: isCentered || isSpotlightPattern
                ? `radial-gradient(circle at 50% 34%, ${accentHex}38 0%, ${primaryHex}12 42%, transparent 74%)`
                : `radial-gradient(circle at 82% 24%, ${accentHex}3C 0%, ${primaryHex}16 44%, transparent 72%)`,
            }}
          />

          {bgUrl && (
            <img
              src={bgUrl}
              alt="Poster Background"
              className="w-full h-full object-cover transition duration-300"
              style={{
                opacity: isProceduralBg ? 0.92 : 0.36,
                filter: poster.backgroundBlur > 0 ? `blur(${poster.backgroundBlur}px)` : undefined,
              }}
              referrerPolicy="no-referrer"
            />
          )}

          {/* Readability Scrim */}
          <div
            className="absolute inset-0 pointer-events-none"
            style={{
              backgroundColor: `rgba(5, 8, 16, ${Math.min(0.45, poster.backgroundDarkness)})`,
              backgroundImage: scrimBackgroundImage,
            }}
          />

          {/* High-Clarity Category Architectural Pattern Layer */}
          <img
            src={patternSvgUrl}
            alt=""
            aria-hidden="true"
            className="absolute inset-0 w-full h-full object-cover pointer-events-none opacity-95"
          />

          {/* Layout-Specific Architectural Framing */}
          {isExecutiveLeft && (
            <>
              <div
                className="absolute top-0 inset-x-0 h-[4px] pointer-events-none"
                style={{ background: `linear-gradient(90deg, ${primaryHex}, ${accentHex})` }}
              />
              <div
                className="absolute top-[6%] bottom-[6%] left-[3.8%] w-[4px] rounded-full pointer-events-none"
                style={{ background: `linear-gradient(180deg, ${primaryHex}, ${accentHex})` }}
              />
              <div
                className="absolute top-[4%] right-[4%] w-8 h-8 border-t-2 border-r-2 rounded-tr-sm pointer-events-none opacity-75"
                style={{ borderColor: primaryHex }}
              />
              <div
                className="absolute bottom-[4%] right-[4%] w-8 h-8 border-b-2 border-r-2 rounded-br-sm pointer-events-none opacity-75"
                style={{ borderColor: accentHex }}
              />
            </>
          )}

          {isCentered && (
            <>
              <div
                className="absolute inset-[3.8%] rounded-xl pointer-events-none border"
                style={{ borderColor: `${primaryHex}58` }}
              />
              <div
                className="absolute inset-[5.2%] rounded-lg pointer-events-none border"
                style={{ borderColor: `${accentHex}34` }}
              />
              {isFestivePattern && (
                <>
                  <div
                    className="absolute top-[3.1%] left-1/2 -translate-x-1/2 w-2.5 h-2.5 rotate-45 pointer-events-none"
                    style={{ backgroundColor: primaryHex }}
                  />
                  <div
                    className="absolute bottom-[3.1%] left-1/2 -translate-x-1/2 w-2.5 h-2.5 rotate-45 pointer-events-none"
                    style={{ backgroundColor: primaryHex }}
                  />
                </>
              )}
            </>
          )}

          {isSplitFrame && (
            <>
              <div
                className="absolute inset-[3.8%] rounded-xl pointer-events-none border"
                style={{ borderColor: `${accentHex}55` }}
              />
              <div
                className="absolute top-[3.8%] inset-x-[22%] h-[3px] rounded-full pointer-events-none"
                style={{ background: `linear-gradient(90deg, transparent, ${primaryHex}, transparent)` }}
              />
            </>
          )}
        </div>

        {/* 6% Safe Margin Overlay */}
        {showSafeMargins && (
          <div className="absolute z-40 inset-[6%] border border-dashed border-amber-400/50 rounded-lg pointer-events-none flex flex-col justify-between p-2">
            <div className="flex justify-between text-[9px] text-amber-300/80 font-mono-tabular tracking-wider">
              <span>6% SAFE MARGIN</span>
              <span>NO-CLIP BOUNDARY</span>
            </div>
            <div className="text-[9px] text-amber-300/60 font-mono-tabular text-center">
              Verified safe zone for IG · FB · LinkedIn
            </div>
          </div>
        )}

        {/* Top Corner Brand Logo / Company Wordmark */}
        {poster.brandLogo.visible && poster.brandLogo.url ? (
          <div
            className={`absolute z-30 select-none ${
              poster.brandLogo.position === 'top-right' && !(!useScallopedSeal && poster.offerBadge.visible)
                ? 'top-[6%] right-[6.5%]'
                : poster.brandLogo.position === 'top-center' && isCentered
                ? 'top-[6%] left-1/2 -translate-x-1/2'
                : 'top-[6%] left-[6.5%]'
            }`}
          >
            <div
              className={`inline-flex items-center gap-2.5 rounded-lg ${
                poster.brandLogo.withPlate
                  ? 'px-2.5 py-1.5 backdrop-blur-md border border-white/18 shadow-lg'
                  : ''
              }`}
              style={poster.brandLogo.withPlate ? { backgroundColor: `${deepHex}D4` } : undefined}
            >
              <img
                src={poster.brandLogo.url}
                alt={poster.brandLogo.name || 'Company Logo'}
                className="max-h-9 max-w-[140px] w-auto h-auto object-contain block"
                referrerPolicy="no-referrer"
              />
            </div>
          </div>
        ) : poster.companyInfo?.companyName ? (
          <div
            className={`absolute z-30 top-[6.5%] select-none ${
              isCentered ? 'left-1/2 -translate-x-1/2 text-center' : 'left-[6.5%] text-left'
            }`}
          >
            <span className="inline-flex items-center gap-2 text-[11px] font-extrabold uppercase tracking-[0.22em] text-slate-100 drop-shadow">
              <span className="w-2.5 h-2.5 rounded-xs" style={{ backgroundColor: primaryHex }} />
              {poster.companyInfo.companyName}
            </span>
          </div>
        ) : null}

        {/* Offer / Editorial Tag */}
        {renderBadgeTag()}

        {/* Split Frame Upper Architectural Crest (when no focal product image is attached) */}
        {isSplitFrame && !(poster.productPhoto.visible && poster.productPhoto.url) && !isLandscape && (
          <div className="absolute z-10 top-[16.5%] inset-x-[6.5%] flex flex-col items-center justify-center pointer-events-none">
            <div
              className="px-4 py-2 rounded-full border backdrop-blur-md flex items-center gap-2.5 shadow-lg"
              style={{
                backgroundColor: `${deepHex}C8`,
                borderColor: `${primaryHex}66`,
              }}
            >
              <span className="w-2 h-2 rounded-full" style={{ backgroundColor: accentHex }} />
              <span
                className="text-[10px] font-extrabold uppercase tracking-[0.24em]"
                style={{ color: primaryHex }}
              >
                {designTheme.categoryTag}
              </span>
              <span className="w-2 h-2 rounded-full" style={{ backgroundColor: accentHex }} />
            </div>
          </div>
        )}

        {/* Product / Visual Focal Element */}
        {poster.productPhoto.visible && poster.productPhoto.url && (
          <div
            className="absolute z-10 transition-transform select-none"
            style={{
              left: `${
                isLandscape
                  ? 77
                  : isExecutiveLeft
                  ? Math.max(poster.productPhoto.x, 73)
                  : isSplitFrame
                  ? 50
                  : poster.productPhoto.x
              }%`,
              top: `${isSplitFrame ? 28 : poster.productPhoto.y}%`,
              transform: `translate(-50%, -50%) scale(${
                isSplitFrame ? Math.min(poster.productPhoto.scale, 0.85) : poster.productPhoto.scale
              })`,
            }}
          >
            <div
              className="absolute inset-0 rounded-full blur-2xl pointer-events-none"
              style={{
                backgroundColor: poster.productPhoto.glowColor || accentHex,
                opacity: poster.productPhoto.glowIntensity,
                transform: 'scale(1.15)',
              }}
            />
            {poster.productPhoto.useCardFallback ? (
              <div
                className="relative bg-slate-900/85 backdrop-blur-md p-2 border border-slate-700/70 shadow-2xl flex flex-col items-center"
                style={{ borderRadius: `${poster.productPhoto.cardBorderRadius}px` }}
              >
                <img
                  src={poster.productPhoto.url}
                  alt={poster.productPhoto.label}
                  className="w-36 h-auto object-contain max-h-40 rounded"
                  referrerPolicy="no-referrer"
                />
              </div>
            ) : (
              <img
                src={poster.productPhoto.url}
                alt={poster.productPhoto.label}
                className="relative w-40 sm:w-48 h-auto object-contain max-h-48"
                style={{
                  filter: `drop-shadow(0 15px 25px rgba(0,0,0,0.75)) drop-shadow(0 0 18px ${
                    poster.productPhoto.glowColor || accentHex
                  }40)`,
                }}
                referrerPolicy="no-referrer"
              />
            )}
          </div>
        )}

        {/* LAYOUT ARCHITECTURE 3: ARCHITECTURAL GLASS PANEL (split_frame) */}
        {isSplitFrame ? (
          <div
            className={`absolute z-20 inset-x-[6%] rounded-xl backdrop-blur-xl border shadow-2xl flex flex-col justify-between ${
              showFooterBar ? 'bottom-[8.5%]' : 'bottom-[6%]'
            } ${isLandscape ? 'top-[22%] p-4' : isStory ? 'p-5' : 'p-4 sm:p-5'}`}
            style={{
              backgroundColor: `${deepHex}EB`,
              borderColor: `${primaryHex}55`,
              boxShadow: '0 22px 50px rgba(0, 0, 0, 0.72)',
            }}
          >
            <div className="flex items-center gap-2 mb-2.5">
              <div
                className="w-14 h-[3.5px] rounded-full"
                style={{ background: `linear-gradient(90deg, ${primaryHex}, ${accentHex})` }}
              />
              <div className="flex-1 h-[1px] bg-white/12" />
            </div>

            {poster.headline.subtext && (
              <p
                className="uppercase tracking-[0.2em] text-[9.5px] font-extrabold mb-1"
                style={{ color: primaryHex }}
              >
                {poster.headline.subtext}
              </p>
            )}

            <h1
              className={`font-black leading-[1.12] tracking-tight ${poster.headline.font} ${getHeadlineGradientClass(
                poster.headline.style
              )}`}
              style={{
                fontSize: headlineFontSize,
                letterSpacing: `${poster.headline.letterSpacing}px`,
              }}
            >
              {poster.headline.text}
            </h1>

            {poster.subheading.visible && poster.subheading.text && (
              <p
                className={`mt-2 font-medium leading-snug ${poster.subheading.font}`}
                style={{
                  color: poster.subheading.color || '#CBD5E1',
                  fontSize: isLandscape ? '12px' : '13px',
                }}
              >
                {poster.subheading.text}
              </p>
            )}

            {renderStructuredHighlights(true)}

            {renderCtaButton(true)}
          </div>
        ) : (
          /* LAYOUT ARCHITECTURES 1 & 2: EXECUTIVE LEFT GRID vs CENTERED EDITORIAL */
          <>
            <div
              className={`absolute z-20 px-[6.5%] transition-all select-none ${
                isExecutiveLeft
                  ? `text-left left-0 ${
                      isLandscape || (poster.productPhoto.visible && poster.productPhoto.url)
                        ? 'w-[60%]'
                        : 'w-[92%]'
                    }`
                  : 'text-center left-0 w-full'
              }`}
              style={{
                top: `${Math.max(isLandscape ? 21 : 17, poster.headline.yOffset)}%`,
              }}
            >
              {poster.headline.subtext && (
                <div className={`flex items-center gap-2 mb-2 ${isCentered ? 'justify-center' : ''}`}>
                  {isHiringPattern || isTechPattern ? (
                    <span
                      className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full border text-[9.5px] font-extrabold uppercase tracking-[0.18em]"
                      style={{
                        backgroundColor: `${primaryHex}1C`,
                        borderColor: `${primaryHex}66`,
                        color: primaryHex,
                      }}
                    >
                      <span className="w-1.5 h-1.5 rounded-full" style={{ backgroundColor: accentHex }} />
                      {poster.headline.subtext}
                    </span>
                  ) : (
                    <>
                      <span className="w-6 h-[2px] inline-block" style={{ backgroundColor: primaryHex }} />
                      <p
                        className="uppercase tracking-[0.22em] text-[10px] font-extrabold drop-shadow"
                        style={{ color: primaryHex }}
                      >
                        {poster.headline.subtext}
                      </p>
                      {isCentered && (
                        <span className="w-6 h-[2px] inline-block" style={{ backgroundColor: primaryHex }} />
                      )}
                    </>
                  )}
                </div>
              )}

              <h1
                className={`font-black leading-[1.1] tracking-tight ${poster.headline.font} ${getHeadlineGradientClass(
                  poster.headline.style
                )}`}
                style={{
                  fontSize: headlineFontSize,
                  letterSpacing: `${poster.headline.letterSpacing}px`,
                }}
              >
                {poster.headline.text}
              </h1>

              {isCentered && (
                <div
                  className="mx-auto mt-2.5 mb-2 w-20 h-[3px] rounded-full opacity-95"
                  style={{ background: `linear-gradient(90deg, ${primaryHex}, ${accentHex})` }}
                />
              )}

              {poster.subheading.visible && poster.subheading.text && (
                <p
                  className={`mt-2 font-medium leading-snug drop-shadow ${
                    isExecutiveLeft ? 'max-w-[96%]' : 'mx-auto max-w-[84%]'
                  } ${poster.subheading.font}`}
                  style={{
                    color: poster.subheading.color || '#E2E8F0',
                    fontSize: `clamp(0.72rem, ${poster.subheading.size * 0.7}px, 0.96rem)`,
                  }}
                >
                  {poster.subheading.text}
                </p>
              )}

              {renderStructuredHighlights(false)}
            </div>

            {renderCtaButton(false)}
          </>
        )}

        {/* Company Footer Strip (Strictly rendered only from user-supplied info) */}
        {showFooterBar && (
          <div
            className={`absolute bottom-[3%] inset-x-[6.5%] z-20 pt-2 border-t border-white/15 text-[10px] font-medium text-slate-300 truncate ${
              isCentered ? 'text-center' : 'text-left'
            }`}
          >
            {contactParts.length > 0 ? contactParts.join('   ·   ') : poster.companyInfo?.tagline}
          </div>
        )}
      </div>

      {/* Studio Action Bar Below Canvas */}
      <div className="mt-3 flex flex-wrap items-center justify-between w-full max-w-[540px] px-1 gap-2">
        <div className="flex items-center gap-2">
          {onSaveDesign && (
            <button
              type="button"
              onClick={onSaveDesign}
              disabled={isSavingDesign}
              className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-slate-900 hover:bg-slate-800 text-slate-200 border border-slate-800 font-medium text-xs transition"
            >
              <BookmarkPlus className="w-3.5 h-3.5 text-amber-400" />
              <span>{isSavingDesign ? 'Saving...' : 'Save to My Designs'}</span>
            </button>
          )}
          {onOpenQualityGate && (
            <button
              type="button"
              onClick={onOpenQualityGate}
              className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-slate-900 hover:bg-slate-800 text-slate-200 border border-slate-800 font-medium text-xs transition"
            >
              <ShieldCheck className="w-3.5 h-3.5 text-emerald-400" />
              <span>Verify Quality</span>
            </button>
          )}
        </div>

        <div className="flex items-center gap-2">
          {onOpenExport && (
            <button
              type="button"
              onClick={onOpenExport}
              className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-slate-900 hover:bg-slate-800 text-slate-200 border border-slate-800 font-medium text-xs transition"
            >
              <Download className="w-3.5 h-3.5 text-sky-400" />
              <span>Export PNG/JPG</span>
            </button>
          )}
          {onOpenPublish && (
            <button
              type="button"
              onClick={onOpenPublish}
              className="flex items-center gap-1.5 px-3.5 py-1.5 rounded-lg bg-amber-500 hover:bg-amber-400 text-slate-950 font-bold text-xs transition"
            >
              <Send className="w-3.5 h-3.5" />
              <span>Publish &amp; Schedule</span>
            </button>
          )}
        </div>
      </div>
    </div>
  );
};

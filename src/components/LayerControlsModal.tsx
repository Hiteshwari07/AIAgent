import React, { useState } from 'react';
import { 
  Sliders, 
  X, 
  Type, 
  Tag, 
  ShoppingBag, 
  Image as ImageIcon, 
  Sparkles, 
  ShieldCheck, 
  Check, 
  Upload,
  Layers
} from 'lucide-react';
import { PosterConfig } from '../types';

interface LayerControlsModalProps {
  poster: PosterConfig;
  isOpen: boolean;
  onClose: () => void;
  onUpdatePoster: (updates: Partial<PosterConfig>) => void;
}

export const LayerControlsModal: React.FC<LayerControlsModalProps> = ({
  poster,
  isOpen,
  onClose,
  onUpdatePoster,
}) => {
  const [activeTab, setActiveTab] = useState<'text' | 'badge' | 'product' | 'logo' | 'backdrop'>('text');

  if (!isOpen) return null;

  // Custom Product Upload Handler
  const handleProductUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      const reader = new FileReader();
      reader.onload = (event) => {
        if (event.target?.result) {
          onUpdatePoster({
            productPhoto: {
              ...poster.productPhoto,
              url: event.target.result as string,
              label: file.name.replace(/\.[^/.]+$/, ''),
              visible: true,
            },
          });
        }
      };
      reader.readAsDataURL(file);
    }
  };

  // Custom Logo Upload Handler
  const handleLogoUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      const reader = new FileReader();
      reader.onload = (event) => {
        if (event.target?.result) {
          onUpdatePoster({
            brandLogo: {
              ...poster.brandLogo,
              url: event.target.result as string,
              name: 'Custom Logo',
              visible: true,
            },
          });
        }
      };
      reader.readAsDataURL(file);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-sm animate-fadeIn">
      <div className="bg-neutral-900 border border-neutral-700/80 rounded-2xl max-w-2xl w-full shadow-2xl overflow-hidden flex flex-col max-h-[92vh]">
        {/* Header */}
        <div className="px-5 py-4 border-b border-neutral-800 bg-neutral-950/60 flex items-center justify-between">
          <div className="flex items-center gap-2.5">
            <div className="w-8 h-8 rounded-lg bg-neutral-800 border border-neutral-700 flex items-center justify-center text-amber-400">
              <Sliders className="w-4 h-4" />
            </div>
            <div>
              <h2 className="text-base font-bold text-white tracking-tight">
                Layer Studio &amp; Fine Controls
              </h2>
            </div>
          </div>

          <button
            onClick={onClose}
            className="p-1.5 rounded-lg text-neutral-400 hover:text-white hover:bg-neutral-800 transition"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* Tab Navigation */}
        <div className="flex items-center border-b border-neutral-800 bg-neutral-950/40 px-4 gap-2 overflow-x-auto">
          {[
            { id: 'text', label: 'Typography', icon: <Type className="w-3.5 h-3.5" /> },
            { id: 'badge', label: 'Offer Badge', icon: <Tag className="w-3.5 h-3.5" /> },
            { id: 'product', label: 'Real Product', icon: <ShoppingBag className="w-3.5 h-3.5" /> },
            { id: 'logo', label: 'Brand Logo', icon: <ImageIcon className="w-3.5 h-3.5" /> },
            { id: 'backdrop', label: 'Vignette & Contrast', icon: <Sparkles className="w-3.5 h-3.5" /> },
          ].map((tab) => (
            <button
              key={tab.id}
              onClick={() => setActiveTab(tab.id as any)}
              className={`flex items-center gap-1.5 px-3 py-2.5 text-xs font-semibold border-b-2 transition whitespace-nowrap ${
                activeTab === tab.id
                  ? 'border-amber-500 text-amber-400 bg-neutral-900/60'
                  : 'border-transparent text-neutral-400 hover:text-neutral-200'
              }`}
            >
              {tab.icon}
              <span>{tab.label}</span>
            </button>
          ))}
        </div>

        {/* Tab Body */}
        <div className="p-5 overflow-y-auto space-y-4">
          {/* TAB 1: Typography */}
          {activeTab === 'text' && (
            <div className="space-y-4">
              <div>
                <label className="text-xs font-semibold text-neutral-300 block mb-1">
                  Main Headline (Devanagari, Gujarati, or Latin)
                </label>
                <input
                  type="text"
                  value={poster.headline.text}
                  onChange={(e) =>
                    onUpdatePoster({
                      headline: { ...poster.headline, text: e.target.value },
                    })
                  }
                  className="w-full bg-neutral-950 border border-neutral-800 rounded-lg px-3 py-2 text-sm text-white focus:outline-none focus:border-amber-500"
                />
              </div>

              <div>
                <label className="text-xs font-semibold text-neutral-300 block mb-1">
                  Headline Subtext / Eyebrow (Optional)
                </label>
                <input
                  type="text"
                  value={poster.headline.subtext}
                  onChange={(e) =>
                    onUpdatePoster({
                      headline: { ...poster.headline, subtext: e.target.value },
                    })
                  }
                  className="w-full bg-neutral-950 border border-neutral-800 rounded-lg px-3 py-1.5 text-xs text-white focus:outline-none focus:border-amber-500"
                />
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="text-xs font-semibold text-neutral-300 block mb-1">
                    Display Gradient Style
                  </label>
                  <select
                    value={poster.headline.style}
                    onChange={(e) =>
                      onUpdatePoster({
                        headline: { ...poster.headline, style: e.target.value as any },
                      })
                    }
                    className="w-full bg-neutral-950 border border-neutral-800 rounded-lg px-3 py-2 text-xs text-white focus:outline-none focus:border-amber-500"
                  >
                    <option value="gold">24K Gold Metallic</option>
                    <option value="silver">Polished Silver</option>
                    <option value="rose_gold">Rose Gold</option>
                    <option value="emerald">Emerald Metallic</option>
                    <option value="white">Crisp Pure White</option>
                  </select>
                </div>

                <div>
                  <label className="text-xs font-semibold text-neutral-300 block mb-1">
                    Font Family (Correct Conjuncts)
                  </label>
                  <select
                    value={poster.headline.font}
                    onChange={(e) =>
                      onUpdatePoster({
                        headline: { ...poster.headline, font: e.target.value },
                      })
                    }
                    className="w-full bg-neutral-950 border border-neutral-800 rounded-lg px-3 py-2 text-xs text-white focus:outline-none focus:border-amber-500"
                  >
                    <option value="font-jakarta">Plus Jakarta Sans (Corporate Agency)</option>
                    <option value="font-montserrat">Montserrat (Bold Geometric)</option>
                    <option value="font-manrope">Manrope (Clean Tech Sans)</option>
                    <option value="font-playfair">Playfair Display (Editorial Serif)</option>
                    <option value="font-cinzel">Cinzel Decorative (Luxury Gold)</option>
                    <option value="font-poppins">Poppins Display</option>
                    <option value="font-hindi">Rozha / Noto Devanagari (Hindi)</option>
                    <option value="font-gujarati">Noto Sans Gujarati</option>
                  </select>
                </div>
              </div>

              <div>
                <div className="flex justify-between text-xs text-neutral-300 mb-1">
                  <span>Headline Size</span>
                  <span className="font-mono text-amber-400">{poster.headline.size}pt</span>
                </div>
                <input
                  type="range"
                  min="26"
                  max="64"
                  value={poster.headline.size}
                  onChange={(e) =>
                    onUpdatePoster({
                      headline: { ...poster.headline, size: Number(e.target.value) },
                    })
                  }
                  className="w-full accent-amber-500 cursor-pointer"
                />
              </div>

              <div>
                <div className="flex justify-between text-xs text-neutral-300 mb-1">
                  <span>Headline Y Position (Offset)</span>
                  <span className="font-mono text-amber-400">{poster.headline.yOffset}%</span>
                </div>
                <input
                  type="range"
                  min="8"
                  max="32"
                  value={poster.headline.yOffset}
                  onChange={(e) =>
                    onUpdatePoster({
                      headline: { ...poster.headline, yOffset: Number(e.target.value) },
                    })
                  }
                  className="w-full accent-amber-500 cursor-pointer"
                />
              </div>

              <div className="pt-3 border-t border-neutral-800">
                <div className="flex items-center justify-between mb-2">
                  <label className="text-xs font-semibold text-neutral-300">
                    Tier 3 Subheading
                  </label>
                  <button
                    onClick={() =>
                      onUpdatePoster({
                        subheading: { ...poster.subheading, visible: !poster.subheading.visible },
                      })
                    }
                    className="text-xs text-amber-400 hover:underline"
                  >
                    {poster.subheading.visible ? 'Hide' : 'Show'}
                  </button>
                </div>
                <input
                  type="text"
                  value={poster.subheading.text}
                  onChange={(e) =>
                    onUpdatePoster({
                      subheading: { ...poster.subheading, text: e.target.value },
                    })
                  }
                  className="w-full bg-neutral-950 border border-neutral-800 rounded-lg px-3 py-1.5 text-xs text-white focus:outline-none focus:border-amber-500"
                />
              </div>
            </div>
          )}

          {/* TAB 2: Offer Badge */}
          {activeTab === 'badge' && (
            <div className="space-y-4">
              <div className="flex items-center justify-between">
                <div>
                  <h4 className="text-xs font-bold text-white">Scalloped Offer Badge</h4>
                </div>
                <button
                  onClick={() =>
                    onUpdatePoster({
                      offerBadge: { ...poster.offerBadge, visible: !poster.offerBadge.visible },
                    })
                  }
                  className={`px-3 py-1 rounded-full text-xs font-semibold border transition ${
                    poster.offerBadge.visible
                      ? 'bg-amber-500/20 text-amber-300 border-amber-500/40'
                      : 'bg-neutral-800 text-neutral-400 border-neutral-700'
                  }`}
                >
                  {poster.offerBadge.visible ? 'Badge Active' : 'Hidden'}
                </button>
              </div>

              {poster.offerBadge.visible && (
                <>
                  <div>
                    <label className="text-xs font-semibold text-neutral-300 block mb-1">
                      Badge Style
                    </label>
                    <select
                      value={poster.offerBadge.style}
                      onChange={(e) =>
                        onUpdatePoster({
                          offerBadge: { ...poster.offerBadge, style: e.target.value as any },
                        })
                      }
                      className="w-full bg-neutral-950 border border-neutral-800 rounded-lg px-3 py-1.5 text-xs text-white focus:outline-none focus:border-amber-500"
                    >
                      <option value="minimal_ring">Architectural Tag (Corporate / Tech)</option>
                      <option value="festive_tag">Editorial Metallic Frame</option>
                      <option value="neon_badge">High-Contrast Accent Pill</option>
                      <option value="scalloped_gold">Festive Scalloped Seal</option>
                    </select>
                  </div>
                  <div className="grid grid-cols-2 gap-3">
                    <div>
                      <label className="text-xs font-semibold text-neutral-300 block mb-1">
                        Primary Offer Text
                      </label>
                      <input
                        type="text"
                        value={poster.offerBadge.text}
                        onChange={(e) =>
                          onUpdatePoster({
                            offerBadge: { ...poster.offerBadge, text: e.target.value },
                          })
                        }
                        className="w-full bg-neutral-950 border border-neutral-800 rounded-lg px-3 py-1.5 text-xs text-white focus:outline-none focus:border-amber-500"
                      />
                    </div>
                    <div>
                      <label className="text-xs font-semibold text-neutral-300 block mb-1">
                        Offer Subtext
                      </label>
                      <input
                        type="text"
                        value={poster.offerBadge.subtext}
                        onChange={(e) =>
                          onUpdatePoster({
                            offerBadge: { ...poster.offerBadge, subtext: e.target.value },
                          })
                        }
                        className="w-full bg-neutral-950 border border-neutral-800 rounded-lg px-3 py-1.5 text-xs text-white focus:outline-none focus:border-amber-500"
                      />
                    </div>
                  </div>

                  <div>
                    <div className="flex justify-between text-xs text-neutral-300 mb-1">
                      <span>Badge Scale</span>
                      <span className="font-mono text-amber-400">{poster.offerBadge.size}x</span>
                    </div>
                    <input
                      type="range"
                      min="0.7"
                      max="1.8"
                      step="0.05"
                      value={poster.offerBadge.size}
                      onChange={(e) =>
                        onUpdatePoster({
                          offerBadge: { ...poster.offerBadge, size: Number(e.target.value) },
                        })
                      }
                      className="w-full accent-amber-500 cursor-pointer"
                    />
                  </div>

                  <div className="grid grid-cols-2 gap-3">
                    <div>
                      <div className="flex justify-between text-xs text-neutral-300 mb-1">
                        <span>Position X</span>
                        <span className="font-mono text-amber-400">{poster.offerBadge.x}%</span>
                      </div>
                      <input
                        type="range"
                        min="15"
                        max="85"
                        value={poster.offerBadge.x}
                        onChange={(e) =>
                          onUpdatePoster({
                            offerBadge: { ...poster.offerBadge, x: Number(e.target.value) },
                          })
                        }
                        className="w-full accent-amber-500 cursor-pointer"
                      />
                    </div>

                    <div>
                      <div className="flex justify-between text-xs text-neutral-300 mb-1">
                        <span>Position Y</span>
                        <span className="font-mono text-amber-400">{poster.offerBadge.y}%</span>
                      </div>
                      <input
                        type="range"
                        min="20"
                        max="80"
                        value={poster.offerBadge.y}
                        onChange={(e) =>
                          onUpdatePoster({
                            offerBadge: { ...poster.offerBadge, y: Number(e.target.value) },
                          })
                        }
                        className="w-full accent-amber-500 cursor-pointer"
                      />
                    </div>
                  </div>
                </>
              )}

              {/* CTA Button controls */}
              <div className="pt-4 border-t border-neutral-800">
                <div className="flex items-center justify-between mb-2">
                  <h4 className="text-xs font-bold text-white">Call to Action (CTA) Button</h4>
                  <button
                    onClick={() =>
                      onUpdatePoster({
                        ctaButton: { ...poster.ctaButton, visible: !poster.ctaButton.visible },
                      })
                    }
                    className="text-xs text-amber-400 hover:underline"
                  >
                    {poster.ctaButton.visible ? 'Hide CTA' : 'Show CTA'}
                  </button>
                </div>
                <div className="grid grid-cols-2 gap-3">
                  <input
                    type="text"
                    value={poster.ctaButton.text}
                    onChange={(e) =>
                      onUpdatePoster({
                        ctaButton: { ...poster.ctaButton, text: e.target.value },
                      })
                    }
                    className="w-full bg-neutral-950 border border-neutral-800 rounded-lg px-3 py-1.5 text-xs text-white focus:outline-none focus:border-amber-500"
                  />
                  <select
                    value={poster.ctaButton.style}
                    onChange={(e) =>
                      onUpdatePoster({
                        ctaButton: { ...poster.ctaButton, style: e.target.value as any },
                      })
                    }
                    className="w-full bg-neutral-950 border border-neutral-800 rounded-lg px-3 py-1.5 text-xs text-white focus:outline-none focus:border-amber-500"
                  >
                    <option value="gold_pill">Warm Gold Accent</option>
                    <option value="neon_accent">Cyan Tech Accent</option>
                    <option value="emerald_luxury">Emerald Executive</option>
                    <option value="solid_crimson">Crimson Highlight</option>
                    <option value="glass_border">Architectural Glass Outline</option>
                  </select>
                </div>
              </div>
            </div>
          )}

          {/* TAB 3: Real Product Photo */}
          {activeTab === 'product' && (
            <div className="space-y-4">
              <div className="p-3 rounded-xl bg-neutral-950/70 border border-neutral-800 flex items-center justify-between">
                <div>
                  <h4 className="text-xs font-bold text-white">Product Photo</h4>
                </div>

                <label className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-neutral-800 hover:bg-neutral-700 text-neutral-200 text-xs font-medium cursor-pointer border border-neutral-700 transition">
                  <Upload className="w-3.5 h-3.5 text-amber-400" />
                  <span>Upload Product</span>
                  <input
                    type="file"
                    accept="image/*"
                    onChange={handleProductUpload}
                    className="hidden"
                  />
                </label>
              </div>

              {/* Clean Rounded Card Fallback Toggle */}
              <div className="p-3 rounded-xl bg-neutral-950 border border-neutral-800 flex items-center justify-between">
                <div>
                  <span className="text-xs font-bold text-neutral-200 block">
                    Clean Rounded Card Mode
                  </span>
                </div>
                <button
                  onClick={() =>
                    onUpdatePoster({
                      productPhoto: {
                        ...poster.productPhoto,
                        useCardFallback: !poster.productPhoto.useCardFallback,
                      },
                    })
                  }
                  className={`px-3 py-1 rounded-full text-xs font-semibold border transition ${
                    poster.productPhoto.useCardFallback
                      ? 'bg-amber-500/20 text-amber-300 border-amber-500/40'
                      : 'bg-neutral-800 text-neutral-400 border-neutral-700'
                  }`}
                >
                  {poster.productPhoto.useCardFallback ? 'Enabled' : 'Cutout Mode'}
                </button>
              </div>

              {/* Sliders for scale, y position, shadow, glow */}
              <div>
                <div className="flex justify-between text-xs text-neutral-300 mb-1">
                  <span>Product Scale</span>
                  <span className="font-mono text-amber-400">{poster.productPhoto.scale}x</span>
                </div>
                <input
                  type="range"
                  min="0.5"
                  max="1.7"
                  step="0.05"
                  value={poster.productPhoto.scale}
                  onChange={(e) =>
                    onUpdatePoster({
                      productPhoto: {
                        ...poster.productPhoto,
                        scale: Number(e.target.value),
                      },
                    })
                  }
                  className="w-full accent-amber-500 cursor-pointer"
                />
              </div>

              <div>
                <div className="flex justify-between text-xs text-neutral-300 mb-1">
                  <span>Product Y Position</span>
                  <span className="font-mono text-amber-400">{poster.productPhoto.y}%</span>
                </div>
                <input
                  type="range"
                  min="30"
                  max="78"
                  value={poster.productPhoto.y}
                  onChange={(e) =>
                    onUpdatePoster({
                      productPhoto: {
                        ...poster.productPhoto,
                        y: Number(e.target.value),
                      },
                    })
                  }
                  className="w-full accent-amber-500 cursor-pointer"
                />
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <div className="flex justify-between text-xs text-neutral-300 mb-1">
                    <span>Contact Shadow</span>
                    <span className="font-mono text-amber-400">{poster.productPhoto.shadowIntensity}</span>
                  </div>
                  <input
                    type="range"
                    min="0"
                    max="1"
                    step="0.05"
                    value={poster.productPhoto.shadowIntensity}
                    onChange={(e) =>
                      onUpdatePoster({
                        productPhoto: {
                          ...poster.productPhoto,
                          shadowIntensity: Number(e.target.value),
                        },
                      })
                    }
                    className="w-full accent-amber-500 cursor-pointer"
                  />
                </div>

                <div>
                  <div className="flex justify-between text-xs text-neutral-300 mb-1">
                    <span>Atmospheric Glow</span>
                    <span className="font-mono text-amber-400">{poster.productPhoto.glowIntensity}</span>
                  </div>
                  <input
                    type="range"
                    min="0"
                    max="1"
                    step="0.05"
                    value={poster.productPhoto.glowIntensity}
                    onChange={(e) =>
                      onUpdatePoster({
                        productPhoto: {
                          ...poster.productPhoto,
                          glowIntensity: Number(e.target.value),
                        },
                      })
                    }
                    className="w-full accent-amber-500 cursor-pointer"
                  />
                </div>
              </div>
            </div>
          )}

          {/* TAB 4: Brand Logo */}
          {activeTab === 'logo' && (
            <div className="space-y-4">
              <div className="p-3 rounded-xl bg-neutral-950/70 border border-neutral-800 flex items-center justify-between">
                <div>
                  <h4 className="text-xs font-bold text-white">Brand Logo</h4>
                </div>

                <label className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-neutral-800 hover:bg-neutral-700 text-neutral-200 text-xs font-medium cursor-pointer border border-neutral-700 transition">
                  <Upload className="w-3.5 h-3.5 text-amber-400" />
                  <span>Upload Logo</span>
                  <input
                    type="file"
                    accept="image/*"
                    onChange={handleLogoUpload}
                    className="hidden"
                  />
                </label>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="text-xs font-semibold text-neutral-300 block mb-1">
                    Safe Corner Position
                  </label>
                  <select
                    value={poster.brandLogo.position}
                    onChange={(e) =>
                      onUpdatePoster({
                        brandLogo: {
                          ...poster.brandLogo,
                          position: e.target.value as any,
                        },
                      })
                    }
                    className="w-full bg-neutral-950 border border-neutral-800 rounded-lg px-3 py-2 text-xs text-white focus:outline-none focus:border-amber-500"
                  >
                    <option value="top-left">Top Left Corner (Standard)</option>
                    <option value="top-right">Top Right Corner</option>
                    <option value="top-center">Top Center</option>
                  </select>
                </div>

                <div>
                  <label className="text-xs font-semibold text-neutral-300 block mb-1">
                    Contrast Plate
                  </label>
                  <button
                    onClick={() =>
                      onUpdatePoster({
                        brandLogo: {
                          ...poster.brandLogo,
                          withPlate: !poster.brandLogo.withPlate,
                        },
                      })
                    }
                    className={`w-full py-2 rounded-lg text-xs font-semibold border transition ${
                      poster.brandLogo.withPlate
                        ? 'bg-amber-500/20 text-amber-300 border-amber-500/40'
                        : 'bg-neutral-950 text-neutral-400 border-neutral-800'
                    }`}
                  >
                    {poster.brandLogo.withPlate ? 'Glass Backdrop Plate ON' : 'Direct Blend (No Plate)'}
                  </button>
                </div>
              </div>
            </div>
          )}

          {/* TAB 5: Vignette & Contrast */}
          {activeTab === 'backdrop' && (
            <div className="space-y-4">
              <div>
                <div className="flex justify-between text-xs text-neutral-300 mb-1">
                  <span>Background Contrast Vignette (Darkness)</span>
                  <span className="font-mono text-amber-400">
                    {Math.round(poster.backgroundDarkness * 100)}%
                  </span>
                </div>
                <input
                  type="range"
                  min="0"
                  max="0.65"
                  step="0.02"
                  value={poster.backgroundDarkness}
                  onChange={(e) =>
                    onUpdatePoster({
                      backgroundDarkness: Number(e.target.value),
                    })
                  }
                  className="w-full accent-amber-500 cursor-pointer"
                />
              </div>

              <div>
                <div className="flex justify-between text-xs text-neutral-300 mb-1">
                  <span>Depth of Field (Background Blur)</span>
                  <span className="font-mono text-amber-400">{poster.backgroundBlur}px</span>
                </div>
                <input
                  type="range"
                  min="0"
                  max="8"
                  step="0.5"
                  value={poster.backgroundBlur}
                  onChange={(e) =>
                    onUpdatePoster({
                      backgroundBlur: Number(e.target.value),
                    })
                  }
                  className="w-full accent-amber-500 cursor-pointer"
                />
              </div>
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="p-4 border-t border-neutral-800 bg-neutral-950/80 flex justify-end">
          <button
            onClick={onClose}
            className="px-4 py-2 rounded-xl bg-amber-500 hover:bg-amber-400 text-neutral-950 font-bold text-xs shadow-md transition"
          >
            Apply &amp; Close
          </button>
        </div>
      </div>
    </div>
  );
};

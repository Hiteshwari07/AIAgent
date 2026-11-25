import React, { useState } from 'react';
import { Wand2, X, Sparkles, RefreshCw, Layers, Copy, Check } from 'lucide-react';
import { OccasionType } from '../types';

interface PromptBuilderModalProps {
  isOpen: boolean;
  onClose: () => void;
  activeOccasion: OccasionType;
  onGeneratePrompt: (occasion: OccasionType, customDetails?: { palette?: string; decorations?: string; customTopic?: string }) => void;
  isGenerating: boolean;
}

export const PromptBuilderModal: React.FC<PromptBuilderModalProps> = ({
  isOpen,
  onClose,
  activeOccasion,
  onGeneratePrompt,
  isGenerating,
}) => {
  const [selectedOccasion, setSelectedOccasion] = useState<OccasionType>(activeOccasion);
  const [customPalette, setCustomPalette] = useState('');
  const [customDecorations, setCustomDecorations] = useState('');
  const [customTopic, setCustomTopic] = useState('');
  const [copied, setCopied] = useState(false);

  if (!isOpen) return null;

  const OCCASIONS: { id: OccasionType; label: string; desc: string; palette: string; dec: string }[] = [
    {
      id: 'corporate',
      label: 'Corporate',
      desc: 'Executive glass architecture & boardroom light',
      palette: 'obsidian navy slate, titanium silver and subtle sapphire light lines',
      dec: 'modern architectural glass geometry, clean light beams, uncluttered negative space'
    },
    {
      id: 'it_tech',
      label: 'IT & AI Tech',
      desc: 'Neural optical depth & clean tech minimalism',
      palette: 'deep space navy, luminous cyan data streams and matte carbon',
      dec: 'optical glass prisms, subtle fiber-optic depth, crisp abstract geometric waves'
    },
    {
      id: 'hiring',
      label: 'Hiring / Careers',
      desc: 'Modern tech campus & architectural workspace',
      palette: 'midnight teal, crisp cobalt studio lighting and warm neutral stone',
      dec: 'modern collaborative glass office architecture, soft depth of field, clean open space'
    },
    {
      id: 'product_launch',
      label: 'Product Launch',
      desc: 'Dark studio podium & precision spotlight',
      palette: 'matte obsidian graphite with directional metallic rim lighting',
      dec: 'minimalist dark studio pedestal, circular backlight halo, subtle floor reflection'
    },
    {
      id: 'diwali',
      label: 'Diwali',
      desc: 'Festival of Lights, royal maroon & warm brass',
      palette: 'deep royal maroon and lustrous antique gold palette',
      dec: 'subtle brass diyas bokeh, soft ambient golden embers, uncluttered dark center'
    },
    {
      id: 'holi',
      label: 'Holi',
      desc: 'Vibrant colors, dark studio & gulal clouds',
      palette: 'deep plum obsidian with magenta, saffron and turquoise powder',
      dec: 'suspended organic pigment clouds along frame edges, dark clean focal zone'
    },
    {
      id: 'navratri',
      label: 'Navratri',
      desc: 'Garba festive, royal indigo & marigold',
      palette: 'royal indigo, crimson marigold and warm bronze lighting',
      dec: 'subtle festive temple lanterns bokeh, clean dark space for typography'
    },
    {
      id: 'sale',
      label: 'Promotional',
      desc: 'Modern commercial dark luxury backdrop',
      palette: 'luxury carbon slate and radiant champagne gold',
      dec: 'architectural studio light sweep, crisp dark focal zone'
    }
  ];

  const currentPack = OCCASIONS.find((o) => o.id === selectedOccasion) || OCCASIONS[0];
  const finalPalette = customPalette.trim() || currentPack.palette;
  const finalDec = customDecorations.trim() || currentPack.dec;
  const occasionTitle = selectedOccasion === 'sale' && customTopic.trim() ? customTopic.trim() : currentPack.label;

  const compiledPrompt = `Agency-grade ${occasionTitle} poster BACKGROUND, ${finalPalette}, cinematic architectural lighting, soft depth of field, ${finalDec}, uncluttered negative space for typography. NO text, NO letters, NO numbers, NO logos, NO random portraits.`;

  const handleCopy = () => {
    navigator.clipboard.writeText(compiledPrompt);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  const handleApplyAndGenerate = () => {
    onGeneratePrompt(selectedOccasion, {
      palette: customPalette,
      decorations: customDecorations,
      customTopic: customTopic
    });
    onClose();
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-sm animate-fadeIn">
      <div className="bg-neutral-900 border border-neutral-700/80 rounded-2xl max-w-2xl w-full shadow-2xl overflow-hidden flex flex-col max-h-[92vh]">
        {/* Header */}
        <div className="px-5 py-4 border-b border-neutral-800 bg-neutral-950/60 flex items-center justify-between">
          <div className="flex items-center gap-2.5">
            <div className="w-8 h-8 rounded-lg bg-amber-500/20 border border-amber-500/40 flex items-center justify-center text-amber-400">
              <Wand2 className="w-5 h-5" />
            </div>
            <div>
              <h2 className="text-base font-bold text-white tracking-tight">
                Scene Prompt Builder
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

        {/* Content */}
        <div className="p-5 overflow-y-auto space-y-4">
          {/* Occasion Packs Selection */}
          <div>
            <label className="text-xs font-bold uppercase tracking-wider text-neutral-300 block mb-2">
              Select Occasion Pack
            </label>
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
              {OCCASIONS.map((occ) => (
                <button
                  key={occ.id}
                  onClick={() => setSelectedOccasion(occ.id)}
                  className={`p-2.5 rounded-xl border text-left transition ${
                    selectedOccasion === occ.id
                      ? 'bg-amber-500/15 border-amber-500 text-white shadow-sm'
                      : 'bg-neutral-950/60 border-neutral-800 text-neutral-400 hover:text-neutral-200 hover:border-neutral-700'
                  }`}
                >
                  <span className="block text-xs font-bold mb-0.5 text-amber-300">
                    {occ.label}
                  </span>
                  <span className="block text-[10px] text-neutral-400 line-clamp-2">
                    {occ.desc}
                  </span>
                </button>
              ))}
            </div>
          </div>

          {/* Compiled Prompt View */}
          <div>
            <div className="flex items-center justify-between mb-1.5">
              <label className="text-xs font-bold uppercase tracking-wider text-neutral-300">
                Scene Prompt Preview
              </label>
              <button
                type="button"
                onClick={handleCopy}
                className="flex items-center gap-1 text-[11px] text-amber-400 hover:text-amber-300 transition"
              >
                {copied ? <Check className="w-3 h-3 text-emerald-400" /> : <Copy className="w-3 h-3" />}
                <span>{copied ? 'Copied' : 'Copy Prompt'}</span>
              </button>
            </div>
            <div className="p-3.5 rounded-xl bg-neutral-950 border border-neutral-800 font-mono text-xs text-neutral-300 leading-relaxed">
              <span className="text-amber-400">{compiledPrompt.slice(0, 35)}</span>
              <span>{compiledPrompt.slice(35, -57)}</span>
              <span className="text-rose-400 font-bold">{compiledPrompt.slice(-57)}</span>
            </div>
          </div>

          {/* Optional Overrides */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 pt-2 border-t border-neutral-800/80">
            <div>
              <label className="text-xs font-semibold text-neutral-400 block mb-1">
                Custom Palette (Optional)
              </label>
              <input
                type="text"
                placeholder={currentPack.palette}
                value={customPalette}
                onChange={(e) => setCustomPalette(e.target.value)}
                className="w-full bg-neutral-950 border border-neutral-800 rounded-lg px-3 py-1.5 text-xs text-white placeholder-neutral-600 focus:outline-none focus:border-amber-500"
              />
            </div>

            <div>
              <label className="text-xs font-semibold text-neutral-400 block mb-1">
                Custom Decorations (Optional)
              </label>
              <input
                type="text"
                placeholder={currentPack.dec}
                value={customDecorations}
                onChange={(e) => setCustomDecorations(e.target.value)}
                className="w-full bg-neutral-950 border border-neutral-800 rounded-lg px-3 py-1.5 text-xs text-white placeholder-neutral-600 focus:outline-none focus:border-amber-500"
              />
            </div>
          </div>
        </div>

        {/* Footer */}
        <div className="p-4 border-t border-neutral-800 bg-neutral-950/80 flex items-center justify-between">
          <span className="text-xs text-neutral-400">
            Will generate 3 variations simultaneously.
          </span>
          <button
            onClick={handleApplyAndGenerate}
            disabled={isGenerating}
            className="flex items-center gap-1.5 px-4 py-2 rounded-xl bg-gradient-to-r from-amber-500 to-yellow-500 hover:from-amber-400 hover:to-yellow-400 text-neutral-950 font-bold text-xs shadow-md shadow-amber-500/20 disabled:opacity-50 transition active:scale-95"
          >
            <RefreshCw className={`w-3.5 h-3.5 ${isGenerating ? 'animate-spin' : ''}`} />
            <span>Generate 3 Variations</span>
          </button>
        </div>
      </div>
    </div>
  );
};

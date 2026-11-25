import React, { useEffect, useState } from 'react';
import { Download, X, Check, Send } from 'lucide-react';
import { ExportDimension, PosterConfig } from '../types';
import { renderPosterToImage } from '../utils/posterRenderer';

interface ExportModalProps {
  poster: PosterConfig;
  isOpen: boolean;
  onClose: () => void;
  onOpenPublish?: () => void;
}

const EXPORT_PRESETS: Array<{
  id: ExportDimension;
  name: string;
  res: string;
  desc: string;
}> = [
  {
    id: '1080x1350',
    name: 'Instagram Portrait (4:5)',
    res: '1080 × 1350',
    desc: 'High-impact vertical feed post for Instagram & Meta campaigns',
  },
  {
    id: '1080x1080',
    name: 'Universal Square (1:1)',
    res: '1080 × 1080',
    desc: 'Balanced square canvas for Instagram, WhatsApp & Facebook',
  },
  {
    id: '1200x630',
    name: 'Facebook & Link Landscape',
    res: '1200 × 630',
    desc: 'Widescreen corporate briefing and Facebook Page showcase format',
  },
  {
    id: '1200x1350',
    name: 'LinkedIn Portrait Carousel',
    res: '1200 × 1350',
    desc: 'Crisp high-density B2B portrait frame engineered for LinkedIn feeds',
  },
  {
    id: '1080x1920',
    name: 'Mobile Story & Reel (9:16)',
    res: '1080 × 1920',
    desc: 'Full-screen vertical format for Instagram Stories and WhatsApp Status',
  },
];

function aspectToDefaultDimension(ratio?: string): ExportDimension {
  if (ratio === '1:1') return '1080x1080';
  if (ratio === '16:9') return '1200x630';
  if (ratio === '9:16') return '1080x1920';
  return '1080x1350';
}

export const ExportModal: React.FC<ExportModalProps> = ({
  poster,
  isOpen,
  onClose,
  onOpenPublish,
}) => {
  const [selectedDimension, setSelectedDimension] = useState<ExportDimension>(
    aspectToDefaultDimension(poster.aspectRatio)
  );
  const [fileFormat, setFileFormat] = useState<'image/png' | 'image/jpeg'>('image/png');
  const [isExporting, setIsExporting] = useState(false);
  const [downloadComplete, setDownloadComplete] = useState(false);

  useEffect(() => {
    if (isOpen) {
      setSelectedDimension(aspectToDefaultDimension(poster.aspectRatio));
      setDownloadComplete(false);
    }
  }, [isOpen, poster.aspectRatio]);

  if (!isOpen) return null;

  const handleDownload = async () => {
    setIsExporting(true);
    setDownloadComplete(false);
    try {
      const rendered = await renderPosterToImage(poster, {
        format: fileFormat,
        quality: fileFormat === 'image/jpeg' ? 0.94 : 1.0,
        resolution: selectedDimension,
      });
      const ext = fileFormat === 'image/jpeg' ? 'jpg' : 'png';
      const link = document.createElement('a');
      link.download = `postpilot-${poster.occasion}-${selectedDimension}.${ext}`;
      link.href = rendered.dataUrl;
      link.click();
      setDownloadComplete(true);
    } finally {
      setIsExporting(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-sm">
      <div className="bg-[#111827] border border-slate-800 rounded-xl max-w-lg w-full shadow-2xl overflow-hidden flex flex-col max-h-[90vh]">
        <div className="px-5 py-4 border-b border-slate-800 bg-[#0B0F19] flex items-center justify-between">
          <div>
            <h2 className="text-base font-bold font-display text-white">
              Multi-Format Studio Export
            </h2>
            <p className="text-xs text-slate-400">
              Proportional re-layout across social &amp; executive dimensions
            </p>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="p-1.5 rounded-lg text-slate-400 hover:text-white hover:bg-slate-800 transition"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        <div className="p-5 overflow-y-auto space-y-3">
          <div className="flex items-center justify-between text-xs mb-1">
            <span className="font-semibold text-slate-300">Output Resolution</span>
            <div className="flex items-center gap-1 bg-[#0B0F19] border border-slate-800 rounded-md p-0.5">
              <button
                type="button"
                onClick={() => setFileFormat('image/png')}
                className={`px-2.5 py-1 rounded text-[11px] font-mono-tabular ${
                  fileFormat === 'image/png' ? 'bg-amber-500 text-slate-950 font-bold' : 'text-slate-400'
                }`}
              >
                PNG
              </button>
              <button
                type="button"
                onClick={() => setFileFormat('image/jpeg')}
                className={`px-2.5 py-1 rounded text-[11px] font-mono-tabular ${
                  fileFormat === 'image/jpeg' ? 'bg-amber-500 text-slate-950 font-bold' : 'text-slate-400'
                }`}
              >
                JPG
              </button>
            </div>
          </div>

          {EXPORT_PRESETS.map((fmt) => (
            <button
              key={fmt.id}
              type="button"
              onClick={() => setSelectedDimension(fmt.id)}
              className={`w-full p-3 rounded-lg border text-left transition flex items-center justify-between ${
                selectedDimension === fmt.id
                  ? 'bg-amber-500/10 border-amber-500 text-white'
                  : 'bg-[#0B0F19] border-slate-800 text-slate-400 hover:border-slate-700'
              }`}
            >
              <div>
                <div className="flex items-center gap-2">
                  <span className="font-semibold text-xs text-slate-100">{fmt.name}</span>
                  <span className="text-[11px] font-mono-tabular text-amber-400">{fmt.res} px</span>
                </div>
                <p className="text-[11px] text-slate-400 mt-0.5">{fmt.desc}</p>
              </div>
              {selectedDimension === fmt.id && <Check className="w-4 h-4 text-amber-400 shrink-0" />}
            </button>
          ))}

          {downloadComplete && (
            <div className="p-3 rounded-lg bg-emerald-950/60 border border-emerald-500/40 text-emerald-300 text-xs flex items-center gap-2">
              <Check className="w-4 h-4 text-emerald-400" />
              <span>Export downloaded at {selectedDimension} cleanly.</span>
            </div>
          )}
        </div>

        <div className="p-4 border-t border-slate-800 bg-[#0B0F19] flex items-center justify-end gap-2">
          {onOpenPublish && (
            <button
              type="button"
              onClick={() => {
                onClose();
                onOpenPublish();
              }}
              className="flex items-center gap-1.5 px-4 py-2 rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-100 font-semibold text-xs transition"
            >
              <Send className="w-3.5 h-3.5 text-amber-400" />
              <span>Publish / Schedule</span>
            </button>
          )}

          <button
            type="button"
            onClick={handleDownload}
            disabled={isExporting}
            className="flex items-center gap-2 px-5 py-2 rounded-lg bg-amber-500 hover:bg-amber-400 text-slate-950 font-bold text-xs disabled:opacity-50 transition"
          >
            <Download className="w-3.5 h-3.5" />
            <span>{isExporting ? 'Rendering...' : 'Download Asset'}</span>
          </button>
        </div>
      </div>
    </div>
  );
};

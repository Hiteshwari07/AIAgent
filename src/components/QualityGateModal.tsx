import React, { useEffect, useState } from 'react';
import { ShieldCheck, CheckCircle2, AlertTriangle, X, RefreshCw, Wand2 } from 'lucide-react';
import { PosterConfig, QualityReport } from '../types';
import { safeFetchJson } from '../utils/safeFetch';

interface QualityGateModalProps {
  poster: PosterConfig;
  isOpen: boolean;
  onClose: () => void;
  onAutoFix: () => void;
}

export const QualityGateModal: React.FC<QualityGateModalProps> = ({
  poster,
  isOpen,
  onClose,
  onAutoFix,
}) => {
  const [isRunningAudit, setIsRunningAudit] = useState(false);
  const [liveReport, setLiveReport] = useState<QualityReport>(poster.qualityReport);

  const runLiveAudit = async () => {
    setIsRunningAudit(true);
    try {
      const res = await safeFetchJson('/api/quality-gate', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ posterConfig: poster }),
      });
      if (res.ok && res.data && typeof res.data.score === 'number') {
        setLiveReport(res.data);
      }
    } catch {
      // keep existing report
    } finally {
      setIsRunningAudit(false);
    }
  };

  useEffect(() => {
    if (isOpen) {
      runLiveAudit();
    }
  }, [isOpen, poster.id, poster.backgroundDarkness, poster.headline.text, poster.aspectRatio]);

  if (!isOpen) return null;

  const checks = [
    {
      title: '1. Spelling & Copy Accuracy',
      passed: liveReport.spellingPassed !== false && liveReport.copyMatchPassed !== false,
      detail: 'Verifies English, Hindi, or Gujarati headline, subheading & highlight spelling without hallucinations.',
    },
    {
      title: '2. Company Branding Presence',
      passed: liveReport.brandingPassed !== false,
      detail: 'Ensures logo lockup or configured company name renders crisply in safe corner.',
    },
    {
      title: '3. Alignment & >= 6% Safe Margins',
      passed: liveReport.marginSafePassed,
      detail: 'Prevents typography, badges, or CTAs from clipping near mobile/feed frame borders.',
    },
    {
      title: '4. High Visual Contrast Scrim',
      passed: liveReport.contrastPassed,
      detail: `Active dark scrim (${Math.round((poster.backgroundDarkness ?? 0.16) * 100)}%) enforces strong text-to-background readability.`,
    },
    {
      title: '5. Zero Layer Overlap / Collisions',
      passed: liveReport.noCollisionPassed,
      detail: 'Verifies clean spacing between typography zones and focal illustrations.',
    },
    {
      title: '6. AI Background OCR Purity',
      passed: liveReport.noAiTextPassed,
      detail: 'Confirms AI scene canvas is free of distorted letters or hallucinated watermarks.',
    },
    {
      title: '7. Layout Whitespace Balance',
      passed: liveReport.balancePassed !== false,
      detail: 'Checks headline conciseness and structured highlight density (max 4 bullets).',
    },
    {
      title: '8. Target Aspect & Export Dimension Lock',
      passed: liveReport.dimensionsPassed !== false,
      detail: `Canvas aspect (${poster.aspectRatio}) ready for 1080×1350, 1080×1080, 1200×630 & 1200×1350 renders.`,
    },
  ];

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-sm">
      <div className="bg-[#111827] border border-slate-800 rounded-xl max-w-2xl w-full shadow-2xl overflow-hidden flex flex-col max-h-[90vh]">
        <div className="px-5 py-4 border-b border-slate-800 bg-[#0B0F19] flex items-center justify-between">
          <div className="flex items-center gap-2.5">
            <ShieldCheck className="w-5 h-5 text-emerald-400" />
            <h2 className="text-base font-bold font-display text-white">
              8-Point Pre-Publish Quality Verification
            </h2>
          </div>

          <button
            type="button"
            onClick={onClose}
            className="p-1.5 rounded-lg text-slate-400 hover:text-white hover:bg-slate-800 transition"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        <div className="p-5 overflow-y-auto space-y-4">
          {/* Score Banner */}
          <div className="p-4 rounded-xl bg-[#0B0F19] border border-slate-800 flex items-center justify-between gap-4">
            <div className="flex items-center gap-3.5">
              <div
                className={`text-2xl font-black font-mono-tabular ${
                  liveReport.passed ? 'text-emerald-400' : 'text-amber-400'
                }`}
              >
                {liveReport.score}%
              </div>
              <div>
                <div className="text-sm font-bold text-white">
                  {liveReport.passed ? 'Ready for Production Publishing' : 'Attention Recommended'}
                </div>
                <div className="text-xs text-slate-400 font-mono-tabular">
                  {checks.filter((c) => c.passed).length}/8 checks verified · {liveReport.checkedAt}
                </div>
              </div>
            </div>

            <button
              type="button"
              onClick={runLiveAudit}
              disabled={isRunningAudit}
              className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-200 text-xs font-medium transition"
            >
              <RefreshCw className={`w-3.5 h-3.5 ${isRunningAudit ? 'animate-spin' : ''}`} />
              <span>Re-Verify</span>
            </button>
          </div>

          {Array.isArray(liveReport.issues) && liveReport.issues.length > 0 && (
            <div className="p-3.5 rounded-lg bg-amber-500/10 border border-amber-500/30 space-y-1 text-xs text-amber-200">
              {liveReport.issues.map((iss, i) => (
                <div key={i} className="flex items-start gap-2">
                  <AlertTriangle className="w-3.5 h-3.5 text-amber-400 shrink-0 mt-0.5" />
                  <span>{iss}</span>
                </div>
              ))}
            </div>
          )}

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5">
            {checks.map((chk) => (
              <div
                key={chk.title}
                className="p-3 rounded-lg bg-[#0B0F19] border border-slate-800 flex items-start gap-2.5"
              >
                {chk.passed ? (
                  <CheckCircle2 className="w-4 h-4 text-emerald-400 shrink-0 mt-0.5" />
                ) : (
                  <AlertTriangle className="w-4 h-4 text-amber-400 shrink-0 mt-0.5" />
                )}
                <div className="text-xs">
                  <div className="font-semibold text-slate-100">{chk.title}</div>
                  <p className="text-slate-400 mt-0.5 leading-snug">{chk.detail}</p>
                </div>
              </div>
            ))}
          </div>
        </div>

        <div className="p-4 border-t border-slate-800 bg-[#0B0F19] flex items-center justify-between gap-2">
          {!liveReport.passed ? (
            <button
              type="button"
              onClick={() => {
                onAutoFix();
                setTimeout(runLiveAudit, 150);
              }}
              className="flex items-center gap-1.5 px-4 py-2 rounded-lg bg-slate-800 hover:bg-slate-700 text-amber-300 text-xs font-semibold transition"
            >
              <Wand2 className="w-3.5 h-3.5" />
              <span>Auto-Adjust Scrim &amp; Spacing</span>
            </button>
          ) : (
            <div />
          )}

          <button
            type="button"
            onClick={onClose}
            className="px-4 py-2 rounded-lg bg-amber-500 hover:bg-amber-400 text-slate-950 font-bold text-xs transition"
          >
            Done
          </button>
        </div>
      </div>
    </div>
  );
};

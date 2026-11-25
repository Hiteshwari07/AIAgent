import React, { useEffect, useState } from 'react';
import { FestivalOccasion, PosterLanguage } from '../types';
import { CalendarClock, Sparkles, Clock } from 'lucide-react';
import { safeFetchJson } from '../utils/safeFetch';

interface UpcomingFestivalsViewProps {
  defaultLanguage: PosterLanguage;
  onDesignFestivalPoster: (festival: FestivalOccasion, language: PosterLanguage) => void;
  onScheduleFestivalPoster: (festival: FestivalOccasion, language: PosterLanguage) => void;
}

export const UpcomingFestivalsView: React.FC<UpcomingFestivalsViewProps> = ({
  defaultLanguage,
  onDesignFestivalPoster,
  onScheduleFestivalPoster,
}) => {
  const [festivals, setFestivals] = useState<FestivalOccasion[]>([]);
  const [referenceDate, setReferenceDate] = useState('');
  const [filterType, setFilterType] = useState<'all' | 'indian_festival' | 'national_special_day'>('all');
  const [selectedLang, setSelectedLang] = useState<PosterLanguage>(defaultLanguage);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    safeFetchJson('/api/festivals')
      .then((res) => {
        if (res.data?.success && Array.isArray(res.data.festivals)) {
          setFestivals(res.data.festivals);
          setReferenceDate(res.data.referenceDate || '');
        }
      })
      .finally(() => setLoading(false));
  }, []);

  const filtered = festivals.filter((f) => filterType === 'all' || f.type === filterType);

  return (
    <div className="max-w-5xl mx-auto space-y-5">
      <div className="flex flex-wrap items-end justify-between gap-4 border-b border-slate-800 pb-4">
        <div>
          <h2 className="text-xl font-bold font-display text-white tracking-tight">
            Upcoming Indian Festivals &amp; National Special Days
          </h2>
          <p className="text-sm text-slate-400 mt-1">
            Plan greetings ahead with culturally accurate designs in English, Hindi, or Gujarati. Auto-scheduled posts only publish when explicitly approved.
          </p>
        </div>
        {referenceDate && (
          <div className="text-xs font-mono-tabular text-slate-400">
            Today: {referenceDate}
          </div>
        )}
      </div>

      {/* Controls Row */}
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="flex items-center gap-1.5 bg-[#111827] border border-slate-800 rounded-lg p-1 text-xs">
          {[
            { id: 'all', label: `All (${festivals.length})` },
            { id: 'indian_festival', label: 'Indian Festivals (16)' },
            { id: 'national_special_day', label: 'National & Special Days (13)' },
          ].map((tab) => (
            <button
              key={tab.id}
              type="button"
              onClick={() => setFilterType(tab.id as any)}
              className={`px-3 py-1.5 rounded-md font-medium transition ${
                filterType === tab.id
                  ? 'bg-amber-500/20 text-amber-300'
                  : 'text-slate-400 hover:text-slate-200'
              }`}
            >
              {tab.label}
            </button>
          ))}
        </div>

        <div className="flex items-center gap-2 text-xs">
          <span className="text-slate-400">Greeting Language:</span>
          <select
            value={selectedLang}
            onChange={(e) => setSelectedLang(e.target.value as PosterLanguage)}
            className="bg-[#111827] border border-slate-800 rounded-lg px-2.5 py-1.5 text-slate-100 focus:outline-none focus:border-amber-500"
          >
            <option value="english">English</option>
            <option value="hindi">Hindi</option>
            <option value="gujarati">Gujarati</option>
          </select>
        </div>
      </div>

      {loading ? (
        <div className="py-12 text-center text-sm text-slate-500">Loading festival calendar...</div>
      ) : (
        <div className="bg-[#111827] border border-slate-800 rounded-xl overflow-hidden">
          <table className="w-full text-left border-collapse">
            <thead>
              <tr className="border-b border-slate-800 text-[11px] font-semibold uppercase tracking-wider text-slate-400 bg-[#0B0F19]">
                <th className="py-3 px-4">Occasion</th>
                <th className="py-3 px-4">Date</th>
                <th className="py-3 px-4">Timeline</th>
                <th className="py-3 px-4 hidden md:table-cell">Preview Greeting ({selectedLang})</th>
                <th className="py-3 px-4 text-right">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-800/80 text-sm">
              {filtered.map((fest) => {
                const isSoon = fest.daysUntil >= 0 && fest.daysUntil <= 30;
                return (
                  <tr key={fest.id} className="hover:bg-slate-800/30 transition">
                    <td className="py-3.5 px-4">
                      <div className="font-semibold text-white">{fest.name}</div>
                      <div className="text-[11px] text-slate-500">
                        {fest.type === 'indian_festival' ? 'Festival' : 'Special Day'}
                      </div>
                    </td>
                    <td className="py-3.5 px-4 font-mono-tabular text-xs text-slate-300">
                      {fest.date}
                    </td>
                    <td className="py-3.5 px-4 font-mono-tabular text-xs">
                      {fest.daysUntil === 0 ? (
                        <span className="text-emerald-400 font-semibold">Today</span>
                      ) : fest.daysUntil > 0 ? (
                        <span className={isSoon ? 'text-amber-400 font-semibold' : 'text-slate-400'}>
                          In {fest.daysUntil}d
                        </span>
                      ) : (
                        <span className="text-slate-500">{Math.abs(fest.daysUntil)}d ago</span>
                      )}
                    </td>
                    <td className="py-3.5 px-4 hidden md:table-cell text-xs text-slate-300 max-w-xs truncate">
                      {fest.suggestedGreeting[selectedLang]}
                    </td>
                    <td className="py-3.5 px-4">
                      <div className="flex items-center justify-end gap-2">
                        <button
                          type="button"
                          onClick={() => onDesignFestivalPoster(fest, selectedLang)}
                          className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-amber-500 hover:bg-amber-400 text-slate-950 font-bold text-xs transition"
                        >
                          <Sparkles className="w-3.5 h-3.5" />
                          <span>Design Poster</span>
                        </button>
                        <button
                          type="button"
                          onClick={() => onScheduleFestivalPoster(fest, selectedLang)}
                          className="flex items-center gap-1 px-2.5 py-1.5 rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-200 text-xs font-medium transition"
                          title="Design & Schedule Advance Auto-Post"
                        >
                          <Clock className="w-3.5 h-3.5 text-sky-400" />
                          <span>Schedule</span>
                        </button>
                      </div>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}

      <div className="flex items-center gap-2 text-xs text-slate-500">
        <CalendarClock className="w-4 h-4 text-slate-400 shrink-0" />
        <span>
          Festival scheduling prepares artwork in advance and requires explicit approval in the Publishing drawer before auto-posting on your selected date.
        </span>
      </div>
    </div>
  );
};

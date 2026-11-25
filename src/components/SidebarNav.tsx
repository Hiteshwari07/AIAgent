import React from 'react';
import {
  Sparkles,
  Building2,
  Cpu,
  Megaphone,
  Briefcase,
  CalendarHeart,
  CalendarClock,
  FolderHeart,
  Palette,
  Share2,
  History,
  PenTool,
} from 'lucide-react';

export type NavSectionId =
  | 'studio'
  | 'create'
  | 'corporate'
  | 'it_tech'
  | 'marketing'
  | 'hiring'
  | 'festival'
  | 'upcoming_festivals'
  | 'my_designs'
  | 'brand_settings'
  | 'social_connections'
  | 'publishing_history';

interface SidebarNavProps {
  activeSection: NavSectionId;
  onSelectSection: (section: NavSectionId) => void;
  brandName?: string;
  connectedCount: number;
  savedCount: number;
}

export const SidebarNav: React.FC<SidebarNavProps> = ({
  activeSection,
  onSelectSection,
  brandName,
  connectedCount,
  savedCount,
}) => {
  const navGroups: Array<{
    title: string;
    items: Array<{ id: NavSectionId; label: string; icon: React.ReactNode; meta?: string }>;
  }> = [
    {
      title: 'Workspace',
      items: [
        { id: 'create', label: 'Create New Poster', icon: <Sparkles className="w-4 h-4" /> },
        { id: 'studio', label: 'Canvas Studio', icon: <PenTool className="w-4 h-4" /> },
        {
          id: 'my_designs',
          label: 'My Designs',
          icon: <FolderHeart className="w-4 h-4" />,
          meta: savedCount > 0 ? String(savedCount) : undefined,
        },
      ],
    },
    {
      title: 'Poster Categories',
      items: [
        { id: 'corporate', label: 'Corporate Posters', icon: <Building2 className="w-4 h-4" /> },
        { id: 'it_tech', label: 'IT & Technology Posters', icon: <Cpu className="w-4 h-4" /> },
        { id: 'marketing', label: 'Marketing Posters', icon: <Megaphone className="w-4 h-4" /> },
        { id: 'hiring', label: 'Hiring Posters', icon: <Briefcase className="w-4 h-4" /> },
        { id: 'festival', label: 'Festival Posters', icon: <CalendarHeart className="w-4 h-4" /> },
        { id: 'upcoming_festivals', label: 'Upcoming Festivals', icon: <CalendarClock className="w-4 h-4" /> },
      ],
    },
    {
      title: 'Brand & Publishing',
      items: [
        {
          id: 'brand_settings',
          label: 'Brand Settings',
          icon: <Palette className="w-4 h-4" />,
          meta: brandName ? 'Set' : undefined,
        },
        {
          id: 'social_connections',
          label: 'Social Connections',
          icon: <Share2 className="w-4 h-4" />,
          meta: `${connectedCount}/3`,
        },
        { id: 'publishing_history', label: 'Publishing History', icon: <History className="w-4 h-4" /> },
      ],
    },
  ];

  return (
    <aside className="w-64 shrink-0 bg-[#0D1322] border-r border-slate-800/90 flex flex-col justify-between min-h-[calc(100vh-56px)]">
      <div className="p-3 space-y-5 overflow-y-auto">
        {navGroups.map((group) => (
          <div key={group.title}>
            <div className="px-2.5 mb-1.5 text-[10px] font-semibold uppercase tracking-widest text-slate-500">
              {group.title}
            </div>
            <nav className="space-y-0.5">
              {group.items.map((item) => {
                const isActive = activeSection === item.id;
                return (
                  <button
                    key={item.id}
                    type="button"
                    onClick={() => onSelectSection(item.id)}
                    className={`w-full flex items-center justify-between px-2.5 py-2 rounded-lg text-[13px] font-medium transition text-left ${
                      isActive
                        ? 'bg-amber-500/15 text-amber-300'
                        : 'text-slate-400 hover:text-slate-100 hover:bg-slate-800/60'
                    }`}
                  >
                    <span className="flex items-center gap-2.5 truncate">
                      <span className={isActive ? 'text-amber-400' : 'text-slate-500'}>{item.icon}</span>
                      <span className="truncate">{item.label}</span>
                    </span>
                    {item.meta && (
                      <span className="text-[11px] font-mono-tabular text-slate-400">{item.meta}</span>
                    )}
                  </button>
                );
              })}
            </nav>
          </div>
        ))}
      </div>

      <div className="p-3 border-t border-slate-800/80 text-[11px] text-slate-500">
        <div className="font-medium text-slate-300 truncate">
          {brandName || 'No Brand Configured'}
        </div>
        <div className="font-mono-tabular text-[10px] text-slate-500 mt-0.5">
          {connectedCount}/3 channels linked
        </div>
      </div>
    </aside>
  );
};

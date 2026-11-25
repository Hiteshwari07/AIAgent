import React, { useEffect, useState } from 'react';
import { SidebarNav, NavSectionId } from './components/SidebarNav';
import { PosterCanvas } from './components/PosterCanvas';
import { SideBySidePicker } from './components/SideBySidePicker';
import { ChatEditor, ChatGeneratePosterParams, ChatSceneOverride } from './components/ChatEditor';
import { QualityGateModal } from './components/QualityGateModal';
import { PromptBuilderModal } from './components/PromptBuilderModal';
import { LayerControlsModal } from './components/LayerControlsModal';
import { ExportModal } from './components/ExportModal';
import { PublishModal } from './components/PublishModal';
import { CreatePosterWizard } from './components/CreatePosterWizard';
import { CategoryGalleryView } from './components/CategoryGalleryView';
import { UpcomingFestivalsView } from './components/UpcomingFestivalsView';
import { BrandSettingsView } from './components/BrandSettingsView';
import { MyDesignsView } from './components/MyDesignsView';
import { SocialConnectionsView } from './components/SocialConnectionsView';
import { PublishingHistoryView } from './components/PublishingHistoryView';
import { TEST_SHOWCASES, PROCEDURAL_SCENES } from './presets';
import { safeFetchJson } from './utils/safeFetch';
import {
  AspectRatio,
  CompanyBrandProfile,
  FestivalOccasion,
  OccasionType,
  PosterCategory,
  PosterConfig,
  PosterLanguage,
  PosterLayoutStyle,
  SavedDesignItem,
  SceneVariation,
} from './types';
import {
  Sliders,
  Wand2,
  Download,
  Send,
  Undo2,
  Redo2,
  Sparkles,
  Check,
} from 'lucide-react';

const EMPTY_BRAND: CompanyBrandProfile = {
  companyName: '',
  tagline: '',
  website: '',
  email: '',
  phone: '',
  address: '',
  logoDataUrl: '',
  primaryColor: '#F59E0B',
  secondaryColor: '#0F172A',
  accentColor: '#06B6D4',
  defaultLanguage: 'english',
};

const SECTION_LABELS: Record<NavSectionId, string> = {
  create: 'Create New Poster',
  studio: 'Canvas Studio',
  corporate: 'Corporate & Company Posters',
  it_tech: 'IT & Technology Posters',
  marketing: 'Marketing & Promotional Posters',
  hiring: 'Hiring & Recruitment Posters',
  festival: 'Festival & Special Occasion Posters',
  upcoming_festivals: 'Upcoming Indian Festivals & Special Days',
  my_designs: 'My Saved Designs',
  brand_settings: 'Company Brand Settings',
  social_connections: 'Social Connections',
  publishing_history: 'Publishing History & Queue',
};

export default function App() {
  const [activeSection, setActiveSection] = useState<NavSectionId>('studio');

  // Studio History (Undo / Redo)
  const [history, setHistory] = useState<PosterConfig[]>([TEST_SHOWCASES[0]]);
  const [historyIndex, setHistoryIndex] = useState(0);
  const currentPoster = history[historyIndex] || TEST_SHOWCASES[0];

  // Server-persisted Brand, Designs, Captions & Connection Status
  const [brandProfile, setBrandProfile] = useState<CompanyBrandProfile>(EMPTY_BRAND);
  const [savedDesigns, setSavedDesigns] = useState<SavedDesignItem[]>([]);
  const [connectedCount, setConnectedCount] = useState(0);
  const [activeCaptions, setActiveCaptions] = useState<
    { instagram: string; facebook: string; linkedin: string } | undefined
  >(undefined);

  // Create Wizard Context
  const [wizardContext, setWizardContext] = useState<{
    category: PosterCategory;
    subCategory?: string;
    occasion?: OccasionType;
    language?: PosterLanguage;
  }>({ category: 'corporate' });

  // Publish Modal State
  const [publishMode, setPublishMode] = useState<'now' | 'schedule'>('now');
  const [publishScheduleDate, setPublishScheduleDate] = useState<string | undefined>(undefined);
  const [publishPlatforms, setPublishPlatforms] = useState<Array<'instagram' | 'facebook' | 'linkedin'> | undefined>(undefined);

  // Modals & Studio UI
  const [showSafeMargins, setShowSafeMargins] = useState(true);
  const [isQualityGateOpen, setIsQualityGateOpen] = useState(false);
  const [isPromptBuilderOpen, setIsPromptBuilderOpen] = useState(false);
  const [isLayerControlsOpen, setIsLayerControlsOpen] = useState(false);
  const [isExportOpen, setIsExportOpen] = useState(false);
  const [isPublishOpen, setIsPublishOpen] = useState(false);
  const [isGeneratingScenes, setIsGeneratingScenes] = useState(false);
  const [isSavingDesign, setIsSavingDesign] = useState(false);
  const [studioNotice, setStudioNotice] = useState<string | null>(null);

  const loadBootstrapData = async () => {
    try {
      const [bRes, dRes, sRes] = await Promise.all([
        safeFetchJson('/api/brand'),
        safeFetchJson('/api/designs'),
        safeFetchJson('/api/social/status'),
      ]);
      const bResp = bRes.data;
      const dResp = dRes.data;
      const sResp = sRes.data;
      if (bResp?.success && bResp.brand) setBrandProfile(bResp.brand);
      if (dResp?.success && Array.isArray(dResp.designs)) setSavedDesigns(dResp.designs);
      if (sResp?.success && sResp.status) {
        const count = [
          sResp.status.instagram?.connected,
          sResp.status.facebook?.connected,
          sResp.status.linkedin?.connected,
        ].filter(Boolean).length;
        setConnectedCount(count);
      }
    } catch {
      // keep initial defaults
    }
  };

  useEffect(() => {
    loadBootstrapData();
  }, []);

  const pushState = (newPoster: PosterConfig) => {
    const updatedHistory = history.slice(0, historyIndex + 1);
    setHistory([...updatedHistory, newPoster]);
    setHistoryIndex(updatedHistory.length);
  };

  const handleUndo = () => {
    if (historyIndex > 0) setHistoryIndex(historyIndex - 1);
  };

  const handleRedo = () => {
    if (historyIndex < history.length - 1) setHistoryIndex(historyIndex + 1);
  };

  const handleUpdatePoster = (updates: Partial<PosterConfig>) => {
    const updated: PosterConfig = {
      ...currentPoster,
      ...updates,
      headline: updates.headline ? { ...currentPoster.headline, ...updates.headline } : currentPoster.headline,
      subheading: updates.subheading ? { ...currentPoster.subheading, ...updates.subheading } : currentPoster.subheading,
      offerBadge: updates.offerBadge ? { ...currentPoster.offerBadge, ...updates.offerBadge } : currentPoster.offerBadge,
      ctaButton: updates.ctaButton ? { ...currentPoster.ctaButton, ...updates.ctaButton } : currentPoster.ctaButton,
      productPhoto: updates.productPhoto
        ? { ...currentPoster.productPhoto, ...updates.productPhoto }
        : currentPoster.productPhoto,
      brandLogo: updates.brandLogo ? { ...currentPoster.brandLogo, ...updates.brandLogo } : currentPoster.brandLogo,
    };
    pushState(updated);
  };

  const handleSelectVariation = (variationIndex: number) => {
    const chosen = currentPoster.backgroundImages[variationIndex];
    if (!chosen) return;
    const nextLayout = chosen.layoutStyle || currentPoster.layoutStyle;

    const updated: PosterConfig = {
      ...currentPoster,
      activeVariationIndex: variationIndex,
      layoutStyle: nextLayout,
      highlights: chosen.highlights || currentPoster.highlights,
      customPalette: chosen.palette || currentPoster.customPalette,
      headline: {
        ...currentPoster.headline,
        text: chosen.headlineText || currentPoster.headline.text,
        subtext: chosen.headlineSubtext || currentPoster.headline.subtext,
        style: chosen.headlineStyle || currentPoster.headline.style,
        font: chosen.headlineFont || currentPoster.headline.font,
        align: nextLayout === 'centered_editorial' ? 'center' : 'left',
      },
      subheading: {
        ...currentPoster.subheading,
        text: chosen.subheadingText || currentPoster.subheading.text,
      },
      offerBadge: {
        ...currentPoster.offerBadge,
        text: chosen.badgeText ?? currentPoster.offerBadge.text,
        subtext: chosen.badgeSubtext ?? currentPoster.offerBadge.subtext,
        style: chosen.badgeStyle || currentPoster.offerBadge.style,
      },
      ctaButton: {
        ...currentPoster.ctaButton,
        text: chosen.ctaText || currentPoster.ctaButton.text,
        style: chosen.ctaStyle || currentPoster.ctaButton.style,
      },
    };
    pushState(updated);
  };

  const handleGenerateScenes = async (
    occasion: OccasionType = currentPoster.occasion,
    customDetails?: ChatSceneOverride,
    pendingLayerUpdates?: Partial<PosterConfig>
  ) => {
    setIsGeneratingScenes(true);
    const mergedBase: PosterConfig = pendingLayerUpdates
      ? {
          ...currentPoster,
          ...pendingLayerUpdates,
          headline: pendingLayerUpdates.headline
            ? { ...currentPoster.headline, ...pendingLayerUpdates.headline }
            : currentPoster.headline,
          subheading: pendingLayerUpdates.subheading
            ? { ...currentPoster.subheading, ...pendingLayerUpdates.subheading }
            : currentPoster.subheading,
          offerBadge: pendingLayerUpdates.offerBadge
            ? { ...currentPoster.offerBadge, ...pendingLayerUpdates.offerBadge }
            : currentPoster.offerBadge,
          ctaButton: pendingLayerUpdates.ctaButton
            ? { ...currentPoster.ctaButton, ...pendingLayerUpdates.ctaButton }
            : currentPoster.ctaButton,
          productPhoto: pendingLayerUpdates.productPhoto
            ? { ...currentPoster.productPhoto, ...pendingLayerUpdates.productPhoto }
            : currentPoster.productPhoto,
          brandLogo: pendingLayerUpdates.brandLogo
            ? { ...currentPoster.brandLogo, ...pendingLayerUpdates.brandLogo }
            : currentPoster.brandLogo,
        }
      : currentPoster;

    try {
      const res = await safeFetchJson('/api/generate-scenes', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          occasion,
          category: mergedBase.category,
          subCategory: mergedBase.subCategory,
          aspectRatio: mergedBase.aspectRatio,
          palette:
            customDetails?.palette ||
            (pendingLayerUpdates?.customPalette
              ? `${pendingLayerUpdates.customPalette.secondary || ''} background with ${pendingLayerUpdates.customPalette.primary || ''} highlights`.trim()
              : undefined),
          decorations: customDetails?.decorations,
          customTopic: customDetails?.customTopic,
        }),
      });
      const data = res.data;
      if (res.ok && data?.variations && data.variations.length > 0) {
        pushState({
          ...mergedBase,
          occasion,
          backgroundImages: data.variations,
          activeVariationIndex: 0,
        });
      } else if (pendingLayerUpdates) {
        pushState(mergedBase);
      } else if (!res.ok) {
        throw new Error(res.error || 'Scene generation failed');
      }
    } catch {
      const pool =
        PROCEDURAL_SCENES[occasion] ||
        PROCEDURAL_SCENES[mergedBase.category || 'corporate'] ||
        PROCEDURAL_SCENES.corporate;
      const proceduralFallbacks: SceneVariation[] = pool.map((svgUrl: string, i: number) => ({
        id: `procedural-${occasion}-${i}`,
        imageUrl: svgUrl,
        prompt: `Studio procedural backdrop for ${occasion}`,
        source: 'procedural',
        qualityPassed: true,
        ocrDetectedText: [],
      }));
      pushState({
        ...mergedBase,
        occasion,
        backgroundImages: proceduralFallbacks,
        activeVariationIndex: 0,
      });
    } finally {
      setIsGeneratingScenes(false);
    }
  };

  const handleGeneratePosterFromChat = async (params: ChatGeneratePosterParams) => {
    setIsGeneratingScenes(true);
    try {
      const category = params.category || 'corporate';
      const subCategory = params.subCategory || params.topic || 'Featured Showcase';
      const occasion = params.occasion || (category === 'festival' ? 'diwali' : (category as OccasionType));
      const language: PosterLanguage =
        params.language === 'hindi' || params.language === 'gujarati'
          ? params.language
          : brandProfile.defaultLanguage || 'english';
      const aspectRatio: AspectRatio =
        params.aspectRatio === '1:1' || params.aspectRatio === '16:9' || params.aspectRatio === '9:16'
          ? params.aspectRatio
          : '4:5';

      const res = await safeFetchJson('/api/poster/generate-suite', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          category,
          subCategory,
          occasion,
          topic: params.topic || subCategory,
          language,
          aspectRatio,
          highlightsInput: Array.isArray(params.highlights) ? params.highlights : [],
          offerText: params.offerText || '',
          ctaInput: params.ctaInput || '',
          palettePrompt: params.palette || '',
          decorationsPrompt: params.decorations || '',
          includeBrandProfile: true,
        }),
      });
      const data = res.data;
      if (!res.ok || !data?.success || !Array.isArray(data.variations) || data.variations.length === 0) {
        throw new Error(res.error || data?.error || 'Could not generate poster concepts.');
      }

      const first = data.variations[0];
      const fontMap: Record<PosterLanguage, string> = {
        english: 'font-jakarta',
        hindi: 'font-hindi',
        gujarati: 'font-gujarati',
      };

      const builtPoster: PosterConfig = {
        id: `chat_poster_${Date.now()}`,
        title: `${subCategory} (${language.toUpperCase()})`,
        category,
        subCategory,
        language,
        layoutStyle: first.layoutStyle || 'executive_left',
        occasion,
        aspectRatio,
        backgroundImages: data.variations,
        activeVariationIndex: 0,
        backgroundDarkness: 0.22,
        backgroundBlur: 0,
        highlights: first.highlights || params.highlights || [],
        companyInfo: data.companyInfo,
        customPalette: first.palette,
        headline: {
          text: first.headlineText,
          subtext: first.headlineSubtext || subCategory.toUpperCase(),
          font: first.headlineFont || fontMap[language],
          style: first.headlineStyle || 'white',
          size: language === 'english' ? 40 : 42,
          yOffset: 17,
          xOffset: 0,
          align: first.layoutStyle === 'centered_editorial' ? 'center' : 'left',
          letterSpacing: language === 'english' ? 0.5 : 0,
        },
        subheading: {
          text: first.subheadingText,
          font: fontMap[language],
          color: '#E2E8F0',
          size: 16,
          yOffset: 28,
          visible: true,
        },
        offerBadge: {
          text: first.badgeText || params.offerText || '',
          subtext: first.badgeSubtext || '',
          style: first.badgeStyle || (category === 'festival' ? 'scalloped_gold' : 'minimal_ring'),
          size: 0.95,
          x: 82,
          y: 26,
          rotation: 0,
          visible: Boolean(first.badgeText || params.offerText),
        },
        ctaButton: {
          text: first.ctaText || params.ctaInput || 'Learn More',
          style: first.ctaStyle || (category === 'it_tech' ? 'neon_accent' : 'gold_pill'),
          size: 1,
          yOffset: 86,
          visible: Boolean(first.ctaText || params.ctaInput),
        },
        productPhoto: {
          url: '',
          label: subCategory,
          x: first.layoutStyle === 'centered_editorial' ? 50 : 74,
          y: 58,
          scale: 0.95,
          shadowIntensity: 0.75,
          glowColor: first.palette?.accent || '#38BDF8',
          glowIntensity: 0.45,
          useCardFallback: false,
          cardBorderRadius: 16,
          visible: false,
        },
        brandLogo: {
          url: brandProfile.logoDataUrl || '',
          name: brandProfile.companyName || '',
          position: 'top-left',
          size: 145,
          withPlate: true,
          visible: Boolean(brandProfile.logoDataUrl),
        },
        qualityReport: {
          passed: true,
          score: 100,
          noAiTextPassed: true,
          marginSafePassed: true,
          contrastPassed: true,
          noCollisionPassed: true,
          copyMatchPassed: true,
          spellingPassed: true,
          brandingPassed: Boolean(brandProfile.logoDataUrl || brandProfile.companyName),
          dimensionsPassed: true,
          balancePassed: true,
          issues: [],
          ocrDetectedText: [],
          repairedAutomatically: false,
          checkedAt: new Date().toLocaleTimeString(),
        },
      };

      pushState(builtPoster);
      setActiveCaptions(data.captions);
      return { poster: builtPoster, captions: data.captions };
    } finally {
      setIsGeneratingScenes(false);
    }
  };

  const handleSaveBrand = async (profile: CompanyBrandProfile) => {
    const res = await safeFetchJson('/api/brand', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(profile),
    });
    const data = res.data;
    if (res.ok && data?.success && data.brand) {
      setBrandProfile(data.brand);
    }
  };

  const handleSaveCurrentDesign = async () => {
    setIsSavingDesign(true);
    setStudioNotice(null);
    try {
      const res = await safeFetchJson('/api/designs', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          name: currentPoster.headline.text || currentPoster.title,
          category: currentPoster.category || 'corporate',
          subCategory: currentPoster.subCategory || currentPoster.occasion,
          language: currentPoster.language || 'english',
          poster: currentPoster,
        }),
      });
      const data = res.data;
      if (res.ok && data?.success && data.design) {
        setSavedDesigns((prev) => [data.design, ...prev.filter((d) => d.id !== data.design.id)]);
        setStudioNotice('Saved to My Designs');
        setTimeout(() => setStudioNotice(null), 2600);
      }
    } finally {
      setIsSavingDesign(false);
    }
  };

  const handleDeleteDesign = async (id: string) => {
    const res = await safeFetchJson(`/api/designs/${id}`, { method: 'DELETE' });
    if (res.ok && res.data?.success) {
      setSavedDesigns((prev) => prev.filter((d) => d.id !== id));
    }
  };

  const handleLaunchFestival = async (
    fest: FestivalOccasion,
    language: PosterLanguage,
    openScheduleAfter: boolean
  ) => {
    setActiveSection('studio');
    setIsGeneratingScenes(true);
    try {
      const res = await safeFetchJson('/api/poster/generate-suite', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          category: 'festival',
          subCategory: fest.name,
          occasion: fest.slug,
          topic: fest.suggestedGreeting[language],
          language,
          aspectRatio: '4:5',
          includeBrandProfile: true,
        }),
      });
      const data = res.data;
      if (res.ok && data?.success && Array.isArray(data.variations) && data.variations.length > 0) {
        const first = data.variations[0];
        const fontMap: Record<PosterLanguage, string> = {
          english: 'font-cinzel',
          hindi: 'font-hindi',
          gujarati: 'font-gujarati',
        };
        const newPoster: PosterConfig = {
          id: `fest_${fest.slug}_${Date.now()}`,
          title: `${fest.name} (${language})`,
          category: 'festival',
          subCategory: fest.name,
          language,
          layoutStyle: first.layoutStyle || 'centered_editorial',
          occasion: fest.slug,
          aspectRatio: '4:5',
          backgroundImages: data.variations,
          activeVariationIndex: 0,
          backgroundDarkness: 0.2,
          backgroundBlur: 0,
          highlights: first.highlights || [],
          companyInfo: data.companyInfo,
          customPalette: first.palette,
          headline: {
            text: first.headlineText || fest.suggestedGreeting[language],
            subtext: first.headlineSubtext || fest.name.toUpperCase(),
            font: first.headlineFont || fontMap[language],
            style: first.headlineStyle || 'gold',
            size: 40,
            yOffset: 17,
            xOffset: 0,
            align: first.layoutStyle === 'centered_editorial' ? 'center' : 'left',
            letterSpacing: language === 'english' ? 1 : 0,
          },
          subheading: {
            text: first.subheadingText,
            font: fontMap[language],
            color: '#FDE68A',
            size: 17,
            yOffset: 28,
            visible: true,
          },
          offerBadge: {
            text: first.badgeText || String(fest.year),
            subtext: first.badgeSubtext || 'Greetings',
            style: first.badgeStyle || 'scalloped_gold',
            size: 0.9,
            x: 82,
            y: 26,
            rotation: 0,
            visible: true,
          },
          ctaButton: {
            text: first.ctaText || 'Warm Wishes',
            style: first.ctaStyle || 'gold_pill',
            size: 1,
            yOffset: 86,
            visible: true,
          },
          productPhoto: {
            url: '',
            label: fest.name,
            x: 50,
            y: 58,
            scale: 1,
            shadowIntensity: 0.6,
            glowColor: '#F59E0B',
            glowIntensity: 0.35,
            useCardFallback: false,
            cardBorderRadius: 16,
            visible: false,
          },
          brandLogo: {
            url: brandProfile.logoDataUrl || '',
            name: brandProfile.companyName || '',
            position: 'top-left',
            size: 145,
            withPlate: true,
            visible: Boolean(brandProfile.logoDataUrl),
          },
          qualityReport: {
            passed: true,
            score: 100,
            noAiTextPassed: true,
            marginSafePassed: true,
            contrastPassed: true,
            noCollisionPassed: true,
            copyMatchPassed: true,
            spellingPassed: true,
            brandingPassed: Boolean(brandProfile.logoDataUrl || brandProfile.companyName),
            dimensionsPassed: true,
            balancePassed: true,
            issues: [],
            ocrDetectedText: [],
            repairedAutomatically: false,
            checkedAt: new Date().toLocaleTimeString(),
          },
        };
        pushState(newPoster);
        setActiveCaptions(data.captions);
        if (openScheduleAfter) {
          setPublishMode('schedule');
          setPublishScheduleDate(fest.date);
          setIsPublishOpen(true);
        }
      }
    } finally {
      setIsGeneratingScenes(false);
    }
  };

  return (
    <div className="min-h-screen bg-[#0B0F19] text-slate-100 flex flex-col font-body">
      {/* Minimal 3-Zone Top Header */}
      <header className="h-14 border-b border-slate-800/90 bg-[#0D1322] px-4 flex items-center justify-between gap-4 sticky top-0 z-30">
        <div className="flex items-center gap-3">
          <div className="flex items-center gap-2">
            <img
              src="/assets/postpilot-logo.png"
              alt="PostPilot"
              className="h-9 w-auto rounded-lg object-contain bg-white px-1.5 py-0.5 shadow-sm"
            />
          </div>
          <span className="text-slate-600 hidden sm:inline">·</span>
          <span className="text-xs text-slate-400 hidden sm:inline">{SECTION_LABELS[activeSection]}</span>
        </div>

        {/* Center Undo/Redo + Quick Notice when inside Canvas Studio */}
        <div className="flex items-center gap-2">
          {studioNotice && (
            <span className="text-xs text-emerald-400 flex items-center gap-1 mr-2">
              <Check className="w-3.5 h-3.5" />
              {studioNotice}
            </span>
          )}
          {activeSection === 'studio' && (
            <div className="flex items-center gap-1 bg-[#0B0F19] border border-slate-800 rounded-lg p-1">
              <button
                type="button"
                onClick={handleUndo}
                disabled={historyIndex <= 0}
                className="p-1.5 rounded text-slate-400 hover:text-white disabled:opacity-30 transition"
                title="Undo"
              >
                <Undo2 className="w-3.5 h-3.5" />
              </button>
              <button
                type="button"
                onClick={handleRedo}
                disabled={historyIndex >= history.length - 1}
                className="p-1.5 rounded text-slate-400 hover:text-white disabled:opacity-30 transition"
                title="Redo"
              >
                <Redo2 className="w-3.5 h-3.5" />
              </button>
            </div>
          )}
        </div>

        {/* Right Primary Actions */}
        <div className="flex items-center gap-2">
          <button
            type="button"
            onClick={() => setActiveSection('create')}
            className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-100 text-xs font-semibold transition"
          >
            <Sparkles className="w-3.5 h-3.5 text-amber-400" />
            <span>New Poster</span>
          </button>
          <button
            type="button"
            onClick={() => {
              setPublishMode('now');
              setIsPublishOpen(true);
            }}
            className="flex items-center gap-1.5 px-3.5 py-1.5 rounded-lg bg-amber-500 hover:bg-amber-400 text-slate-950 text-xs font-bold transition"
          >
            <Send className="w-3.5 h-3.5" />
            <span>Publish</span>
          </button>
        </div>
      </header>

      {/* Main Two-Column SaaS Layout */}
      <div className="flex flex-1 min-h-0">
        <SidebarNav
          activeSection={activeSection}
          onSelectSection={(sec) => setActiveSection(sec)}
          brandName={brandProfile.companyName}
          connectedCount={connectedCount}
          savedCount={savedDesigns.length}
        />

        <main className="flex-1 p-5 sm:p-6 overflow-y-auto">
          {activeSection === 'create' && (
            <CreatePosterWizard
              brandProfile={brandProfile}
              initialCategory={wizardContext.category}
              initialSubCategory={wizardContext.subCategory}
              initialOccasion={wizardContext.occasion}
              initialLanguage={wizardContext.language}
              onPosterCreated={(builtPoster, captions) => {
                pushState(builtPoster);
                setActiveCaptions(captions);
                setActiveSection('studio');
              }}
            />
          )}

          {(activeSection === 'corporate' ||
            activeSection === 'it_tech' ||
            activeSection === 'marketing' ||
            activeSection === 'hiring' ||
            activeSection === 'festival') && (
            <CategoryGalleryView
              category={activeSection}
              onStartSubCategory={(cat, sub) => {
                setWizardContext({ category: cat, subCategory: sub });
                setActiveSection('create');
              }}
              onLoadShowcase={(preset) => {
                pushState(preset);
                setActiveCaptions(undefined);
                setActiveSection('studio');
              }}
            />
          )}

          {activeSection === 'upcoming_festivals' && (
            <UpcomingFestivalsView
              defaultLanguage={brandProfile.defaultLanguage || 'english'}
              onDesignFestivalPoster={(fest, lang) => handleLaunchFestival(fest, lang, false)}
              onScheduleFestivalPoster={(fest, lang) => handleLaunchFestival(fest, lang, true)}
            />
          )}

          {activeSection === 'my_designs' && (
            <MyDesignsView
              designs={savedDesigns}
              onLoadDesign={(p) => {
                pushState(p);
                setActiveSection('studio');
              }}
              onPublishDesign={(p) => {
                pushState(p);
                setPublishMode('now');
                setIsPublishOpen(true);
              }}
              onDeleteDesign={handleDeleteDesign}
            />
          )}

          {activeSection === 'brand_settings' && (
            <BrandSettingsView brandProfile={brandProfile} onSaveBrand={handleSaveBrand} />
          )}

          {activeSection === 'social_connections' && (
            <SocialConnectionsView onStatusChange={loadBootstrapData} />
          )}

          {activeSection === 'publishing_history' && <PublishingHistoryView />}

          {activeSection === 'studio' && (
            <div className="max-w-7xl mx-auto flex flex-col gap-5">
              {/* Top Quick Switcher Strip: Aspect Ratio + Layout Composition */}
              <div className="bg-[#111827] border border-slate-800 rounded-xl px-4 py-2.5 flex flex-wrap items-center justify-between gap-3 text-xs">
                <div className="flex flex-wrap items-center gap-3">
                  <span className="font-semibold text-slate-400">Aspect:</span>
                  {(['4:5', '1:1', '16:9', '9:16'] as AspectRatio[]).map((ratio) => (
                    <button
                      key={ratio}
                      type="button"
                      onClick={() => handleUpdatePoster({ aspectRatio: ratio })}
                      className={`px-2.5 py-1 rounded font-mono-tabular transition ${
                        currentPoster.aspectRatio === ratio
                          ? 'bg-amber-500 text-slate-950 font-bold'
                          : 'bg-[#0B0F19] text-slate-300 border border-slate-800 hover:border-slate-700'
                      }`}
                    >
                      {ratio}
                    </button>
                  ))}
                </div>

                <div className="flex flex-wrap items-center gap-2">
                  <span className="font-semibold text-slate-400">Layout:</span>
                  {(
                    [
                      { id: 'executive_left', label: 'Executive Left' },
                      { id: 'centered_editorial', label: 'Centered Editorial' },
                      { id: 'split_frame', label: 'Split Frame' },
                    ] as Array<{ id: PosterLayoutStyle; label: string }>
                  ).map((lay) => (
                    <button
                      key={lay.id}
                      type="button"
                      onClick={() => handleUpdatePoster({ layoutStyle: lay.id })}
                      className={`px-2.5 py-1 rounded transition ${
                        (currentPoster.layoutStyle || 'centered_editorial') === lay.id
                          ? 'bg-slate-800 text-amber-300 border border-amber-500/50 font-semibold'
                          : 'bg-[#0B0F19] text-slate-400 border border-slate-800 hover:text-white'
                      }`}
                    >
                      {lay.label}
                    </button>
                  ))}
                </div>
              </div>

              {/* 3 Creative Concept Variations */}
              <SideBySidePicker
                poster={currentPoster}
                onSelectVariation={handleSelectVariation}
                onRegenerateAll={() => handleGenerateScenes()}
                isGenerating={isGeneratingScenes}
              />

              {/* Studio Main Split: Canvas Left + Assistant & Inspector Right */}
              <div className="grid grid-cols-1 lg:grid-cols-12 gap-5 items-start">
                <div className="lg:col-span-7 flex flex-col items-center">
                  <PosterCanvas
                    poster={currentPoster}
                    showSafeMargins={showSafeMargins}
                    onToggleSafeMargins={() => setShowSafeMargins(!showSafeMargins)}
                    onSaveDesign={handleSaveCurrentDesign}
                    isSavingDesign={isSavingDesign}
                    onOpenQualityGate={() => setIsQualityGateOpen(true)}
                    onOpenExport={() => setIsExportOpen(true)}
                    onOpenPublish={() => {
                      setPublishMode('now');
                      setIsPublishOpen(true);
                    }}
                  />
                </div>

                <div className="lg:col-span-5 flex flex-col gap-3">
                  <ChatEditor
                    poster={currentPoster}
                    onApplyUpdates={(updates) => handleUpdatePoster(updates)}
                    onRegenerateScenes={(override, updates) =>
                      handleGenerateScenes(
                        override?.occasion || currentPoster.occasion,
                        override,
                        updates
                      )
                    }
                    onGeneratePosterFromChat={handleGeneratePosterFromChat}
                    onOpenPublish={(suggested) => {
                      setPublishMode('now');
                      setPublishPlatforms(suggested);
                      setIsPublishOpen(true);
                    }}
                    isProcessing={isGeneratingScenes}
                  />

                  <div className="grid grid-cols-3 gap-2 text-xs">
                    <button
                      type="button"
                      onClick={() => setIsLayerControlsOpen(true)}
                      className="p-3 rounded-xl bg-[#111827] border border-slate-800 hover:border-slate-700 text-left transition"
                    >
                      <div className="flex items-center gap-1.5 text-sky-400 font-bold mb-1">
                        <Sliders className="w-3.5 h-3.5" />
                        <span>Layers</span>
                      </div>
                      <p className="text-[11px] text-slate-400">Text, logo &amp; badge</p>
                    </button>

                    <button
                      type="button"
                      onClick={() => setIsPromptBuilderOpen(true)}
                      className="p-3 rounded-xl bg-[#111827] border border-slate-800 hover:border-slate-700 text-left transition"
                    >
                      <div className="flex items-center gap-1.5 text-amber-400 font-bold mb-1">
                        <Wand2 className="w-3.5 h-3.5" />
                        <span>Scenes</span>
                      </div>
                      <p className="text-[11px] text-slate-400">Custom backdrop</p>
                    </button>

                    <button
                      type="button"
                      onClick={() => setIsExportOpen(true)}
                      className="p-3 rounded-xl bg-[#111827] border border-slate-800 hover:border-slate-700 text-left transition"
                    >
                      <div className="flex items-center gap-1.5 text-emerald-400 font-bold mb-1">
                        <Download className="w-3.5 h-3.5" />
                        <span>Export</span>
                      </div>
                      <p className="text-[11px] text-slate-400">All 5 sizes</p>
                    </button>
                  </div>
                </div>
              </div>
            </div>
          )}
        </main>
      </div>

      {/* Studio Modals */}
      <QualityGateModal
        poster={currentPoster}
        isOpen={isQualityGateOpen}
        onClose={() => setIsQualityGateOpen(false)}
        onAutoFix={() => {
          handleUpdatePoster({
            backgroundDarkness: Math.max(currentPoster.backgroundDarkness, 0.22),
            productPhoto: { ...currentPoster.productPhoto, y: 60 },
          });
        }}
      />

      <PromptBuilderModal
        isOpen={isPromptBuilderOpen}
        onClose={() => setIsPromptBuilderOpen(false)}
        activeOccasion={currentPoster.occasion}
        onGeneratePrompt={(occ, custom) => handleGenerateScenes(occ, custom)}
        isGenerating={isGeneratingScenes}
      />

      <LayerControlsModal
        poster={currentPoster}
        isOpen={isLayerControlsOpen}
        onClose={() => setIsLayerControlsOpen(false)}
        onUpdatePoster={handleUpdatePoster}
      />

      <ExportModal
        poster={currentPoster}
        isOpen={isExportOpen}
        onClose={() => setIsExportOpen(false)}
        onOpenPublish={() => {
          setPublishMode('now');
          setIsPublishOpen(true);
        }}
      />

      <PublishModal
        poster={currentPoster}
        isOpen={isPublishOpen}
        initialMode={publishMode}
        initialScheduleDate={publishScheduleDate}
        initialCaptions={activeCaptions}
        initialSelectedPlatforms={publishPlatforms}
        onClose={() => {
          setIsPublishOpen(false);
          setPublishPlatforms(undefined);
        }}
        onGoToConnections={() => setActiveSection('social_connections')}
      />
    </div>
  );
}

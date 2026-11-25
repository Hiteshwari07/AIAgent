export type AspectRatio = '1:1' | '4:5' | '9:16' | '16:9';

export type ExportDimension =
  | '1080x1350'
  | '1080x1080'
  | '1080x1920'
  | '1200x630'
  | '1200x1350';

export type PosterCategory =
  | 'corporate'
  | 'it_tech'
  | 'marketing'
  | 'hiring'
  | 'festival';

export type PosterLanguage = 'english' | 'hindi' | 'gujarati';

export type PosterLayoutStyle =
  | 'executive_left'
  | 'centered_editorial'
  | 'split_frame';

export type OccasionType =
  | 'diwali'
  | 'dhanteras'
  | 'navratri'
  | 'durga_puja'
  | 'dussehra'
  | 'ganesh_chaturthi'
  | 'janmashtami'
  | 'raksha_bandhan'
  | 'holi'
  | 'uttarayan'
  | 'pongal'
  | 'onam'
  | 'eid_ul_fitr'
  | 'eid_ul_adha'
  | 'eid'
  | 'christmas'
  | 'new_year'
  | 'republic_day'
  | 'independence_day'
  | 'gandhi_jayanti'
  | 'womens_day'
  | 'teachers_day'
  | 'childrens_day'
  | 'labour_day'
  | 'environment_day'
  | 'yoga_day'
  | 'health_day'
  | 'engineers_day'
  | 'technology_day'
  | 'entrepreneurs_day'
  | 'product_launch'
  | 'sale'
  | 'corporate'
  | 'it_tech'
  | 'hiring'
  | 'custom';

export type HeadlineStyle = 'gold' | 'silver' | 'rose_gold' | 'emerald' | 'white';

export interface HeadlineConfig {
  text: string;
  subtext: string;
  font: string;
  style: HeadlineStyle;
  size: number;
  yOffset: number;
  xOffset: number;
  align: 'center' | 'left' | 'right';
  letterSpacing: number;
}

export interface SubheadingConfig {
  text: string;
  font: string;
  color: string;
  size: number;
  yOffset: number;
  visible: boolean;
}

export interface OfferBadgeConfig {
  text: string;
  subtext: string;
  style: 'scalloped_gold' | 'minimal_ring' | 'festive_tag' | 'neon_badge';
  size: number;
  x: number;
  y: number;
  rotation: number;
  visible: boolean;
}

export interface CtaButtonConfig {
  text: string;
  style: 'gold_pill' | 'solid_crimson' | 'emerald_luxury' | 'glass_border' | 'neon_accent';
  size: number;
  yOffset: number;
  visible: boolean;
}

export interface ProductPhotoConfig {
  url: string;
  label: string;
  x: number;
  y: number;
  scale: number;
  shadowIntensity: number;
  glowColor: string;
  glowIntensity: number;
  useCardFallback: boolean;
  cardBorderRadius: number;
  visible: boolean;
}

export interface BrandLogoConfig {
  url: string;
  name: string;
  position: 'top-left' | 'top-right' | 'top-center';
  size: number;
  withPlate: boolean;
  visible: boolean;
}

export interface CompanyBrandProfile {
  companyName: string;
  tagline: string;
  website: string;
  email: string;
  phone: string;
  address: string;
  logoDataUrl: string;
  primaryColor: string;
  secondaryColor: string;
  accentColor: string;
  defaultLanguage: PosterLanguage;
  updatedAt?: string;
}

export interface PosterCompanyInfo {
  companyName?: string;
  tagline?: string;
  website?: string;
  email?: string;
  phone?: string;
  showContactBar?: boolean;
}

export interface QualityReport {
  passed: boolean;
  score: number;
  noAiTextPassed: boolean;
  marginSafePassed: boolean;
  contrastPassed: boolean;
  noCollisionPassed: boolean;
  copyMatchPassed: boolean;
  spellingPassed?: boolean;
  brandingPassed?: boolean;
  dimensionsPassed?: boolean;
  balancePassed?: boolean;
  issues: string[];
  ocrDetectedText: string[];
  repairedAutomatically: boolean;
  checkedAt: string;
}

export interface SceneVariation {
  id: string;
  imageUrl: string;
  prompt: string;
  source: 'gemini' | 'pollinations' | 'procedural';
  qualityPassed: boolean;
  ocrDetectedText: string[];
  conceptTitle?: string;
  layoutStyle?: PosterLayoutStyle;
  headlineText?: string;
  headlineSubtext?: string;
  headlineStyle?: HeadlineStyle;
  headlineFont?: string;
  subheadingText?: string;
  ctaText?: string;
  ctaStyle?: CtaButtonConfig['style'];
  badgeText?: string;
  badgeSubtext?: string;
  badgeStyle?: OfferBadgeConfig['style'];
  highlights?: string[];
  palette?: {
    primary: string;
    secondary: string;
    accent: string;
  };
}

export interface PosterConfig {
  id: string;
  title: string;
  category?: PosterCategory;
  subCategory?: string;
  language?: PosterLanguage;
  layoutStyle?: PosterLayoutStyle;
  occasion: OccasionType;
  aspectRatio: AspectRatio;
  backgroundImages: SceneVariation[];
  activeVariationIndex: number;
  backgroundDarkness: number;
  backgroundBlur: number;
  highlights?: string[];
  companyInfo?: PosterCompanyInfo;
  headline: HeadlineConfig;
  subheading: SubheadingConfig;
  offerBadge: OfferBadgeConfig;
  ctaButton: CtaButtonConfig;
  productPhoto: ProductPhotoConfig;
  brandLogo: BrandLogoConfig;
  qualityReport: QualityReport;
  customPalette?: {
    primary: string;
    secondary: string;
    accent: string;
  };
}

export interface FestivalOccasion {
  id: string;
  slug: OccasionType;
  name: string;
  type: 'indian_festival' | 'national_special_day';
  date: string; // YYYY-MM-DD
  year: number;
  daysUntil: number;
  visualTheme: string;
  suggestedGreeting: {
    english: string;
    hindi: string;
    gujarati: string;
  };
}

export interface SavedDesignItem {
  id: string;
  name: string;
  category: PosterCategory;
  subCategory: string;
  language: PosterLanguage;
  savedAt: string;
  poster: PosterConfig;
}

export interface ScheduledPostItem {
  id: string;
  topic: string;
  category: PosterCategory;
  occasionSlug?: string;
  scheduledFor: string; // ISO datetime string
  platforms: ('instagram' | 'facebook' | 'linkedin')[];
  captions: {
    instagram: string;
    facebook: string;
    linkedin: string;
  };
  platformDataUrls: {
    instagram?: string;
    facebook?: string;
    linkedin?: string;
  };
  autoPublishApproved: boolean;
  status: 'scheduled' | 'published' | 'failed' | 'cancelled';
  createdAt: string;
  lastError?: string;
  reportId?: string;
}

export interface ChatMessage {
  id: string;
  sender: 'user' | 'assistant' | 'system';
  text: string;
  timestamp: string;
  actionTaken?: string;
  regeneratedScene?: boolean;
  isError?: boolean;
  failedPrompt?: string;
  readyToPublish?: boolean;
  suggestedPlatforms?: ('instagram' | 'facebook' | 'linkedin')[];
  generatedTitle?: string;
}

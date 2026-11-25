import fs from 'fs';
import path from 'path';
import type {
  CompanyBrandProfile,
  SavedDesignItem,
  ScheduledPostItem,
} from '../src/types';

const STUDIO_DATA_FILE = path.join(process.cwd(), '.studio_data.json');

export interface StudioPersistenceState {
  brandProfile: CompanyBrandProfile;
  savedDesigns: SavedDesignItem[];
  scheduledPosts: ScheduledPostItem[];
}

const DEFAULT_BRAND_PROFILE: CompanyBrandProfile = {
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

function loadStudioData(): StudioPersistenceState {
  try {
    if (fs.existsSync(STUDIO_DATA_FILE)) {
      const raw = fs.readFileSync(STUDIO_DATA_FILE, 'utf8');
      const parsed = JSON.parse(raw);
      return {
        brandProfile: { ...DEFAULT_BRAND_PROFILE, ...(parsed.brandProfile || {}) },
        savedDesigns: Array.isArray(parsed.savedDesigns) ? parsed.savedDesigns : [],
        scheduledPosts: Array.isArray(parsed.scheduledPosts) ? parsed.scheduledPosts : [],
      };
    }
  } catch (err) {
    console.warn('[StudioStore] Failed to load .studio_data.json:', err);
  }
  return {
    brandProfile: { ...DEFAULT_BRAND_PROFILE },
    savedDesigns: [],
    scheduledPosts: [],
  };
}

let store: StudioPersistenceState = loadStudioData();

function persistStudioData() {
  try {
    fs.writeFileSync(STUDIO_DATA_FILE, JSON.stringify(store, null, 2), 'utf8');
  } catch (err) {
    console.warn('[StudioStore] Failed to save .studio_data.json:', err);
  }
}

export function getBrandProfile(): CompanyBrandProfile {
  return store.brandProfile;
}

export function saveBrandProfile(profile: Partial<CompanyBrandProfile>): CompanyBrandProfile {
  store.brandProfile = {
    ...store.brandProfile,
    ...profile,
    updatedAt: new Date().toISOString(),
  };
  persistStudioData();
  return store.brandProfile;
}

export function getSavedDesigns(): SavedDesignItem[] {
  return store.savedDesigns;
}

export function saveDesignItem(item: Omit<SavedDesignItem, 'id' | 'savedAt'> & { id?: string }): SavedDesignItem {
  const existingIdx = item.id ? store.savedDesigns.findIndex((d) => d.id === item.id) : -1;
  const record: SavedDesignItem = {
    id: item.id || `design_${Date.now()}_${Math.floor(Math.random() * 1000)}`,
    name: item.name,
    category: item.category,
    subCategory: item.subCategory,
    language: item.language,
    savedAt: new Date().toISOString(),
    poster: item.poster,
  };

  if (existingIdx >= 0) {
    store.savedDesigns[existingIdx] = record;
  } else {
    store.savedDesigns.unshift(record);
    if (store.savedDesigns.length > 60) {
      store.savedDesigns = store.savedDesigns.slice(0, 60);
    }
  }
  persistStudioData();
  return record;
}

export function deleteDesignItem(id: string): boolean {
  const before = store.savedDesigns.length;
  store.savedDesigns = store.savedDesigns.filter((d) => d.id !== id);
  if (store.savedDesigns.length !== before) {
    persistStudioData();
    return true;
  }
  return false;
}

export function getScheduledPosts(): ScheduledPostItem[] {
  return store.scheduledPosts;
}

export function createScheduledPost(
  input: Omit<ScheduledPostItem, 'id' | 'createdAt' | 'status'>
): ScheduledPostItem {
  const item: ScheduledPostItem = {
    ...input,
    id: `sched_${Date.now()}_${Math.floor(Math.random() * 1000)}`,
    status: 'scheduled',
    createdAt: new Date().toISOString(),
  };
  store.scheduledPosts.unshift(item);
  persistStudioData();
  return item;
}

export function updateScheduledPost(
  id: string,
  updates: Partial<ScheduledPostItem>
): ScheduledPostItem | null {
  const idx = store.scheduledPosts.findIndex((s) => s.id === id);
  if (idx < 0) return null;
  store.scheduledPosts[idx] = {
    ...store.scheduledPosts[idx],
    ...updates,
  };
  persistStudioData();
  return store.scheduledPosts[idx];
}

export function deleteScheduledPost(id: string): boolean {
  const before = store.scheduledPosts.length;
  store.scheduledPosts = store.scheduledPosts.filter((s) => s.id !== id);
  if (store.scheduledPosts.length !== before) {
    persistStudioData();
    return true;
  }
  return false;
}

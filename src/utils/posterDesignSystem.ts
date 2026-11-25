import { PosterCategory, PosterConfig } from '../types';

export type DesignPatternKind =
  | 'executive_grid'
  | 'talent_matrix'
  | 'growth_orbit'
  | 'tech_circuit'
  | 'neural_mesh'
  | 'stage_spotlight'
  | 'celebration_crest'
  | 'festive_mandala';

export interface PosterDesignTheme {
  pattern: DesignPatternKind;
  primary: string;
  secondary: string;
  accent: string;
  surfaceDeep: string;
  surfaceTint: string;
  cardSurface: string;
  cornerStyle: 'brackets' | 'filigree' | 'spine' | 'minimal';
  categoryTag: string;
}

interface PaletteTriplet {
  primary: string;
  secondary: string;
  accent: string;
  surfaceDeep: string;
}

export const PATTERN_PALETTES: Record<DesignPatternKind, PaletteTriplet[]> = {
  executive_grid: [
    { primary: '#FFFFFF', secondary: '#0A192F', accent: '#38BDF8', surfaceDeep: '#040C1A' }, // Navy & White
    { primary: '#F5C451', secondary: '#090B10', accent: '#FDE68A', surfaceDeep: '#030406' }, // Black & Gold
    { primary: '#E2E8F0', secondary: '#0F2557', accent: '#60A5FA', surfaceDeep: '#06112B' }, // Royal Blue & Silver
  ],
  talent_matrix: [
    { primary: '#2DD4BF', secondary: '#081F2C', accent: '#38BDF8', surfaceDeep: '#030E16' }, // Deep Navy & Teal
    { primary: '#60A5FA', secondary: '#0B1736', accent: '#FFFFFF', surfaceDeep: '#040919' }, // Royal Blue & White
    { primary: '#F5C451', secondary: '#111827', accent: '#34D399', surfaceDeep: '#05080F' }, // Slate & Gold
  ],
  growth_orbit: [
    { primary: '#38BDF8', secondary: '#0F173D', accent: '#A78BFA', surfaceDeep: '#060A1E' }, // Indigo & Sky
    { primary: '#34D399', secondary: '#06241D', accent: '#E2E8F0', surfaceDeep: '#02100C' }, // Emerald & White
    { primary: '#FBBF24', secondary: '#0B162C', accent: '#38BDF8', surfaceDeep: '#040914' }, // Navy & Amber
  ],
  tech_circuit: [
    { primary: '#38BDF8', secondary: '#06162E', accent: '#818CF8', surfaceDeep: '#020814' }, // Deep Navy & Cyan
    { primary: '#C4B5FD', secondary: '#160E33', accent: '#38BDF8', surfaceDeep: '#070414' }, // Purple & Silver
    { primary: '#34D399', secondary: '#061F1B', accent: '#38BDF8', surfaceDeep: '#020C0A' }, // Carbon & Emerald
  ],
  neural_mesh: [
    { primary: '#D8B4FE', secondary: '#170E33', accent: '#38BDF8', surfaceDeep: '#080416' }, // Purple & Silver
    { primary: '#38BDF8', secondary: '#060F24', accent: '#A78BFA', surfaceDeep: '#020611' }, // Obsidian & Electric Blue
    { primary: '#F5C451', secondary: '#121329', accent: '#818CF8', surfaceDeep: '#060712' }, // Midnight & Gold
  ],
  stage_spotlight: [
    { primary: '#F5C451', secondary: '#0A0B10', accent: '#38BDF8', surfaceDeep: '#030305' }, // Black & Gold
    { primary: '#E2E8F0', secondary: '#0D111A', accent: '#F59E0B', surfaceDeep: '#04060A' }, // Obsidian & Silver
    { primary: '#34D399', secondary: '#062118', accent: '#F5C451', surfaceDeep: '#020D09' }, // Emerald & Gold
  ],
  celebration_crest: [
    { primary: '#F5C451', secondary: '#110C18', accent: '#F472B6', surfaceDeep: '#050308' }, // Black & Gold
    { primary: '#DDD6FE', secondary: '#1A0F36', accent: '#F5C451', surfaceDeep: '#080414' }, // Royal Purple & Silver
    { primary: '#FBBF24', secondary: '#0C1838', accent: '#E2E8F0', surfaceDeep: '#040917' }, // Navy & Gold
  ],
  festive_mandala: [
    { primary: '#F5C451', secondary: '#360714', accent: '#FB923C', surfaceDeep: '#140207' }, // Royal Maroon & Gold
    { primary: '#E2E8F0', secondary: '#16113D', accent: '#F5C451', surfaceDeep: '#07051A' }, // Deep Indigo & Silver
    { primary: '#FDE047', secondary: '#062920', accent: '#34D399', surfaceDeep: '#02120E' }, // Emerald & Champagne
  ],
};

const PATTERN_TAGS: Record<DesignPatternKind, string> = {
  executive_grid: 'CORPORATE BRIEFING',
  talent_matrix: 'TALENT RECRUITMENT',
  growth_orbit: 'COHORT & TRAINING',
  tech_circuit: 'ENTERPRISE TECH',
  neural_mesh: 'AI & DIGITAL GROWTH',
  stage_spotlight: 'FEATURED LAUNCH',
  celebration_crest: 'SPECIAL EVENT',
  festive_mandala: 'FESTIVE EDITION',
};

export function inferDesignPattern(
  poster: Pick<PosterConfig, 'category' | 'subCategory' | 'occasion' | 'title'>
): DesignPatternKind {
  const haystack = `${poster.subCategory || ''} ${poster.title || ''} ${poster.occasion || ''}`.toLowerCase();
  const cat: PosterCategory | undefined = poster.category;

  if (/(intern|internship|training|campus|bootcamp|fellowship|cohort)/i.test(haystack)) {
    return 'growth_orbit';
  }
  if (cat === 'hiring' || /(hiring|job|recruit|vacancy|vacancies|career|walk-in)/i.test(haystack)) {
    return 'talent_matrix';
  }
  if (/(event|celebrat|anniversary|summit|conference|gala|award|milestone)/i.test(haystack)) {
    return 'celebration_crest';
  }
  if (
    cat === 'festival' ||
    /(diwali|dhanteras|navratri|durga|dussehra|ganesh|janmashtami|raksha|holi|uttarayan|pongal|onam|eid|christmas|new year|republic|independence|gandhi|women|teacher|children|labour|environment|yoga|health)/i.test(
      haystack
    )
  ) {
    return 'festive_mandala';
  }
  if (/(ai|artificial|machine|data|digital marketing|automation|llm|neural|analytics)/i.test(haystack)) {
    return 'neural_mesh';
  }
  if (cat === 'it_tech' || /(cloud|cyber|security|software|web|app|tech|devops|engineer)/i.test(haystack)) {
    return 'tech_circuit';
  }
  if (cat === 'marketing' || /(product|launch|offer|discount|sale|promo|campaign)/i.test(haystack)) {
    return 'stage_spotlight';
  }
  return 'executive_grid';
}

export function normalizeSixHex(val: string | undefined, fallback: string): string {
  const s = String(val || '').trim();
  if (/^#[0-9A-Fa-f]{6}$/.test(s)) return s.toUpperCase();
  if (/^#[0-9A-Fa-f]{3}$/.test(s)) {
    const r = s[1];
    const g = s[2];
    const b = s[3];
    return `#${r}${r}${g}${g}${b}${b}`.toUpperCase();
  }
  return fallback;
}

function isUntouchedDefaultTriplet(p?: { primary?: string; secondary?: string; accent?: string }): boolean {
  if (!p) return true;
  const prim = normalizeSixHex(p.primary, '');
  const sec = normalizeSixHex(p.secondary, '');
  const acc = normalizeSixHex(p.accent, '');
  if (!prim && !sec) return true;
  const isDefaultAmberSlate =
    prim === '#F59E0B' &&
    (sec === '#0F172A' || sec === '#090D16' || sec === '#111827') &&
    (acc === '#06B6D4' || acc === '#38BDF8' || acc === '#E2E8F0' || !acc);
  const isDefaultCyanDark =
    prim === '#38BDF8' && sec === '#090D16' && (acc === '#10B981' || acc === '#F59E0B');
  return isDefaultAmberSlate || isDefaultCyanDark;
}

export function resolvePosterDesignTheme(poster: PosterConfig, overrideVariationIndex?: number): PosterDesignTheme {
  const varIdx = overrideVariationIndex ?? poster.activeVariationIndex ?? 0;
  const activeVar = poster.backgroundImages[varIdx] || poster.backgroundImages[0];
  const pattern = inferDesignPattern(poster);
  const bank = PATTERN_PALETTES[pattern];
  const preset = bank[varIdx % bank.length];

  const varPalette = activeVar?.palette;
  const customPalette = poster.customPalette;

  const chosenPalette =
    customPalette && !isUntouchedDefaultTriplet(customPalette)
      ? customPalette
      : varPalette && !isUntouchedDefaultTriplet(varPalette)
      ? varPalette
      : null;

  const primary = chosenPalette ? normalizeSixHex(chosenPalette.primary, preset.primary) : preset.primary;
  const secondary = chosenPalette ? normalizeSixHex(chosenPalette.secondary, preset.secondary) : preset.secondary;
  const accent = chosenPalette ? normalizeSixHex(chosenPalette.accent, preset.accent) : preset.accent;

  const cornerStyle: PosterDesignTheme['cornerStyle'] =
    pattern === 'festive_mandala' || pattern === 'celebration_crest'
      ? 'filigree'
      : pattern === 'executive_grid' || pattern === 'talent_matrix'
      ? 'brackets'
      : pattern === 'tech_circuit' || pattern === 'neural_mesh'
      ? 'spine'
      : 'minimal';

  return {
    pattern,
    primary,
    secondary,
    accent,
    surfaceDeep: preset.surfaceDeep,
    surfaceTint: `${secondary}EC`,
    cardSurface: `${secondary}DB`,
    cornerStyle,
    categoryTag: PATTERN_TAGS[pattern],
  };
}

/**
 * Generates an inline SVG architectural pattern layer (transparent background)
 * with strong graphic-designer presence matching Canvas 2D export 1:1.
 */
export function buildOverlayPatternSvgUrl(theme: PosterDesignTheme, variationIndex = 0): string {
  const p = encodeURIComponent(theme.primary);
  const a = encodeURIComponent(theme.accent);
  const shift = (variationIndex % 3) * 20;

  let shapes = '';
  switch (theme.pattern) {
    case 'executive_grid':
      shapes = `
        <polygon points="${620 + shift},0 1080,0 1080,1080 ${860 + shift},1080" fill="${p}" opacity="0.06"/>
        <polygon points="${740 + shift},0 1080,0 1080,540 ${880 + shift},540" fill="${a}" opacity="0.11"/>
        <g stroke="${p}" stroke-width="1.5" opacity="0.22">
          <line x1="0" y1="168" x2="1080" y2="168"/>
          <line x1="0" y1="920" x2="1080" y2="920"/>
          <line x1="68" y1="0" x2="68" y2="1080"/>
          <line x1="1012" y1="0" x2="1012" y2="1080"/>
        </g>
        <g fill="none" stroke="${a}" stroke-width="2.5" opacity="0.45">
          <path d="M 935 64 L 1016 64 L 1016 145"/>
          <path d="M 64 935 L 64 1016 L 145 1016"/>
        </g>
        <rect x="68" y="64" width="140" height="5" rx="2.5" fill="${a}" opacity="0.75"/>`;
      break;

    case 'talent_matrix': {
      let dots = '';
      for (let gx = 0; gx < 6; gx++) {
        for (let gy = 0; gy < 6; gy++) {
          dots += `<circle cx="${735 + gx * 46}" cy="${125 + gy * 46}" r="5" fill="${p}" opacity="0.38"/>`;
        }
      }
      shapes = `
        <polygon points="690,0 1080,0 1080,1080 540,1080" fill="${a}" opacity="0.08"/>
        <polygon points="820,0 1080,0 1080,460 660,230" fill="${p}" opacity="0.11"/>
        ${dots}
        <g fill="none" stroke="${p}" stroke-width="5" stroke-linecap="round" stroke-linejoin="round" opacity="0.34">
          <path d="M 755 865 L 845 775 L 935 865"/>
          <path d="M 755 925 L 845 835 L 935 925" stroke="${a}"/>
        </g>
        <rect x="0" y="0" width="1080" height="10" fill="${p}" opacity="0.85"/>`;
      break;
    }

    case 'growth_orbit':
      shapes = `
        <polygon points="0,0 1080,0 1080,260 0,130" fill="${a}" opacity="0.08"/>
        <g fill="none" opacity="0.38">
          <circle cx="870" cy="230" r="115" stroke="${p}" stroke-width="2.5"/>
          <circle cx="870" cy="230" r="195" stroke="${a}" stroke-width="2" stroke-dasharray="10 10"/>
          <circle cx="870" cy="230" r="285" stroke="${p}" stroke-width="1.5"/>
        </g>
        <circle cx="870" cy="115" r="9" fill="${p}" opacity="0.75"/>
        <circle cx="715" cy="348" r="11" fill="${a}" opacity="0.8"/>
        <path d="M 650 930 Q 820 790 990 590" fill="none" stroke="${a}" stroke-width="4" opacity="0.45"/>
        <circle cx="990" cy="590" r="10" fill="${p}" opacity="0.85"/>`;
      break;

    case 'tech_circuit': {
      let grid = '';
      for (let x = 660; x <= 1020; x += 60) {
        for (let y = 120; y <= 960; y += 60) {
          grid += `<circle cx="${x}" cy="${y}" r="2" fill="${p}" opacity="0.22"/>`;
        }
      }
      shapes = `
        ${grid}
        <g fill="none" stroke="${p}" opacity="0.44">
          <circle cx="840" cy="340" r="135" stroke-width="2.5"/>
          <circle cx="840" cy="340" r="210" stroke="${a}" stroke-width="2" stroke-dasharray="8 12"/>
          <polyline points="620,145 735,145 775,185 990,185" stroke-width="2.5"/>
          <polyline points="680,875 805,875 850,830 1020,830" stroke-width="2.5" stroke="${a}"/>
          <polyline points="720,485 785,485 835,535 1010,535" stroke-width="2"/>
        </g>
        <circle cx="775" cy="185" r="7" fill="${a}" opacity="0.85"/>
        <circle cx="850" cy="830" r="7" fill="${p}" opacity="0.85"/>
        <circle cx="840" cy="340" r="18" fill="${a}" opacity="0.32"/>`;
      break;
    }

    case 'neural_mesh':
      shapes = `
        <g fill="none" opacity="0.42">
          <polygon points="845,105 1005,198 1005,382 845,475 685,382 685,198" stroke="${p}" stroke-width="2.5"/>
          <polygon points="845,168 952,230 952,350 845,412 738,350 738,230" stroke="${a}" stroke-width="2"/>
          <polygon points="845,224 904,258 904,322 845,356 786,322 786,258" fill="${a}" opacity="0.16" stroke="${p}" stroke-width="1.8"/>
          <line x1="845" y1="105" x2="845" y2="475" stroke="${p}" stroke-width="1.5"/>
          <line x1="685" y1="198" x2="1005" y2="382" stroke="${a}" stroke-width="1.5"/>
          <line x1="1005" y1="198" x2="685" y2="382" stroke="${a}" stroke-width="1.5"/>
        </g>
        <circle cx="845" cy="290" r="11" fill="${p}" opacity="0.85"/>
        <circle cx="845" cy="105" r="7" fill="${a}" opacity="0.85"/>
        <circle cx="1005" cy="198" r="7" fill="${p}" opacity="0.85"/>
        <circle cx="685" cy="382" r="7" fill="${a}" opacity="0.85"/>
        <path d="M 650 870 L 820 770 L 990 840" fill="none" stroke="${p}" stroke-width="2.2" opacity="0.34"/>
        <circle cx="820" cy="770" r="8" fill="${a}" opacity="0.7"/>`;
      break;

    case 'stage_spotlight':
      shapes = `
        <polygon points="150,0 530,0 880,1080 260,1080" fill="${p}" opacity="0.09"/>
        <polygon points="560,0 920,0 740,1080 390,1080" fill="${a}" opacity="0.06"/>
        <ellipse cx="540" cy="765" rx="340" ry="62" fill="${p}" opacity="0.1"/>
        <circle cx="540" cy="520" r="245" fill="none" stroke="${p}" stroke-width="2" opacity="0.28"/>
        <circle cx="540" cy="520" r="335" fill="none" stroke="${a}" stroke-width="1.8" stroke-dasharray="8 12" opacity="0.25"/>`;
      break;

    case 'celebration_crest':
      shapes = `
        <g stroke="${p}" stroke-width="2.2" opacity="0.38" fill="none">
          <path d="M 56 140 L 56 56 L 140 56"/>
          <path d="M 940 56 L 1024 56 L 1024 140"/>
          <path d="M 56 940 L 56 1024 L 140 1024"/>
          <path d="M 940 1024 L 1024 1024 L 1024 940"/>
          <circle cx="885" cy="200" r="105" stroke-dasharray="6 9" stroke="${a}"/>
          <circle cx="885" cy="200" r="165"/>
        </g>
        <g fill="${p}" opacity="0.65">
          <polygon points="56,56 72,56 56,72"/>
          <polygon points="1024,56 1008,56 1024,72"/>
          <polygon points="56,1024 72,1024 56,1008"/>
          <polygon points="1024,1024 1008,1024 1024,1008"/>
        </g>`;
      break;

    case 'festive_mandala':
    default: {
      let petals = '';
      for (let i = 0; i < 12; i++) {
        const deg = i * 30;
        petals += `<ellipse cx="540" cy="220" rx="22" ry="76" transform="rotate(${deg} 540 540)" fill="none" stroke="${p}" stroke-width="1.6" opacity="0.24"/>`;
      }
      shapes = `
        ${petals}
        <g fill="none" stroke="${p}" opacity="0.34">
          <circle cx="540" cy="540" r="415" stroke-width="1.8" stroke-dasharray="7 11"/>
          <circle cx="540" cy="540" r="345" stroke="${a}" stroke-width="1.4"/>
          <circle cx="965" cy="115" r="120" stroke-width="2"/>
          <circle cx="965" cy="115" r="175" stroke="${a}" stroke-width="1.4" stroke-dasharray="5 9"/>
          <circle cx="115" cy="965" r="120" stroke-width="2"/>
          <circle cx="115" cy="965" r="175" stroke="${a}" stroke-width="1.4" stroke-dasharray="5 9"/>
        </g>
        <path d="M 0 36 Q 135 92 270 36 Q 405 92 540 36 Q 675 92 810 36 Q 945 92 1080 36" fill="none" stroke="${p}" stroke-width="2.5" opacity="0.42"/>
        <g fill="${a}" opacity="0.65">
          <circle cx="135" cy="68" r="5"/><circle cx="405" cy="68" r="5"/>
          <circle cx="675" cy="68" r="5"/><circle cx="945" cy="68" r="5"/>
        </g>`;
      break;
    }
  }

  return `data:image/svg+xml;utf8,<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 1080 1080" preserveAspectRatio="xMidYMid slice">${shapes}</svg>`;
}

/**
 * Draws the identical agency architectural pattern directly onto Canvas 2D
 * so PNG/JPG exports and social posts match PosterCanvas.tsx 1:1.
 */
export function drawCanvasArchitecturalPattern(
  ctx: CanvasRenderingContext2D,
  width: number,
  height: number,
  theme: PosterDesignTheme,
  variationIndex = 0
) {
  const sx = width / 1080;
  const sy = height / 1080;
  const minS = Math.min(sx, sy);

  ctx.save();
  switch (theme.pattern) {
    case 'executive_grid': {
      const shift = (variationIndex % 3) * 20 * sx;
      ctx.fillStyle = theme.primary;
      ctx.globalAlpha = 0.06;
      ctx.beginPath();
      ctx.moveTo(620 * sx + shift, 0);
      ctx.lineTo(width, 0);
      ctx.lineTo(width, height);
      ctx.lineTo(860 * sx + shift, height);
      ctx.closePath();
      ctx.fill();

      ctx.fillStyle = theme.accent;
      ctx.globalAlpha = 0.11;
      ctx.beginPath();
      ctx.moveTo(740 * sx + shift, 0);
      ctx.lineTo(width, 0);
      ctx.lineTo(width, 540 * sy);
      ctx.lineTo(880 * sx + shift, 540 * sy);
      ctx.closePath();
      ctx.fill();

      ctx.strokeStyle = theme.primary;
      ctx.globalAlpha = 0.22;
      ctx.lineWidth = 1.5 * minS;
      [168 * sy, 920 * sy].forEach((y) => {
        ctx.beginPath();
        ctx.moveTo(0, y);
        ctx.lineTo(width, y);
        ctx.stroke();
      });
      [68 * sx, width - 68 * sx].forEach((x) => {
        ctx.beginPath();
        ctx.moveTo(x, 0);
        ctx.lineTo(x, height);
        ctx.stroke();
      });

      ctx.strokeStyle = theme.accent;
      ctx.globalAlpha = 0.45;
      ctx.lineWidth = 2.6 * minS;
      ctx.beginPath();
      ctx.moveTo(width - 145 * sx, 64 * sy);
      ctx.lineTo(width - 64 * sx, 64 * sy);
      ctx.lineTo(width - 64 * sx, 145 * sy);
      ctx.moveTo(64 * sx, height - 145 * sy);
      ctx.lineTo(64 * sx, height - 64 * sy);
      ctx.lineTo(145 * sx, height - 64 * sy);
      ctx.stroke();

      ctx.fillStyle = theme.accent;
      ctx.globalAlpha = 0.75;
      ctx.beginPath();
      ctx.roundRect(68 * sx, 64 * sy, 140 * sx, 5 * sy, 3);
      ctx.fill();
      break;
    }

    case 'talent_matrix': {
      ctx.fillStyle = theme.accent;
      ctx.globalAlpha = 0.08;
      ctx.beginPath();
      ctx.moveTo(690 * sx, 0);
      ctx.lineTo(width, 0);
      ctx.lineTo(width, height);
      ctx.lineTo(540 * sx, height);
      ctx.closePath();
      ctx.fill();

      ctx.fillStyle = theme.primary;
      ctx.globalAlpha = 0.11;
      ctx.beginPath();
      ctx.moveTo(820 * sx, 0);
      ctx.lineTo(width, 0);
      ctx.lineTo(width, 460 * sy);
      ctx.lineTo(660 * sx, 230 * sy);
      ctx.closePath();
      ctx.fill();

      ctx.fillStyle = theme.primary;
      ctx.globalAlpha = 0.38;
      for (let gx = 0; gx < 6; gx++) {
        for (let gy = 0; gy < 6; gy++) {
          ctx.beginPath();
          ctx.arc((735 + gx * 46) * sx, (125 + gy * 46) * sy, 5 * minS, 0, Math.PI * 2);
          ctx.fill();
        }
      }

      ctx.lineCap = 'round';
      ctx.lineJoin = 'round';
      ctx.strokeStyle = theme.primary;
      ctx.globalAlpha = 0.34;
      ctx.lineWidth = 5 * minS;
      ctx.beginPath();
      ctx.moveTo(755 * sx, 865 * sy);
      ctx.lineTo(845 * sx, 775 * sy);
      ctx.lineTo(935 * sx, 865 * sy);
      ctx.stroke();

      ctx.strokeStyle = theme.accent;
      ctx.beginPath();
      ctx.moveTo(755 * sx, 925 * sy);
      ctx.lineTo(845 * sx, 835 * sy);
      ctx.lineTo(935 * sx, 925 * sy);
      ctx.stroke();

      ctx.fillStyle = theme.primary;
      ctx.globalAlpha = 0.85;
      ctx.fillRect(0, 0, width, 10 * minS);
      break;
    }

    case 'growth_orbit': {
      ctx.fillStyle = theme.accent;
      ctx.globalAlpha = 0.08;
      ctx.beginPath();
      ctx.moveTo(0, 0);
      ctx.lineTo(width, 0);
      ctx.lineTo(width, 260 * sy);
      ctx.lineTo(0, 130 * sy);
      ctx.closePath();
      ctx.fill();

      [
        { r: 115, c: theme.primary, dash: false, w: 2.5 },
        { r: 195, c: theme.accent, dash: true, w: 2 },
        { r: 285, c: theme.primary, dash: false, w: 1.5 },
      ].forEach((ring) => {
        ctx.save();
        ctx.strokeStyle = ring.c;
        ctx.globalAlpha = 0.38;
        ctx.lineWidth = ring.w * minS;
        if (ring.dash) ctx.setLineDash([10 * minS, 10 * minS]);
        ctx.beginPath();
        ctx.arc(870 * sx, 230 * sy, ring.r * minS, 0, Math.PI * 2);
        ctx.stroke();
        ctx.restore();
      });

      ctx.fillStyle = theme.primary;
      ctx.globalAlpha = 0.78;
      ctx.beginPath();
      ctx.arc(870 * sx, 115 * sy, 9 * minS, 0, Math.PI * 2);
      ctx.fill();

      ctx.fillStyle = theme.accent;
      ctx.beginPath();
      ctx.arc(715 * sx, 348 * sy, 11 * minS, 0, Math.PI * 2);
      ctx.fill();

      ctx.strokeStyle = theme.accent;
      ctx.globalAlpha = 0.45;
      ctx.lineWidth = 4 * minS;
      ctx.beginPath();
      ctx.moveTo(650 * sx, 930 * sy);
      ctx.quadraticCurveTo(820 * sx, 790 * sy, 990 * sx, 590 * sy);
      ctx.stroke();

      ctx.fillStyle = theme.primary;
      ctx.globalAlpha = 0.85;
      ctx.beginPath();
      ctx.arc(990 * sx, 590 * sy, 10 * minS, 0, Math.PI * 2);
      ctx.fill();
      break;
    }

    case 'tech_circuit': {
      ctx.fillStyle = theme.primary;
      ctx.globalAlpha = 0.22;
      for (let x = 660; x <= 1020; x += 60) {
        for (let y = 120; y <= 960; y += 60) {
          ctx.beginPath();
          ctx.arc(x * sx, y * sy, 2 * minS, 0, Math.PI * 2);
          ctx.fill();
        }
      }

      ctx.strokeStyle = theme.primary;
      ctx.globalAlpha = 0.44;
      ctx.lineWidth = 2.5 * minS;
      ctx.beginPath();
      ctx.arc(840 * sx, 340 * sy, 135 * minS, 0, Math.PI * 2);
      ctx.stroke();

      ctx.save();
      ctx.strokeStyle = theme.accent;
      ctx.lineWidth = 2 * minS;
      ctx.setLineDash([8 * minS, 12 * minS]);
      ctx.beginPath();
      ctx.arc(840 * sx, 340 * sy, 210 * minS, 0, Math.PI * 2);
      ctx.stroke();
      ctx.restore();

      ctx.strokeStyle = theme.primary;
      ctx.lineWidth = 2.5 * minS;
      ctx.beginPath();
      ctx.moveTo(620 * sx, 145 * sy);
      ctx.lineTo(735 * sx, 145 * sy);
      ctx.lineTo(775 * sx, 185 * sy);
      ctx.lineTo(990 * sx, 185 * sy);
      ctx.moveTo(720 * sx, 485 * sy);
      ctx.lineTo(785 * sx, 485 * sy);
      ctx.lineTo(835 * sx, 535 * sy);
      ctx.lineTo(1010 * sx, 535 * sy);
      ctx.stroke();

      ctx.strokeStyle = theme.accent;
      ctx.beginPath();
      ctx.moveTo(680 * sx, 875 * sy);
      ctx.lineTo(805 * sx, 875 * sy);
      ctx.lineTo(850 * sx, 830 * sy);
      ctx.lineTo(1020 * sx, 830 * sy);
      ctx.stroke();

      ctx.fillStyle = theme.accent;
      ctx.globalAlpha = 0.85;
      ctx.beginPath();
      ctx.arc(775 * sx, 185 * sy, 7 * minS, 0, Math.PI * 2);
      ctx.fill();
      ctx.fillStyle = theme.primary;
      ctx.beginPath();
      ctx.arc(850 * sx, 830 * sy, 7 * minS, 0, Math.PI * 2);
      ctx.fill();
      break;
    }

    case 'neural_mesh': {
      const drawHex = (radius: number, color: string, lw: number, fillAlpha = 0) => {
        ctx.strokeStyle = color;
        ctx.lineWidth = lw * minS;
        ctx.beginPath();
        for (let i = 0; i < 6; i++) {
          const ang = (Math.PI / 3) * i - Math.PI / 6;
          const x = 845 * sx + Math.cos(ang) * radius * minS;
          const y = 290 * sy + Math.sin(ang) * radius * minS;
          if (i === 0) ctx.moveTo(x, y);
          else ctx.lineTo(x, y);
        }
        ctx.closePath();
        if (fillAlpha > 0) {
          ctx.save();
          ctx.fillStyle = color;
          ctx.globalAlpha = fillAlpha;
          ctx.fill();
          ctx.restore();
        }
        ctx.stroke();
      };
      ctx.globalAlpha = 0.42;
      drawHex(185, theme.primary, 2.5);
      drawHex(122, theme.accent, 2.0);
      drawHex(66, theme.primary, 1.8, 0.14);

      ctx.strokeStyle = theme.accent;
      ctx.lineWidth = 1.5 * minS;
      ctx.beginPath();
      ctx.moveTo(845 * sx, 105 * sy);
      ctx.lineTo(845 * sx, 475 * sy);
      ctx.moveTo(685 * sx, 198 * sy);
      ctx.lineTo(1005 * sx, 382 * sy);
      ctx.moveTo(1005 * sx, 198 * sy);
      ctx.lineTo(685 * sx, 382 * sy);
      ctx.stroke();

      ctx.globalAlpha = 0.85;
      ctx.fillStyle = theme.primary;
      ctx.beginPath();
      ctx.arc(845 * sx, 290 * sy, 11 * minS, 0, Math.PI * 2);
      ctx.fill();
      ctx.fillStyle = theme.accent;
      ctx.beginPath();
      ctx.arc(845 * sx, 105 * sy, 7 * minS, 0, Math.PI * 2);
      ctx.fill();
      break;
    }

    case 'stage_spotlight': {
      ctx.fillStyle = theme.primary;
      ctx.globalAlpha = 0.09;
      ctx.beginPath();
      ctx.moveTo(150 * sx, 0);
      ctx.lineTo(530 * sx, 0);
      ctx.lineTo(880 * sx, height);
      ctx.lineTo(260 * sx, height);
      ctx.closePath();
      ctx.fill();

      ctx.fillStyle = theme.accent;
      ctx.globalAlpha = 0.06;
      ctx.beginPath();
      ctx.moveTo(560 * sx, 0);
      ctx.lineTo(920 * sx, 0);
      ctx.lineTo(740 * sx, height);
      ctx.lineTo(390 * sx, height);
      ctx.closePath();
      ctx.fill();

      ctx.strokeStyle = theme.primary;
      ctx.globalAlpha = 0.28;
      ctx.lineWidth = 2 * minS;
      ctx.beginPath();
      ctx.arc(width * 0.5, height * 0.48, 245 * minS, 0, Math.PI * 2);
      ctx.stroke();

      ctx.save();
      ctx.strokeStyle = theme.accent;
      ctx.globalAlpha = 0.25;
      ctx.setLineDash([8 * minS, 12 * minS]);
      ctx.beginPath();
      ctx.arc(width * 0.5, height * 0.48, 335 * minS, 0, Math.PI * 2);
      ctx.stroke();
      ctx.restore();
      break;
    }

    case 'celebration_crest': {
      ctx.strokeStyle = theme.primary;
      ctx.globalAlpha = 0.38;
      ctx.lineWidth = 2.2 * minS;
      const m = 56 * minS;
      const len = 84 * minS;
      ctx.beginPath();
      ctx.moveTo(m, m + len);
      ctx.lineTo(m, m);
      ctx.lineTo(m + len, m);
      ctx.moveTo(width - m - len, m);
      ctx.lineTo(width - m, m);
      ctx.lineTo(width - m, m + len);
      ctx.moveTo(m, height - m - len);
      ctx.lineTo(m, height - m);
      ctx.lineTo(m + len, height - m);
      ctx.moveTo(width - m - len, height - m);
      ctx.lineTo(width - m, height - m);
      ctx.lineTo(width - m, height - m - len);
      ctx.stroke();

      ctx.beginPath();
      ctx.arc(885 * sx, 200 * sy, 165 * minS, 0, Math.PI * 2);
      ctx.stroke();
      ctx.save();
      ctx.strokeStyle = theme.accent;
      ctx.setLineDash([6 * minS, 9 * minS]);
      ctx.beginPath();
      ctx.arc(885 * sx, 200 * sy, 105 * minS, 0, Math.PI * 2);
      ctx.stroke();
      ctx.restore();
      break;
    }

    case 'festive_mandala':
    default: {
      ctx.strokeStyle = theme.primary;
      ctx.globalAlpha = 0.24;
      ctx.lineWidth = 1.6 * minS;
      for (let i = 0; i < 12; i++) {
        ctx.save();
        ctx.translate(width * 0.5, height * 0.5);
        ctx.rotate((i * Math.PI) / 6);
        ctx.beginPath();
        ctx.ellipse(0, -310 * minS, 22 * minS, 76 * minS, 0, 0, Math.PI * 2);
        ctx.stroke();
        ctx.restore();
      }

      ctx.globalAlpha = 0.34;
      ctx.save();
      ctx.setLineDash([7 * minS, 11 * minS]);
      ctx.beginPath();
      ctx.arc(width * 0.5, height * 0.5, 415 * minS, 0, Math.PI * 2);
      ctx.stroke();
      ctx.restore();

      ctx.strokeStyle = theme.accent;
      ctx.beginPath();
      ctx.arc(width * 0.5, height * 0.5, 345 * minS, 0, Math.PI * 2);
      ctx.stroke();

      ctx.strokeStyle = theme.primary;
      ctx.beginPath();
      ctx.arc(965 * sx, 115 * sy, 120 * minS, 0, Math.PI * 2);
      ctx.stroke();
      ctx.beginPath();
      ctx.arc(115 * sx, height - 115 * sy, 120 * minS, 0, Math.PI * 2);
      ctx.stroke();

      // Top decorative toran arch
      ctx.globalAlpha = 0.42;
      ctx.lineWidth = 2.5 * minS;
      ctx.beginPath();
      ctx.moveTo(0, 36 * sy);
      ctx.quadraticCurveTo(width * 0.125, 92 * sy, width * 0.25, 36 * sy);
      ctx.quadraticCurveTo(width * 0.375, 92 * sy, width * 0.5, 36 * sy);
      ctx.quadraticCurveTo(width * 0.625, 92 * sy, width * 0.75, 36 * sy);
      ctx.quadraticCurveTo(width * 0.875, 92 * sy, width, 36 * sy);
      ctx.stroke();
      break;
    }
  }
  ctx.restore();
}

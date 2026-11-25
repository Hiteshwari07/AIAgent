import { ExportDimension, PosterConfig } from '../types';
import {
  drawCanvasArchitecturalPattern,
  PosterDesignTheme,
  resolvePosterDesignTheme,
} from './posterDesignSystem';

export interface RenderedPosterAsset {
  dataUrl: string;
  mimeType: 'image/jpeg' | 'image/png';
  width: number;
  height: number;
  estimatedSizeBytes: number;
}

const DIMENSION_MAP: Record<ExportDimension, { width: number; height: number }> = {
  '1080x1080': { width: 1080, height: 1080 },
  '1080x1350': { width: 1080, height: 1350 },
  '1080x1920': { width: 1080, height: 1920 },
  '1200x630': { width: 1200, height: 630 },
  '1200x1350': { width: 1200, height: 1350 },
};

function resolveCanvasFontFamily(fontClass?: string): string {
  switch (fontClass) {
    case 'font-playfair':
      return '"Playfair Display", Georgia, serif';
    case 'font-cinzel':
      return '"Cinzel", Georgia, serif';
    case 'font-jakarta':
      return '"Plus Jakarta Sans", "DM Sans", sans-serif';
    case 'font-manrope':
      return '"Manrope", "Plus Jakarta Sans", sans-serif';
    case 'font-poppins':
      return '"Poppins", sans-serif';
    case 'font-rozha':
      return '"Rozha One", "Noto Sans Devanagari", serif';
    case 'font-hindi':
      return '"Noto Sans Devanagari", "Rozha One", sans-serif';
    case 'font-gujarati':
      return '"Noto Sans Gujarati", sans-serif';
    case 'font-montserrat':
    default:
      return '"Montserrat", "Noto Sans Devanagari", "Noto Sans Gujarati", sans-serif';
  }
}

function loadCorsImage(src: string): Promise<HTMLImageElement | null> {
  return new Promise((resolve) => {
    if (!src) return resolve(null);
    const img = new Image();
    if (!src.startsWith('data:')) {
      img.crossOrigin = 'anonymous';
    }
    const timer = setTimeout(() => resolve(null), 12000);
    img.onload = () => {
      clearTimeout(timer);
      resolve(img);
    };
    img.onerror = () => {
      clearTimeout(timer);
      resolve(null);
    };
    img.src = src;
  });
}

function wrapLines(ctx: CanvasRenderingContext2D, text: string, maxWidth: number, maxLines = 3): string[] {
  const words = text.trim().split(/\s+/);
  if (words.length === 0 || !words[0]) return [];
  const lines: string[] = [];
  let currentLine = words[0];

  for (let i = 1; i < words.length; i++) {
    const candidate = `${currentLine} ${words[i]}`;
    if (ctx.measureText(candidate).width <= maxWidth) {
      currentLine = candidate;
    } else {
      lines.push(currentLine);
      currentLine = words[i];
    }
  }
  lines.push(currentLine);
  return lines.slice(0, maxLines);
}

function drawArchitecturalThemeBackdrop(
  ctx: CanvasRenderingContext2D,
  width: number,
  height: number,
  theme: PosterDesignTheme,
  isCentered: boolean
) {
  const bgGrad = ctx.createLinearGradient(0, 0, width * 0.85, height);
  bgGrad.addColorStop(0, theme.secondary);
  bgGrad.addColorStop(1, theme.surfaceDeep);
  ctx.fillStyle = bgGrad;
  ctx.fillRect(0, 0, width, height);

  const glowX = isCentered || theme.pattern === 'stage_spotlight' ? width * 0.5 : width * 0.82;
  const glowY = isCentered || theme.pattern === 'stage_spotlight' ? height * 0.34 : height * 0.24;
  const glow = ctx.createRadialGradient(glowX, glowY, 20, glowX, glowY, Math.max(width, height) * 0.65);
  glow.addColorStop(0, `${theme.accent}38`);
  glow.addColorStop(0.45, `${theme.primary}16`);
  glow.addColorStop(1, 'rgba(0,0,0,0)');
  ctx.fillStyle = glow;
  ctx.fillRect(0, 0, width, height);
}

/**
 * Renders the composite studio poster cleanly into high-res PNG/JPEG across all export sizes,
 * synchronized 1:1 with PosterCanvas.tsx across all 8 category patterns and 3 layout styles.
 */
export async function renderPosterToImage(
  poster: PosterConfig,
  options: {
    format?: 'image/jpeg' | 'image/png';
    quality?: number;
    resolution?: ExportDimension;
  } = {}
): Promise<RenderedPosterAsset> {
  const mimeType = options.format || 'image/jpeg';
  const quality = options.quality ?? 0.92;

  let dims = DIMENSION_MAP['1080x1080'];
  if (options.resolution && DIMENSION_MAP[options.resolution]) {
    dims = DIMENSION_MAP[options.resolution];
  } else if (poster.aspectRatio === '4:5') {
    dims = DIMENSION_MAP['1080x1350'];
  } else if (poster.aspectRatio === '9:16') {
    dims = DIMENSION_MAP['1080x1920'];
  } else if (poster.aspectRatio === '16:9') {
    dims = DIMENSION_MAP['1200x630'];
  }

  const { width, height } = dims;
  const isLandscape = width > height;
  const activeVar = poster.backgroundImages[poster.activeVariationIndex] || poster.backgroundImages[0];
  const bgUrl = activeVar?.imageUrl || '';
  const isProceduralBg = bgUrl.startsWith('data:image/svg+xml');
  const layoutStyle = poster.layoutStyle || activeVar?.layoutStyle || 'centered_editorial';
  const isExecutiveLeft = layoutStyle === 'executive_left';
  const isSplitFrame = layoutStyle === 'split_frame';
  const isCentered = layoutStyle === 'centered_editorial';

  const designTheme = resolvePosterDesignTheme(poster);
  const primaryHex = designTheme.primary;
  const secondaryHex = designTheme.secondary;
  const accentHex = designTheme.accent;
  const deepHex = designTheme.surfaceDeep;

  const isHiringPattern = designTheme.pattern === 'talent_matrix';
  const isOrbitPattern = designTheme.pattern === 'growth_orbit';
  const isTechPattern = designTheme.pattern === 'tech_circuit' || designTheme.pattern === 'neural_mesh';
  const isFestivePattern = designTheme.pattern === 'festive_mandala' || designTheme.pattern === 'celebration_crest';

  if (typeof document !== 'undefined' && document.fonts?.ready) {
    try {
      await Promise.race([document.fonts.ready, new Promise((r) => setTimeout(r, 1500))]);
    } catch {
      // continue
    }
  }

  const canvas = document.createElement('canvas');
  canvas.width = width;
  canvas.height = height;
  const ctx = canvas.getContext('2d');
  if (!ctx) throw new Error('Canvas 2D context is unavailable.');

  // 1. Base category architectural gradient + Background Scene (cover proportional scaling)
  drawArchitecturalThemeBackdrop(ctx, width, height, designTheme, isCentered);

  if (bgUrl) {
    const bgImg = await loadCorsImage(bgUrl);
    if (bgImg && bgImg.width > 0 && bgImg.height > 0) {
      const hRatio = width / bgImg.width;
      const vRatio = height / bgImg.height;
      const ratio = Math.max(hRatio, vRatio);
      const shiftX = (width - bgImg.width * ratio) / 2;
      const shiftY = (height - bgImg.height * ratio) / 2;
      ctx.save();
      ctx.globalAlpha = isProceduralBg ? 0.92 : 0.36;
      if (poster.backgroundBlur > 0) {
        ctx.filter = `blur(${poster.backgroundBlur * 1.6}px)`;
      }
      ctx.drawImage(
        bgImg,
        0,
        0,
        bgImg.width,
        bgImg.height,
        shiftX,
        shiftY,
        bgImg.width * ratio,
        bgImg.height * ratio
      );
      ctx.restore();
    }
  }

  // 2. Layout-Matched Readability Scrim, Architectural Pattern & Framing
  ctx.fillStyle = `rgba(5, 8, 16, ${Math.min(0.45, poster.backgroundDarkness ?? 0.2)})`;
  ctx.fillRect(0, 0, width, height);

  if (isExecutiveLeft) {
    const leftGrad = ctx.createLinearGradient(0, 0, width, height * 0.25);
    leftGrad.addColorStop(0, `${secondaryHex}E8`);
    leftGrad.addColorStop(0.55, `${secondaryHex}C4`);
    leftGrad.addColorStop(1, `${deepHex}75`);
    ctx.fillStyle = leftGrad;
    ctx.fillRect(0, 0, width, height);

    drawCanvasArchitecturalPattern(ctx, width, height, designTheme, poster.activeVariationIndex || 0);

    ctx.save();
    // Top horizontal accent bar
    const topBarGrad = ctx.createLinearGradient(0, 0, width, 0);
    topBarGrad.addColorStop(0, primaryHex);
    topBarGrad.addColorStop(1, accentHex);
    ctx.fillStyle = topBarGrad;
    ctx.fillRect(0, 0, width, 6);

    // Left vertical spine
    const spineGrad = ctx.createLinearGradient(0, height * 0.06, 0, height * 0.94);
    spineGrad.addColorStop(0, primaryHex);
    spineGrad.addColorStop(1, accentHex);
    ctx.fillStyle = spineGrad;
    ctx.beginPath();
    ctx.roundRect(Math.round(width * 0.038), Math.round(height * 0.06), 7, Math.round(height * 0.88), 3.5);
    ctx.fill();

    // Right precision brackets
    ctx.strokeStyle = primaryHex;
    ctx.globalAlpha = 0.75;
    ctx.lineWidth = 3;
    const bx = Math.round(width * 0.96);
    const by1 = Math.round(height * 0.04);
    const by2 = Math.round(height * 0.96);
    ctx.beginPath();
    ctx.moveTo(bx - 38, by1);
    ctx.lineTo(bx, by1);
    ctx.lineTo(bx, by1 + 38);
    ctx.stroke();

    ctx.strokeStyle = accentHex;
    ctx.beginPath();
    ctx.moveTo(bx - 38, by2);
    ctx.lineTo(bx, by2);
    ctx.lineTo(bx, by2 - 38);
    ctx.stroke();
    ctx.restore();
  } else if (isSplitFrame) {
    const splitGrad = ctx.createLinearGradient(0, 0, 0, height);
    splitGrad.addColorStop(0, `${secondaryHex}7A`);
    splitGrad.addColorStop(0.4, `${secondaryHex}52`);
    splitGrad.addColorStop(1, `${deepHex}E8`);
    ctx.fillStyle = splitGrad;
    ctx.fillRect(0, 0, width, height);

    drawCanvasArchitecturalPattern(ctx, width, height, designTheme, poster.activeVariationIndex || 0);

    ctx.save();
    ctx.strokeStyle = `${accentHex}55`;
    ctx.lineWidth = 2;
    const inset = Math.round(Math.min(width, height) * 0.038);
    ctx.beginPath();
    ctx.roundRect(inset, inset, width - inset * 2, height - inset * 2, 22);
    ctx.stroke();

    const topRuleGrad = ctx.createLinearGradient(width * 0.22, 0, width * 0.78, 0);
    topRuleGrad.addColorStop(0, 'rgba(0,0,0,0)');
    topRuleGrad.addColorStop(0.5, primaryHex);
    topRuleGrad.addColorStop(1, 'rgba(0,0,0,0)');
    ctx.fillStyle = topRuleGrad;
    ctx.fillRect(Math.round(width * 0.22), inset - 2, Math.round(width * 0.56), 5);
    ctx.restore();
  } else {
    const radialGrad = ctx.createRadialGradient(
      width * 0.5,
      height * 0.42,
      width * 0.1,
      width * 0.5,
      height * 0.5,
      Math.max(width, height) * 0.78
    );
    radialGrad.addColorStop(0, `${secondaryHex}44`);
    radialGrad.addColorStop(1, `${deepHex}E0`);
    ctx.fillStyle = radialGrad;
    ctx.fillRect(0, 0, width, height);

    drawCanvasArchitecturalPattern(ctx, width, height, designTheme, poster.activeVariationIndex || 0);

    ctx.save();
    const inset1 = Math.round(Math.min(width, height) * 0.038);
    const inset2 = Math.round(Math.min(width, height) * 0.052);
    ctx.strokeStyle = `${primaryHex}58`;
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.roundRect(inset1, inset1, width - inset1 * 2, height - inset1 * 2, 18);
    ctx.stroke();

    ctx.strokeStyle = `${accentHex}34`;
    ctx.lineWidth = 1.5;
    ctx.beginPath();
    ctx.roundRect(inset2, inset2, width - inset2 * 2, height - inset2 * 2, 14);
    ctx.stroke();

    if (isFestivePattern) {
      ctx.fillStyle = primaryHex;
      [inset1, height - inset1].forEach((dy) => {
        ctx.save();
        ctx.translate(width / 2, dy);
        ctx.rotate(Math.PI / 4);
        ctx.fillRect(-7, -7, 14, 14);
        ctx.restore();
      });
    }
    ctx.restore();
  }

  const safePad = Math.round(width * 0.065);
  const safeTop = Math.round(height * 0.06);

  // 3. Brand Logo & Company Lockup (STRICTLY PROPORTIONAL — NEVER DISTORTED)
  let topHeaderBottomY = safeTop + 66;
  const isFestiveCategory =
    poster.category === 'festival' || poster.occasion === 'sale' || poster.occasion === 'diwali';
  const useScallopedSeal =
    poster.offerBadge.visible &&
    poster.offerBadge.style === 'scalloped_gold' &&
    isFestiveCategory &&
    !isExecutiveLeft &&
    !isSplitFrame &&
    !isLandscape;

  if (poster.brandLogo.visible && poster.brandLogo.url) {
    const logoImg = await loadCorsImage(poster.brandLogo.url);
    const maxLogoW = Math.min(260, Math.round(width * 0.23));
    const maxLogoH = Math.min(92, Math.round(height * 0.072));
    let drawW = maxLogoW;
    let drawH = Math.round(maxLogoW * 0.34);

    if (logoImg && logoImg.naturalWidth > 0 && logoImg.naturalHeight > 0) {
      const ratio = Math.min(maxLogoW / logoImg.naturalWidth, maxLogoH / logoImg.naturalHeight);
      drawW = Math.max(28, Math.round(logoImg.naturalWidth * ratio));
      drawH = Math.max(24, Math.round(logoImg.naturalHeight * ratio));
    }

    const placeRight =
      poster.brandLogo.position === 'top-right' && !(poster.offerBadge.visible && !useScallopedSeal);
    const logoX = placeRight
      ? width - drawW - safePad
      : poster.brandLogo.position === 'top-center' && isCentered
      ? (width - drawW) / 2
      : safePad;
    const logoY = safeTop;

    if (poster.brandLogo.withPlate) {
      ctx.save();
      ctx.fillStyle = `${deepHex}D4`;
      ctx.strokeStyle = 'rgba(255, 255, 255, 0.18)';
      ctx.lineWidth = 1.5;
      ctx.beginPath();
      ctx.roundRect(logoX - 14, logoY - 10, drawW + 28, drawH + 20, 14);
      ctx.fill();
      ctx.stroke();
      ctx.restore();
    }
    if (logoImg) {
      ctx.drawImage(logoImg, logoX, logoY, drawW, drawH);
    }
    topHeaderBottomY = logoY + drawH + 34;
  } else if (poster.companyInfo?.companyName) {
    ctx.save();
    ctx.font = `800 ${Math.round(width * 0.021)}px "Plus Jakarta Sans", "Montserrat", sans-serif`;
    ctx.fillStyle = '#F8FAFC';
    ctx.textAlign = isCentered ? 'center' : 'left';
    const cx = isCentered ? width / 2 : safePad + 24;
    if (!isCentered) {
      ctx.fillStyle = primaryHex;
      ctx.fillRect(safePad, safeTop + 9, 14, 14);
      ctx.fillStyle = '#F8FAFC';
    }
    ctx.fillText(poster.companyInfo.companyName.toUpperCase(), cx, safeTop + 23);
    ctx.restore();
    topHeaderBottomY = safeTop + 56;
  }

  // Footer details & safe bottom bounds
  const contactParts = [
    poster.companyInfo?.website,
    poster.companyInfo?.email,
    poster.companyInfo?.phone,
  ]
    .map((s) => (s || '').trim())
    .filter(Boolean);
  const showFooterBar = Boolean(
    poster.companyInfo?.showContactBar && (contactParts.length > 0 || poster.companyInfo?.tagline)
  );
  const footerLineY = showFooterBar ? height - Math.round(height * 0.068) : height - Math.round(height * 0.04);

  // 4. Product / Visual Illustration OR Split-Frame Category Crest
  if (poster.productPhoto.visible && poster.productPhoto.url) {
    const prodImg = await loadCorsImage(poster.productPhoto.url);
    if (prodImg && prodImg.width > 0) {
      const natRatio = prodImg.height / prodImg.width;
      const targetW = isLandscape
        ? width * 0.32 * (poster.productPhoto.scale || 1)
        : isSplitFrame
        ? width * 0.28 * (poster.productPhoto.scale || 1)
        : isExecutiveLeft
        ? width * 0.34 * (poster.productPhoto.scale || 1)
        : width * 0.38 * (poster.productPhoto.scale || 1);
      const targetH = targetW * natRatio;

      const cxPercent = isLandscape
        ? 77
        : isExecutiveLeft
        ? Math.max(poster.productPhoto.x || 73, 70)
        : isSplitFrame
        ? 50
        : poster.productPhoto.x || 50;
      const cyPercent = isLandscape ? 48 : isSplitFrame ? 28 : poster.productPhoto.y || 58;

      const prodX = width * (cxPercent / 100) - targetW / 2;
      const prodY = height * (cyPercent / 100) - targetH / 2;

      ctx.save();
      ctx.beginPath();
      ctx.arc(prodX + targetW / 2, prodY + targetH / 2, targetW * 0.48, 0, Math.PI * 2);
      ctx.fillStyle = poster.productPhoto.glowColor || accentHex;
      ctx.globalAlpha = (poster.productPhoto.glowIntensity || 0.4) * 0.36;
      ctx.filter = 'blur(32px)';
      ctx.fill();
      ctx.restore();

      ctx.save();
      ctx.shadowColor = 'rgba(0,0,0,0.85)';
      ctx.shadowBlur = 22;
      ctx.drawImage(prodImg, prodX, prodY, targetW, targetH);
      ctx.restore();
    }
  } else if (isSplitFrame && !isLandscape) {
    ctx.save();
    ctx.font = `800 ${Math.round(width * 0.017)}px "Plus Jakarta Sans", "Montserrat", sans-serif`;
    const tagText = designTheme.categoryTag;
    const tw = ctx.measureText(tagText).width;
    const pillW = tw + 88;
    const pillH = 44;
    const pillX = (width - pillW) / 2;
    const pillY = Math.round(height * 0.175);

    ctx.fillStyle = `${deepHex}C8`;
    ctx.strokeStyle = `${primaryHex}66`;
    ctx.lineWidth = 1.5;
    ctx.beginPath();
    ctx.roundRect(pillX, pillY, pillW, pillH, 22);
    ctx.fill();
    ctx.stroke();

    ctx.fillStyle = accentHex;
    ctx.beginPath();
    ctx.arc(pillX + 24, pillY + pillH / 2, 5, 0, Math.PI * 2);
    ctx.arc(pillX + pillW - 24, pillY + pillH / 2, 5, 0, Math.PI * 2);
    ctx.fill();

    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.fillStyle = primaryHex;
    ctx.fillText(tagText, width / 2, pillY + pillH / 2);
    ctx.restore();
  }

  // Font resolution
  const headFontFamily = resolveCanvasFontFamily(poster.headline.font);
  const subFontFamily = resolveCanvasFontFamily(poster.subheading.font);
  const highlights = Array.isArray(poster.highlights)
    ? poster.highlights.filter(Boolean).slice(0, isLandscape ? 2 : 4)
    : [];

  // 5. Render Typography & CTA (Architectural Split Glass Card vs Executive Left vs Centered Editorial)
  if (isSplitFrame) {
    const panelX = Math.round(width * 0.06);
    const panelW = width - panelX * 2;
    const panelBottom = showFooterBar ? footerLineY - 20 : height - Math.round(height * 0.06);
    const padX = Math.round(width * 0.042);
    const maxTextW = panelW - padX * 2;

    let headSize = isLandscape ? Math.round(width * 0.036) : Math.round(width * 0.048);
    let subSize = isLandscape ? 18 : Math.round(width * 0.022);
    ctx.font = `900 ${headSize}px ${headFontFamily}`;
    let headLines = wrapLines(ctx, poster.headline.text, maxTextW, 3);
    if (headLines.length >= 3 && !isLandscape) {
      headSize = Math.round(headSize * 0.88);
      ctx.font = `900 ${headSize}px ${headFontFamily}`;
      headLines = wrapLines(ctx, poster.headline.text, maxTextW, 3);
    }

    ctx.font = `500 ${subSize}px ${subFontFamily}`;
    const subLines =
      poster.subheading.visible && poster.subheading.text
        ? wrapLines(ctx, poster.subheading.text, maxTextW, 2)
        : [];

    const hasHighlights = highlights.length > 0 && !isLandscape;
    const highlightRows = hasHighlights ? Math.ceil(highlights.length / 2) : 0;
    const highlightH = hasHighlights ? 30 + highlightRows * 52 : 0;
    const ctaH = poster.ctaButton.visible && poster.ctaButton.text ? 76 : 12;
    const eyebrowH = poster.headline.subtext ? 34 : 0;

    const neededH =
      52 +
      eyebrowH +
      headLines.length * (headSize * 1.15) +
      (subLines.length > 0 ? 16 + subLines.length * (subSize * 1.32) : 0) +
      highlightH +
      ctaH +
      28;

    const minTopY = Math.max(topHeaderBottomY + 24, isLandscape ? height * 0.2 : height * 0.31);
    const panelTop = Math.max(minTopY, panelBottom - neededH);
    const panelH = panelBottom - panelTop;

    // Draw Glass Architectural Panel
    ctx.save();
    ctx.fillStyle = `${deepHex}EB`;
    ctx.strokeStyle = `${primaryHex}55`;
    ctx.lineWidth = 2;
    ctx.shadowColor = 'rgba(0,0,0,0.75)';
    ctx.shadowBlur = 32;
    ctx.beginPath();
    ctx.roundRect(panelX, panelTop, panelW, panelH, 22);
    ctx.fill();
    ctx.shadowBlur = 0;
    ctx.stroke();

    // Accent top bar inside card
    const barGrad = ctx.createLinearGradient(panelX + padX, 0, panelX + padX + 90, 0);
    barGrad.addColorStop(0, primaryHex);
    barGrad.addColorStop(1, accentHex);
    ctx.fillStyle = barGrad;
    ctx.beginPath();
    ctx.roundRect(panelX + padX, panelTop + 26, 90, 6, 3);
    ctx.fill();

    let y = panelTop + 60;
    const tx = panelX + padX;
    ctx.textAlign = 'left';

    if (poster.headline.subtext) {
      ctx.font = `800 ${Math.round(width * 0.017)}px "Plus Jakarta Sans", "Montserrat", sans-serif`;
      ctx.fillStyle = primaryHex;
      ctx.fillText(poster.headline.subtext.toUpperCase(), tx, y, maxTextW);
      y += 32;
    }

    // Headline inside card
    ctx.font = `900 ${headSize}px ${headFontFamily}`;
    const textGrad = ctx.createLinearGradient(tx, y - headSize, tx + maxTextW, y + headSize * headLines.length);
    if (poster.headline.style === 'silver') {
      textGrad.addColorStop(0, '#FFFFFF');
      textGrad.addColorStop(1, '#CBD5E1');
    } else if (poster.headline.style === 'white') {
      textGrad.addColorStop(0, '#FFFFFF');
      textGrad.addColorStop(1, '#F1F5F9');
    } else if (poster.headline.style === 'emerald') {
      textGrad.addColorStop(0, '#A7F3D0');
      textGrad.addColorStop(1, '#10B981');
    } else {
      textGrad.addColorStop(0, '#FFF2B2');
      textGrad.addColorStop(0.5, '#E6C260');
      textGrad.addColorStop(1, '#F59E0B');
    }
    ctx.fillStyle = textGrad;
    headLines.forEach((line, idx) => {
      ctx.fillText(line, tx, y + idx * (headSize * 1.15), maxTextW);
    });
    y += headLines.length * (headSize * 1.15) + 12;

    if (subLines.length > 0) {
      ctx.font = `500 ${subSize}px ${subFontFamily}`;
      ctx.fillStyle = poster.subheading.color || '#CBD5E1';
      subLines.forEach((line, idx) => {
        ctx.fillText(line, tx, y + idx * (subSize * 1.32), maxTextW);
      });
      y += subLines.length * (subSize * 1.32) + 16;
    }

    if (hasHighlights) {
      ctx.strokeStyle = 'rgba(255,255,255,0.12)';
      ctx.lineWidth = 1;
      ctx.beginPath();
      ctx.moveTo(tx, y);
      ctx.lineTo(tx + maxTextW, y);
      ctx.stroke();
      y += 18;

      const itemSize = Math.round(width * 0.0175);
      const colW = maxTextW / 2 - 8;
      const boxH = 42;
      ctx.font = `600 ${itemSize}px ${subFontFamily}`;
      highlights.forEach((pt, idx) => {
        const col = idx % 2;
        const row = Math.floor(idx / 2);
        const ix = tx + col * (colW + 16);
        const iy = y + row * (boxH + 10);

        ctx.fillStyle = `${secondaryHex}B5`;
        ctx.strokeStyle = `${accentHex}44`;
        ctx.lineWidth = 1.5;
        ctx.beginPath();
        ctx.roundRect(ix, iy, colW, boxH, 8);
        ctx.fill();
        ctx.stroke();

        const edgeColor = idx % 2 === 0 ? primaryHex : accentHex;
        if (isTechPattern || isHiringPattern) {
          ctx.fillStyle = edgeColor;
          ctx.fillRect(ix, iy + 4, 4, boxH - 8);
        }

        if (isOrbitPattern || isHiringPattern) {
          ctx.font = `800 ${Math.round(itemSize * 0.88)}px "Plus Jakarta Sans", monospace`;
          ctx.fillStyle = primaryHex;
          ctx.fillText(String(idx + 1).padStart(2, '0'), ix + 14, iy + boxH * 0.63);
          ctx.font = `600 ${itemSize}px ${subFontFamily}`;
          ctx.fillStyle = '#F1F5F9';
          ctx.fillText(pt, ix + 42, iy + boxH * 0.63, colW - 52);
        } else {
          ctx.fillStyle = accentHex;
          ctx.beginPath();
          ctx.arc(ix + 16, iy + boxH / 2, 4, 0, Math.PI * 2);
          ctx.fill();
          ctx.fillStyle = '#F1F5F9';
          ctx.fillText(pt, ix + 28, iy + boxH * 0.63, colW - 38);
        }
      });
      y += highlightRows * (boxH + 10) + 12;
    }

    if (poster.ctaButton.visible && poster.ctaButton.text) {
      const btnW = Math.min(340, Math.round(width * 0.34));
      const btnH = isLandscape ? 46 : 54;
      const btnY = Math.min(y + 10, panelBottom - btnH - 22);
      const isGlass = poster.ctaButton.style === 'glass_border';
      if (isGlass) {
        ctx.fillStyle = `${deepHex}D9`;
        ctx.strokeStyle = primaryHex;
        ctx.lineWidth = 2;
      } else if (poster.ctaButton.style === 'neon_accent') {
        const g = ctx.createLinearGradient(tx, btnY, tx + btnW, btnY + btnH);
        g.addColorStop(0, accentHex);
        g.addColorStop(1, primaryHex);
        ctx.fillStyle = g;
      } else {
        ctx.fillStyle =
          poster.ctaButton.style === 'emerald_luxury'
            ? '#059669'
            : poster.ctaButton.style === 'solid_crimson'
            ? '#E11D48'
            : primaryHex;
      }
      ctx.beginPath();
      ctx.roundRect(tx, btnY, btnW, btnH, 10);
      ctx.fill();
      if (isGlass) ctx.stroke();

      ctx.textAlign = 'center';
      ctx.textBaseline = 'middle';
      ctx.font = `800 ${isLandscape ? 16 : 19}px "Plus Jakarta Sans", "Montserrat", sans-serif`;
      ctx.fillStyle =
        (poster.ctaButton.style === 'gold_pill' || poster.ctaButton.style === 'neon_accent') && !isGlass
          ? '#090D16'
          : '#FFFFFF';
      ctx.fillText(`${poster.ctaButton.text.toUpperCase()}  →`, tx + btnW / 2, btnY + btnH / 2, btnW - 28);
    }

    ctx.restore();
  } else {
    // EXECUTIVE LEFT or CENTERED EDITORIAL
    const isLeftAligned = isLandscape || isExecutiveLeft;
    const textX = isLeftAligned ? safePad : width / 2;
    const maxTextW = isLeftAligned
      ? isLandscape || poster.productPhoto.visible
        ? width * 0.52
        : width * 0.85
      : width * 0.84;

    const ctaY = isLandscape
      ? height - 74
      : height * (Math.min(poster.ctaButton.yOffset || 86, showFooterBar ? 82 : 88) / 100);
    const btnH = isLandscape ? 50 : 58;
    const maxBodyBottomY =
      poster.ctaButton.visible && poster.ctaButton.text ? ctaY - btnH / 2 - 26 : footerLineY - 26;

    let cursorY = isLandscape
      ? Math.max(topHeaderBottomY + 18, height * 0.27)
      : Math.max(topHeaderBottomY + 34, height * ((poster.headline.yOffset || 17) / 100));

    ctx.save();
    ctx.textAlign = isLeftAligned ? 'left' : 'center';

    if (poster.headline.subtext) {
      const eyeSize = isLandscape ? 17 : Math.round(width * 0.0185);
      ctx.font = `800 ${eyeSize}px "Plus Jakarta Sans", "Montserrat", sans-serif`;
      const eyeLabel = poster.headline.subtext.toUpperCase();

      if (isHiringPattern || isTechPattern) {
        const tw = ctx.measureText(eyeLabel).width;
        const pillW = Math.min(maxTextW, tw + 46);
        const pillH = eyeSize + 16;
        const px = isLeftAligned ? textX : textX - pillW / 2;
        const py = cursorY - pillH * 0.72;

        ctx.fillStyle = `${primaryHex}1C`;
        ctx.strokeStyle = `${primaryHex}66`;
        ctx.lineWidth = 1.5;
        ctx.beginPath();
        ctx.roundRect(px, py, pillW, pillH, pillH / 2);
        ctx.fill();
        ctx.stroke();

        ctx.fillStyle = accentHex;
        ctx.beginPath();
        ctx.arc(px + 16, py + pillH / 2, 4, 0, Math.PI * 2);
        ctx.fill();

        ctx.textAlign = 'left';
        ctx.fillStyle = primaryHex;
        ctx.fillText(eyeLabel, px + 28, cursorY, pillW - 36);
        ctx.textAlign = isLeftAligned ? 'left' : 'center';
      } else {
        ctx.fillStyle = primaryHex;
        if (isExecutiveLeft) {
          ctx.fillRect(textX, cursorY - eyeSize * 0.45, 32, 3);
          ctx.fillText(eyeLabel, textX + 42, cursorY, maxTextW - 42);
        } else {
          ctx.fillText(eyeLabel, textX, cursorY, maxTextW);
        }
      }
      cursorY += eyeSize * 2.1;
    }

    const baseHeadlinePt = isLandscape ? Math.min(poster.headline.size || 40, 34) : poster.headline.size || 40;
    let headFontSize = Math.round(width * (baseHeadlinePt / (isLandscape ? 880 : 760)));
    ctx.font = `900 ${headFontSize}px ${headFontFamily}`;
    let headlineLines = wrapLines(ctx, poster.headline.text, maxTextW, 3);

    if (headlineLines.length >= 3 && cursorY + headlineLines.length * headFontSize * 1.15 > maxBodyBottomY - 140) {
      headFontSize = Math.round(headFontSize * 0.85);
      ctx.font = `900 ${headFontSize}px ${headFontFamily}`;
      headlineLines = wrapLines(ctx, poster.headline.text, maxTextW, 3);
    }

    const textGrad = ctx.createLinearGradient(
      isLeftAligned ? textX : width * 0.2,
      cursorY - headFontSize,
      isLeftAligned ? textX + maxTextW : width * 0.8,
      cursorY + headFontSize * headlineLines.length
    );
    if (poster.headline.style === 'silver') {
      textGrad.addColorStop(0, '#FFFFFF');
      textGrad.addColorStop(0.55, '#E2E8F0');
      textGrad.addColorStop(1, '#94A3B8');
    } else if (poster.headline.style === 'white') {
      textGrad.addColorStop(0, '#FFFFFF');
      textGrad.addColorStop(1, '#F1F5F9');
    } else if (poster.headline.style === 'emerald') {
      textGrad.addColorStop(0, '#A7F3D0');
      textGrad.addColorStop(1, '#10B981');
    } else if (poster.headline.style === 'rose_gold') {
      textGrad.addColorStop(0, '#FFE4E6');
      textGrad.addColorStop(0.55, '#F472B6');
      textGrad.addColorStop(1, '#E11D48');
    } else {
      textGrad.addColorStop(0, '#FFF2B2');
      textGrad.addColorStop(0.45, '#E6C260');
      textGrad.addColorStop(1, '#F59E0B');
    }

    ctx.fillStyle = textGrad;
    ctx.shadowColor = 'rgba(0,0,0,0.92)';
    ctx.shadowBlur = 18;

    const lineStep = headFontSize * 1.12;
    headlineLines.forEach((line, idx) => {
      ctx.fillText(line, textX, cursorY + idx * lineStep, maxTextW);
    });
    cursorY += headlineLines.length * lineStep;

    if (isCentered && !isLandscape) {
      ctx.save();
      ctx.shadowBlur = 0;
      const ruleGrad = ctx.createLinearGradient(width / 2 - 60, 0, width / 2 + 60, 0);
      ruleGrad.addColorStop(0, primaryHex);
      ruleGrad.addColorStop(1, accentHex);
      ctx.fillStyle = ruleGrad;
      ctx.beginPath();
      ctx.roundRect(width / 2 - 60, cursorY - 6, 120, 4.5, 2.5);
      ctx.fill();
      ctx.restore();
      cursorY += 28;
    } else {
      cursorY += 16;
    }

    if (poster.subheading.visible && poster.subheading.text && cursorY < maxBodyBottomY - 30) {
      const subSize = isLandscape ? 19 : Math.round(width * 0.0225);
      ctx.font = `500 ${subSize}px ${subFontFamily}`;
      ctx.fillStyle = poster.subheading.color || '#E2E8F0';
      ctx.shadowBlur = 10;
      const subLines = wrapLines(ctx, poster.subheading.text, maxTextW, 3);
      subLines.forEach((line, idx) => {
        const lineY = cursorY + idx * (subSize * 1.32);
        if (lineY < maxBodyBottomY - 12) {
          ctx.fillText(line, textX, lineY, maxTextW);
        }
      });
      cursorY += subLines.length * (subSize * 1.32) + 22;
    }

    if (highlights.length > 0 && !isLandscape && cursorY < maxBodyBottomY - 30) {
      const itemSize = Math.round(width * 0.0185);
      ctx.shadowBlur = 0;

      if (isExecutiveLeft) {
        const cardH = Math.round(itemSize * 2.25);
        const cardGap = 10;
        const maxDrawCount = Math.min(
          highlights.length,
          Math.max(0, Math.floor((maxBodyBottomY - cursorY) / (cardH + cardGap)))
        );
        for (let idx = 0; idx < maxDrawCount; idx++) {
          const py = cursorY + idx * (cardH + cardGap);
          ctx.fillStyle = `${deepHex}BD`;
          ctx.strokeStyle = `${primaryHex}36`;
          ctx.lineWidth = 1.5;
          ctx.beginPath();
          ctx.roundRect(textX, py, maxTextW, cardH, 10);
          ctx.fill();
          ctx.stroke();

          ctx.fillStyle = idx % 2 === 0 ? primaryHex : accentHex;
          ctx.fillRect(textX, py + 4, 4, cardH - 8);

          ctx.textAlign = 'left';
          ctx.font = `800 ${Math.round(itemSize * 0.88)}px "Plus Jakarta Sans", monospace`;
          ctx.fillStyle = accentHex;
          const marker =
            isOrbitPattern || designTheme.pattern === 'executive_grid'
              ? String(idx + 1).padStart(2, '0')
              : '▸';
          ctx.fillText(marker, textX + 18, py + cardH * 0.62);

          ctx.font = `600 ${itemSize}px ${subFontFamily}`;
          ctx.fillStyle = '#F1F5F9';
          ctx.fillText(highlights[idx], textX + 50, py + cardH * 0.62, maxTextW - 64);
        }
      } else {
        // Centered pill highlights
        const pillH = Math.round(itemSize * 2.0);
        const pillGap = 10;
        ctx.font = `600 ${itemSize}px ${subFontFamily}`;
        highlights.forEach((point, idx) => {
          const py = cursorY + idx * (pillH + pillGap);
          if (py + pillH < maxBodyBottomY) {
            const tw = ctx.measureText(point).width;
            const pw = Math.min(maxTextW, tw + 56);
            const px = textX - pw / 2;

            ctx.fillStyle = `${deepHex}C4`;
            ctx.strokeStyle = `${primaryHex}48`;
            ctx.lineWidth = 1.5;
            ctx.beginPath();
            ctx.roundRect(px, py, pw, pillH, pillH / 2);
            ctx.fill();
            ctx.stroke();

            ctx.fillStyle = idx % 2 === 0 ? primaryHex : accentHex;
            ctx.beginPath();
            ctx.arc(px + 20, py + pillH / 2, 4, 0, Math.PI * 2);
            ctx.fill();

            ctx.textAlign = 'left';
            ctx.fillStyle = '#F1F5F9';
            ctx.fillText(point, px + 34, py + pillH * 0.63, pw - 48);
          }
        });
      }
    }
    ctx.restore();

    // Standalone CTA Button
    if (poster.ctaButton.visible && poster.ctaButton.text) {
      ctx.save();
      const btnW = Math.min(350, Math.round(width * 0.36));
      const btnX = isLeftAligned ? safePad : width / 2 - btnW / 2;
      const cornerRadius = isExecutiveLeft ? 10 : 30;
      const isGlass = poster.ctaButton.style === 'glass_border';

      if (isGlass) {
        ctx.fillStyle = `${deepHex}D9`;
        ctx.strokeStyle = primaryHex;
        ctx.lineWidth = 2.5;
      } else if (poster.ctaButton.style === 'solid_crimson') {
        const g = ctx.createLinearGradient(btnX, ctaY, btnX + btnW, ctaY + btnH);
        g.addColorStop(0, '#E11D48');
        g.addColorStop(1, '#BE123C');
        ctx.fillStyle = g;
      } else if (poster.ctaButton.style === 'emerald_luxury') {
        const g = ctx.createLinearGradient(btnX, ctaY, btnX + btnW, ctaY + btnH);
        g.addColorStop(0, '#059669');
        g.addColorStop(1, '#047857');
        ctx.fillStyle = g;
      } else if (poster.ctaButton.style === 'neon_accent') {
        const g = ctx.createLinearGradient(btnX, ctaY, btnX + btnW, ctaY + btnH);
        g.addColorStop(0, accentHex);
        g.addColorStop(1, primaryHex);
        ctx.fillStyle = g;
      } else {
        ctx.fillStyle = primaryHex;
      }

      ctx.shadowColor = 'rgba(0,0,0,0.65)';
      ctx.shadowBlur = 16;
      ctx.beginPath();
      ctx.roundRect(btnX, ctaY - btnH / 2, btnW, btnH, cornerRadius);
      ctx.fill();
      if (isGlass) {
        ctx.shadowBlur = 0;
        ctx.stroke();
      }

      ctx.textAlign = 'center';
      ctx.textBaseline = 'middle';
      ctx.font = `800 ${isLandscape ? 16 : 19}px "Plus Jakarta Sans", "Montserrat", "Noto Sans Devanagari", "Noto Sans Gujarati", sans-serif`;
      ctx.fillStyle =
        (poster.ctaButton.style === 'gold_pill' || poster.ctaButton.style === 'neon_accent') && !isGlass
          ? '#090D16'
          : '#FFFFFF';
      ctx.fillText(`${poster.ctaButton.text.toUpperCase()}  →`, btnX + btnW / 2, ctaY, btnW - 28);
      ctx.restore();
    }
  }

  // 6. Badge / Editorial Tag (Scalloped seal strictly limited to festive/promo centered posters)
  if (poster.offerBadge.visible && poster.offerBadge.text) {
    ctx.save();
    if (!useScallopedSeal) {
      const tagW = Math.min(220, Math.round(width * 0.2));
      const tagH = poster.offerBadge.subtext ? 58 : 42;
      const tagX = width - safePad - tagW;
      const tagY = safeTop;
      ctx.fillStyle = `${deepHex}E6`;
      ctx.strokeStyle = `${primaryHex}88`;
      ctx.lineWidth = 2;
      ctx.beginPath();
      ctx.roundRect(tagX, tagY, tagW, tagH, 10);
      ctx.fill();
      ctx.stroke();

      ctx.textAlign = 'right';
      ctx.font = '800 16px "Plus Jakarta Sans", "Montserrat", sans-serif';
      ctx.fillStyle = '#FFFFFF';
      ctx.fillText(
        poster.offerBadge.text.toUpperCase(),
        tagX + tagW - 16,
        tagY + (poster.offerBadge.subtext ? 25 : 27),
        tagW - 28
      );
      if (poster.offerBadge.subtext) {
        ctx.font = '700 11px "Plus Jakarta Sans", "Montserrat", sans-serif';
        ctx.fillStyle = primaryHex;
        ctx.fillText(poster.offerBadge.subtext.toUpperCase(), tagX + tagW - 16, tagY + 45, tagW - 28);
      }
    } else {
      const badgeX = width * ((poster.offerBadge.x || 82) / 100);
      const badgeY = height * ((poster.offerBadge.y || 34) / 100);
      const radius = 76 * (poster.offerBadge.size || 1);
      ctx.translate(badgeX, badgeY);
      ctx.rotate(((poster.offerBadge.rotation || 0) * Math.PI) / 180);

      ctx.beginPath();
      const numPoints = 16;
      for (let i = 0; i < numPoints * 2; i++) {
        const r = i % 2 === 0 ? radius : radius * 0.88;
        const angle = (i * Math.PI) / numPoints;
        const x = Math.cos(angle) * r;
        const y = Math.sin(angle) * r;
        if (i === 0) ctx.moveTo(x, y);
        else ctx.lineTo(x, y);
      }
      ctx.closePath();
      ctx.fillStyle = '#E6C260';
      ctx.shadowColor = 'rgba(0,0,0,0.75)';
      ctx.shadowBlur = 16;
      ctx.fill();

      ctx.beginPath();
      ctx.arc(0, 0, radius * 0.8, 0, Math.PI * 2);
      ctx.fillStyle = '#4C0519';
      ctx.strokeStyle = '#FFE082';
      ctx.lineWidth = 3.5;
      ctx.fill();
      ctx.stroke();

      ctx.textAlign = 'center';
      ctx.textBaseline = 'middle';
      ctx.font = '900 22px "Montserrat", sans-serif';
      ctx.fillStyle = '#FFFFFF';
      ctx.fillText(poster.offerBadge.text, 0, poster.offerBadge.subtext ? -9 : 0, radius * 1.4);

      if (poster.offerBadge.subtext) {
        ctx.font = '700 12px "Noto Sans Devanagari", "Montserrat", sans-serif';
        ctx.fillStyle = '#FDE047';
        ctx.fillText(poster.offerBadge.subtext, 0, 17, radius * 1.35);
      }
    }
    ctx.restore();
  }

  // 7. Provided Company Contact Strip (Never invented!)
  if (showFooterBar) {
    ctx.save();
    const footerY = height - Math.round(height * 0.036);
    ctx.strokeStyle = 'rgba(255,255,255,0.16)';
    ctx.lineWidth = 1;
    ctx.beginPath();
    ctx.moveTo(safePad, footerLineY);
    ctx.lineTo(width - safePad, footerLineY);
    ctx.stroke();

    ctx.font = `600 ${Math.round(width * 0.0165)}px "Plus Jakarta Sans", "Montserrat", sans-serif`;
    ctx.fillStyle = '#CBD5E1';
    ctx.textAlign = isCentered ? 'center' : 'left';
    const footerText =
      contactParts.length > 0
        ? contactParts.join('   ·   ')
        : poster.companyInfo?.tagline || '';
    ctx.fillText(footerText, isCentered ? width / 2 : safePad, footerY, width - safePad * 2);
    ctx.restore();
  }

  const dataUrl = canvas.toDataURL(mimeType, quality);
  const base64Len = dataUrl.split(',')[1]?.length || 0;
  const estimatedSizeBytes = Math.floor((base64Len * 3) / 4);

  return {
    dataUrl,
    mimeType,
    width,
    height,
    estimatedSizeBytes,
  };
}

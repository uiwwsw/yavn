export type LauncherShowcaseImage = {
  positionX?: number;
  positionY?: number;
  scale?: number;
  offsetX?: number;
  offsetY?: number;
};

export type LauncherShowcase = {
  label?: string;
  backgroundColor?: string;
  image?: LauncherShowcaseImage;
};

const isRecord = (value: unknown): value is Record<string, unknown> =>
  Boolean(value) && typeof value === 'object' && !Array.isArray(value);

const normalizeText = (value: unknown, maxLength: number): string | undefined => {
  if (typeof value !== 'string') {
    return undefined;
  }
  const normalized = value.trim();
  if (!normalized) {
    return undefined;
  }
  return normalized.slice(0, maxLength);
};

const normalizeNumber = (value: unknown, min: number, max: number): number | undefined => {
  if (typeof value !== 'number' || !Number.isFinite(value)) {
    return undefined;
  }
  return Math.min(max, Math.max(min, value));
};

const normalizeHexColor = (value: unknown): string | undefined => {
  const normalized = normalizeText(value, 9);
  return normalized && /^#(?:[0-9a-f]{3}|[0-9a-f]{4}|[0-9a-f]{6}|[0-9a-f]{8})$/i.test(normalized)
    ? normalized
    : undefined;
};

export function normalizeLauncherShowcase(value: unknown): LauncherShowcase | undefined {
  if (!isRecord(value)) {
    return undefined;
  }

  const rawImage = isRecord(value.image) ? value.image : undefined;
  const image: LauncherShowcaseImage | undefined = rawImage
    ? {
        positionX: normalizeNumber(rawImage.positionX, 0, 100),
        positionY: normalizeNumber(rawImage.positionY, 0, 100),
        scale: normalizeNumber(rawImage.scale, 0.5, 2),
        offsetX: normalizeNumber(rawImage.offsetX, -50, 50),
        offsetY: normalizeNumber(rawImage.offsetY, -50, 50),
      }
    : undefined;
  const normalizedImage = image && Object.values(image).some((entry) => entry !== undefined) ? image : undefined;
  const showcase: LauncherShowcase = {
    label: normalizeText(value.label, 48),
    backgroundColor: normalizeHexColor(value.backgroundColor),
    image: normalizedImage,
  };

  return Object.values(showcase).some((entry) => entry !== undefined) ? showcase : undefined;
}

export function buildLauncherShowcaseStyle(showcase: LauncherShowcase | undefined): Record<string, string> | undefined {
  if (!showcase) {
    return undefined;
  }

  const style: Record<string, string> = {};
  if (showcase.backgroundColor) {
    style['--launcher-showcase-background'] = showcase.backgroundColor;
  }
  if (showcase.image?.positionX !== undefined) {
    style['--launcher-showcase-position-x'] = `${showcase.image.positionX}%`;
  }
  if (showcase.image?.positionY !== undefined) {
    style['--launcher-showcase-position-y'] = `${showcase.image.positionY}%`;
  }
  if (showcase.image?.scale !== undefined) {
    style['--launcher-showcase-scale'] = String(showcase.image.scale);
  }
  if (showcase.image?.offsetX !== undefined) {
    style['--launcher-showcase-offset-x'] = `${showcase.image.offsetX}%`;
  }
  if (showcase.image?.offsetY !== undefined) {
    style['--launcher-showcase-offset-y'] = `${showcase.image.offsetY}%`;
  }
  return Object.keys(style).length > 0 ? style : undefined;
}

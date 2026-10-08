// Filters Wikimedia Commons results down to real photographs. Commons search
// also returns screenshots, diagrams, maps, logos, scans, and charts, which
// make poor video and thumbnail backgrounds.

const NOT_A_PHOTO =
  /screen ?shot|screencap|screen capture|screengrab|diagram|chart|graph|plot|infographic|schematic|blueprint|map\b|maps\b|locator|logo|icon|emblem|coat of arms|\bseal\b|flag of|symbol|\bsvg\b|wikipedia|wiki\b|website|webpage|web page|homepage|user interface|\bgui\b|\bui\b|interface|scan\b|scanned|document|letter\b|page \d|manuscript|newspaper|poster|banner|text\b|table\b|drawing|illustration|cartoon|clip ?art|comic|sketch|painting|engraving|lithograph|render\b|rendering|3d model|montage|collage|chess|keyboard layout|font\b|typeface|signature|stamp\b|banknote|coin\b|book cover|album cover|qr code|barcode/i;

// Real photos whose subject is a lit screen full of text or UI. They read like
// screenshots in a thumbnail, so they are ranked last instead of dropped.
const SCREEN_SUBJECT = /front of (smart)?phones|\bdisplays?\b|\bscreens?\b|monitors?\b|wikipedia|app\b|apps\b|software/i;

const PHOTO_HINT = /photo|photograph|\bpicture\b|camera|taken with|\bdsc|\bimg[_ ]?\d|\bp\d{6,}/i;

export type CommonsInfo = {
  title: string;
  mime?: string;
  width?: number;
  height?: number;
  categories?: string;
  description?: string;
};

function stripHtml(text: string | undefined): string {
  return (text ?? "").replace(/<[^>]+>/g, " ");
}

// True when the file looks like a real photograph we can use as a background.
export function isLikelyPhoto(info: CommonsInfo): boolean {
  const mime = (info.mime ?? "").toLowerCase();
  if (mime && mime !== "image/jpeg") return false; // drops SVG, PNG (mostly graphics), GIF, TIFF scans
  if (/\.(svg|png|gif|tiff?|pdf|djvu|webp)$/i.test(info.title)) return false;
  const w = info.width ?? 0;
  const h = info.height ?? 0;
  if (w && h) {
    if (Math.min(w, h) < 500) return false; // too small, often icons
    const ratio = w / h;
    if (ratio < 0.45 || ratio > 2.4) return false; // panoramas, banners, strips
  }
  const haystack = `${info.title} ${stripHtml(info.categories)} ${stripHtml(info.description)}`;
  return !NOT_A_PHOTO.test(haystack);
}

// Small bonus for files that say they are photographs, and a penalty for
// photos of screens showing text or UI.
export function photoBonus(info: CommonsInfo): number {
  const haystack = `${info.title} ${stripHtml(info.categories)} ${stripHtml(info.description)}`;
  return (PHOTO_HINT.test(haystack) ? 1 : 0) - (SCREEN_SUBJECT.test(haystack) ? 3 : 0);
}

// Query string parts to ask Commons for the metadata the filter needs.
export const COMMONS_IMAGEINFO =
  "prop=imageinfo&iiprop=url|mime|size|extmetadata&iiextmetadatafilter=Categories|ImageDescription";

type RawPage = {
  title?: string;
  imageinfo?: {
    url?: string;
    thumburl?: string;
    descriptionurl?: string;
    mime?: string;
    width?: number;
    height?: number;
    extmetadata?: { Categories?: { value?: string }; ImageDescription?: { value?: string } };
  }[];
};

export function commonsInfo(page: RawPage): (CommonsInfo & { url: string; thumburl?: string; descriptionurl?: string }) | null {
  const info = page.imageinfo?.[0];
  if (!info || !page.title || !(info.thumburl || info.url)) return null;
  return {
    title: page.title,
    url: info.url ?? info.thumburl ?? "",
    thumburl: info.thumburl,
    descriptionurl: info.descriptionurl,
    mime: info.mime,
    width: info.width,
    height: info.height,
    categories: info.extmetadata?.Categories?.value,
    description: info.extmetadata?.ImageDescription?.value,
  };
}

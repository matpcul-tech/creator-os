// Filters Wikimedia Commons results down to real photographs. Commons search
// also returns screenshots, diagrams, maps, logos, scans, and charts, which
// make poor video and thumbnail backgrounds.

// Whole words only. Substring matches used to drop real photos: "graph" hit
// every "photograph", "icon" hit "iconic", "wiki" hit "Wiki Loves Monuments".
const NOT_A_PHOTO =
  /\b(screen ?shots?|screencaps?|screen captures?|screengrabs?|diagrams?|charts?|graphs?|infographics?|schematics?|blueprints?|maps?|locator|logos?|icons?|emblems?|coat of arms|seals?|flag of|svg|website|web ?pages?|homepage|user interface|gui|scanned|scans?|manuscripts?|newspapers?|posters?|cartoons?|clip ?art|comics?|engravings?|lithographs?|3d model|3d render(ing)?|keyboard layout|typeface|banknotes?|book cover|album cover|qr code|barcode)\b/i;

// Checked against the title and description only, since Commons categories
// mention these words on lots of ordinary photos.
const NOT_A_PHOTO_TITLE = /\b(drawing|illustration|painting|sketch|collage|montage|signature|stamp|document|letter|page \d+|text|table|chess|font)\b/i;

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
    if (Math.min(w, h) < 400) return false; // too small, often icons
    const ratio = w / h;
    if (ratio < 0.45 || ratio > 2.4) return false; // panoramas, banners, strips
  }
  const title = info.title.replace(/[_]+/g, " ");
  const haystack = `${title} ${stripHtml(info.categories)} ${stripHtml(info.description)}`;
  if (NOT_A_PHOTO.test(haystack)) return false;
  return !NOT_A_PHOTO_TITLE.test(`${title} ${stripHtml(info.description)}`);
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

// Real photos that are not scene stock: museum and dig finds, medical and
// anatomy images, specimens, ID style portraits. Dropped outright.
const NOT_STOCK =
  /\bfind ?id\b|portable antiquities|\bpas\b.*\bfinds?\b|archaeolog|\bartefacts?\b|\bartifacts?\b|\bmuseum (?:object|collection|number|no)\b|accession (?:number|no)|\bspecimens?\b|herbarium|\bfossils?\b|\banatom(?:y|ical)\b|\bmedical\b|\bclinical\b|\bsurgery\b|\bsurgical\b|\bpatients?\b|\blesions?\b|\bsyndrome\b|\bdisease\b|\breflex\b|\bx-?rays?\b|\bradiograph|\bhistolog|\bmicroscop|\bmri\b|\bct scan|\bpathology\b|\bautopsy\b|\bmugshots?\b|\bpassport photo|\bid (?:photo|card)\b|official portrait|\bheadshot\b|\bvisa photo|\bstatues?\b|\bsculptures?\b|\bbust of\b|\bfigurines?\b|\bmagazines?\b|\bperiodicals?\b|\bdefecat|\bfeces\b|\bcorpses?\b|\bcarcass|\broadkill\b|\btaxiderm/i;

// Museum in the file name almost always means an object photographed in a museum.
const MUSEUM_TITLE = /\bmuseum\b|\bmus[e\u00e9]e\b|\bmuseo\b/i;

// Buildings and places of worship are fine when the scene asks for them.
const BUILDING = /\b(church|cathedral|chapel|basilica|abbey|mosque|temple|synagogue|monastery|castle|palace|courthouse|town hall|facade|fa\u00e7ade|listed building|grade (i|ii)\b)/i;

// Categories that usually hold everyday, photo-like subjects.
const LIFE_CATEGORY =
  /\b(people|men|women|persons|children|families|couples|elderly|seniors?|sports?|exercise|fitness|gym|running|walking|swimming|yoga|food|drinks?|cooking|kitchens?|bedrooms?|sleep|nature|landscapes?|forests?|beaches|mountains|sunrises?|sunsets?|streets?|cities|offices?|work|working|laptops?|coffee|animals|dogs|cats|gardens?|outdoors?|lifestyle|hands|activities)\b/i;

function textOf(info: CommonsInfo): { title: string; body: string } {
  const title = info.title.replace(/^File:/i, "").replace(/\.[a-z0-9]+$/i, "").replace(/[_]+/g, " ");
  return { title, body: `${stripHtml(info.categories)} ${stripHtml(info.description)}` };
}

/** False for real photos that clearly are not stock for a scene. */
export function isSceneStock(info: CommonsInfo): boolean {
  const { title, body } = textOf(info);
  return !NOT_STOCK.test(`${title} ${body}`) && !MUSEUM_TITLE.test(title);
}

function stem(word: string): string {
  return word
    .toLowerCase()
    .replace(/(ing|ers|er|ed|es|s)$/, "")
    .slice(0, 7);
}

const QUERY_STOP = new Set(["the", "and", "with", "for", "from", "photo", "photograph", "image", "picture", "stock", "a", "an", "of", "in", "on", "at", "to"]);

export function queryWords(query: string): string[] {
  return [...new Set(query.toLowerCase().split(/[^a-z0-9]+/).filter((w) => w.length > 2 && !QUERY_STOP.has(w)).map(stem))];
}

/**
 * How well a Commons file fits a search query: words of the query found in
 * the title count double, in the description or categories once. Buildings
 * the query did not ask for, and photos of screens, rank lower; files filed
 * under everyday subjects rank a little higher.
 */
export function stockScore(info: CommonsInfo, query: string): { overlap: number; titleHits: number; score: number } {
  const { title, body } = textOf(info);
  const titleWords = title.toLowerCase().split(/[^a-z0-9]+/).filter((w) => w.length > 2 && !/^\d+$/.test(w));
  const titleStems = new Set(titleWords.map(stem));
  const bodyStems = new Set(body.toLowerCase().split(/[^a-z0-9]+/).filter(Boolean).map(stem));
  let overlap = 0;
  let titleHits = 0;
  let score = 0;
  for (const word of queryWords(query)) {
    if (titleStems.has(word)) {
      overlap += 1;
      titleHits += 1;
      score += 2;
    } else if (bodyStems.has(word)) {
      overlap += 1;
      score += 1;
    }
  }
  // A title that is mostly about the query beats one that mentions it in passing.
  if (titleWords.length) score += (2 * titleHits) / Math.max(3, titleWords.length);
  if (BUILDING.test(`${title} ${body}`) && !BUILDING.test(query)) score -= 3;
  // Dated before 1900 in the title: archive photos, rarely modern stock.
  if (/\b1[5-8]\d\d\b|\blccn\b|\bn\.d\./i.test(title)) score -= 3;
  if (LIFE_CATEGORY.test(stripHtml(info.categories))) score += 1;
  score += photoBonus(info);
  return { overlap, titleHits, score };
}

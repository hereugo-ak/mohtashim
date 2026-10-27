// Six editorial share-card directions. User-provided strings are escaped before entering SVG.
import { AMU_LOGO } from './amuLogo.js';

export function xml(value) {
  return String(value ?? '')
    .replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;').replace(/'/g, '&apos;');
}

export const variants = Object.freeze([
  { name: 'The Manifesto' }, { name: 'The Field Note' }, { name: 'The Register' },
  { name: 'The Declaration' }, { name: 'The Margin' }, { name: 'The Collective' },
]);

export function cardFacultyName(note = {}) {
  const raw = String(note.cardFacultyName || note.facultyName || note.faculty || '').trim();
  const short = raw.replace(/^faculty\s+of\s+/i, '').trim();
  if (/agricultur/i.test(short)) return 'Agricultural Sciences';
  if (/community/i.test(short)) return 'Community Science';
  if (/theology/i.test(short)) return 'Theology';
  return short || 'Your Faculty';
}

function facultyLines(name) {
  if (name === 'Agricultural Sciences') return ['AGRICULTURAL', 'SCIENCES'];
  if (name === 'Community Science') return ['COMMUNITY', 'SCIENCE'];
  if (name === 'Theology') return ['THEOLOGY'];
  const words = name.toUpperCase().split(/\s+/);
  return words.length > 1 ? [words.slice(0, -1).join(' '), words.at(-1)] : words;
}

function normalizeText(value) {
  return String(value ?? '')
    .replace(/[\u0000-\u0008\u000B\u000C\u000E-\u001F\u007F]/g, '')
    .replace(/\s+/g, ' ').trim();
}

function excerptText(value, max = 220) {
  const text = normalizeText(value);
  if (text.length <= max) return text;
  const candidate = text.slice(0, max - 1);
  const lastSpace = candidate.lastIndexOf(' ');
  return `${candidate.slice(0, lastSpace > max - 35 ? lastSpace : max - 1).trimEnd()}…`;
}

function wrapText(value, maxChars = 55, maxLines = 4) {
  const words = normalizeText(value).split(' ').filter(Boolean);
  const safeWords = [];
  for (const word of words) {
    if (word.length <= maxChars) safeWords.push(word);
    else for (let i = 0; i < word.length; i += maxChars) safeWords.push(word.slice(i, i + maxChars));
  }
  const lines = [];
  let line = '';
  for (const word of safeWords) {
    const next = line ? `${line} ${word}` : word;
    if (next.length > maxChars && line) { lines.push(line); line = word; }
    else line = next;
  }
  if (line) lines.push(line);
  if (lines.length <= maxLines) return lines;
  const limited = lines.slice(0, maxLines);
  const last = limited[maxLines - 1];
  limited[maxLines - 1] = `${last.replace(/[.,;:!?…]+$/, '')}…`;
  return limited;
}

function svgMultiline(lines, { x, y, size = 27, lineGap = 37, fill = '#17231D', anchor = 'start', family = 'Georgia,serif', italic = false, weight = 400, letterSpacing = 0 } = {}) {
  if (!lines.length) return '';
  return `<text x="${x}" y="${y}" text-anchor="${anchor}" font-family="${family}" font-size="${size}" font-weight="${weight}"${italic ? ' font-style="italic"' : ''}${letterSpacing ? ` letter-spacing="${letterSpacing}"` : ''} fill="${fill}">${lines.map((line, index) => `<tspan x="${x}" dy="${index === 0 ? 0 : lineGap}">${xml(line)}</tspan>`).join('')}</text>`;
}

function amuSeal(x, y, size) {
  // Square box + meet: the inscribed circular emblem stays perfectly round.
  return `<image x="${x}" y="${y}" width="${size}" height="${size}" href="${AMU_LOGO}" preserveAspectRatio="xMidYMid meet"/>`;
}

function header(brand, fg, accent, number, x = 82, right = 998, sealY = 52, sealSize = 58) {
  const baseline = sealY + 32;
  return `${amuSeal(x - 4, sealY, sealSize)}<text x="${x + 68}" y="${baseline}" font-family="Arial,Helvetica,sans-serif" font-size="14" letter-spacing="2.2" fill="${fg}" opacity=".9">${xml(brand)}</text><text x="${right}" y="${baseline}" text-anchor="end" font-family="Arial,Helvetica,sans-serif" font-size="14" letter-spacing="2" fill="${fg}" opacity=".72">${String(number).padStart(2, '0')} / 06</text>`;
}

function contributionPanel(note, palette, { x = 82, width = 916, maxChars = 56 } = {}) {
  const { ink, accent, panel, panelInk } = palette;
  const right = x + width;
  const innerX = x + 36;
  const topic = normalizeText(note.topic) || 'Student representation';
  const contributor = normalizeText(note.name);
  const named = !note.anonymous && Boolean(contributor);
  const details = excerptText(note.details, named ? (width < 800 ? 130 : 170) : (width < 800 ? 156 : 220));
  const lineMax = Math.max(28, Math.floor(maxChars));
  const quoteLines = named ? 3 : 4;
  const background = `<rect x="${x}" y="665" width="${width}" height="440" fill="${panel}"/><rect x="${x}" y="665" width="6" height="440" fill="${accent}"/><path d="M${innerX} 795 H${right - 36}" stroke="${ink}" stroke-opacity=".22"/>`;
  const topicMarkup = `<text x="${innerX}" y="712" font-family="Arial,Helvetica,sans-serif" font-size="14" letter-spacing="3" fill="${accent}">SELECTED TOPIC</text><text x="${innerX}" y="760" font-family="Arial,Helvetica,sans-serif" font-size="${width < 800 ? 24 : 29}" font-weight="600" fill="${panelInk}">${xml(topic)}</text>`;
  const identityRule = `<path d="M${innerX} 1022 H${innerX + 84}" stroke="${accent}" stroke-width="1.5"/>`;
  const className = excerptText(normalizeText(note.className), 40);
  const signature = named
    ? `${identityRule}<text x="${innerX}" y="1058" font-family="Georgia,serif" font-size="${width < 800 ? 26 : 30}" fill="${panelInk}">${xml(contributor ? excerptText(contributor, 46) : '')}</text><text x="${innerX}" y="1086" font-family="Arial,Helvetica,sans-serif" font-size="12.5" fill="${panelInk}" opacity=".8">${className ? xml(className) : ''}<tspan dx="${className ? 9 : 0}" fill="${accent}" font-size="11" letter-spacing="1.8">SIGNED OPENLY</tspan></text>`
    : `${identityRule}<text x="${innerX}" y="1058" font-family="Arial,Helvetica,sans-serif" font-size="12" letter-spacing="1.6" fill="${panelInk}" opacity=".68">SHARED ANONYMOUSLY<tspan dx="8" fill="${accent}" opacity="1">·</tspan><tspan dx="8">IDENTITY PROTECTED</tspan></text>`;
  if (!details) {
    return `${background}${topicMarkup}<text x="${innerX}" y="838" font-family="Arial,Helvetica,sans-serif" font-size="14" letter-spacing="3" fill="${accent}">THE PRINCIPLE</text><text x="${innerX}" y="886" font-family="Georgia,serif" font-size="${width < 800 ? 30 : 35}" fill="${panelInk}">Every faculty deserves</text><text x="${innerX}" y="934" font-family="Georgia,serif" font-size="${width < 800 ? 30 : 35}" font-style="italic" fill="${panelInk}">to be heard.</text>${signature}`;
  }
  const wrapped = wrapText(details, lineMax, quoteLines);
  const quote = svgMultiline(wrapped, { x: innerX, y: 886, size: width < 800 ? 23 : 27, lineGap: width < 800 ? 34 : 38, fill: panelInk, italic: true });
  return `${background}${topicMarkup}<text x="${innerX}" y="838" font-family="Arial,Helvetica,sans-serif" font-size="14" letter-spacing="3" fill="${accent}">YOUR WORDS</text><text x="${innerX - 18}" y="881" font-family="Georgia,serif" font-size="42" fill="${accent}" opacity=".75">“</text>${quote}${signature}`;
}

function footer(fg, accent, brand = 'MOHTASHIM EJAZ SANI · UNIVERSITY COURT', x = 82, right = 998) {
  return `<path d="M${x} 1150 H${right}" stroke="${accent}" stroke-width="1" stroke-opacity=".72"/><text x="${x}" y="1200" font-family="Arial,Helvetica,sans-serif" font-size="15" letter-spacing="2.8" fill="${fg}" opacity=".82">MAKE ROOM FOR EVERY VOICE</text><text x="${right}" y="1200" text-anchor="end" font-family="Arial,Helvetica,sans-serif" font-size="15" letter-spacing=".6" fill="${fg}" opacity=".85">${brand}</text>`;
}

export function makeCardSvg(note = {}, index = 0) {
  const style = ((index % variants.length) + variants.length) % variants.length;
  const faculty = cardFacultyName(note);
  const lines = facultyLines(faculty);
  const palettes = [
    { bg: '#064B37', fg: '#FFF9EE', accent: '#D8BB73', panel: '#0A5A42', panelFg: '#FFF9EE', brand: 'UNIVERSITY COURT · STUDENT VOICE' },
    { bg: '#F4F0E7', fg: '#0A4936', accent: '#853949', panel: '#E8E0D0', panelFg: '#17372C', brand: 'A NOTE TO THE UNIVERSITY' },
    { bg: '#E8E1D2', fg: '#1E3028', accent: '#006747', panel: '#F4F0E7', panelFg: '#1E3028', brand: 'UNIVERSITY COURT / CONTRIBUTIONS' },
    { bg: '#763746', fg: '#FFF8EC', accent: '#E3C783', panel: '#63303D', panelFg: '#FFF8EC', brand: 'A DECLARATION OF STUDENT VOICE' },
    { bg: '#FBF8F0', fg: '#064B37', accent: '#BEA15E', panel: '#EFE8DA', panelFg: '#17382D', brand: 'A PERSONAL RECORD' },
    { bg: '#F0EBDD', fg: '#FFF9EE', accent: '#D8BB73', panel: '#E5DDCC', panelFg: '#17382D', brand: 'THE COLLECTIVE · STUDENT VOICE' },
  ];
  const palette = palettes[style];
  const marginStyle = style === 4;
  const contentX = marginStyle ? 254 : 82;
  const right = 998;
  const contentWidth = right - contentX;
  const detailMax = marginStyle ? 156 : 220;
  const maxLineChars = marginStyle ? 40 : 56;
  const topFg = palette.fg;

  let backdrop = `<rect width="1080" height="1350" fill="${palette.bg}"/>`;
  let ornaments = '';
  let headerMarkup = '';
  if (style === 0) {
    backdrop += `<rect width="18" height="1350" fill="${palette.accent}"/><rect x="54" y="54" width="972" height="1242" fill="none" stroke="${palette.accent}" stroke-opacity=".34"/>`;
    ornaments = `<path d="M82 143 H998" stroke="${palette.fg}" stroke-opacity=".25"/>`;
    headerMarkup = header(palette.brand, palette.fg, palette.accent, style + 1, 82, 998, 70);
  } else if (style === 1) {
    backdrop += `<rect x="0" y="0" width="1080" height="174" fill="#0A4936"/><rect x="0" y="174" width="18" height="1176" fill="${palette.accent}"/>`;
    ornaments = `<path d="M82 223 H998" stroke="${palette.fg}" stroke-opacity=".28"/>`;
    headerMarkup = header(palette.brand, palette.bg, '#D8BB73', style + 1);
  } else if (style === 2) {
    backdrop += `<rect x="0" y="0" width="1080" height="24" fill="${palette.accent}"/><rect x="0" y="24" width="1080" height="5" fill="#B99A58"/>`;
    ornaments = `<path d="M82 143 H998" stroke="${palette.fg}" stroke-opacity=".35"/>`;
    headerMarkup = header(palette.brand, palette.fg, palette.accent, style + 1);
  } else if (style === 3) {
    backdrop += `<rect x="54" y="54" width="972" height="1242" fill="none" stroke="${palette.accent}" stroke-width="1.5"/>`;
    ornaments = `<path d="M82 155 H998" stroke="${palette.accent}" stroke-opacity=".65"/>`;
    headerMarkup = header(palette.brand, palette.fg, palette.accent, style + 1, 82, 998, 70);
  } else if (style === 4) {
    backdrop += `<rect x="0" y="0" width="205" height="1350" fill="#064B37"/><rect x="205" y="0" width="7" height="1350" fill="${palette.accent}"/>`;
    ornaments = `${amuSeal(72, 52, 60)}<path d="M55 132 H150" stroke="${palette.accent}" stroke-opacity=".6"/><text x="102" y="200" text-anchor="middle" font-family="Arial,Helvetica,sans-serif" font-size="13" letter-spacing="2.5" fill="#FBF8F0">STUDENT</text><text x="102" y="226" text-anchor="middle" font-family="Arial,Helvetica,sans-serif" font-size="13" letter-spacing="2.5" fill="#FBF8F0">VOICE</text>`;
    headerMarkup = `<text x="254" y="88" font-family="Arial,Helvetica,sans-serif" font-size="14" letter-spacing="2.3" fill="${palette.fg}" opacity=".9">${xml(palette.brand)}</text><text x="998" y="88" text-anchor="end" font-family="Arial,Helvetica,sans-serif" font-size="14" letter-spacing="2" fill="${palette.fg}" opacity=".72">05 / 06</text>`;
  } else {
    backdrop = `<rect width="1080" height="1350" fill="${palette.bg}"/><path d="M0 0 H1080 V635 L0 735 Z" fill="#064B37"/>`;
    ornaments = `<path d="M82 150 H998" stroke="${palette.accent}" stroke-opacity=".45"/>`;
    headerMarkup = header(palette.brand, palette.fg, palette.accent, style + 1);
  }

  const titleSize = marginStyle ? 62 : (faculty === 'Agricultural Sciences' || faculty === 'Community Science' ? 77 : 96);
  const titleY = 423;
  const facultyTitle = svgMultiline(lines, { x: contentX - 4, y: titleY, size: titleSize, lineGap: marginStyle ? 72 : 82, fill: topFg, family: 'Arial,Helvetica,sans-serif', weight: 800, letterSpacing: marginStyle ? -1.7 : -2.3 });
  const lastTitleY = titleY + (lines.length - 1) * (marginStyle ? 72 : 82);
  const suffix = `<text x="${contentX}" y="${lastTitleY + 80}" font-family="Georgia,serif" font-size="${marginStyle ? 35 : 40}" font-style="italic" fill="${palette.accent}">faculty better.</text>`;
  const message = `<text x="${contentX}" y="242" font-family="Arial,Helvetica,sans-serif" font-size="16" letter-spacing="3.5" fill="${palette.accent}">I MADE MY CONTRIBUTION</text><text x="${contentX}" y="310" font-family="Georgia,serif" font-size="39" font-style="italic" fill="${topFg}" opacity=".84">for making this</text>${facultyTitle}${suffix}`;
  const panel = contributionPanel(note, { ink: palette.fg, accent: palette.accent, panel: palette.panel, panelInk: palette.panelFg }, { x: contentX, width: contentWidth, maxChars: maxLineChars });
  const footerMarkup = marginStyle
    ? footer(palette.fg, palette.accent, 'MOHTASHIM EJAZ SANI · UNIVERSITY COURT', 254, 998)
    : footer(style === 5 ? '#064B37' : palette.fg, palette.accent);
  const rule = `<path d="M${contentX} 143 H${right}" stroke="${palette.fg}" stroke-opacity=".22"/>`;
  const svg = `${backdrop}${ornaments}${headerMarkup}${rule}${message}${panel}${footerMarkup}`;
  const topic = normalizeText(note.topic) || 'Student representation';
  const contribution = normalizeText(note.details);
  const named = !note.anonymous && Boolean(normalizeText(note.name));
  const ariaExcerpt = named ? (marginStyle ? 130 : 170) : (marginStyle ? 156 : 220);
  const ariaDescription = contribution ? `Contribution: ${excerptText(contribution, ariaExcerpt)}` : 'Every faculty deserves to be heard.';
  return `<svg xmlns="http://www.w3.org/2000/svg" width="1080" height="1350" viewBox="0 0 1080 1350" role="img" aria-label="Share card for ${xml(faculty)}. Selected topic: ${xml(topic)}. ${xml(ariaDescription)}">${svg}</svg>`;
}

// Faculty-specific share-card sets: two designs per faculty.
// User-provided strings are escaped before entering SVG.
import { AMU_LOGO } from './amuLogo.js';

export function xml(value) {
  return String(value ?? '')
    .replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;').replace(/'/g, '&apos;');
}

export const variants = Object.freeze([
  { faculty: 'agriculture', name: 'The Furrow' },
  { faculty: 'agriculture', name: 'The Field Ledger' },
  { faculty: 'community', name: 'The Commons' },
  { faculty: 'community', name: 'The Weave' },
  { faculty: 'theology', name: 'The Illuminated' },
  { faculty: 'theology', name: 'The Study' },
]);

export function cardFacultyName(note = {}) {
  const raw = String(note.cardFacultyName || note.facultyName || note.faculty || '').trim();
  const short = raw.replace(/^faculty\s+of\s+/i, '').trim();
  if (/agricultur/i.test(short)) return 'Agricultural Sciences';
  if (/community/i.test(short)) return 'Community Science';
  if (/theology/i.test(short)) return 'Theology';
  return short || 'Your Faculty';
}

export function variantKey(note = {}) {
  const name = cardFacultyName(note);
  if (name === 'Community Science') return 'community';
  if (name === 'Theology') return 'theology';
  return 'agriculture';
}

export function designNames(key = 'agriculture') {
  return variants.filter((variant) => variant.faculty === key).map((variant) => variant.name);
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

function amuSeal(x, y, size, backing = false) {
  // Square box + meet: the inscribed circular emblem stays perfectly round.
  // On dark skins the seal needs a paper medallion behind it to stay visible.
  const disc = backing ? `<circle cx="${x + size / 2}" cy="${y + size / 2}" r="${size * 0.57}" fill="#F6F3EB"/>` : '';
  return `${disc}<image x="${x}" y="${y}" width="${size}" height="${size}" href="${AMU_LOGO}" preserveAspectRatio="xMidYMid meet"/>`;
}

// ---------- ornament vocabulary (drawn, not decorative clip-art) ----------

function sunMark(cx, cy, r, color) {
  const rays = [];
  for (let a = 0; a < 12; a += 1) {
    const ang = (Math.PI * 2 * a) / 12 - Math.PI / 2;
    const x1 = cx + Math.cos(ang) * (r + 18);
    const y1 = cy + Math.sin(ang) * (r + 18);
    const x2 = cx + Math.cos(ang) * (r + 36);
    const y2 = cy + Math.sin(ang) * (r + 36);
    rays.push(`<path d="M${x1.toFixed(1)} ${y1.toFixed(1)} L${x2.toFixed(1)} ${y2.toFixed(1)}" stroke="${color}" stroke-width="1.2" opacity=".5"/>`);
  }
  return `<circle cx="${cx}" cy="${cy}" r="${r}" fill="${color}" opacity=".92"/><circle cx="${cx}" cy="${cy}" r="${r + 9}" fill="none" stroke="${color}" stroke-width="1" opacity=".5"/>${rays.join('')}`;
}

function fieldBands(fg) {
  // Layered field horizons, quiet enough to sit under type.
  return `<path d="M82 566 Q320 548 560 566 T998 562 V655 H82 Z" fill="${fg}" opacity=".05"/><path d="M82 594 Q340 578 600 594 T998 590 V655 H82 Z" fill="${fg}" opacity=".038"/><path d="M82 622 Q360 608 620 622 T998 618 V655 H82 Z" fill="${fg}" opacity=".028"/>`;
}

function furrowDashes(x0, x1, y0, y1, step, color, opacity) {
  const rows = [];
  for (let y = y0; y <= y1; y += step) rows.push(`<path d="M${x0} ${y} H${x1}" stroke="${color}" stroke-width="1" stroke-dasharray="9 7" opacity="${opacity}"/>`);
  return rows.join('');
}

function ledgerRules(x0, x1, y0, y1, step, color, opacity) {
  const rows = [];
  for (let y = y0; y <= y1; y += step) rows.push(`<path d="M${x0} ${y} H${x1}" stroke="${color}" stroke-width="1" opacity="${opacity}"/><path d="M${x0} ${y - 4} V${y + 4}" stroke="${color}" stroke-width="1.2" opacity="${opacity + 0.06}"/><path d="M${x1} ${y - 4} V${y + 4}" stroke="${color}" stroke-width="1.2" opacity="${opacity + 0.06}"/>`);
  return rows.join('');
}

function dotGridDef(id, fill) {
  return `<defs><pattern id="${id}" width="22" height="22" patternUnits="userSpaceOnUse"><circle cx="2" cy="2" r="1.15" fill="${fill}"/></pattern></defs>`;
}

function weaveDef(id, c1, c2) {
  return `<defs><pattern id="${id}" width="36" height="14" patternUnits="userSpaceOnUse"><rect width="36" height="14" fill="${c2}" opacity=".26"/><rect width="18" height="7" fill="${c1}" opacity=".85"/><rect x="18" y="7" width="18" height="7" fill="${c1}" opacity=".85"/></pattern></defs>`;
}

function weaveBand(x, y, w, id, line) {
  return `<rect x="${x}" y="${y}" width="${w}" height="14" fill="url(#${id})"/><path d="M${x} ${y - 4} H${x + w}" stroke="${line}" stroke-width="1" opacity=".5"/><path d="M${x} ${y + 18} H${x + w}" stroke="${line}" stroke-width="1" opacity=".5"/>`;
}

function rings(cx, cy, r, color, opacity = .8) {
  return `<circle cx="${cx - r - 8}" cy="${cy}" r="${r}" fill="none" stroke="${color}" stroke-width="1.6" opacity="${opacity}"/><circle cx="${cx}" cy="${cy}" r="${r}" fill="none" stroke="${color}" stroke-width="1.6" opacity="${opacity}"/><circle cx="${cx + r + 8}" cy="${cy}" r="${r}" fill="none" stroke="${color}" stroke-width="1.6" opacity="${opacity}"/>`;
}

function star8(cx, cy, r, color, opacity = .9) {
  return `<rect x="${cx - r}" y="${cy - r}" width="${r * 2}" height="${r * 2}" fill="none" stroke="${color}" stroke-width="1.2" opacity="${opacity}"/><rect x="${cx - r}" y="${cy - r}" width="${r * 2}" height="${r * 2}" transform="rotate(45 ${cx} ${cy})" fill="none" stroke="${color}" stroke-width="1.2" opacity="${opacity}"/><circle cx="${cx}" cy="${cy}" r="${r * 0.26}" fill="${color}" opacity="${opacity}"/>`;
}

function pointedArch(cx, yb, halfW, height, color, opacity = .55) {
  const x0 = cx - halfW;
  const x1 = cx + halfW;
  const ym = yb - height * 0.62;
  const apex = yb - height;
  const drop = height * 0.16;
  return `<path d="M${x0} ${yb} V${ym} Q${x0} ${apex + drop} ${cx} ${apex} Q${x1} ${apex + drop} ${x1} ${ym} V${yb}" fill="none" stroke="${color}" stroke-width="1.5" opacity="${opacity}"/>`;
}

function diamond(x, y, s, fill, opacity = 1) {
  return `<rect x="${x - s / 2}" y="${y - s / 2}" width="${s}" height="${s}" transform="rotate(45 ${x} ${y})" fill="${fill}" opacity="${opacity}"/>`;
}

function diamondChain(x0, x1, y, color, opacity = .55) {
  const links = [];
  for (let x = x0; x <= x1; x += 30) links.push(diamond(x, y, 5, color, opacity));
  return links.join('');
}

function cornerMarks(m, color, opacity = .5) {
  const L = (x, y, dx, dy) => `<path d="M${x} ${y + dy * 22} V${y} H${x + dx * 22}" stroke="${color}" stroke-width="1.2" opacity="${opacity}" fill="none"/>`;
  return `${L(m, m, 1, 1)}${L(1080 - m, m, -1, 1)}${L(m, 1350 - m, 1, -1)}${L(1080 - m, 1350 - m, -1, -1)}`;
}

// ---------- shared content blocks ----------

function masthead(skin, number) {
  const { fg, accent } = skin;
  return `${amuSeal(82, 44, 56, skin.mode === 'dark')}<text x="152" y="72" font-family="Arial,Helvetica,sans-serif" font-size="13.5" letter-spacing="2.6" fill="${fg}">ALIGARH MUSLIM UNIVERSITY</text><text x="152" y="96" font-family="Arial,Helvetica,sans-serif" font-size="10" letter-spacing="2" fill="${fg}" opacity=".62">EST. 1875 · STUDENT-LED</text><text x="998" y="70" text-anchor="end" font-family="Arial,Helvetica,sans-serif" font-size="11" letter-spacing="2.2" fill="${fg}" opacity=".72">STUDENT CONCERN</text><text x="998" y="96" text-anchor="end" font-family="Arial,Helvetica,sans-serif" font-size="13" letter-spacing="1.6" fill="${accent}">No. ${String(number + 1).padStart(2, '0')} / 02</text>`;
}

function candidatePlate(skin) {
  const { fg, accent } = skin;
  return `<path d="M82 134 H998" stroke="${accent}" stroke-width="1.2" stroke-opacity=".75"/><text x="82" y="228" font-family="Arial,Helvetica,sans-serif" font-size="11" letter-spacing="3.2" fill="${accent}">PRESENTED BY</text><text x="82" y="278" font-family="Georgia,serif" font-size="47" fill="${fg}">Mohtashim Ejaz Sani</text><rect x="82" y="296" width="7" height="7" fill="${accent}"/><text x="100" y="304" font-family="Arial,Helvetica,sans-serif" font-size="12" letter-spacing="2.4" fill="${fg}" opacity=".88">CANDIDATE · UNIVERSITY COURT MEMBER</text>`;
}

function leftFacultyZone(skin, lines, kicker, motif) {
  const { fg, accent } = skin;
  return `<text x="82" y="382" font-family="Arial,Helvetica,sans-serif" font-size="13" letter-spacing="3" fill="${accent}">${kicker}</text>${svgMultiline(lines, { x: 78, y: 464, size: 76, lineGap: 82, fill: fg, family: 'Arial,Helvetica,sans-serif', weight: 800, letterSpacing: -2.3 })}<text x="82" y="604" font-family="Georgia,serif" font-size="33" font-style="italic" fill="${fg}" opacity=".82">and the Court should hear it.</text>${motif}`;
}

function centeredFacultyZone(skin, line, kicker, motif) {
  const { fg, accent } = skin;
  return `<text x="540" y="352" text-anchor="middle" font-family="Arial,Helvetica,sans-serif" font-size="13" letter-spacing="3" fill="${accent}">${kicker}</text>${svgMultiline([line], { x: 540, y: 486, size: 100, fill: fg, family: 'Arial,Helvetica,sans-serif', weight: 800, letterSpacing: -2.5, anchor: 'middle' })}<text x="540" y="556" text-anchor="middle" font-family="Georgia,serif" font-size="33" font-style="italic" fill="${fg}" opacity=".82">and the Court should hear it.</text>${motif}`;
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

function footerLine(skin) {
  const { fg, accent } = skin;
  return `<path d="M82 1148 H998" stroke="${accent}" stroke-width="1" stroke-opacity=".72"/><text x="82" y="1196" font-family="Arial,Helvetica,sans-serif" font-size="15" letter-spacing="2.8" fill="${fg}" opacity=".82">EVERY FACULTY DESERVES TO BE HEARD</text><text x="998" y="1196" text-anchor="end" font-family="Arial,Helvetica,sans-serif" font-size="11" letter-spacing="1.4" fill="${fg}" opacity=".62">MOHTASHIMFORCOURTMEMBER.VERCEL.APP</text>`;
}

// ---------- faculty palettes (campaign green/gold/paper as the anchor) ----------

const SKINS = {
  agriculture: [
    { mode: 'dark', bg: '#05422B', fg: '#F7F1E2', accent: '#D8BB73', panel: '#0A5642', panelFg: '#F5EFE0' },
    { mode: 'light', bg: '#F3EEE1', fg: '#1B3A2D', accent: '#A98734', panel: '#E9E2CF', panelFg: '#1B3A2D' },
  ],
  community: [
    { mode: 'dark', bg: '#0B4638', fg: '#F8F2E6', accent: '#D8BB73', accent2: '#C96F4A', panel: '#0F5447', panelFg: '#F5EFE1' },
    { mode: 'light', bg: '#F5F0E6', fg: '#1E3A2E', accent: '#B4552D', accent2: '#A98734', panel: '#EAE1D2', panelFg: '#1E3A2D' },
  ],
  theology: [
    { mode: 'dark', bg: '#0A2B1F', fg: '#FAF4E6', accent: '#E0C68C', panel: '#0E3A2B', panelFg: '#F8F2E3' },
    { mode: 'light', bg: '#F1ECDF', fg: '#142B22', accent: '#B99A58', panel: '#E7E0CE', panelFg: '#142B22' },
  ],
};

const KICKERS = {
  agriculture: 'FROM THE FIELDS TO THE COURT',
  community: 'FROM THE COMMONS TO THE COURT',
  theology: 'FROM THE STUDY TO THE COURT',
};

// ---------- the six designs ----------

function designAgricultureFurrow(note, skin, number) {
  const { bg, fg, accent } = skin;
  const backdrop = `<rect width="1080" height="1350" fill="${bg}"/>${furrowDashes(82, 998, 396, 560, 28, fg, .09)}${fieldBands(fg)}`;
  const motif = sunMark(850, 420, 56, accent);
  const zone = leftFacultyZone(skin, facultyLines('Agricultural Sciences'), KICKERS.agriculture, motif);
  const divider = `<path d="M82 648 H998" stroke="${fg}" stroke-width="1" stroke-dasharray="9 7" opacity=".28"/>${diamond(540, 648, 8, accent)}`;
  return `${backdrop}${masthead(skin, number)}${candidatePlate(skin)}${zone}${divider}${contributionPanel(note, { ink: fg, accent, panel: skin.panel, panelInk: skin.panelFg }, { x: 82, width: 916, maxChars: 56 })}${footerLine(skin)}`;
}

function designAgricultureLedger(note, skin, number) {
  const { bg, fg, accent } = skin;
  const backdrop = `<rect width="1080" height="1350" fill="${bg}"/><rect width="1080" height="10" fill="${accent}"/>${cornerMarks(46, fg)}${ledgerRules(82, 998, 396, 560, 28, fg, .07)}`;
  const motif = `<circle cx="880" cy="470" r="46" fill="none" stroke="${accent}" stroke-width="1.4" opacity=".6"/><circle cx="880" cy="470" r="37" fill="none" stroke="${accent}" stroke-width="1" opacity=".4"/>`;
  const zone = leftFacultyZone(skin, facultyLines('Agricultural Sciences'), KICKERS.agriculture, motif);
  const divider = `<path d="M82 643 H998" stroke="${accent}" stroke-width="1" opacity=".55"/><path d="M300 655 H780" stroke="${accent}" stroke-width="1" opacity=".4"/>${diamond(540, 649, 7, accent)}`;
  return `${backdrop}${masthead(skin, number)}${candidatePlate(skin)}${zone}${divider}${contributionPanel(note, { ink: fg, accent, panel: skin.panel, panelInk: skin.panelFg }, { x: 82, width: 916, maxChars: 56 })}${footerLine(skin)}`;
}

function designCommunityCommons(note, skin, number) {
  const { bg, fg, accent, accent2 } = skin;
  const backdrop = `<rect width="1080" height="1350" fill="${bg}"/>${dotGridDef('commonsDots', fg)}<rect x="82" y="336" width="916" height="224" fill="url(#commonsDots)" opacity=".12"/>`;
  const motif = rings(866, 455, 44, accent, .75);
  const zone = leftFacultyZone(skin, facultyLines('Community Science'), KICKERS.community, motif);
  const divider = `${weaveDef('commonsWeave', accent, accent2)}${weaveBand(82, 640, 916, 'commonsWeave', fg)}`;
  return `${backdrop}${masthead(skin, number)}${candidatePlate(skin)}${zone}${divider}${contributionPanel(note, { ink: fg, accent, panel: skin.panel, panelInk: skin.panelFg }, { x: 82, width: 916, maxChars: 56 })}${footerLine(skin)}`;
}

function designCommunityWeave(note, skin, number) {
  const { bg, fg, accent, accent2 } = skin;
  const backdrop = `${weaveDef('weaveTop', accent, accent2)}<rect width="1080" height="1350" fill="${bg}"/><rect x="0" y="0" width="1080" height="18" fill="url(#weaveTop)"/><path d="M0 22 H1080" stroke="${accent}" stroke-width="1" opacity=".5"/>${dotGridDef('weaveDots', fg)}<rect x="82" y="336" width="916" height="224" fill="url(#weaveDots)" opacity=".1"/>`;
  const motif = `<circle cx="880" cy="468" r="108" fill="none" stroke="${accent}" stroke-width="1.2" opacity=".32"/><circle cx="880" cy="468" r="72" fill="none" stroke="${accent}" stroke-width="1.2" opacity=".24"/><circle cx="880" cy="468" r="36" fill="none" stroke="${accent}" stroke-width="1.2" opacity=".18"/>`;
  const zone = leftFacultyZone(skin, facultyLines('Community Science'), KICKERS.community, motif);
  const divider = weaveBand(82, 640, 916, 'weaveTop', accent);
  return `${backdrop}${masthead(skin, number)}${candidatePlate(skin)}${zone}${divider}${contributionPanel(note, { ink: fg, accent, panel: skin.panel, panelInk: skin.panelFg }, { x: 82, width: 916, maxChars: 56 })}${footerLine(skin)}`;
}

function designTheologyIlluminated(note, skin, number) {
  const { bg, fg, accent } = skin;
  const backdrop = `<rect width="1080" height="1350" fill="${bg}"/><rect x="40" y="40" width="1000" height="1270" fill="none" stroke="${accent}" stroke-width="1.4" opacity=".8"/><rect x="52" y="52" width="976" height="1246" fill="none" stroke="${accent}" stroke-width="1" opacity=".4"/>${diamond(40, 40, 8, accent, .9)}${diamond(1040, 40, 8, accent, .9)}${diamond(40, 1310, 8, accent, .9)}${diamond(1040, 1310, 8, accent, .9)}`;
  const motif = `${star8(540, 92, 24, accent, .85)}${pointedArch(540, 600, 400, 230, accent, .5)}`;
  const zone = centeredFacultyZone(skin, 'THEOLOGY', KICKERS.theology, motif);
  const divider = `${diamondChain(300, 780, 648, accent)}`;
  return `${backdrop}${masthead(skin, number)}${candidatePlate(skin)}${zone}${divider}${contributionPanel(note, { ink: fg, accent, panel: skin.panel, panelInk: skin.panelFg }, { x: 82, width: 916, maxChars: 56 })}${footerLine(skin)}`;
}

function designTheologyStudy(note, skin, number) {
  const { bg, fg, accent } = skin;
  const backdrop = `<rect width="1080" height="1350" fill="${bg}"/><rect x="46" y="46" width="988" height="1258" fill="none" stroke="${accent}" stroke-width="1.2" opacity=".65"/>`;
  const motif = `${pointedArch(540, 600, 400, 230, accent, .38)}`;
  const zone = centeredFacultyZone(skin, 'THEOLOGY', KICKERS.theology, motif);
  const divider = `<path d="M82 648 H460" stroke="${accent}" stroke-width="1" opacity=".55"/><path d="M620 648 H998" stroke="${accent}" stroke-width="1" opacity=".55"/>${diamond(540, 648, 7, accent)}`;
  return `${backdrop}${masthead(skin, number)}${candidatePlate(skin)}${zone}${divider}${contributionPanel(note, { ink: fg, accent, panel: skin.panel, panelInk: skin.panelFg }, { x: 82, width: 916, maxChars: 56 })}${footerLine(skin)}`;
}

const DESIGNS = {
  agriculture: [designAgricultureFurrow, designAgricultureLedger],
  community: [designCommunityCommons, designCommunityWeave],
  theology: [designTheologyIlluminated, designTheologyStudy],
};

export function makeCardSvg(note = {}, index = 0) {
  const key = variantKey(note);
  const design = ((index % 2) + 2) % 2;
  const skin = SKINS[key][design];
  const topic = normalizeText(note.topic) || 'Student representation';
  const contribution = normalizeText(note.details);
  const named = !note.anonymous && Boolean(normalizeText(note.name));
  const ariaExcerpt = named ? 170 : 220;
  const ariaDescription = contribution ? `Contribution: ${excerptText(contribution, ariaExcerpt)}` : 'Every faculty deserves to be heard.';
  const faculty = cardFacultyName(note);
  const svg = DESIGNS[key][design](note, skin, design);
  return `<svg xmlns="http://www.w3.org/2000/svg" width="1080" height="1350" viewBox="0 0 1080 1350" role="img" aria-label="Share card for ${xml(faculty)}. Selected topic: ${xml(topic)}. ${xml(ariaDescription)}">${svg}</svg>`;
}

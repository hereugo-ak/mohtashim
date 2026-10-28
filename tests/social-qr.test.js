import test from 'node:test';
import assert from 'node:assert/strict';
import { INSTAGRAM_LINK, igGlyph, qrSvg, waGlyph, WHATSAPP_INVITE_BASE, WHATSAPP_LINK } from '../src/lib/social.js';

test('both campaign links generate distinct, scannable QR codes', () => {
  const wa = qrSvg(WHATSAPP_LINK);
  const ig = qrSvg(INSTAGRAM_LINK);
  for (const svg of [wa, ig]) {
    assert.match(svg, /^<svg /);
    assert.match(svg, /<\/svg>$/);
    assert.match(svg, /shape-rendering="crispEdges"/);
    assert.ok((svg.match(/h1v1h-1z/g) || []).length > 60, 'QR carries a dense module matrix');
    assert.match(svg, /fill="#064b37"/);
  }
  assert.notEqual(wa, ig);
  assert.equal(qrSvg(WHATSAPP_LINK), wa, 'QR generation is deterministic');
});

test('the QR-encoded WhatsApp invite stays small enough to scan on any phone', () => {
  assert.equal(WHATSAPP_INVITE_BASE, 'https://chat.whatsapp.com/CxN7dL8S5lMDyqRIsI3ow5');
  const svg = qrSvg(WHATSAPP_INVITE_BASE);
  const total = Number(svg.match(/viewBox="0 0 (\d+) \d+"/)[1]);
  assert.ok(total <= 42, `QR matrix stays compact (got ${total} units incl. quiet zone)`);
});

test('the base WhatsApp invite and Instagram page are the encoded destinations', () => {
  assert.match(WHATSAPP_LINK, /^https:\/\/chat\.whatsapp\.com\/CxN7dL8S5lMDyqRIsI3ow5/);
  assert.equal(INSTAGRAM_LINK, 'https://www.instagram.com/mohtashim_for_court_member');
});

test('platform glyphs ship as inline official marks', () => {
  assert.match(waGlyph(), /^<svg viewBox="0 0 24 24"/);
  assert.match(igGlyph(), /^<svg viewBox="0 0 24 24"/);
  assert.ok(waGlyph().length > 400 && igGlyph().length > 400);
});

import test from 'node:test';
import assert from 'node:assert/strict';
import { FACULTIES } from '../src/data/faculties.js';
import { cardFacultyName, designNames, makeCardSvg, variants, variantKey, xml } from '../src/lib/shareCards.js';

test('each faculty carries its own two-design set, six designs in all', () => {
  assert.equal(variants.length, 6);
  assert.deepEqual(designNames('agriculture'), ['The Furrow', 'The Field Ledger']);
  assert.deepEqual(designNames('community'), ['The Commons', 'The Weave']);
  assert.deepEqual(designNames('theology'), ['The Illuminated', 'The Study']);
  assert.equal(variantKey({ facultyName: 'Faculty of Theology' }), 'theology');
  assert.equal(variantKey({ faculty: 'community' }), 'community');
});

const FACULTY_DISPLAY = {
  agriculture: 'AGRICULTURAL SCIENCES',
  community: 'COMMUNITY SCIENCE',
  theology: 'THEOLOGY',
};

test('every design carries the university, the seal, the candidate and the contested post', () => {
  for (const [key, faculty] of Object.entries(FACULTIES)) {
    for (let index = 0; index < 2; index += 1) {
      const svg = makeCardSvg({ faculty: key, facultyName: faculty.cardName }, index);
      assert.match(svg, /^<svg /);
      assert.match(svg, /<\/svg>$/);
      assert.match(svg, /ALIGARH MUSLIM UNIVERSITY/);
      assert.match(svg, /href="data:image\/png;base64,iVBOR/);
      assert.match(svg, /PRESENTED BY/);
      assert.match(svg, /Mohtashim Ejaz Sani/);
      assert.match(svg, /CANDIDATE · UNIVERSITY COURT MEMBER/);
      assert.match(svg, /STUDENT CONCERN/);
      const title = FACULTY_DISPLAY[key];
      for (const part of title.split(' ')) assert.match(svg, new RegExp(`>${part}</tspan>`));
      assert.match(svg, /Every faculty deserves/);
      assert.match(svg, /SELECTED TOPIC/);
    }
  }
});

test('every design includes the selected topic and a written contribution', () => {
  const note = {
    faculty: 'agriculture',
    facultyName: 'Agricultural Sciences',
    topic: 'Facilities & infrastructure',
    details: 'The reading room needs longer evening hours and accessible desk space.',
  };
  for (let index = 0; index < 2; index += 1) {
    const svg = makeCardSvg(note, index);
    assert.match(svg, /Facilities &amp; infrastructure/);
    assert.match(svg, /The reading room needs longer evening hours/);
    assert.match(svg, /YOUR WORDS/);
  }
});

test('share-card user text is XML-escaped and descriptions are sized for the card', () => {
  assert.equal(xml('<hello attr="x">&\'world\'</hello>'), '&lt;hello attr=&quot;x&quot;&gt;&amp;&apos;world&apos;&lt;/hello&gt;');
  const long = 'Improve facilities & accessibility. '.repeat(30);
  const svg = makeCardSvg({ faculty: 'community', facultyName: 'Community Science', topic: 'Safety & accessibility', details: long }, 1);
  assert.match(svg, /Safety &amp; accessibility/);
  assert.match(svg, /\.\.\.|…/);
  assert.doesNotMatch(svg, /<script/i);
});

test('named contributions sign the card openly; anonymous ones never leak identity', () => {
  const base = {
    faculty: 'agriculture',
    facultyName: 'Agricultural Sciences',
    topic: 'Facilities & infrastructure',
    details: 'The reading room needs longer evening hours and accessible desk space.',
  };
  for (const [key, faculty] of Object.entries(FACULTIES)) {
    for (let index = 0; index < 2; index += 1) {
      const named = makeCardSvg({ ...base, faculty: key, facultyName: faculty.cardName, name: 'Zoya Anwer', className: 'B.Sc. (Hons) Agriculture, Final Year', anonymous: false }, index);
      assert.match(named, /Zoya Anwer/);
      assert.match(named, /B.Sc. \(Hons\) Agriculture, Final Year/);
      assert.match(named, /SIGNED OPENLY/);
      assert.doesNotMatch(named, /SHARED ANONYMOUSLY/);

      const anonymous = makeCardSvg({ ...base, faculty: key, facultyName: faculty.cardName, name: 'Zoya Anwer', className: 'B.Sc. (Hons) Agriculture, Final Year', anonymous: true }, index);
      assert.doesNotMatch(anonymous, /Zoya Anwer/);
      assert.doesNotMatch(anonymous, /Agriculture, Final Year/);
      assert.match(anonymous, /SHARED ANONYMOUSLY/);
      assert.match(anonymous, /IDENTITY PROTECTED/);
      assert.doesNotMatch(anonymous, /SIGNED OPENLY/);
    }
  }
});

test('faculty names resolve cleanly for the share-card message', () => {
  assert.equal(cardFacultyName({ facultyName: 'Agricultural Sciences' }), 'Agricultural Sciences');
  assert.equal(cardFacultyName({ facultyName: 'Community Science' }), 'Community Science');
  assert.equal(cardFacultyName({ facultyName: 'Faculty of Theology' }), 'Theology');
});

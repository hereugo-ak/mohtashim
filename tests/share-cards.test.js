import test from 'node:test';
import assert from 'node:assert/strict';
import { FACULTIES } from '../src/data/faculties.js';
import { cardFacultyName, makeCardSvg, variants, xml } from '../src/lib/shareCards.js';

test('the approved six share-card concepts remain available', () => {
  assert.equal(variants.length, 6);
  assert.deepEqual(variants.map((variant) => variant.name), [
    'The Manifesto', 'The Field Note', 'The Register',
    'The Declaration', 'The Margin', 'The Collective',
  ]);
});

test('all six card variants render for every faculty', () => {
  for (const [key, faculty] of Object.entries(FACULTIES)) {
    for (let index = 0; index < variants.length; index += 1) {
      const svg = makeCardSvg({ faculty: key, facultyName: faculty.name }, index);
      assert.match(svg, /^<svg /);
      assert.match(svg, /<\/svg>$/);
      assert.match(svg, /Every faculty deserves/);
      assert.match(svg, /SELECTED TOPIC/);
      assert.match(svg, /Student representation/);
    }
  }
});

test('every share-card includes the selected topic and a written contribution', () => {
  const note = {
    faculty: 'agriculture',
    facultyName: 'Agricultural Sciences',
    topic: 'Facilities & infrastructure',
    details: 'The reading room needs longer evening hours and accessible desk space.',
  };
  for (let index = 0; index < variants.length; index += 1) {
    const svg = makeCardSvg(note, index);
    assert.match(svg, /Facilities &amp; infrastructure/);
    assert.match(svg, /The reading room needs longer evening hours/);
    assert.match(svg, /YOUR WORDS/);
  }
});

test('share-card user text is XML-escaped and descriptions are sized for the card', () => {
  assert.equal(xml('<hello attr="x">&\'world\'</hello>'), '&lt;hello attr=&quot;x&quot;&gt;&amp;&apos;world&apos;&lt;/hello&gt;');
  const long = 'Improve facilities & accessibility. '.repeat(30);
  const svg = makeCardSvg({ facultyName: 'Faculty of Theology', topic: 'Safety & accessibility', details: long }, 2);
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
  for (let index = 0; index < variants.length; index += 1) {
    const named = makeCardSvg({ ...base, name: 'Zoya Anwer', className: 'B.Sc. (Hons) Agriculture, Final Year', anonymous: false }, index);
    assert.match(named, /Zoya Anwer/);
    assert.match(named, /B.Sc. \(Hons\) Agriculture, Final Year/);
    assert.match(named, /SIGNED OPENLY/);
    assert.doesNotMatch(named, /SHARED ANONYMOUSLY/);

    const anonymous = makeCardSvg({ ...base, name: 'Zoya Anwer', className: 'B.Sc. (Hons) Agriculture, Final Year', anonymous: true }, index);
    assert.doesNotMatch(anonymous, /Zoya Anwer/);
    assert.doesNotMatch(anonymous, /Agriculture, Final Year/);
    assert.match(anonymous, /SHARED ANONYMOUSLY/);
    assert.match(anonymous, /IDENTITY PROTECTED/);
    assert.doesNotMatch(anonymous, /SIGNED OPENLY/);
  }
});

test('faculty names resolve cleanly for the share-card message', () => {
  assert.equal(cardFacultyName({ facultyName: 'Agricultural Sciences' }), 'Agricultural Sciences');
  assert.equal(cardFacultyName({ facultyName: 'Community Science' }), 'Community Science');
  assert.equal(cardFacultyName({ facultyName: 'Faculty of Theology' }), 'Theology');
});

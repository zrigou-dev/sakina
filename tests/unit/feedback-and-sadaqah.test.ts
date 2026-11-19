import { createHash } from 'node:crypto';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';

import SADAQAH from '@/content/sadaqah/hadith.generated.json';
import { CONTACT_EMAIL } from '@/content/contact';
import { buildMailto, crashMailto, feedbackBody, feedbackMailto } from '@/services/feedback/mailto';

const info = { appVersion: '0.1.0', platform: 'android', osVersion: '15', language: 'ar' };
const labels = { subject: 'SAKINA — problem report', prompts: ['What happened?', 'What did you expect?'], tech: 'Technical details:' };
const params = (url: string) => new URL(url.replace(/^mailto:/, 'https://mail.invalid/')).searchParams;

describe('contact', () => {
  it('goes to the developer’s address exactly', () => {
    expect(CONTACT_EMAIL).toBe('zrigoudev@gmail.com');
    expect(feedbackMailto(labels, info).startsWith('mailto:zrigoudev@gmail.com?subject=')).toBe(true);
  });

  it('builds a valid RFC 6068 URL that round-trips subject and body (Unicode, newlines, reserved characters)', () => {
    const nasty = 'a&b=c?d#e\nسطر ثانٍ — “quotes”';
    const url = buildMailto('x@y.z', nasty, nasty);
    expect(url.startsWith('mailto:x@y.z?subject=')).toBe(true);
    expect(url).not.toMatch(/ |\n|#(?!$)/); // nothing raw that a mail client could misparse
    expect(params(url).get('subject')).toBe(nasty.replace(/\n/g, ' ')); // a subject is a single line
    expect(params(url).get('body')).toBe(nasty.replace(/\n/g, '\r\n'));
  });

  it('the draft holds the prompts and a small technical footer — nothing identifying', () => {
    const body = feedbackBody(labels, info);
    expect(body).toContain('What happened?');
    expect(body).toContain('SAKINA 0.1.0 · android 15 · ar');
    expect(body).not.toMatch(/latitude|longitude|location|@|device id|uuid/i);
    expect(params(feedbackMailto(labels, info)).get('subject')).toBe('SAKINA — problem report');
  });

  it('the startup-crash draft carries a bounded error text and survives hostile error messages', () => {
    const url = crashMailto('boom & <script>'.padEnd(1000, 'x'), info);
    const body = params(url).get('body')!;
    expect(body).toContain('boom & <script>');
    expect(body.length).toBeLessThan(600);
    expect(params(url).get('subject')).toBe('SAKINA — startup problem');
  });
});

describe('sadaqah hadith (Sahih Muslim 1631)', () => {
  it('is the verified text: right number, the three things, no chain of narrators, locked by SHA-256', () => {
    expect(SADAQAH.collection).toBe('muslim');
    expect(SADAQAH.arabicNumber).toBe('1631');
    for (const phrase of ['إِذَا مَاتَ الإِنْسَانُ انْقَطَعَ عَنْهُ عَمَلُهُ', 'صَدَقَةٍ جَارِيَةٍ', 'عِلْمٍ يُنْتَفَعُ بِهِ', 'وَلَدٍ صَالِحٍ يَدْعُو لَهُ']) expect(SADAQAH.ar).toContain(phrase);
    expect(SADAQAH.ar).not.toMatch(/حَدَّثَنَا|["‏]/);
    expect(SADAQAH.arFull).toContain(SADAQAH.ar); // the excerpt is a verbatim slice of the source
    expect(SADAQAH.en).toMatch(/recurring charity/);
    expect(SADAQAH.fr).toMatch(/aumône continue/);

    const root = join(__dirname, '..', '..');
    const lock = JSON.parse(readFileSync(join(root, 'content', 'SOURCES.extended.lock.json'), 'utf8'));
    const sha = createHash('sha256')
      .update(readFileSync(join(root, 'src', 'content', 'sadaqah', 'hadith.generated.json')))
      .digest('hex');
    expect(lock.sources['sadaqah.hadith'].sha256).toBe(sha);
  });
});

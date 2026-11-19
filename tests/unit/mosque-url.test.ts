import { mosqueSearchUrl } from '@/services/mosques/mapsUrl';

describe('mosqueSearchUrl', () => {
  it('builds a geo: intent on Android', () => {
    expect(mosqueSearchUrl(48.8566, 2.3522, 'android')).toBe('geo:48.85660,2.35220?q=mosque');
  });
  it('builds an Apple Maps link on iOS', () => {
    expect(mosqueSearchUrl(48.8566, 2.3522, 'ios')).toBe('https://maps.apple.com/?q=mosque&sll=48.85660,2.35220&z=14');
  });
  it('builds a web map link elsewhere and keeps negative coordinates', () => {
    expect(mosqueSearchUrl(-33.8688, -70.6693, 'web')).toBe('https://www.google.com/maps/search/mosque/@-33.86880,-70.66930,14z');
  });
});

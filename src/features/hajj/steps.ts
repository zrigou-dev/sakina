import type { TKey } from '@/runtime/AppProvider';

/**
 * Hajj & ʿUmrah step STRUCTURE (names and order of the rites). No explanatory religious
 * text is bundled; the UI says guidance awaits a verified, reviewed source.
 * Related verses are references only — their text is read from the verified Quran.
 * Verse references below are awaiting scholarly review like the rest of this section.
 */
export interface HajjStep {
  readonly id: string;
  readonly title: TKey;
  readonly verses?: readonly { surah: number; from: number; to: number }[];
  readonly counter?: 'tawaf' | 'sai';
}

export const UMRAH_STEPS: readonly HajjStep[] = [
  { id: 'ihram', title: 'hajj.steps.ihram' },
  { id: 'tawaf', title: 'hajj.steps.tawaf', counter: 'tawaf' },
  { id: 'sai', title: 'hajj.steps.sai', counter: 'sai', verses: [{ surah: 2, from: 158, to: 158 }] },
  { id: 'halq', title: 'hajj.steps.halq' },
];

export const HAJJ_STEPS: readonly HajjStep[] = [
  { id: 'ihram', title: 'hajj.steps.ihram', verses: [{ surah: 2, from: 196, to: 197 }] },
  { id: 'tarwiyah', title: 'hajj.steps.tarwiyah' },
  { id: 'arafah', title: 'hajj.steps.arafah', verses: [{ surah: 2, from: 198, to: 199 }] },
  { id: 'muzdalifah', title: 'hajj.steps.muzdalifah' },
  { id: 'ramy', title: 'hajj.steps.ramy' },
  { id: 'hady', title: 'hajj.steps.hady' },
  { id: 'halq', title: 'hajj.steps.halq' },
  { id: 'ifadah', title: 'hajj.steps.ifadah', counter: 'tawaf' },
  { id: 'sai', title: 'hajj.steps.sai', counter: 'sai' },
  { id: 'tashreeq', title: 'hajj.steps.tashreeq', verses: [{ surah: 2, from: 203, to: 203 }] },
  { id: 'wada', title: 'hajj.steps.wada', counter: 'tawaf' },
];

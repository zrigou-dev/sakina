import { Easing } from 'react-native-reanimated';

export const duration = {
  instant: 120,
  quick: 220,
  base: 320,
  slow: 600,
  ambient: 24_000,
} as const;

export const easing = {
  standard: Easing.bezier(0.2, 0, 0, 1),
  emphasized: Easing.bezier(0.3, 0, 0, 1),
  exit: Easing.bezier(0.3, 0, 1, 1),
} as const;

/** No visible overshoot: calm, not bouncy. */
export const spring = {
  gentle: { damping: 18, stiffness: 180, mass: 1 },
  press: { damping: 22, stiffness: 320, mass: 0.8 },
} as const;

export const STAGGER_MS = 60;
export const PRESS_SCALE = 0.97;

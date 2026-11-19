import type { LucideIcon } from 'lucide-react-native';
import BookHeart from 'lucide-react-native/icons/book-heart';
import CloudRain from 'lucide-react-native/icons/cloud-rain';
import Droplets from 'lucide-react-native/icons/droplets';
import HandHeart from 'lucide-react-native/icons/hand-heart';
import HeartPulse from 'lucide-react-native/icons/heart-pulse';
import House from 'lucide-react-native/icons/house';
import Moon from 'lucide-react-native/icons/moon';
import Plane from 'lucide-react-native/icons/plane';
import ShieldCheck from 'lucide-react-native/icons/shield-check';
import Sparkles from 'lucide-react-native/icons/sparkles';
import Users from 'lucide-react-native/icons/users';
import UtensilsCrossed from 'lucide-react-native/icons/utensils-crossed';

import type { AdhkarGroupId } from '@/content/adhkar/groups';

export const GROUP_ICONS: Record<AdhkarGroupId, LucideIcon> = {
  day: Moon,
  prayer: Droplets,
  home: House,
  hardship: ShieldCheck,
  repentance: Sparkles,
  illness: HeartPulse,
  family: HandHeart,
  food: UtensilsCrossed,
  travel: Plane,
  nature: CloudRain,
  social: Users,
  hajj: BookHeart,
};

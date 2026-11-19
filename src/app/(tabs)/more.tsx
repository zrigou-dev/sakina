import { router } from 'expo-router';
import Bell from 'lucide-react-native/icons/bell';
import CalendarDays from 'lucide-react-native/icons/calendar-days';
import CircleDot from 'lucide-react-native/icons/circle-dot';
import Coins from 'lucide-react-native/icons/coins';
import HardDriveDownload from 'lucide-react-native/icons/hard-drive-download';
import Heart from 'lucide-react-native/icons/heart';
import History from 'lucide-react-native/icons/rotate-ccw-clock';
import Info from 'lucide-react-native/icons/info';
import Library from 'lucide-react-native/icons/library';
import MessageCircleHeart from 'lucide-react-native/icons/message-circle-heart';
import NotebookPen from 'lucide-react-native/icons/notebook-pen';
import Settings from 'lucide-react-native/icons/settings';
import Sparkles from 'lucide-react-native/icons/sparkles';
import Sprout from 'lucide-react-native/icons/sprout';
import Target from 'lucide-react-native/icons/target';
import Volume2 from 'lucide-react-native/icons/volume-2';

import { FadeIn, ListGroup, ListRow, SectionHeader } from '@/design-system/components';
import { Screen } from '@/design-system/Screen';
import { useI18n } from '@/runtime/AppProvider';

export default function MoreTab() {
  const { t } = useI18n();
  return (
    <Screen title={t('more.title')} large tabBarInset testID="more-tab">
      <FadeIn index={0}>
        <ListGroup>
          <ListRow icon={Sprout} title={t('more.journey')} subtitle={t('journey.intro')} onPress={() => router.push('/journey')} testID="more-journey" />
          <ListRow
            icon={HardDriveDownload}
            iconTone="accent"
            title={t('more.library')}
            subtitle={t('library.intro')}
            onPress={() => router.push('/library')}
            testID="more-library"
            last
          />
        </ListGroup>
      </FadeIn>
      <FadeIn index={1}>
        <SectionHeader title={t('prayer.tools')} />
        <ListGroup>
          <ListRow icon={Library} iconTone="accent" title={t('hadith.title')} onPress={() => router.push('/hadith')} testID="more-hadith" />
          <ListRow icon={Volume2} title={t('adhan.title')} onPress={() => router.push('/adhan')} testID="more-adhan" />
          <ListRow icon={Target} iconTone="accent" title={t('khatma.title')} onPress={() => router.push('/khatma')} testID="more-khatma" />
          <ListRow icon={Bell} title={t('reminders.title')} onPress={() => router.push('/reminders')} testID="more-reminders" />
          <ListRow icon={History} iconTone="muted" title={t('qada.title')} onPress={() => router.push('/qada')} testID="more-qada" />
          <ListRow icon={CalendarDays} title={t('more.calendar')} onPress={() => router.push('/calendar')} testID="more-calendar" />
          <ListRow icon={Coins} iconTone="accent" title={t('more.zakat')} onPress={() => router.push('/zakat')} testID="more-zakat" />
          <ListRow icon={CircleDot} title={t('more.tasbih')} onPress={() => router.push('/tasbih')} testID="more-tasbih" />
          <ListRow icon={Sparkles} iconTone="accent" title={t('more.asma')} onPress={() => router.push('/asma')} testID="more-asma" />
          <ListRow icon={NotebookPen} title={t('more.notes')} onPress={() => router.push('/journey')} testID="more-notes" last />
        </ListGroup>
      </FadeIn>
      <FadeIn index={2}>
        <SectionHeader title={t('settings.general')} />
        <ListGroup>
          <ListRow icon={Settings} iconTone="muted" title={t('more.settings')} onPress={() => router.push('/settings')} testID="more-settings" />
          <ListRow
            icon={Heart}
            iconTone="accent"
            title={t('sadaqah.title')}
            subtitle={t('sadaqah.rowSubtitle')}
            onPress={() => router.push('/sadaqah')}
            testID="more-sadaqah"
          />
          <ListRow
            icon={MessageCircleHeart}
            iconTone="muted"
            title={t('contact.title')}
            subtitle={t('contact.rowSubtitle')}
            onPress={() => router.push('/contact')}
            testID="more-contact"
          />
          <ListRow icon={Info} iconTone="muted" title={t('more.about')} onPress={() => router.push('/about')} testID="more-about" last />
        </ListGroup>
      </FadeIn>
    </Screen>
  );
}

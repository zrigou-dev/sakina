import Bug from 'lucide-react-native/icons/bug';
import Copy from 'lucide-react-native/icons/copy';
import Lightbulb from 'lucide-react-native/icons/lightbulb';
import Mail from 'lucide-react-native/icons/mail';
import { View } from 'react-native';

import { CONTACT_EMAIL } from '@/content/contact';
import { Button, Card, FadeIn, Notice, SectionHeader } from '@/design-system/components';
import { Screen } from '@/design-system/Screen';
import { Text } from '@/design-system/Text';
import { space } from '@/design-system/tokens';
import { useFeedback } from '@/features/sadaqah/useFeedback';
import { useI18n, useTheme } from '@/runtime/AppProvider';

export default function Contact() {
  const { t } = useI18n();
  const { colors } = useTheme();
  const { compose, copyAddress, mailFailed, copied } = useFeedback();

  return (
    <Screen back title={t('contact.title')} subtitle={t('contact.intro')} large testID="contact-screen">
      <FadeIn index={0}>
        <Card style={{ gap: space.md }}>
          <Button label={t('contact.report')} icon={Bug} onPress={() => compose('report')} testID="contact-report" />
          <Button label={t('contact.suggest')} icon={Lightbulb} variant="secondary" onPress={() => compose('suggest')} testID="contact-suggest" />
          {mailFailed ? <Notice tone="warning" text={t('contact.noMail', { email: CONTACT_EMAIL })} /> : null}
        </Card>
      </FadeIn>

      <FadeIn index={1}>
        <SectionHeader title={t('contact.address')} />
        <Card style={{ gap: space.sm }}>
          <View style={{ flexDirection: 'row', alignItems: 'center', gap: space.sm }}>
            <Mail size={20} color={colors.accent} />
            <Text variant="headline" selectable script="latin" testID="contact-email" style={{ flexShrink: 1 }}>
              {CONTACT_EMAIL}
            </Text>
          </View>
          <Button label={copied ? t('contact.copied') : t('contact.copy')} icon={Copy} variant="ghost" size="sm" onPress={copyAddress} testID="contact-copy" />
        </Card>
      </FadeIn>

      <FadeIn index={2}>
        <SectionHeader title={t('contact.tipsTitle')} />
        <Card tone="muted" style={{ gap: space.sm }}>
          {(['tip1', 'tip2', 'tip3'] as const).map((k) => (
            <Text key={k} variant="subhead" color="textMuted">
              • {t(`contact.${k}`)}
            </Text>
          ))}
        </Card>
        <Text variant="caption" color="textFaint" style={{ marginTop: space.md }} testID="contact-privacy">
          {t('contact.privacy')}
        </Text>
      </FadeIn>
    </Screen>
  );
}

import Constants from 'expo-constants';
import { Linking, Platform, Share } from 'react-native';
import { useCallback, useMemo, useState } from 'react';

import { CONTACT_EMAIL } from '@/content/contact';
import { useI18n } from '@/runtime/AppProvider';
import { feedbackMailto, type DeviceInfo, type FeedbackKind } from '@/services/feedback/mailto';

export function useDeviceInfo(): DeviceInfo {
  const { lang } = useI18n();
  return useMemo(
    () => ({ appVersion: Constants.expoConfig?.version ?? 'dev', platform: Platform.OS, osVersion: String(Platform.Version), language: lang }),
    [lang],
  );
}

/** Opens the user's email app with an editable draft; reports whether that worked. */
export function useFeedback() {
  const { t } = useI18n();
  const info = useDeviceInfo();
  const [mailFailed, setMailFailed] = useState(false);
  const [copied, setCopied] = useState(false);

  const compose = useCallback(
    async (kind: FeedbackKind) => {
      const labels =
        kind === 'report'
          ? {
              subject: t('contact.subjectReport'),
              prompts: [t('contact.mailWhat'), t('contact.mailExpected'), t('contact.mailSteps')],
              tech: t('contact.mailTech'),
            }
          : { subject: t('contact.subjectSuggest'), prompts: [t('contact.mailIdea'), t('contact.mailWhy')], tech: t('contact.mailTech') };
      try {
        await Linking.openURL(feedbackMailto(labels, info));
        setMailFailed(false);
      } catch {
        setMailFailed(true);
      }
    },
    [info, t],
  );

  /** Copies the address (web) or opens the share sheet (native) so it can be pasted anywhere. */
  const copyAddress = useCallback(async () => {
    try {
      if (Platform.OS === 'web' && typeof navigator !== 'undefined' && navigator.clipboard) {
        await navigator.clipboard.writeText(CONTACT_EMAIL);
        setCopied(true);
      } else {
        await Share.share({ message: CONTACT_EMAIL });
      }
    } catch {
      // The address is shown on screen and is selectable; nothing else to do.
    }
  }, []);

  return { compose, copyAddress, mailFailed, copied };
}

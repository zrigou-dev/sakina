import { router } from 'expo-router';

import { EmptyState } from '@/design-system/components';
import { Screen } from '@/design-system/Screen';
import { useI18n } from '@/runtime/AppProvider';

export default function NotFound() {
  const { t } = useI18n();
  return (
    <Screen back>
      <EmptyState title={t('errors.notFound')} action={t('errors.goHome')} onAction={() => router.replace('/')} />
    </Screen>
  );
}

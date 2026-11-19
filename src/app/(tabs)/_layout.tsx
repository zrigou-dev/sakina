import { Redirect } from 'expo-router';
import { TabList, TabSlot, TabTrigger, Tabs } from 'expo-router/ui';

import { SakinaTabBar, TabButton, TAB_ITEMS } from '@/features/shell/TabBar';
import { useSettings } from '@/runtime/AppProvider';

export default function TabsLayout() {
  const [settings] = useSettings();
  if (!settings.onboardingComplete) return <Redirect href="/onboarding" />;
  return (
    <Tabs>
      <TabSlot />
      <TabList asChild>
        <SakinaTabBar>
          {TAB_ITEMS.map((item) => (
            <TabTrigger key={item.name} name={item.name} href={item.href} asChild>
              <TabButton item={item} />
            </TabTrigger>
          ))}
        </SakinaTabBar>
      </TabList>
    </Tabs>
  );
}

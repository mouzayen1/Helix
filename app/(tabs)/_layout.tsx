import { Tabs, useRouter } from 'expo-router';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import {
  IconBook,
  IconChart,
  IconCog,
  IconHome,
  IconPlus,
} from '../../components/Icons';
import { useTheme } from '../../theme/ThemeContext';
import { font } from '../../theme/tokens';

type TabItem = {
  route: string;
  label: string;
  Icon: (props: { size?: number; color?: string }) => React.ReactElement;
};

const TAB_LEFT: TabItem[] = [
  { route: '/', label: 'Today', Icon: IconHome },
  { route: '/library', label: 'Library', Icon: IconBook },
];

const TAB_RIGHT: TabItem[] = [
  { route: '/progress', label: 'Progress', Icon: IconChart },
  { route: '/me', label: 'Me', Icon: IconCog },
];

function CustomTabBar({ state, navigation }: any) {
  const { t } = useTheme();
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const activeRoute = state.routes[state.index]?.name;

  const isActive = (routeName: string) => {
    if (routeName === '/') return activeRoute === 'index';
    return activeRoute === routeName.replace('/', '');
  };

  const nav = (target: string) => {
    const name = target === '/' ? 'index' : target.replace('/', '');
    navigation.navigate(name);
  };

  const renderTab = (item: TabItem) => {
    const active = isActive(item.route);
    return (
      <Pressable
        key={item.route}
        onPress={() => nav(item.route)}
        style={styles.tab}
        hitSlop={8}
      >
        <item.Icon size={20} color={active ? t.ink : t.ink3} />
        <Text
          style={{
            fontSize: 10,
            fontFamily: active ? font.sansSemi : font.sansMed,
            color: active ? t.ink : t.ink3,
            letterSpacing: 0.2,
            marginTop: 2,
          }}
        >
          {item.label}
        </Text>
      </Pressable>
    );
  };

  return (
    <View
      style={[
        styles.bar,
        {
          backgroundColor: t.surface,
          borderTopColor: t.line,
          paddingBottom: Math.max(insets.bottom, 10),
        },
      ]}
    >
      {TAB_LEFT.map(renderTab)}

      {/* Elevated center Log button — spec §09 */}
      <Pressable
        onPress={() => router.push('/log-dose')}
        style={[
          styles.logBtn,
          { backgroundColor: t.ink, shadowColor: t.ink },
        ]}
        hitSlop={8}
      >
        <IconPlus size={22} color={t.bg} />
      </Pressable>

      {TAB_RIGHT.map(renderTab)}
    </View>
  );
}

export default function TabsLayout() {
  return (
    <Tabs tabBar={(p) => <CustomTabBar {...p} />} screenOptions={{ headerShown: false }}>
      <Tabs.Screen name="index" />
      <Tabs.Screen name="library" />
      <Tabs.Screen name="progress" />
      <Tabs.Screen name="me" />
    </Tabs>
  );
}

const styles = StyleSheet.create({
  bar: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-around',
    paddingHorizontal: 12,
    paddingTop: 10,
    borderTopWidth: 1,
  },
  tab: {
    flex: 1,
    alignItems: 'center',
    paddingVertical: 4,
  },
  logBtn: {
    width: 52,
    height: 52,
    borderRadius: 16,
    alignItems: 'center',
    justifyContent: 'center',
    marginTop: -18,
    marginHorizontal: 6,
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.2,
    shadowRadius: 10,
    elevation: 6,
  },
});

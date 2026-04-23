// Tab bar — spec v2.0 §09. 4 tabs + center quick-log FAB.
import { Tabs, useRouter } from 'expo-router';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import Svg, { Circle, Path } from 'react-native-svg';
import { IconChart, IconHome, IconPlus } from '../../components/Icons';
import { useTheme } from '../../theme/ThemeContext';
import { font } from '../../theme/tokens';

type TabItem = {
  name: string;
  route: string;
  label: string;
  Icon: (p: { size?: number; color?: string }) => React.ReactElement;
};

function IconLibrary({ size = 22, color = '#000' }: { size?: number; color?: string }) {
  return (
    <Svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke={color} strokeWidth={1.8} strokeLinecap="round" strokeLinejoin="round">
      <Path d="M4 3h6a2 2 0 012 2v14a2 2 0 00-2-2H4V3z" />
      <Path d="M20 3h-6a2 2 0 00-2 2v14a2 2 0 012-2h6V3z" />
    </Svg>
  );
}

function IconStacks({ size = 22, color = '#000' }: { size?: number; color?: string }) {
  return (
    <Svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke={color} strokeWidth={1.8} strokeLinecap="round" strokeLinejoin="round">
      <Path d="M3 8l9-5 9 5-9 5-9-5z" />
      <Path d="M3 13l9 5 9-5" />
      <Path d="M3 18l9 5 9-5" />
    </Svg>
  );
}

const LEFT: TabItem[] = [
  { name: 'index', route: '/(tabs)', label: 'Today', Icon: IconHome },
  { name: 'library', route: '/(tabs)/library', label: 'Library', Icon: IconLibrary as any },
];

const RIGHT: TabItem[] = [
  { name: 'stacks', route: '/(tabs)/stacks', label: 'Stacks', Icon: IconStacks as any },
  { name: 'progress', route: '/(tabs)/progress', label: 'Progress', Icon: IconChart },
];

function CustomTabBar({ state, navigation }: any) {
  const { t } = useTheme();
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const currentName = state.routes[state.index]?.name;

  const renderTab = (item: TabItem) => {
    const active = item.name === currentName;
    return (
      <Pressable
        key={item.name}
        onPress={() => navigation.navigate(item.name)}
        style={styles.tab}
        hitSlop={8}
      >
        <item.Icon size={22} color={active ? t.ink : t.ink3} />
        <Text
          style={{
            fontSize: 10,
            fontFamily: active ? font.sansSemi : font.sansMed,
            color: active ? t.ink : t.ink3,
            letterSpacing: 0.2,
            marginTop: 3,
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
      {LEFT.map(renderTab)}
      <Pressable
        onPress={() => router.push('/log-dose')}
        style={[styles.fab, { backgroundColor: t.ink, shadowColor: t.ink }]}
        hitSlop={8}
      >
        <IconPlus size={24} color={t.bg} />
      </Pressable>
      {RIGHT.map(renderTab)}
    </View>
  );
}

export default function TabsLayout() {
  return (
    <Tabs tabBar={(p) => <CustomTabBar {...p} />} screenOptions={{ headerShown: false }}>
      <Tabs.Screen name="index" />
      <Tabs.Screen name="library" />
      <Tabs.Screen name="stacks" />
      <Tabs.Screen name="progress" />
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
  tab: { flex: 1, alignItems: 'center', paddingVertical: 4 },
  fab: {
    width: 54,
    height: 54,
    borderRadius: 18,
    alignItems: 'center',
    justifyContent: 'center',
    marginTop: -20,
    marginHorizontal: 6,
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.2,
    shadowRadius: 10,
    elevation: 8,
  },
});

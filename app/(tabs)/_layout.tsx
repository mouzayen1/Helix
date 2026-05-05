// Tab bar — editorial v1. Sharp-cornered, hairline-topped, mono-cap
// labels. Center quick-log control loses the floating pill in favor of
// a square brass tile that aligns with the bar baseline. Icons are
// retained as 1.2-px hairline glyphs for scan speed.
import { Tabs, useRouter } from 'expo-router';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import Svg, { Path } from 'react-native-svg';
import { useEditorialTheme } from '../../lib/design/theme';

type TabItem = {
  name: string;
  route: string;
  label: string;
  Icon: (p: { size?: number; color?: string }) => React.ReactElement;
};

function HairlineSvg({
  size,
  color,
  d,
}: {
  size: number;
  color: string;
  d: string | string[];
}) {
  const paths = Array.isArray(d) ? d : [d];
  return (
    <Svg width={size} height={size} viewBox="0 0 24 24" fill="none">
      {paths.map((path, i) => (
        <Path
          key={i}
          d={path}
          stroke={color}
          strokeWidth={1.2}
          strokeLinecap="round"
          strokeLinejoin="round"
        />
      ))}
    </Svg>
  );
}

function IconToday({ size = 18, color = '#000' }: { size?: number; color?: string }) {
  return <HairlineSvg size={size} color={color} d={['M3 12L12 4l9 8', 'M5 10v10h14V10']} />;
}
function IconLibrary({ size = 18, color = '#000' }: { size?: number; color?: string }) {
  return (
    <HairlineSvg
      size={size}
      color={color}
      d={['M4 3h6a2 2 0 012 2v14a2 2 0 00-2-2H4V3z', 'M20 3h-6a2 2 0 00-2 2v14a2 2 0 012-2h6V3z']}
    />
  );
}
function IconStacks({ size = 18, color = '#000' }: { size?: number; color?: string }) {
  return (
    <HairlineSvg
      size={size}
      color={color}
      d={['M3 8l9-5 9 5-9 5-9-5z', 'M3 13l9 5 9-5', 'M3 18l9 5 9-5']}
    />
  );
}
function IconChart({ size = 18, color = '#000' }: { size?: number; color?: string }) {
  return <HairlineSvg size={size} color={color} d={['M4 20V10', 'M10 20V4', 'M16 20v-7', 'M22 20H2']} />;
}

const LEFT: TabItem[] = [
  { name: 'index', route: '/(tabs)', label: 'Today', Icon: IconToday },
  { name: 'library', route: '/(tabs)/library', label: 'Library', Icon: IconLibrary },
];
const RIGHT: TabItem[] = [
  { name: 'stacks', route: '/(tabs)/stacks', label: 'Stacks', Icon: IconStacks },
  { name: 'progress', route: '/(tabs)/progress', label: 'Progress', Icon: IconChart },
];

function CustomTabBar({ state, navigation }: any) {
  const ed = useEditorialTheme();
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
        accessibilityRole="button"
        accessibilityLabel={item.label}
        accessibilityState={{ selected: active }}
      >
        <item.Icon size={18} color={active ? ed.colors.ink1 : ed.colors.ink3} />
        <Text
          style={{
            marginTop: 6,
            fontFamily: ed.typography.labelSm.fontFamily,
            fontSize: ed.typography.labelSm.fontSize,
            letterSpacing: ed.typography.labelSm.letterSpacing,
            color: active ? ed.colors.ink1 : ed.colors.ink3,
            textTransform: 'uppercase',
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
          backgroundColor: ed.colors.bg,
          borderTopColor: ed.colors.line,
          paddingBottom: Math.max(insets.bottom, 10),
        },
      ]}
    >
      {LEFT.map(renderTab)}
      <Pressable
        onPress={() => router.push('/log-dose')}
        accessibilityRole="button"
        accessibilityLabel="Log a dose"
        hitSlop={8}
        style={[styles.fab, { backgroundColor: ed.colors.brand }]}
      >
        <Text
          style={{
            fontFamily: ed.fraunces('Fraunces_300Light'),
            fontSize: 32,
            color: ed.colors.bg,
            lineHeight: 32,
          }}
        >
          +
        </Text>
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
  tab: { flex: 1, alignItems: 'center', paddingVertical: 6 },
  fab: {
    width: 56,
    height: 56,
    alignItems: 'center',
    justifyContent: 'center',
    marginTop: -18,
    marginHorizontal: 6,
  },
});

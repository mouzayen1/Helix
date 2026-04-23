// Settings — spec v2.0 §10 "Settings home".
import Constants from 'expo-constants';
import { useRouter } from 'expo-router';
import { Pressable, ScrollView, Switch, Text, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { IconChevronLeft, IconChevronRight } from '../../components/Icons';
import { useProfile } from '../../lib/profile-context';
import { useTheme } from '../../theme/ThemeContext';
import { font, radius, space } from '../../theme/tokens';

export default function Settings() {
  const { t } = useTheme();
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const { profile, update } = useProfile();

  const groups: {
    label: string;
    rows: {
      key: string;
      title: string;
      value?: React.ReactNode;
      onPress?: () => void;
      right?: React.ReactNode;
      danger?: boolean;
    }[];
  }[] = [
    {
      label: 'Appearance',
      rows: [
        {
          key: 'theme',
          title: 'Theme',
          value: <ThemeToggle />,
        },
      ],
    },
    {
      label: 'Units',
      rows: [
        {
          key: 'weight',
          title: 'Weight',
          value: (
            <UnitToggle
              value={profile?.unit_weight ?? 'lb'}
              options={['lb', 'kg']}
              onChange={(v) => update({ unit_weight: v })}
            />
          ),
        },
        {
          key: 'volume',
          title: 'Syringe',
          value: (
            <UnitToggle
              value={profile?.unit_volume ?? 'units'}
              options={['units', 'mL']}
              onChange={(v) => update({ unit_volume: v })}
            />
          ),
        },
      ],
    },
    {
      label: 'Privacy',
      rows: [
        {
          key: 'notif',
          title: 'Notifications',
          right: (
            <Switch
              value={profile?.notifications_enabled === 1}
              onValueChange={(v) => update({ notifications_enabled: v ? 1 : 0 })}
              trackColor={{ false: t.surfaceAlt, true: t.accent }}
            />
          ),
        },
        {
          key: 'bio',
          title: 'Biometric lock',
          right: (
            <Switch
              value={profile?.biometric_lock === 1}
              onValueChange={(v) => update({ biometric_lock: v ? 1 : 0 })}
              trackColor={{ false: t.surfaceAlt, true: t.accent }}
            />
          ),
        },
      ],
    },
    {
      label: 'Data',
      rows: [
        { key: 'export', title: 'Export data', onPress: () => router.push('/settings/export') },
        { key: 'about', title: 'About Helix', onPress: () => router.push('/settings/about') },
        {
          key: 'delete',
          title: 'Delete all data',
          onPress: () => router.push('/settings/delete-account'),
          danger: true,
        },
      ],
    },
  ];

  return (
    <ScrollView
      style={{ flex: 1, backgroundColor: t.bg }}
      contentContainerStyle={{ paddingBottom: insets.bottom + 40 }}
    >
      <View
        style={{
          flexDirection: 'row',
          justifyContent: 'space-between',
          alignItems: 'center',
          paddingTop: insets.top + space.sm,
          paddingBottom: space.md,
          paddingHorizontal: space.xl,
        }}
      >
        <Pressable onPress={() => router.back()} hitSlop={8}>
          <IconChevronLeft size={18} color={t.ink2} />
        </Pressable>
      </View>

      <View style={{ paddingHorizontal: space.xl }}>
        <Text
          style={{
            fontSize: 28,
            fontFamily: font.sansBold,
            color: t.ink,
            letterSpacing: -0.6,
          }}
        >
          Settings
        </Text>
      </View>

      {groups.map((g) => (
        <View key={g.label} style={{ marginTop: space.xl }}>
          <Text
            style={{
              paddingHorizontal: space.xl,
              fontSize: 11,
              letterSpacing: 1.2,
              fontFamily: font.sansSemi,
              textTransform: 'uppercase',
              color: t.ink3,
              marginBottom: space.sm,
            }}
          >
            {g.label}
          </Text>
          <View
            style={{
              marginHorizontal: space.xl,
              backgroundColor: t.surface,
              borderRadius: radius.md,
              borderWidth: 1,
              borderColor: t.line,
              overflow: 'hidden',
            }}
          >
            {g.rows.map((r, i) => (
              <Pressable
                key={r.key}
                onPress={r.onPress}
                style={{
                  flexDirection: 'row',
                  alignItems: 'center',
                  padding: space.md,
                  borderTopWidth: i === 0 ? 0 : 1,
                  borderTopColor: t.line,
                  minHeight: 52,
                }}
              >
                <Text
                  style={{
                    flex: 1,
                    color: r.danger ? t.danger : t.ink,
                    fontSize: 15,
                    fontFamily: font.sansMed,
                  }}
                >
                  {r.title}
                </Text>
                {r.right ?? r.value ?? (r.onPress ? <IconChevronRight size={14} color={t.ink4} /> : null)}
              </Pressable>
            ))}
          </View>
        </View>
      ))}

      <Text
        style={{
          marginTop: space.xl,
          textAlign: 'center',
          color: t.ink4,
          fontSize: 12,
          fontFamily: font.mono,
        }}
      >
        Helix v{Constants.expoConfig?.version ?? '0.0.0'}
      </Text>
    </ScrollView>
  );
}

function ThemeToggle() {
  const { t } = useTheme();
  const { profile, update } = useProfile();
  const value = profile?.theme ?? 'system';
  return (
    <View style={{ flexDirection: 'row', gap: 2, padding: 2, borderRadius: radius.sm, backgroundColor: t.surfaceAlt }}>
      {(['system', 'light', 'dark'] as const).map((v) => {
        const active = v === value;
        return (
          <Pressable
            key={v}
            onPress={() => update({ theme: v })}
            style={{
              paddingVertical: 4,
              paddingHorizontal: 10,
              borderRadius: radius.sm,
              backgroundColor: active ? t.surface : 'transparent',
            }}
          >
            <Text style={{ color: active ? t.ink : t.ink3, fontSize: 11, fontFamily: font.sansMed, textTransform: 'capitalize' }}>
              {v}
            </Text>
          </Pressable>
        );
      })}
    </View>
  );
}

function UnitToggle({ value, options, onChange }: { value: string; options: string[]; onChange: (v: any) => void }) {
  const { t } = useTheme();
  return (
    <View style={{ flexDirection: 'row', gap: 2, padding: 2, borderRadius: radius.sm, backgroundColor: t.surfaceAlt }}>
      {options.map((opt) => {
        const active = opt === value;
        return (
          <Pressable
            key={opt}
            onPress={() => onChange(opt)}
            style={{
              paddingVertical: 4,
              paddingHorizontal: 10,
              borderRadius: radius.sm,
              backgroundColor: active ? t.surface : 'transparent',
            }}
          >
            <Text style={{ color: active ? t.ink : t.ink3, fontSize: 12, fontFamily: font.sansMed }}>
              {opt}
            </Text>
          </Pressable>
        );
      })}
    </View>
  );
}

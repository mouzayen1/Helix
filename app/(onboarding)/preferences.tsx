// Preferences — spec v2.0 onboarding step 3. Safe defaults; all skippable.
import { useRouter } from 'expo-router';
import { useState } from 'react';
import { Pressable, Text, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useProfile } from '../../lib/profile-context';
import { useTheme } from '../../theme/ThemeContext';
import { font, radius, space } from '../../theme/tokens';

type Unit = 'lb' | 'kg';
type Vol = 'units' | 'mL';
type Theme = 'system' | 'light' | 'dark';

function Toggle<T extends string>({
  label,
  value,
  options,
  onChange,
}: {
  label: string;
  value: T;
  options: { id: T; label: string }[];
  onChange: (v: T) => void;
}) {
  const { t } = useTheme();
  return (
    <View style={{ gap: space.sm }}>
      <Text
        style={{
          color: t.ink3,
          fontSize: 11,
          fontFamily: font.sansSemi,
          letterSpacing: 1.1,
          textTransform: 'uppercase',
        }}
      >
        {label}
      </Text>
      <View
        style={{
          flexDirection: 'row',
          gap: 4,
          padding: 4,
          borderRadius: radius.md,
          backgroundColor: t.surfaceAlt,
        }}
      >
        {options.map((opt) => {
          const active = opt.id === value;
          return (
            <Pressable
              key={opt.id}
              onPress={() => onChange(opt.id)}
              style={{
                flex: 1,
                padding: space.md,
                borderRadius: radius.sm,
                backgroundColor: active ? t.surface : 'transparent',
                alignItems: 'center',
              }}
            >
              <Text
                style={{
                  color: active ? t.ink : t.ink2,
                  fontSize: 14,
                  fontFamily: active ? font.sansSemi : font.sansMed,
                }}
              >
                {opt.label}
              </Text>
            </Pressable>
          );
        })}
      </View>
    </View>
  );
}

export default function Preferences() {
  const { t } = useTheme();
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const { profile, update } = useProfile();

  const [weightUnit, setWeightUnit] = useState<Unit>(
    (profile?.unit_weight as Unit) ?? 'lb'
  );
  const [volUnit, setVolUnit] = useState<Vol>(
    (profile?.unit_volume as Vol) ?? 'units'
  );
  const [theme, setTheme] = useState<Theme>((profile?.theme as Theme) ?? 'system');

  const proceed = async () => {
    await update({
      unit_weight: weightUnit,
      unit_volume: volUnit,
      theme,
    });
    router.push('/(onboarding)/choose-path');
  };

  return (
    <View
      style={{
        flex: 1,
        backgroundColor: t.bg,
        paddingTop: insets.top + space.xl,
        paddingBottom: insets.bottom + space.xl,
        paddingHorizontal: space.xl,
      }}
    >
      <Text style={{ color: t.ink3, fontSize: 11, fontFamily: font.sansSemi, letterSpacing: 1.2 }}>
        STEP 3 OF 4
      </Text>

      <Text
        style={{
          marginTop: space.lg,
          fontSize: 34,
          lineHeight: 40,
          fontFamily: font.sansBold,
          color: t.ink,
          letterSpacing: -1,
        }}
      >
        Quick preferences.
      </Text>
      <Text
        style={{
          marginTop: space.sm,
          color: t.ink2,
          fontSize: 15,
          lineHeight: 22,
        }}
      >
        You can change any of this later in Settings.
      </Text>

      <View style={{ flex: 1, gap: space.xl, paddingTop: space['2xl'] }}>
        <Toggle
          label="Weight"
          value={weightUnit}
          options={[
            { id: 'lb', label: 'Pounds (lb)' },
            { id: 'kg', label: 'Kilograms (kg)' },
          ]}
          onChange={setWeightUnit}
        />
        <Toggle
          label="Syringe volume"
          value={volUnit}
          options={[
            { id: 'units', label: 'Insulin units' },
            { id: 'mL', label: 'Milliliters' },
          ]}
          onChange={setVolUnit}
        />
        <Toggle
          label="Theme"
          value={theme}
          options={[
            { id: 'system', label: 'System' },
            { id: 'light', label: 'Light' },
            { id: 'dark', label: 'Dark' },
          ]}
          onChange={setTheme}
        />
      </View>

      <Pressable
        onPress={proceed}
        style={{
          backgroundColor: t.ink,
          padding: space.lg,
          borderRadius: radius.lg,
          alignItems: 'center',
        }}
      >
        <Text style={{ color: t.bg, fontSize: 16, fontFamily: font.sansSemi }}>
          Continue
        </Text>
      </Pressable>
    </View>
  );
}

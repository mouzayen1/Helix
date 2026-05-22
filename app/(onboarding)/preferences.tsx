// Preferences — editorial rebuild. Sharp-corner segmented toggles
// (mono labels) replace the soft-fill pills. Three sections share the
// same component for visual rhythm.
import { useRouter } from 'expo-router';
import { useState } from 'react';
import { Pressable, Text, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { EditorialButton } from '../../components/editorial/EditorialButton';
import { EditorialHeadline } from '../../components/editorial/EditorialHeadline';
import { EyebrowLabel } from '../../components/editorial/EyebrowLabel';
import { useEditorialTheme } from '../../lib/design/theme';
import { useProfile } from '../../lib/profile-context';

type Unit = 'lb' | 'kg';
type Vol = 'units' | 'mL';
type Theme = 'system' | 'light' | 'dark';

function Segmented<T extends string>({
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
  const ed = useEditorialTheme();
  return (
    <View style={{ gap: 12 }}>
      <EyebrowLabel withRule>{label}</EyebrowLabel>
      <View style={{ flexDirection: 'row', gap: 6 }}>
        {options.map((opt) => {
          const active = opt.id === value;
          return (
            <Pressable
              key={opt.id}
              onPress={() => onChange(opt.id)}
              style={{
                flex: 1,
                paddingVertical: 14,
                alignItems: 'center',
                backgroundColor: active ? ed.colors.ink1 : 'transparent',
                borderWidth: 1,
                borderColor: active ? ed.colors.ink1 : ed.colors.lineStrong,
              }}
            >
              <Text
                style={{
                  fontFamily: ed.typography.labelSm.fontFamily,
                  fontSize: ed.typography.labelSm.fontSize,
                  letterSpacing: ed.typography.labelSm.letterSpacing,
                  color: active ? ed.colors.bg : ed.colors.ink2,
                  textTransform: 'uppercase',
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
  const ed = useEditorialTheme();
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const { profile, update } = useProfile();

  const [weightUnit, setWeightUnit] = useState<Unit>((profile?.unit_weight as Unit) ?? 'lb');
  const [volUnit, setVolUnit] = useState<Vol>((profile?.unit_volume as Vol) ?? 'units');
  const [theme, setTheme] = useState<Theme>((profile?.theme as Theme) ?? 'system');

  const proceed = async () => {
    await update({
      unit_weight: weightUnit,
      unit_volume: volUnit,
      theme,
    });
    router.push('/(auth)/sign-up');
  };

  return (
    <View
      style={{
        flex: 1,
        backgroundColor: ed.colors.bg,
        paddingTop: insets.top + 28,
        paddingBottom: insets.bottom + 24,
        paddingHorizontal: 24,
      }}
    >
      <Text
        style={{
          fontFamily: ed.typography.eyebrow.fontFamily,
          fontSize: ed.typography.eyebrow.fontSize,
          letterSpacing: ed.typography.eyebrow.letterSpacing,
          color: ed.colors.ink3,
          textTransform: 'uppercase',
        }}
      >
        Step 4 of 5
      </Text>
      <View style={{ marginTop: 18 }}>
        <EditorialHeadline size="title1">{`Quick *preferences*.`}</EditorialHeadline>
        <Text
          style={{
            marginTop: 8,
            fontFamily: ed.typography.bodySm.fontFamily,
            fontSize: ed.typography.bodySm.fontSize,
            lineHeight: ed.typography.bodySm.lineHeight,
            color: ed.colors.ink3,
          }}
        >
          Change any of this later in Settings.
        </Text>
      </View>

      <View style={{ flex: 1, gap: 32, paddingTop: 36 }}>
        <Segmented
          label="Weight"
          value={weightUnit}
          options={[
            { id: 'lb', label: 'Pounds' },
            { id: 'kg', label: 'Kilograms' },
          ]}
          onChange={setWeightUnit}
        />
        <Segmented
          label="Syringe volume"
          value={volUnit}
          options={[
            { id: 'units', label: 'Units' },
            { id: 'mL', label: 'Milliliters' },
          ]}
          onChange={setVolUnit}
        />
        <Segmented
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

      <EditorialButton fullWidth onPress={proceed}>
        Continue
      </EditorialButton>
    </View>
  );
}

// Dose unit display + input chips.
//
// <DoseValue> renders a stored mcg value as "VALUE UNIT" where the unit
// segment is a tappable chip wired to the global dose_unit_pref. Tap
// cycles auto → mcg → mg → auto and updates every dose display in the
// app on the next render.
//
// <DoseInputUnitChip> is the lower-stakes sibling for input fields
// (wizard dose stepper, Log Dose modal). It toggles an isolated mode
// that only affects how the user types the value into that single
// field; the global preference is untouched, and the parsed value is
// always converted to canonical mcg before storage.
import { useEffect, useRef } from 'react';
import { Animated, Pressable, Text, View, type StyleProp, type TextStyle, type ViewStyle } from 'react-native';
import { useEditorialTheme } from '../../lib/design/theme';
import { useDoseUnitPref } from '../../lib/profile-context';
import { formatDose, type DoseUnit, type DoseUnitPref } from '../../lib/dose-format';
import { haptic } from '../../lib/haptics';

/**
 * Inline unit chip that drives the global preference. Renders as a
 * mono-uppercase pill ("MCG" / "MG" / "AUTO·MCG" / "AUTO·MG"). Tap to
 * cycle through auto → mcg → mg → auto.
 */
export function DoseUnitChip({
  unit,
  pref,
  onPress,
  style,
}: {
  unit: DoseUnit;
  pref: DoseUnitPref;
  onPress: () => void;
  style?: StyleProp<ViewStyle>;
}) {
  const { colors, typography } = useEditorialTheme();
  const isAuto = pref === 'auto';
  return (
    <Pressable
      onPress={onPress}
      hitSlop={8}
      accessibilityRole="button"
      accessibilityLabel={`Dose unit ${unit}, currently ${isAuto ? 'auto' : 'manual'}. Tap to change.`}
      style={({ pressed }) => [
        {
          paddingHorizontal: 6,
          paddingVertical: 2,
          borderRadius: 3,
          borderWidth: 1,
          borderColor: isAuto ? colors.line : colors.brand,
          backgroundColor: 'transparent',
          opacity: pressed ? 0.55 : 1,
        },
        style,
      ]}
    >
      <Text
        style={{
          fontFamily: typography.labelSm.fontFamily,
          fontSize: typography.labelSm.fontSize,
          lineHeight: typography.labelSm.lineHeight,
          letterSpacing: typography.labelSm.letterSpacing,
          color: isAuto ? colors.ink3 : colors.brand,
          textTransform: 'uppercase',
        }}
      >
        {unit}
      </Text>
    </Pressable>
  );
}

/**
 * Composed dose value: renders the formatted number followed by the
 * tap-to-cycle unit chip. Preferred over rolling your own
 * `${formatDose(...).value} mcg` because every dose in the app needs
 * the chip affordance for consistency.
 *
 * `valueStyle` controls the numeric portion's typography. Default is
 * dataMd; pass labelSm-flavored styles for compact captions.
 */
export function DoseValue({
  mcg,
  valueStyle,
  inline = false,
  style,
}: {
  mcg: number;
  valueStyle?: StyleProp<TextStyle>;
  /**
   * If true, suppresses the chip entirely and only renders the formatted
   * string. Use for system-internal labels like accessibilityLabel,
   * never for visible UI.
   */
  inline?: boolean;
  style?: StyleProp<ViewStyle>;
}) {
  const { pref, cycle } = useDoseUnitPref();
  const { value, unit } = formatDose(mcg, pref);
  if (inline) {
    return (
      <Text style={valueStyle as StyleProp<TextStyle>}>
        {value} {unit}
      </Text>
    );
  }
  return (
    <View
      style={[
        { flexDirection: 'row', alignItems: 'center', gap: 4 },
        style,
      ]}
    >
      <Text style={valueStyle as StyleProp<TextStyle>}>{value}</Text>
      <DoseUnitChip
        unit={unit}
        pref={pref}
        onPress={() => {
          haptic.light();
          cycle();
        }}
      />
    </View>
  );
}

/**
 * Input-mode chip. Toggles between mcg and mg for *one* input field;
 * does not touch the global preference. The chip is brass+highlighted
 * when in mg mode, muted in mcg mode, to make the active typing unit
 * unambiguous.
 */
export function DoseInputUnitChip({
  mode,
  onChange,
  style,
}: {
  mode: DoseUnit;
  onChange: (next: DoseUnit) => void;
  style?: StyleProp<ViewStyle>;
}) {
  const { colors, typography } = useEditorialTheme();
  const isMg = mode === 'mg';
  // Subtle pop on toggle so the change is unmissable.
  const scale = useRef(new Animated.Value(1)).current;
  useEffect(() => {
    Animated.sequence([
      Animated.timing(scale, { toValue: 1.08, duration: 80, useNativeDriver: true }),
      Animated.timing(scale, { toValue: 1, duration: 80, useNativeDriver: true }),
    ]).start();
  }, [mode, scale]);
  return (
    <Pressable
      onPress={() => {
        haptic.light();
        onChange(isMg ? 'mcg' : 'mg');
      }}
      hitSlop={10}
      accessibilityRole="button"
      accessibilityLabel={`Input unit ${mode}. Tap to switch to ${isMg ? 'mcg' : 'mg'}.`}
      style={({ pressed }) => [
        {
          flexDirection: 'row',
          gap: 0,
          paddingHorizontal: 8,
          paddingVertical: 4,
          borderRadius: 4,
          borderWidth: 1,
          borderColor: colors.brand,
          backgroundColor: 'transparent',
          opacity: pressed ? 0.55 : 1,
        },
        style,
      ]}
    >
      <Animated.Text
        style={{
          fontFamily: typography.labelSm.fontFamily,
          fontSize: typography.labelSm.fontSize,
          lineHeight: typography.labelSm.lineHeight,
          letterSpacing: typography.labelSm.letterSpacing,
          color: isMg ? colors.brand : colors.ink3,
          transform: [{ scale }],
        }}
      >
        MG
      </Animated.Text>
      <Text
        style={{
          fontFamily: typography.labelSm.fontFamily,
          fontSize: typography.labelSm.fontSize,
          lineHeight: typography.labelSm.lineHeight,
          letterSpacing: typography.labelSm.letterSpacing,
          color: colors.ink4,
          marginHorizontal: 4,
        }}
      >
        /
      </Text>
      <Animated.Text
        style={{
          fontFamily: typography.labelSm.fontFamily,
          fontSize: typography.labelSm.fontSize,
          lineHeight: typography.labelSm.lineHeight,
          letterSpacing: typography.labelSm.letterSpacing,
          color: !isMg ? colors.brand : colors.ink3,
          transform: [{ scale }],
        }}
      >
        MCG
      </Animated.Text>
    </Pressable>
  );
}

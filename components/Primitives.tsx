// Shared primitives — RN port of prototype lib/helix-ui.jsx.
import { StyleSheet, Text, View, type ViewStyle } from 'react-native';
import { DISCLAIMER_DOSING, DISCLAIMER_SHORT } from '../lib/disclaimers';
import { useTheme } from '../theme/ThemeContext';
import { font, radius, space } from '../theme/tokens';

// Pill tag
export function HTag({
  children,
  color,
  size = 'sm',
}: {
  children: React.ReactNode;
  color?: string;
  size?: 'sm' | 'md';
}) {
  const { t } = useTheme();
  const c = color || t.accent;
  const paddingV = size === 'sm' ? 3 : 5;
  const paddingH = size === 'sm' ? 8 : 10;
  const fontSize = size === 'sm' ? 11 : 12;
  return (
    <View
      style={{
        alignSelf: 'flex-start',
        paddingVertical: paddingV,
        paddingHorizontal: paddingH,
        borderRadius: radius.pill,
        backgroundColor: c + '18',
      }}
    >
      <Text style={{ color: c, fontSize, fontFamily: font.sansMed, letterSpacing: 0.2 }}>
        {children}
      </Text>
    </View>
  );
}

// Section header (uppercase kicker)
export function HSectionHeader({ title, action }: { title: string; action?: React.ReactNode }) {
  const { t } = useTheme();
  return (
    <View style={styles.sectionHeader}>
      <Text
        style={{
          fontSize: 11,
          fontFamily: font.sansSemi,
          letterSpacing: 1.2,
          textTransform: 'uppercase',
          color: t.ink3,
        }}
      >
        {title}
      </Text>
      {action ? (
        <Text style={{ fontSize: 13, color: t.accent, fontFamily: font.sansMed }}>{action}</Text>
      ) : null}
    </View>
  );
}

// Big numeric metric (mono by default)
export function HMetric({
  value,
  unit,
  label,
  mono = true,
}: {
  value: string | number;
  unit?: string;
  label?: string;
  mono?: boolean;
}) {
  const { t } = useTheme();
  return (
    <View>
      <Text
        style={{
          fontSize: 28,
          fontFamily: mono ? font.monoSemi : font.sansSemi,
          color: t.ink,
          letterSpacing: -0.5,
          lineHeight: 32,
        }}
      >
        {value}
        {unit ? (
          <Text style={{ fontSize: 13, color: t.ink3, fontFamily: font.sansMed }}>
            {' '}
            {unit}
          </Text>
        ) : null}
      </Text>
      {label ? (
        <Text
          style={{
            fontSize: 11,
            color: t.ink3,
            marginTop: 6,
            letterSpacing: 0.4,
            textTransform: 'uppercase',
            fontFamily: font.sansMed,
          }}
        >
          {label}
        </Text>
      ) : null}
    </View>
  );
}

// Molecular formula block
export function HFormula({ formula, mw }: { formula: string; mw?: number }) {
  const { t } = useTheme();
  return (
    <Text style={{ fontFamily: font.mono, fontSize: 12, color: t.ink3, letterSpacing: 0.2 }}>
      {formula}
      {mw ? (
        <Text style={{ color: t.ink4 }}>
          {'   ·  '}
          {mw} g/mol
        </Text>
      ) : null}
    </Text>
  );
}

// Card — common container style used across screens
export function HCard({
  children,
  style,
}: {
  children: React.ReactNode;
  style?: ViewStyle;
}) {
  const { t } = useTheme();
  return (
    <View
      style={[
        {
          backgroundColor: t.surface,
          borderRadius: radius.lg,
          borderWidth: 1,
          borderColor: t.line,
          padding: 16,
        },
        style,
      ]}
    >
      {children}
    </View>
  );
}

// 3-letter mono "code avatar" used for peptide rows
export function HCodeAvatar({ id, color }: { id: string; color?: string }) {
  const { t } = useTheme();
  const c = color || t.accent;
  const label = id.slice(0, 3).toUpperCase();
  return (
    <View
      style={{
        width: 44,
        height: 44,
        borderRadius: radius.md,
        backgroundColor: c + '1F',
        alignItems: 'center',
        justifyContent: 'center',
      }}
    >
      <Text style={{ color: c, fontFamily: font.monoSemi, fontSize: 13, letterSpacing: 0.5 }}>
        {label}
      </Text>
    </View>
  );
}

// Persistent "research only" bar used on dose/vial/peptide screens.
// Intended to be always-visible so there's no ambiguity about positioning.
export function ResearchBanner({ compact = false, tone = 'warn' }: {
  compact?: boolean;
  tone?: 'warn' | 'danger' | 'muted';
}) {
  const { t } = useTheme();
  const bg =
    tone === 'danger' ? t.dangerSoft :
    tone === 'muted'  ? t.surfaceAlt :
                        t.warnSoft;
  const fg =
    tone === 'danger' ? t.danger :
    tone === 'muted'  ? t.ink3 :
                        t.warn;
  return (
    <View
      style={{
        paddingHorizontal: space.md,
        paddingVertical: compact ? 6 : 8,
        backgroundColor: bg,
        borderLeftWidth: 3,
        borderLeftColor: fg,
      }}
    >
      <Text
        style={{
          fontSize: compact ? 10 : 11,
          fontFamily: font.sansSemi,
          color: t.ink2,
          letterSpacing: 0.3,
        }}
      >
        {DISCLAIMER_SHORT}
      </Text>
    </View>
  );
}

// Inline dosing disclaimer (shown above Save on dose sheets).
export function DosingDisclaimer() {
  const { t } = useTheme();
  return (
    <View
      style={{
        padding: space.md,
        borderRadius: radius.md,
        backgroundColor: t.warnSoft,
        borderWidth: 1,
        borderColor: t.warn + '40',
      }}
    >
      <Text style={{ fontSize: 12, color: t.ink2, lineHeight: 17 }}>
        {DISCLAIMER_DOSING}
      </Text>
    </View>
  );
}

// Unapproved-research-chemical chip for peptide detail / dose screens.
export function UnapprovedChip() {
  const { t } = useTheme();
  return (
    <View
      style={{
        alignSelf: 'flex-start',
        flexDirection: 'row',
        alignItems: 'center',
        gap: 6,
        paddingVertical: 3,
        paddingHorizontal: 8,
        borderRadius: radius.pill,
        backgroundColor: t.dangerSoft,
      }}
    >
      <View
        style={{
          width: 6,
          height: 6,
          borderRadius: 3,
          backgroundColor: t.danger,
        }}
      />
      <Text style={{ fontSize: 10, color: t.danger, fontFamily: font.sansSemi, letterSpacing: 0.3 }}>
        RESEARCH · NOT FOR HUMAN USE
      </Text>
    </View>
  );
}

const styles = StyleSheet.create({
  sectionHeader: {
    flexDirection: 'row',
    alignItems: 'flex-end',
    justifyContent: 'space-between',
    paddingHorizontal: 20,
    marginTop: 24,
    marginBottom: 12,
  },
});

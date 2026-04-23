// Log dose — spec §10.4
// Modal. Peptide selector, dose scrubber, site/route, time, note, confirm.
import { useRouter } from 'expo-router';
import { useState } from 'react';
import { Pressable, ScrollView, Text, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { IconChevronRight, IconClock, IconClose } from '../components/Icons';
import { HCodeAvatar } from '../components/Primitives';
import { insertDose } from '../lib/db';
import { PEPTIDES } from '../lib/peptides';
import { useTheme } from '../theme/ThemeContext';
import { font, radius, space } from '../theme/tokens';

const DOSE_MIN = 50;
const DOSE_MAX = 500;
const DOSE_STEP = 25;

export default function LogDoseModal() {
  const { t } = useTheme();
  const router = useRouter();
  const insets = useSafeAreaInsets();

  const [peptideId, setPeptideId] = useState('bpc157');
  const [amountMcg, setAmountMcg] = useState(250);
  const [site] = useState('R. Abdomen');
  const [route] = useState('Subcutaneous');

  const peptide = PEPTIDES.find((p) => p.id === peptideId) ?? PEPTIDES[0];

  const ticks = Array.from(
    { length: (DOSE_MAX - DOSE_MIN) / DOSE_STEP + 1 },
    (_, i) => DOSE_MIN + i * DOSE_STEP
  );
  const activeTickIndex = ticks.indexOf(amountMcg);

  const save = async () => {
    try {
      await insertDose({
        peptide_id: peptideId,
        amount_mcg: amountMcg,
        site,
        route,
      });
    } catch (err) {
      console.warn('insert failed', err);
    }
    router.back();
  };

  return (
    <View style={{ flex: 1, backgroundColor: t.bg }}>
      {/* Top bar */}
      <View
        style={{
          flexDirection: 'row',
          justifyContent: 'space-between',
          alignItems: 'center',
          paddingTop: insets.top + 12,
          paddingBottom: 12,
          paddingHorizontal: space.xl,
        }}
      >
        <Pressable onPress={() => router.back()} hitSlop={10}>
          <IconClose size={16} color={t.ink3} />
        </Pressable>
        <Text style={{ fontSize: 15, fontFamily: font.sansSemi, color: t.ink }}>Log dose</Text>
        <Pressable onPress={save} hitSlop={10}>
          <Text style={{ fontSize: 13, color: t.accent, fontFamily: font.sansSemi }}>Save</Text>
        </Pressable>
      </View>

      <ScrollView
        contentContainerStyle={{ paddingBottom: insets.bottom + 24 }}
        showsVerticalScrollIndicator={false}
      >
        {/* Peptide selector */}
        <View style={{ paddingHorizontal: space.xl }}>
          <View
            style={{
              backgroundColor: t.surface,
              borderRadius: radius.xl,
              padding: 18,
              borderWidth: 1,
              borderColor: t.line,
              flexDirection: 'row',
              alignItems: 'center',
              gap: 14,
            }}
          >
            <HCodeAvatar id={peptide.name.split('-')[0]} color={peptide.color} />
            <View style={{ flex: 1 }}>
              <Text style={{ fontSize: 17, fontFamily: font.sansSemi, color: t.ink }}>
                {peptide.name}
              </Text>
              <Text style={{ fontSize: 12, color: t.ink3, fontFamily: font.mono }}>
                {peptide.formula}
              </Text>
            </View>
            <IconChevronRight size={14} color={t.ink3} />
          </View>
        </View>

        {/* Dose picker */}
        <View style={{ paddingHorizontal: space.xl, marginTop: 24 }}>
          <Text
            style={{
              fontSize: 11,
              fontFamily: font.sansSemi,
              letterSpacing: 1.2,
              color: t.ink3,
              marginBottom: 10,
              textTransform: 'uppercase',
            }}
          >
            Dose
          </Text>
          <View
            style={{
              backgroundColor: t.surface,
              borderRadius: radius.xl,
              paddingVertical: 24,
              paddingHorizontal: 20,
              borderWidth: 1,
              borderColor: t.line,
              alignItems: 'center',
            }}
          >
            <View style={{ flexDirection: 'row', alignItems: 'baseline' }}>
              <Text
                style={{
                  fontSize: 56,
                  fontFamily: font.monoSemi,
                  color: t.ink,
                  letterSpacing: -2,
                  lineHeight: 58,
                }}
              >
                {amountMcg}
              </Text>
              <Text
                style={{
                  fontSize: 20,
                  color: t.ink3,
                  fontFamily: font.sansMed,
                  marginLeft: 6,
                }}
              >
                mcg
              </Text>
            </View>

            {/* +/- picker — simplified for MVP. Spec uses a scrub ruler. */}
            <View style={{ flexDirection: 'row', gap: 12, marginTop: 18 }}>
              {[-50, -25, +25, +50].map((delta) => (
                <Pressable
                  key={delta}
                  onPress={() =>
                    setAmountMcg((v) => Math.max(DOSE_MIN, Math.min(DOSE_MAX, v + delta)))
                  }
                  style={{
                    paddingVertical: 8,
                    paddingHorizontal: 14,
                    borderRadius: radius.pill,
                    backgroundColor: t.surfaceAlt,
                  }}
                >
                  <Text
                    style={{
                      fontSize: 13,
                      fontFamily: font.monoSemi,
                      color: t.ink,
                    }}
                  >
                    {delta > 0 ? `+${delta}` : delta}
                  </Text>
                </Pressable>
              ))}
            </View>

            {/* Tick row — visual reference */}
            <View
              style={{
                flexDirection: 'row',
                alignItems: 'flex-end',
                justifyContent: 'space-between',
                height: 24,
                width: '100%',
                marginTop: 20,
              }}
            >
              {ticks.map((_, i) => {
                const big = i % 4 === 0;
                return (
                  <View
                    key={i}
                    style={{
                      width: 1,
                      height: big ? 16 : 8,
                      backgroundColor: i === activeTickIndex ? t.accent : t.ink3,
                      opacity: i === activeTickIndex ? 1 : 0.4,
                    }}
                  />
                );
              })}
            </View>

            <View
              style={{
                marginTop: 14,
                paddingVertical: 10,
                paddingHorizontal: 12,
                backgroundColor: t.surfaceAlt,
                borderRadius: 10,
                flexDirection: 'row',
                justifyContent: 'space-between',
                alignItems: 'center',
                width: '100%',
              }}
            >
              <Text style={{ fontSize: 11, color: t.ink3, letterSpacing: 0.3 }}>
                Vial remaining
              </Text>
              <Text
                style={{
                  fontSize: 12,
                  fontFamily: font.monoSemi,
                  color: t.ink,
                }}
              >
                4.25 / 5.00 mg
              </Text>
            </View>
          </View>
        </View>

        {/* Site + Route */}
        <View
          style={{
            paddingHorizontal: space.xl,
            marginTop: 20,
            flexDirection: 'row',
            gap: 10,
          }}
        >
          <View
            style={{
              flex: 1,
              backgroundColor: t.surface,
              borderRadius: radius.md,
              padding: 14,
              borderWidth: 1,
              borderColor: t.line,
            }}
          >
            <Text
              style={{
                fontSize: 10,
                letterSpacing: 1.1,
                color: t.ink3,
                fontFamily: font.sansSemi,
                textTransform: 'uppercase',
              }}
            >
              Site
            </Text>
            <Text
              style={{
                fontSize: 16,
                fontFamily: font.sansSemi,
                color: t.ink,
                marginTop: 6,
              }}
            >
              {site}
            </Text>
            <Text style={{ fontSize: 11, color: t.accent, marginTop: 2 }}>Suggested</Text>
          </View>
          <View
            style={{
              flex: 1,
              backgroundColor: t.surface,
              borderRadius: radius.md,
              padding: 14,
              borderWidth: 1,
              borderColor: t.line,
            }}
          >
            <Text
              style={{
                fontSize: 10,
                letterSpacing: 1.1,
                color: t.ink3,
                fontFamily: font.sansSemi,
                textTransform: 'uppercase',
              }}
            >
              Route
            </Text>
            <Text
              style={{
                fontSize: 16,
                fontFamily: font.sansSemi,
                color: t.ink,
                marginTop: 6,
              }}
            >
              {route}
            </Text>
            <Text style={{ fontSize: 11, color: t.ink3, marginTop: 2 }}>Default</Text>
          </View>
        </View>

        {/* Time */}
        <View style={{ paddingHorizontal: space.xl, marginTop: 20 }}>
          <View
            style={{
              backgroundColor: t.surface,
              borderRadius: radius.md,
              padding: 14,
              borderWidth: 1,
              borderColor: t.line,
              flexDirection: 'row',
              alignItems: 'center',
              gap: 12,
            }}
          >
            <IconClock size={16} color={t.ink3} />
            <View style={{ flex: 1 }}>
              <Text style={{ fontSize: 14, color: t.ink }}>
                Now —{' '}
                {new Date().toLocaleTimeString('en-US', {
                  hour: 'numeric',
                  minute: '2-digit',
                })}
              </Text>
            </View>
            <Text style={{ fontSize: 12, color: t.accent, fontFamily: font.sansSemi }}>Edit</Text>
          </View>
        </View>

        {/* Confirm */}
        <View style={{ paddingHorizontal: space.xl, marginTop: 28 }}>
          <Pressable
            onPress={save}
            style={{
              padding: 16,
              borderRadius: radius.md,
              backgroundColor: t.ink,
              alignItems: 'center',
            }}
          >
            <Text style={{ fontSize: 15, fontFamily: font.sansSemi, color: t.bg }}>
              Confirm dose
            </Text>
          </Pressable>
        </View>
      </ScrollView>
    </View>
  );
}

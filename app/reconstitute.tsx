// Reconstitution calculator — spec §10.5
// Concentration = strength_mg / bac_water_ml.
// volume_ml_per_dose = dose_mcg / (concentration_mg_per_ml × 1000)
// units_per_dose = volume_ml_per_dose × 100 (U100 syringe)
// total_doses = strength_mg / (dose_mcg / 1000)
import { useRouter } from 'expo-router';
import { useMemo, useState } from 'react';
import { Pressable, ScrollView, Text, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import Svg, { Line, Rect, Text as SvgText } from 'react-native-svg';
import { IconChevronLeft } from '../components/Icons';
import { useTheme } from '../theme/ThemeContext';
import { font, radius, space } from '../theme/tokens';

export default function ReconstituteScreen() {
  const { t } = useTheme();
  const router = useRouter();
  const insets = useSafeAreaInsets();

  const [strengthMg, setStrengthMg] = useState(5);
  const [bacMl, setBacMl] = useState(2.0);
  const [doseMcg, setDoseMcg] = useState(250);

  const concentrationMgPerMl = strengthMg / bacMl;
  const volumeMlPerDose = doseMcg / (concentrationMgPerMl * 1000);
  const unitsPerDose = volumeMlPerDose * 100;
  const totalDoses = strengthMg / (doseMcg / 1000);

  const bumpStrength = (d: number) =>
    setStrengthMg((v) => Math.max(1, Math.min(20, Math.round((v + d) * 10) / 10)));
  const bumpBac = (d: number) =>
    setBacMl((v) => Math.max(0.5, Math.min(10, Math.round((v + d) * 10) / 10)));
  const bumpDose = (d: number) =>
    setDoseMcg((v) => Math.max(50, Math.min(2000, v + d)));

  const fillPct = useMemo(() => Math.max(0.02, Math.min(1, unitsPerDose / 100)), [unitsPerDose]);

  return (
    <View style={{ flex: 1, backgroundColor: t.bg }}>
      <View
        style={{
          flexDirection: 'row',
          alignItems: 'center',
          justifyContent: 'space-between',
          paddingTop: insets.top + 12,
          paddingBottom: 12,
          paddingHorizontal: space.xl,
        }}
      >
        <Pressable onPress={() => router.back()} hitSlop={10}>
          <IconChevronLeft size={18} color={t.ink3} />
        </Pressable>
        <Text style={{ fontSize: 15, fontFamily: font.sansSemi, color: t.ink }}>Reconstitute</Text>
        <View style={{ width: 18 }} />
      </View>

      <ScrollView
        contentContainerStyle={{ paddingBottom: insets.bottom + 20 }}
        showsVerticalScrollIndicator={false}
      >
        <View style={{ paddingHorizontal: space.xl }}>
          <Text
            style={{
              fontSize: 28,
              fontFamily: font.sansBold,
              color: t.ink,
              letterSpacing: -0.6,
              lineHeight: 32,
            }}
          >
            Mix a new vial.
          </Text>
          <Text style={{ fontSize: 14, color: t.ink3, marginTop: 6 }}>
            We'll tell you exactly how much BAC water to draw.
          </Text>
        </View>

        {/* Inputs */}
        <View style={{ paddingHorizontal: space.xl, marginTop: 24, gap: 10 }}>
          <Stepper
            label="Vial strength"
            value={`${strengthMg}`}
            unit="mg"
            onMinus={() => bumpStrength(-1)}
            onPlus={() => bumpStrength(1)}
          />
          <Stepper
            label="BAC water"
            value={bacMl.toFixed(1)}
            unit="mL"
            onMinus={() => bumpBac(-0.5)}
            onPlus={() => bumpBac(0.5)}
          />
          <Stepper
            label="Target dose"
            value={`${doseMcg}`}
            unit="mcg"
            onMinus={() => bumpDose(-25)}
            onPlus={() => bumpDose(25)}
          />
          <View
            style={{
              backgroundColor: t.surface,
              borderRadius: radius.md,
              paddingVertical: 12,
              paddingHorizontal: 16,
              borderWidth: 1,
              borderColor: t.line,
            }}
          >
            <Text
              style={{
                fontSize: 11,
                color: t.ink3,
                letterSpacing: 0.3,
                fontFamily: font.sansSemi,
                textTransform: 'uppercase',
              }}
            >
              Syringe
            </Text>
            <Text
              style={{
                fontSize: 15,
                fontFamily: font.sansSemi,
                color: t.ink,
                marginTop: 3,
              }}
            >
              Insulin · 100 units / 1 mL
            </Text>
          </View>
        </View>

        {/* Result card */}
        <View style={{ paddingHorizontal: space.xl, marginTop: 24 }}>
          <View
            style={{
              backgroundColor: t.ink,
              borderRadius: radius.xl,
              padding: 22,
              overflow: 'hidden',
            }}
          >
            <Text
              style={{
                fontSize: 11,
                letterSpacing: 1.2,
                color: t.bg,
                opacity: 0.6,
                fontFamily: font.sansSemi,
                textTransform: 'uppercase',
              }}
            >
              Concentration
            </Text>
            <View style={{ flexDirection: 'row', alignItems: 'baseline', marginTop: 6 }}>
              <Text
                style={{
                  fontSize: 42,
                  fontFamily: font.monoSemi,
                  color: t.bg,
                  letterSpacing: -1,
                  lineHeight: 46,
                }}
              >
                {concentrationMgPerMl.toFixed(2)}
              </Text>
              <Text
                style={{
                  fontSize: 16,
                  color: t.bg,
                  opacity: 0.7,
                  marginLeft: 6,
                  fontFamily: font.sansMed,
                }}
              >
                mg / mL
              </Text>
            </View>

            <View
              style={{
                flexDirection: 'row',
                marginTop: 22,
                gap: 20,
              }}
            >
              <View style={{ flex: 1 }}>
                <Text
                  style={{
                    fontSize: 10,
                    letterSpacing: 1.1,
                    color: t.bg,
                    opacity: 0.5,
                    fontFamily: font.sansSemi,
                    textTransform: 'uppercase',
                  }}
                >
                  Per {doseMcg} mcg dose
                </Text>
                <View style={{ flexDirection: 'row', alignItems: 'baseline', marginTop: 4 }}>
                  <Text
                    style={{
                      fontSize: 28,
                      fontFamily: font.monoSemi,
                      color: t.bg,
                      letterSpacing: -0.5,
                    }}
                  >
                    {unitsPerDose.toFixed(1)}
                  </Text>
                  <Text
                    style={{
                      fontSize: 12,
                      color: t.bg,
                      opacity: 0.7,
                      marginLeft: 3,
                    }}
                  >
                    units
                  </Text>
                </View>
                <Text
                  style={{
                    fontSize: 11,
                    color: t.bg,
                    opacity: 0.6,
                    marginTop: 2,
                    fontFamily: font.mono,
                  }}
                >
                  = {volumeMlPerDose.toFixed(2)} mL
                </Text>
              </View>
              <View style={{ width: 1, backgroundColor: 'rgba(255,255,255,0.14)' }} />
              <View style={{ flex: 1 }}>
                <Text
                  style={{
                    fontSize: 10,
                    letterSpacing: 1.1,
                    color: t.bg,
                    opacity: 0.5,
                    fontFamily: font.sansSemi,
                    textTransform: 'uppercase',
                  }}
                >
                  Total doses
                </Text>
                <Text
                  style={{
                    fontSize: 28,
                    fontFamily: font.monoSemi,
                    color: t.bg,
                    letterSpacing: -0.5,
                    marginTop: 4,
                  }}
                >
                  {Math.floor(totalDoses)}
                </Text>
                <Text
                  style={{
                    fontSize: 11,
                    color: t.bg,
                    opacity: 0.6,
                    marginTop: 2,
                  }}
                >
                  ~{Math.floor(totalDoses)} days @ 1/day
                </Text>
              </View>
            </View>
          </View>
        </View>

        {/* Visual syringe */}
        <View style={{ paddingHorizontal: space.xl, marginTop: 24 }}>
          <Text
            style={{
              fontSize: 11,
              fontFamily: font.sansSemi,
              letterSpacing: 1.2,
              color: t.ink3,
              marginBottom: 12,
              textTransform: 'uppercase',
            }}
          >
            Draw to {unitsPerDose.toFixed(1)} units
          </Text>
          <View
            style={{
              backgroundColor: t.surface,
              borderRadius: radius.lg,
              paddingVertical: 20,
              paddingHorizontal: 16,
              borderWidth: 1,
              borderColor: t.line,
            }}
          >
            <Svg viewBox="0 0 320 60" width="100%" height={56}>
              <Rect x={8} y={18} width={240} height={24} rx={2} fill="none" stroke={t.ink3} strokeWidth={1.5} />
              {Array.from({ length: 11 }).map((_, i) => (
                <Line
                  key={`tick-${i}`}
                  x1={8 + i * 24}
                  y1={14}
                  x2={8 + i * 24}
                  y2={18}
                  stroke={t.ink3}
                  strokeWidth={1}
                />
              ))}
              {Array.from({ length: 11 }).map((_, i) => (
                <SvgText
                  key={`txt-${i}`}
                  x={8 + i * 24}
                  y={10}
                  fontSize={7}
                  fill={t.ink3}
                  textAnchor="middle"
                >
                  {i * 10}
                </SvgText>
              ))}
              <Rect
                x={9}
                y={19.5}
                width={238 * fillPct}
                height={21}
                fill={t.accent}
                opacity={0.8}
              />
              <Rect x={248} y={18} width={6} height={24} fill={t.ink3} />
              <Rect x={254} y={22} width={50} height={16} fill="none" stroke={t.ink3} strokeWidth={1.5} />
              <Rect x={304} y={18} width={8} height={24} rx={1} fill={t.ink3} />
              <Line x1={0} y1={30} x2={8} y2={30} stroke={t.ink3} strokeWidth={1.5} />
            </Svg>
          </View>
        </View>

        <View style={{ paddingHorizontal: space.xl, marginTop: 20 }}>
          <Pressable
            onPress={() => router.back()}
            style={{
              padding: 14,
              borderRadius: radius.md,
              backgroundColor: t.ink,
              alignItems: 'center',
            }}
          >
            <Text style={{ fontSize: 15, fontFamily: font.sansSemi, color: t.bg }}>
              Save as new vial
            </Text>
          </Pressable>
        </View>
      </ScrollView>
    </View>
  );
}

function Stepper({
  label,
  value,
  unit,
  onMinus,
  onPlus,
}: {
  label: string;
  value: string;
  unit: string;
  onMinus: () => void;
  onPlus: () => void;
}) {
  const { t } = useTheme();
  return (
    <View
      style={{
        backgroundColor: t.surface,
        borderRadius: radius.md,
        paddingVertical: 10,
        paddingHorizontal: 16,
        borderWidth: 1,
        borderColor: t.line,
        flexDirection: 'row',
        alignItems: 'center',
      }}
    >
      <View style={{ flex: 1 }}>
        <Text
          style={{
            fontSize: 11,
            color: t.ink3,
            letterSpacing: 0.3,
            fontFamily: font.sansSemi,
            textTransform: 'uppercase',
          }}
        >
          {label}
        </Text>
        <View style={{ flexDirection: 'row', alignItems: 'baseline', marginTop: 3 }}>
          <Text
            style={{
              fontSize: 17,
              fontFamily: font.monoSemi,
              color: t.ink,
            }}
          >
            {value}
          </Text>
          <Text
            style={{
              fontSize: 13,
              color: t.ink3,
              fontFamily: font.sansMed,
              marginLeft: 4,
            }}
          >
            {unit}
          </Text>
        </View>
      </View>
      <View style={{ flexDirection: 'row', gap: 6 }}>
        <Pressable
          onPress={onMinus}
          style={{
            width: 34,
            height: 34,
            borderRadius: radius.pill,
            backgroundColor: t.surfaceAlt,
            alignItems: 'center',
            justifyContent: 'center',
          }}
          hitSlop={6}
        >
          <Text style={{ fontSize: 18, color: t.ink, fontFamily: font.sansSemi }}>−</Text>
        </Pressable>
        <Pressable
          onPress={onPlus}
          style={{
            width: 34,
            height: 34,
            borderRadius: radius.pill,
            backgroundColor: t.surfaceAlt,
            alignItems: 'center',
            justifyContent: 'center',
          }}
          hitSlop={6}
        >
          <Text style={{ fontSize: 18, color: t.ink, fontFamily: font.sansSemi }}>+</Text>
        </Pressable>
      </View>
    </View>
  );
}

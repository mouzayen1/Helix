// Reconstitute — spec v2.0 §10. Modal. Creates a real vial row.
import { useRouter } from 'expo-router';
import { useMemo, useState } from 'react';
import { Pressable, ScrollView, Text, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import Svg, { Line, Rect } from 'react-native-svg';
import { IconChevronRight, IconClose } from '../components/Icons';
import { HCodeAvatar } from '../components/Primitives';
import { createVial } from '../lib/db';
import { PEPTIDES, findPeptide } from '../lib/peptides';
import { useTheme } from '../theme/ThemeContext';
import { font, radius, space } from '../theme/tokens';

const STRENGTH_PRESETS = [2, 5, 10, 15];

export default function ReconstituteModal() {
  const { t } = useTheme();
  const router = useRouter();
  const insets = useSafeAreaInsets();

  const [showPeptidePicker, setShowPeptidePicker] = useState(false);
  const [peptideId, setPeptideId] = useState<string>(PEPTIDES[0].id);
  const [strengthMg, setStrengthMg] = useState(5);
  const [bacMl, setBacMl] = useState(2);
  const [targetDoseMcg, setTargetDoseMcg] = useState(250);
  const [saving, setSaving] = useState(false);

  const peptide = findPeptide(peptideId)!;

  const calc = useMemo(() => {
    const concMgPerMl = strengthMg / bacMl;
    const volMlPerDose = targetDoseMcg / (concMgPerMl * 1000);
    const unitsPerDose = volMlPerDose * 100;
    const totalDoses = strengthMg / (targetDoseMcg / 1000);
    return { concMgPerMl, volMlPerDose, unitsPerDose, totalDoses };
  }, [strengthMg, bacMl, targetDoseMcg]);

  const fillPct = Math.max(0.02, Math.min(1, calc.unitsPerDose / 100));

  const save = async () => {
    if (saving) return;
    setSaving(true);
    try {
      await createVial({
        peptide_id: peptideId,
        strength_mg: strengthMg,
        bac_water_ml: bacMl,
      });
      router.back();
    } catch (e) {
      console.warn('recon failed', e);
      setSaving(false);
    }
  };

  return (
    <View style={{ flex: 1, backgroundColor: t.bg }}>
      <View
        style={{
          flexDirection: 'row',
          alignItems: 'center',
          justifyContent: 'space-between',
          paddingTop: insets.top + space.md,
          paddingBottom: space.md,
          paddingHorizontal: space.xl,
        }}
      >
        <Pressable onPress={() => router.back()} hitSlop={10}>
          <IconClose size={16} color={t.ink3} />
        </Pressable>
        <Text style={{ fontSize: 15, fontFamily: font.sansSemi, color: t.ink }}>
          Reconstitute
        </Text>
        <View style={{ width: 16 }} />
      </View>

      <ScrollView
        contentContainerStyle={{ paddingBottom: insets.bottom + space['2xl'] }}
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

        {/* Peptide */}
        <View style={{ paddingHorizontal: space.xl, marginTop: space.xl }}>
          <Pressable
            onPress={() => setShowPeptidePicker(!showPeptidePicker)}
            style={{
              backgroundColor: t.surface,
              borderRadius: radius.md,
              paddingVertical: 12,
              paddingHorizontal: 16,
              borderWidth: 1,
              borderColor: t.line,
              flexDirection: 'row',
              alignItems: 'center',
              gap: 12,
            }}
          >
            <HCodeAvatar id={peptide.name.replace(/[^A-Za-z]/g, '').slice(0, 3)} color={peptide.color} />
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
                Peptide
              </Text>
              <Text style={{ fontSize: 15, fontFamily: font.sansSemi, color: t.ink, marginTop: 2 }}>
                {peptide.name}
              </Text>
            </View>
            <IconChevronRight size={14} color={t.ink4} />
          </Pressable>
          {showPeptidePicker ? (
            <View
              style={{
                marginTop: 4,
                maxHeight: 240,
                backgroundColor: t.surface,
                borderRadius: radius.md,
                borderWidth: 1,
                borderColor: t.line,
              }}
            >
              <ScrollView>
                {PEPTIDES.map((p) => (
                  <Pressable
                    key={p.id}
                    onPress={() => {
                      setPeptideId(p.id);
                      setShowPeptidePicker(false);
                    }}
                    style={{
                      padding: space.md,
                      flexDirection: 'row',
                      alignItems: 'center',
                      gap: 10,
                      borderBottomWidth: 1,
                      borderBottomColor: t.line,
                    }}
                  >
                    <View style={{ width: 8, height: 8, borderRadius: 4, backgroundColor: p.color }} />
                    <Text style={{ flex: 1, color: t.ink, fontSize: 14, fontFamily: font.sansMed }}>
                      {p.name}
                    </Text>
                  </Pressable>
                ))}
              </ScrollView>
            </View>
          ) : null}
        </View>

        {/* Strength presets */}
        <View style={{ paddingHorizontal: space.xl, marginTop: space.md }}>
          <Text
            style={{
              fontSize: 11,
              color: t.ink3,
              letterSpacing: 0.3,
              fontFamily: font.sansSemi,
              textTransform: 'uppercase',
              marginBottom: 8,
            }}
          >
            Vial strength
          </Text>
          <View style={{ flexDirection: 'row', gap: 6 }}>
            {STRENGTH_PRESETS.map((s) => {
              const active = s === strengthMg;
              return (
                <Pressable
                  key={s}
                  onPress={() => setStrengthMg(s)}
                  style={{
                    flex: 1,
                    paddingVertical: 14,
                    borderRadius: radius.md,
                    backgroundColor: active ? t.ink : t.surface,
                    borderWidth: 1,
                    borderColor: active ? t.ink : t.line,
                    alignItems: 'center',
                  }}
                >
                  <Text
                    style={{
                      fontSize: 16,
                      fontFamily: font.monoSemi,
                      color: active ? t.bg : t.ink,
                    }}
                  >
                    {s} mg
                  </Text>
                </Pressable>
              );
            })}
          </View>
        </View>

        {/* Steppers */}
        <View style={{ paddingHorizontal: space.xl, marginTop: space.md, gap: 10 }}>
          <Stepper
            label="BAC water"
            value={bacMl.toFixed(1)}
            unit="mL"
            onMinus={() =>
              setBacMl((v) => Math.max(0.5, Math.round((v - 0.5) * 10) / 10))
            }
            onPlus={() =>
              setBacMl((v) => Math.min(10, Math.round((v + 0.5) * 10) / 10))
            }
          />
          <Stepper
            label="Target dose"
            value={`${targetDoseMcg}`}
            unit="mcg"
            onMinus={() => setTargetDoseMcg((v) => Math.max(10, v - 25))}
            onPlus={() => setTargetDoseMcg((v) => Math.min(5000, v + 25))}
          />
        </View>

        {/* Result */}
        <View style={{ paddingHorizontal: space.xl, marginTop: space.xl }}>
          <View
            style={{
              backgroundColor: t.ink,
              borderRadius: radius.lg,
              padding: space.lg,
              overflow: 'hidden',
            }}
          >
            <Text
              style={{
                fontSize: 11,
                letterSpacing: 1.1,
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
                {calc.concMgPerMl.toFixed(2)}
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

            <View style={{ flexDirection: 'row', marginTop: space.lg, gap: space.lg }}>
              <View style={{ flex: 1 }}>
                <Text
                  style={{
                    fontSize: 10,
                    color: t.bg,
                    opacity: 0.5,
                    fontFamily: font.sansSemi,
                    letterSpacing: 0.9,
                    textTransform: 'uppercase',
                  }}
                >
                  Per {targetDoseMcg} mcg
                </Text>
                <View style={{ flexDirection: 'row', alignItems: 'baseline', marginTop: 4 }}>
                  <Text
                    style={{
                      fontSize: 24,
                      fontFamily: font.monoSemi,
                      color: t.bg,
                      letterSpacing: -0.5,
                    }}
                  >
                    {calc.unitsPerDose.toFixed(1)}
                  </Text>
                  <Text
                    style={{
                      fontSize: 12,
                      color: t.bg,
                      opacity: 0.7,
                      marginLeft: 4,
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
                  = {calc.volMlPerDose.toFixed(3)} mL
                </Text>
              </View>
              <View style={{ width: 1, backgroundColor: 'rgba(255,255,255,0.14)' }} />
              <View style={{ flex: 1 }}>
                <Text
                  style={{
                    fontSize: 10,
                    color: t.bg,
                    opacity: 0.5,
                    fontFamily: font.sansSemi,
                    letterSpacing: 0.9,
                    textTransform: 'uppercase',
                  }}
                >
                  Total doses
                </Text>
                <Text
                  style={{
                    fontSize: 24,
                    fontFamily: font.monoSemi,
                    color: t.bg,
                    marginTop: 4,
                  }}
                >
                  {Math.floor(calc.totalDoses)}
                </Text>
                <Text
                  style={{
                    fontSize: 11,
                    color: t.bg,
                    opacity: 0.6,
                    marginTop: 2,
                  }}
                >
                  ~{Math.floor(calc.totalDoses)} days @ 1/day
                </Text>
              </View>
            </View>
          </View>
        </View>

        {/* Syringe */}
        <View style={{ paddingHorizontal: space.xl, marginTop: space.md }}>
          <Text
            style={{
              fontSize: 11,
              fontFamily: font.sansSemi,
              letterSpacing: 1.1,
              color: t.ink3,
              marginBottom: 10,
              textTransform: 'uppercase',
            }}
          >
            Draw to {calc.unitsPerDose.toFixed(1)} units
          </Text>
          <View
            style={{
              backgroundColor: t.surface,
              borderRadius: radius.md,
              paddingVertical: space.lg,
              paddingHorizontal: space.md,
              borderWidth: 1,
              borderColor: t.line,
            }}
          >
            <Svg viewBox="0 0 320 60" width="100%" height={56}>
              <Rect x={8} y={18} width={240} height={24} rx={2} fill="none" stroke={t.ink3} strokeWidth={1.5} />
              {Array.from({ length: 11 }).map((_, i) => (
                <Line
                  key={i}
                  x1={8 + i * 24}
                  y1={14}
                  x2={8 + i * 24}
                  y2={18}
                  stroke={t.ink3}
                  strokeWidth={1}
                />
              ))}
              <Rect x={9} y={19.5} width={238 * fillPct} height={21} fill={t.accent} opacity={0.8} />
              <Rect x={248} y={18} width={6} height={24} fill={t.ink3} />
              <Rect x={254} y={22} width={50} height={16} fill="none" stroke={t.ink3} strokeWidth={1.5} />
              <Rect x={304} y={18} width={8} height={24} rx={1} fill={t.ink3} />
              <Line x1={0} y1={30} x2={8} y2={30} stroke={t.ink3} strokeWidth={1.5} />
            </Svg>
          </View>
        </View>

        <View style={{ paddingHorizontal: space.xl, marginTop: space.xl }}>
          <Pressable
            onPress={save}
            disabled={saving}
            style={{
              padding: space.lg,
              borderRadius: radius.lg,
              backgroundColor: saving ? t.surfaceAlt : t.ink,
              alignItems: 'center',
            }}
          >
            <Text style={{ fontSize: 15, fontFamily: font.sansSemi, color: saving ? t.ink3 : t.bg }}>
              {saving ? 'Saving…' : 'Save vial'}
            </Text>
          </Pressable>
          <Text
            style={{
              marginTop: space.sm,
              fontSize: 11,
              color: t.ink3,
              textAlign: 'center',
            }}
          >
            Vial expires 30 days after mixing.
          </Text>
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
        paddingHorizontal: 14,
        borderWidth: 1,
        borderColor: t.line,
        flexDirection: 'row',
        alignItems: 'center',
      }}
    >
      <View style={{ flex: 1 }}>
        <Text
          style={{
            fontSize: 10,
            color: t.ink3,
            letterSpacing: 0.3,
            fontFamily: font.sansSemi,
            textTransform: 'uppercase',
          }}
        >
          {label}
        </Text>
        <View style={{ flexDirection: 'row', alignItems: 'baseline', marginTop: 3 }}>
          <Text style={{ fontSize: 17, fontFamily: font.monoSemi, color: t.ink }}>{value}</Text>
          <Text
            style={{
              fontSize: 12,
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
            width: 32,
            height: 32,
            borderRadius: 16,
            backgroundColor: t.surfaceAlt,
            alignItems: 'center',
            justifyContent: 'center',
          }}
          hitSlop={4}
        >
          <Text style={{ fontSize: 18, color: t.ink, fontFamily: font.sansSemi }}>−</Text>
        </Pressable>
        <Pressable
          onPress={onPlus}
          style={{
            width: 32,
            height: 32,
            borderRadius: 16,
            backgroundColor: t.surfaceAlt,
            alignItems: 'center',
            justifyContent: 'center',
          }}
          hitSlop={4}
        >
          <Text style={{ fontSize: 18, color: t.ink, fontFamily: font.sansSemi }}>+</Text>
        </Pressable>
      </View>
    </View>
  );
}

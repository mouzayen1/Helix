// Reconstitute — spec v2.0 §10 + extras.
// Creates real vial row. Supports peptideId query param, beginner-mode walkthrough,
// typed number inputs, auto-fill from peptide.reconstitution, co-reconstitute option.
import { useLocalSearchParams, useRouter } from 'expo-router';
import { useEffect, useMemo, useState } from 'react';
import { Alert, Pressable, ScrollView, Switch, Text, TextInput, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import Svg, { Line, Rect } from 'react-native-svg';
import { IconChevronRight, IconClose } from '../components/Icons';
import { DosingDisclaimer, HCodeAvatar } from '../components/Primitives';
import { createVial } from '../lib/db';
import { formatDuration } from '../lib/freq';
import { getPeptideExtras } from '../lib/peptide-extras';
import { findPeptide, PEPTIDES } from '../lib/peptides';
import { useTheme } from '../theme/ThemeContext';
import { font, radius, space } from '../theme/tokens';

const STRENGTH_PRESETS = [2, 5, 10, 15];

// Parse strings like "5 mg + 2 mL BAC = 2.5 mg/mL · 10 units = 250 mcg" or
// "5 mg + 1 mL BAC = 5 mg/mL · 32 units = 1.6 mg" into
// { strength_mg, bac_water_ml, target_dose_mcg }. Both mg and mcg are
// accepted for the example dose; mg is converted to mcg internally so the
// reconstitute UI's "Draw Xu" callout always matches the monograph.
//
// fallbackMcg is the peptide's authoritative defaultDoseMcg (preferred over
// the legacy 250 mcg hardcoded fallback when the example dose can't be
// parsed — e.g. mL-based intranasal recipes or pen-only strings).
function parseRecon(recon: string | undefined, fallbackMcg = 250) {
  if (!recon) return null;
  const strengthMatch = recon.match(/(\d+(?:\.\d+)?)\s*mg\s*\+/);
  const bacMatch = recon.match(/\+\s*(\d+(?:\.\d+)?)\s*mL/);
  if (!strengthMatch || !bacMatch) return null;
  // Find the *last* "= N mg" or "= N mcg" — for strings that contain both
  // "= 5 mg/mL" (concentration) and "= 1.6 mg" (example dose), we want the
  // example, which always comes after the concentration.
  const doseMatches = [
    ...recon.matchAll(/=\s*(\d+(?:\.\d+)?)\s*(mcg|mg)\b/gi),
  ];
  let target_dose_mcg = fallbackMcg;
  for (let i = doseMatches.length - 1; i >= 0; i--) {
    const m = doseMatches[i];
    // Skip the "= N mg/mL" concentration callout — only the example dose.
    if (recon.slice(m.index ?? 0, (m.index ?? 0) + m[0].length + 3).includes('mg/mL')) {
      continue;
    }
    const n = parseFloat(m[1]);
    target_dose_mcg = m[2].toLowerCase() === 'mg' ? n * 1000 : n;
    break;
  }
  return {
    strength_mg: parseFloat(strengthMatch[1]),
    bac_water_ml: parseFloat(bacMatch[1]),
    target_dose_mcg,
  };
}

export default function ReconstituteModal() {
  const { t } = useTheme();
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const { peptideId: initialId } = useLocalSearchParams<{ peptideId?: string }>();

  const [showPeptidePicker, setShowPeptidePicker] = useState(false);
  const [peptideId, setPeptideId] = useState<string>(initialId || PEPTIDES[0].id);
  const [strengthMg, setStrengthMg] = useState(5);
  const [strengthText, setStrengthText] = useState('5');
  const [bacMl, setBacMl] = useState(2);
  const [bacText, setBacText] = useState('2');
  const [targetDoseMcg, setTargetDoseMcg] = useState(250);
  const [targetDoseText, setTargetDoseText] = useState('250');
  const [beginnerMode, setBeginnerMode] = useState(false);
  const [coReconstitutePartner, setCoReconstitutePartner] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);

  const peptide = findPeptide(peptideId)!;
  const extras = getPeptideExtras(peptideId);
  const coReconstituteOptions = useMemo(
    () => extras?.coAdministration.filter((ca) => ca.co_reconstitute) ?? [],
    [extras]
  );

  // Auto-fill numeric fields from the selected peptide's suggested
  // reconstitution. Pass defaultDoseMcg so peptides whose example dose can't
  // be parsed (intranasal mL recipes, pen-only strings) still seed a
  // sensible target value.
  useEffect(() => {
    const parsed = parseRecon(peptide.reconstitution, peptide.defaultDoseMcg);
    if (parsed) {
      setStrengthMg(parsed.strength_mg);
      setStrengthText(String(parsed.strength_mg));
      setBacMl(parsed.bac_water_ml);
      setBacText(String(parsed.bac_water_ml));
      setTargetDoseMcg(parsed.target_dose_mcg);
      setTargetDoseText(String(parsed.target_dose_mcg));
    }
    // Clear any prior co-reconstitute partner when peptide changes
    setCoReconstitutePartner(null);
  }, [peptide.id, peptide.reconstitution]);

  const calc = useMemo(() => {
    const concMgPerMl = strengthMg / bacMl;
    const volMlPerDose = targetDoseMcg / (concMgPerMl * 1000);
    const unitsPerDose = volMlPerDose * 100;
    const totalDoses = strengthMg / (targetDoseMcg / 1000);
    return {
      concMgPerMl: isFinite(concMgPerMl) ? concMgPerMl : 0,
      volMlPerDose: isFinite(volMlPerDose) ? volMlPerDose : 0,
      unitsPerDose: isFinite(unitsPerDose) ? unitsPerDose : 0,
      totalDoses: isFinite(totalDoses) ? totalDoses : 0,
    };
  }, [strengthMg, bacMl, targetDoseMcg]);

  const fillPct = Math.max(0.02, Math.min(1, calc.unitsPerDose / 100));

  const commitNum = (
    text: string,
    setNum: (n: number) => void,
    setText: (s: string) => void,
    min: number,
    max: number,
    fallback: number
  ) => {
    const n = parseFloat(text);
    if (isNaN(n) || n < min || n > max) {
      setText(String(fallback));
      setNum(fallback);
    } else {
      setNum(n);
      setText(String(n));
    }
  };

  const save = async () => {
    if (saving) return;
    setSaving(true);
    try {
      await createVial({
        peptide_id: peptideId,
        strength_mg: strengthMg,
        bac_water_ml: bacMl,
      });
      // Create a second vial row for the co-reconstitute partner (shared BAC).
      if (coReconstitutePartner) {
        const partner = findPeptide(coReconstitutePartner);
        if (partner) {
          const partnerParsed = parseRecon(partner.reconstitution, partner.defaultDoseMcg);
          const partnerStrength = partnerParsed?.strength_mg ?? strengthMg;
          await createVial({
            peptide_id: coReconstitutePartner,
            strength_mg: partnerStrength,
            bac_water_ml: bacMl,
            notes: `Co-reconstituted with ${peptide.name}`,
          });
        }
      }
      router.back();
    } catch (e) {
      setSaving(false);
      const msg = e instanceof Error && e.message ? e.message : 'Please try again.';
      Alert.alert('Could not save vial', msg, [{ text: 'OK' }]);
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
        <Text style={{ fontSize: 15, fontFamily: font.sansSemi, color: t.ink }}>Reconstitute</Text>
        <View style={{ width: 16 }} />
      </View>

      <ScrollView
        contentContainerStyle={{ paddingBottom: insets.bottom + space['2xl'] }}
        showsVerticalScrollIndicator={false}
      >
        <View style={{ paddingHorizontal: space.xl }}>
          <Text
            style={{
              fontSize: 26,
              fontFamily: font.sansBold,
              color: t.ink,
              letterSpacing: -0.6,
              lineHeight: 30,
            }}
          >
            Mix a new vial.
          </Text>
          <Text style={{ fontSize: 13, color: t.ink3, marginTop: 4 }}>
            We'll tell you exactly how much BAC water to draw.
          </Text>

          {/* Beginner mode toggle */}
          <View
            style={{
              marginTop: space.md,
              flexDirection: 'row',
              alignItems: 'center',
              justifyContent: 'space-between',
              paddingVertical: 8,
              paddingHorizontal: 12,
              borderRadius: radius.md,
              backgroundColor: t.accentSoft,
            }}
          >
            <View style={{ flex: 1 }}>
              <Text style={{ fontSize: 13, color: t.accentInk, fontFamily: font.sansSemi }}>
                Beginner mode
              </Text>
              <Text style={{ fontSize: 11, color: t.ink2, marginTop: 2 }}>
                Step-by-step walkthrough for first reconstitution
              </Text>
            </View>
            <Switch
              value={beginnerMode}
              onValueChange={setBeginnerMode}
              trackColor={{ false: t.surfaceAlt, true: t.accent }}
            />
          </View>
        </View>

        {beginnerMode ? (
          <View style={{ paddingHorizontal: space.xl, marginTop: space.md, gap: 8 }}>
            <WalkthroughStep
              n={1}
              title="What is reconstitution?"
              body="Most peptides ship as a dry powder. 'Reconstitution' just means adding sterile bacteriostatic (BAC) water to dissolve the powder into a liquid you can draw into a syringe."
            />
            <WalkthroughStep
              n={2}
              title="How much BAC water?"
              body={
                peptide.reconstitution
                  ? `For ${peptide.name}, research protocols commonly use: ${peptide.reconstitution}. We've pre-filled these numbers — adjust if your vial is a different strength.`
                  : 'Match the powder strength to a target concentration that gives easy-to-measure syringe units. Typical: 2 mL BAC per 5 mg vial.'
              }
            />
            <WalkthroughStep
              n={3}
              title="What are 'units'?"
              body="Insulin syringes are marked in units. A 1 mL (100-unit) syringe = 100 'units' total. 10 units = 0.10 mL. Helix shows the units-per-dose below so you know exactly how far to pull the plunger."
            />
          </View>
        ) : null}

        {/* Peptide picker */}
        <View style={{ paddingHorizontal: space.xl, marginTop: space.lg }}>
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
                height: 340,
                backgroundColor: t.surface,
                borderRadius: radius.md,
                borderWidth: 1,
                borderColor: t.line,
              }}
            >
              <ScrollView nestedScrollEnabled showsVerticalScrollIndicator>
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
                    <Text style={{ color: t.ink3, fontSize: 11 }}>{p.class.split('/')[0].trim()}</Text>
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
                  onPress={() => {
                    setStrengthMg(s);
                    setStrengthText(String(s));
                  }}
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

        {/* Typed-number inputs */}
        <View style={{ paddingHorizontal: space.xl, marginTop: space.md, gap: 10 }}>
          <TypedField
            label="Vial strength"
            unit="mg"
            value={strengthText}
            onChangeText={setStrengthText}
            onCommit={() =>
              commitNum(strengthText, setStrengthMg, setStrengthText, 0.5, 100, strengthMg)
            }
            onMinus={() => {
              const v = Math.max(0.5, Math.round((strengthMg - 1) * 10) / 10);
              setStrengthMg(v);
              setStrengthText(String(v));
            }}
            onPlus={() => {
              const v = Math.min(100, Math.round((strengthMg + 1) * 10) / 10);
              setStrengthMg(v);
              setStrengthText(String(v));
            }}
          />
          <TypedField
            label="BAC water"
            unit="mL"
            value={bacText}
            onChangeText={setBacText}
            onCommit={() => commitNum(bacText, setBacMl, setBacText, 0.1, 20, bacMl)}
            onMinus={() => {
              const v = Math.max(0.1, Math.round((bacMl - 0.5) * 10) / 10);
              setBacMl(v);
              setBacText(String(v));
            }}
            onPlus={() => {
              const v = Math.min(20, Math.round((bacMl + 0.5) * 10) / 10);
              setBacMl(v);
              setBacText(String(v));
            }}
          />
          <TypedField
            label="Target dose"
            unit="mcg"
            value={targetDoseText}
            onChangeText={setTargetDoseText}
            onCommit={() =>
              commitNum(targetDoseText, setTargetDoseMcg, setTargetDoseText, 1, 500000, targetDoseMcg)
            }
            onMinus={() => {
              const v = Math.max(1, targetDoseMcg - 25);
              setTargetDoseMcg(v);
              setTargetDoseText(String(v));
            }}
            onPlus={() => {
              const v = Math.min(500000, targetDoseMcg + 25);
              setTargetDoseMcg(v);
              setTargetDoseText(String(v));
            }}
          />
        </View>

        {/* Result card */}
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
                  {formatDuration(calc.totalDoses, peptide.freq)}
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
            How much to draw
          </Text>
          <View
            style={{
              backgroundColor: t.accentSoft,
              borderRadius: radius.md,
              paddingVertical: space.md,
              paddingHorizontal: space.lg,
              borderLeftWidth: 3,
              borderLeftColor: t.accent,
              marginBottom: 10,
            }}
          >
            <Text
              style={{
                fontSize: 11,
                color: t.accentInk,
                fontFamily: font.sansSemi,
                letterSpacing: 0.9,
                textTransform: 'uppercase',
              }}
            >
              On U100 insulin syringe
            </Text>
            <Text
              style={{
                fontSize: 28,
                fontFamily: font.monoSemi,
                color: t.ink,
                marginTop: 4,
                letterSpacing: -0.5,
              }}
            >
              {calc.unitsPerDose.toFixed(1)}
              <Text style={{ fontSize: 14, color: t.ink3, fontFamily: font.sansMed }}>
                {' units'}
              </Text>
            </Text>
            <Text
              style={{
                fontSize: 11,
                color: t.ink3,
                fontFamily: font.mono,
                marginTop: 2,
              }}
            >
              = {calc.volMlPerDose.toFixed(3)} mL · {targetDoseMcg} mcg per dose
            </Text>
          </View>
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

        {/* Co-reconstitute partners */}
        {coReconstituteOptions.length > 0 ? (
          <View style={{ paddingHorizontal: space.xl, marginTop: space.md }}>
            <Text
              style={{
                fontSize: 11,
                fontFamily: font.sansSemi,
                letterSpacing: 1.1,
                color: t.ink3,
                marginBottom: 8,
                textTransform: 'uppercase',
              }}
            >
              Co-reconstitute with
            </Text>
            <View style={{ gap: 6 }}>
              {coReconstituteOptions.map((ca) => {
                const partner = findPeptide(ca.peptide_id);
                if (!partner) return null;
                const active = coReconstitutePartner === ca.peptide_id;
                return (
                  <Pressable
                    key={ca.peptide_id}
                    onPress={() =>
                      setCoReconstitutePartner(active ? null : ca.peptide_id)
                    }
                    style={{
                      backgroundColor: active ? t.accentSoft : t.surface,
                      borderRadius: radius.md,
                      borderWidth: 1,
                      borderColor: active ? t.accent : t.line,
                      padding: space.md,
                      flexDirection: 'row',
                      alignItems: 'center',
                      gap: 10,
                    }}
                  >
                    <View
                      style={{
                        width: 18,
                        height: 18,
                        borderRadius: 4,
                        borderWidth: 2,
                        borderColor: active ? t.accent : t.ink4,
                        backgroundColor: active ? t.accent : 'transparent',
                        alignItems: 'center',
                        justifyContent: 'center',
                      }}
                    >
                      {active ? (
                        <Text style={{ color: '#fff', fontSize: 11, fontFamily: font.sansBold }}>
                          ✓
                        </Text>
                      ) : null}
                    </View>
                    <View style={{ flex: 1 }}>
                      <Text style={{ fontSize: 14, fontFamily: font.sansSemi, color: t.ink }}>
                        + {partner.name}
                      </Text>
                      <Text style={{ fontSize: 12, color: t.ink3, marginTop: 2, lineHeight: 17 }}>
                        {ca.note}
                      </Text>
                    </View>
                  </Pressable>
                );
              })}
            </View>
            {coReconstitutePartner ? (
              <Text
                style={{
                  fontSize: 11,
                  color: t.ink3,
                  marginTop: 6,
                  fontFamily: font.mono,
                }}
              >
                Saving will create two vial rows sharing {bacMl} mL BAC.
              </Text>
            ) : null}
          </View>
        ) : null}

        {/* Inline disclaimer */}
        <View style={{ paddingHorizontal: space.xl, marginTop: space.md }}>
          <DosingDisclaimer />
        </View>

        <View style={{ paddingHorizontal: space.xl, marginTop: space.md }}>
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

function WalkthroughStep({ n, title, body }: { n: number; title: string; body: string }) {
  const { t } = useTheme();
  return (
    <View
      style={{
        padding: space.md,
        borderRadius: radius.md,
        backgroundColor: t.surface,
        borderWidth: 1,
        borderColor: t.line,
        flexDirection: 'row',
        gap: 12,
      }}
    >
      <View
        style={{
          width: 24,
          height: 24,
          borderRadius: 12,
          backgroundColor: t.accent,
          alignItems: 'center',
          justifyContent: 'center',
        }}
      >
        <Text style={{ color: '#fff', fontSize: 12, fontFamily: font.sansBold }}>{n}</Text>
      </View>
      <View style={{ flex: 1 }}>
        <Text style={{ fontSize: 13, fontFamily: font.sansSemi, color: t.ink }}>{title}</Text>
        <Text style={{ fontSize: 12, color: t.ink2, marginTop: 3, lineHeight: 18 }}>{body}</Text>
      </View>
    </View>
  );
}

function TypedField({
  label,
  unit,
  value,
  onChangeText,
  onCommit,
  onMinus,
  onPlus,
}: {
  label: string;
  unit: string;
  value: string;
  onChangeText: (s: string) => void;
  onCommit: () => void;
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
          <TextInput
            value={value}
            onChangeText={onChangeText}
            onBlur={onCommit}
            onSubmitEditing={onCommit}
            keyboardType="decimal-pad"
            returnKeyType="done"
            style={{
              fontSize: 17,
              fontFamily: font.monoSemi,
              color: t.ink,
              padding: 0,
              minWidth: 50,
            }}
          />
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

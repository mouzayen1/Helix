// Reconstitute — editorial rebuild. Same data flow as the v1.2
// implementation (parseRecon, calc, createVial, co-reconstitute partner)
// — only the visual layer is re-skinned. Beginner walkthrough + peptide
// picker preserved; result block uses StatPair instead of an inverted
// black card; the syringe SVG is retinted to the editorial palette.
import { useLocalSearchParams, useRouter } from 'expo-router';
import { useEffect, useMemo, useState } from 'react';
import { Alert, Pressable, ScrollView, Switch, Text, TextInput, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import Svg, { Line, Rect } from 'react-native-svg';
import { EditorialButton } from '../components/editorial/EditorialButton';
import { EditorialHeadline } from '../components/editorial/EditorialHeadline';
import { EyebrowLabel } from '../components/editorial/EyebrowLabel';
import { HairlineRow } from '../components/editorial/HairlineRow';
import { StatPair } from '../components/editorial/StatPair';
import { DosingDisclaimer } from '../components/Primitives';
import { useEditorialTheme } from '../lib/design/theme';
import { createVial } from '../lib/db';
import { formatDuration } from '../lib/freq';
import { getPeptideExtras } from '../lib/peptide-extras';
import { findPeptide, PEPTIDES } from '../lib/peptides';

const STRENGTH_PRESETS = [2, 5, 10, 15];

function parseRecon(recon: string | undefined, fallbackMcg = 250) {
  if (!recon) return null;
  const strengthMatch = recon.match(/(\d+(?:\.\d+)?)\s*mg\s*\+/);
  const bacMatch = recon.match(/\+\s*(\d+(?:\.\d+)?)\s*mL/);
  if (!strengthMatch || !bacMatch) return null;
  const doseMatches = [...recon.matchAll(/=\s*(\d+(?:\.\d+)?)\s*(mcg|mg)\b/gi)];
  let target_dose_mcg = fallbackMcg;
  for (let i = doseMatches.length - 1; i >= 0; i--) {
    const m = doseMatches[i];
    if (recon.slice(m.index ?? 0, (m.index ?? 0) + m[0].length + 3).includes('mg/mL')) continue;
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
  const ed = useEditorialTheme();
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
    setCoReconstitutePartner(null);
  }, [peptide.defaultDoseMcg, peptide.id, peptide.reconstitution]);

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
    <View style={{ flex: 1, backgroundColor: ed.colors.bg }}>
      {/* Header bar — close ×, mono uppercase title, no right action. */}
      <View
        style={{
          flexDirection: 'row',
          alignItems: 'center',
          justifyContent: 'space-between',
          paddingTop: insets.top + 12,
          paddingBottom: 12,
          paddingHorizontal: 24,
        }}
      >
        <Pressable onPress={() => router.back()} hitSlop={10} accessibilityRole="button">
          <Text
            style={{
              fontFamily: ed.fraunces('Fraunces_300Light'),
              fontSize: 26,
              color: ed.colors.ink2,
              lineHeight: 26,
            }}
          >
            ×
          </Text>
        </Pressable>
        <Text
          style={{
            fontFamily: ed.typography.label.fontFamily,
            fontSize: ed.typography.label.fontSize,
            letterSpacing: ed.typography.label.letterSpacing,
            color: ed.colors.ink3,
            textTransform: 'uppercase',
          }}
        >
          Reconstitute
        </Text>
        <View style={{ width: 16 }} />
      </View>

      <ScrollView
        contentContainerStyle={{ paddingBottom: insets.bottom + 64 }}
        showsVerticalScrollIndicator={false}
        keyboardShouldPersistTaps="handled"
      >
        <View style={{ paddingHorizontal: 24 }}>
          <EditorialHeadline size="title1">{`Mix a *new* vial.`}</EditorialHeadline>
          <Text
            style={{
              marginTop: 8,
              fontFamily: ed.typography.bodySm.fontFamily,
              fontSize: ed.typography.bodySm.fontSize,
              lineHeight: ed.typography.bodySm.lineHeight,
              color: ed.colors.ink3,
            }}
          >
            We will tell you exactly how much BAC water to draw.
          </Text>

          {/* Beginner mode toggle — hairline-framed, no fill. */}
          <View
            style={{
              marginTop: 20,
              flexDirection: 'row',
              alignItems: 'center',
              justifyContent: 'space-between',
              borderTopWidth: 1,
              borderBottomWidth: 1,
              borderColor: ed.colors.line,
              paddingVertical: 14,
            }}
          >
            <View style={{ flex: 1 }}>
              <Text
                style={{
                  fontFamily: ed.typography.label.fontFamily,
                  fontSize: ed.typography.label.fontSize,
                  letterSpacing: ed.typography.label.letterSpacing,
                  color: ed.colors.ink3,
                  textTransform: 'uppercase',
                }}
              >
                Beginner mode
              </Text>
              <Text
                style={{
                  marginTop: 4,
                  fontFamily: ed.typography.bodySm.fontFamily,
                  fontSize: ed.typography.bodySm.fontSize,
                  color: ed.colors.ink2,
                }}
              >
                Step-by-step walkthrough.
              </Text>
            </View>
            <Switch
              value={beginnerMode}
              onValueChange={setBeginnerMode}
              trackColor={{ false: ed.colors.lineStrong, true: ed.colors.brand }}
              thumbColor={ed.colors.bg}
            />
          </View>
        </View>

        {beginnerMode ? (
          <View style={{ paddingHorizontal: 24, marginTop: 20, gap: 14 }}>
            <WalkthroughStep
              n={1}
              title="What is reconstitution?"
              body="Most peptides ship as a dry powder. Reconstitution just means adding sterile bacteriostatic (BAC) water to dissolve the powder into a liquid you can draw into a syringe."
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
              title="What are units?"
              body="Insulin syringes are marked in units. A 1 mL (100-unit) syringe = 100 units total. 10 units = 0.10 mL. Helix shows the units-per-dose below."
            />
          </View>
        ) : null}

        {/* Peptide selector */}
        <View style={{ marginTop: 28, paddingHorizontal: 24 }}>
          <EyebrowLabel withRule>Peptide</EyebrowLabel>
          <Pressable
            onPress={() => setShowPeptidePicker((v) => !v)}
            accessibilityRole="button"
            style={{
              flexDirection: 'row',
              alignItems: 'center',
              paddingVertical: 18,
              gap: 12,
            }}
          >
            <View style={{ flex: 1 }}>
              <Text
                style={{
                  fontFamily: ed.fraunces('Fraunces_400Regular'),
                  fontSize: 24,
                  color: ed.colors.ink1,
                  letterSpacing: -0.4,
                }}
              >
                {peptide.name}
              </Text>
              <Text
                style={{
                  marginTop: 2,
                  fontFamily: ed.typography.dataMd.fontFamily,
                  fontSize: ed.typography.dataMd.fontSize,
                  color: ed.colors.ink3,
                }}
              >
                {peptide.class}
              </Text>
            </View>
            <Text
              style={{
                fontFamily: ed.fraunces('Fraunces_300Light'),
                fontSize: 22,
                color: ed.colors.ink3,
              }}
            >
              {showPeptidePicker ? '▴' : '▾'}
            </Text>
          </Pressable>
          <HairlineRow strong />
          {showPeptidePicker ? (
            <View style={{ height: 320, marginTop: 4 }}>
              <ScrollView nestedScrollEnabled showsVerticalScrollIndicator>
                {PEPTIDES.map((p, idx) => (
                  <View key={p.id}>
                    <Pressable
                      onPress={() => {
                        setPeptideId(p.id);
                        setShowPeptidePicker(false);
                      }}
                      style={{
                        paddingVertical: 14,
                        flexDirection: 'row',
                        alignItems: 'center',
                        gap: 12,
                      }}
                    >
                      <View
                        style={{
                          width: 6,
                          height: 6,
                          borderRadius: 3,
                          backgroundColor: p.color,
                        }}
                      />
                      <Text
                        style={{
                          flex: 1,
                          fontFamily: ed.fraunces('Fraunces_400Regular'),
                          fontSize: 17,
                          color: ed.colors.ink1,
                        }}
                      >
                        {p.name}
                      </Text>
                      <Text
                        style={{
                          fontFamily: ed.typography.labelSm.fontFamily,
                          fontSize: ed.typography.labelSm.fontSize,
                          letterSpacing: ed.typography.labelSm.letterSpacing,
                          color: ed.colors.ink3,
                          textTransform: 'uppercase',
                        }}
                      >
                        {p.class.split('/')[0].trim()}
                      </Text>
                    </Pressable>
                    {idx < PEPTIDES.length - 1 ? <HairlineRow /> : null}
                  </View>
                ))}
              </ScrollView>
            </View>
          ) : null}
        </View>

        {/* Vial strength presets */}
        <View style={{ marginTop: 28, paddingHorizontal: 24 }}>
          <EyebrowLabel withRule>Vial strength</EyebrowLabel>
          <View style={{ flexDirection: 'row', gap: 8, marginTop: 16 }}>
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
                    paddingVertical: 16,
                    alignItems: 'center',
                    backgroundColor: active ? ed.colors.ink1 : 'transparent',
                    borderWidth: 1,
                    borderColor: active ? ed.colors.ink1 : ed.colors.lineStrong,
                  }}
                >
                  <Text
                    style={{
                      fontFamily: ed.fraunces(active ? 'Fraunces_400Regular' : 'Fraunces_300Light'),
                      fontSize: 22,
                      color: active ? ed.colors.bg : ed.colors.ink1,
                      letterSpacing: -0.3,
                    }}
                  >
                    {s}
                    <Text
                      style={{
                        fontFamily: ed.typography.labelSm.fontFamily,
                        fontSize: ed.typography.labelSm.fontSize,
                        letterSpacing: ed.typography.labelSm.letterSpacing,
                        color: active ? ed.colors.bg : ed.colors.ink3,
                      }}
                    >
                      {' MG'}
                    </Text>
                  </Text>
                </Pressable>
              );
            })}
          </View>
        </View>

        {/* Typed numeric inputs */}
        <View style={{ marginTop: 24, paddingHorizontal: 24 }}>
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
          <HairlineRow />
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
          <HairlineRow />
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

        {/* Result block — StatPair triple under a strong hairline. */}
        <View style={{ marginTop: 32, marginHorizontal: 24 }}>
          <HairlineRow strong />
          <StatPair
            cells={[
              {
                value: calc.concMgPerMl.toFixed(2),
                unit: 'mg/mL',
                label: 'Concentration',
                color: 'brand',
              },
              {
                value: calc.unitsPerDose.toFixed(1),
                unit: 'u',
                label: `Per ${targetDoseMcg} mcg`,
              },
              {
                value: Math.floor(calc.totalDoses),
                label: 'Doses',
              },
            ]}
          />
          <HairlineRow strong />
          <Text
            style={{
              marginTop: 10,
              fontFamily: ed.typography.dataMd.fontFamily,
              fontSize: ed.typography.dataMd.fontSize,
              color: ed.colors.ink3,
            }}
          >
            = {calc.volMlPerDose.toFixed(3)} mL per dose · {formatDuration(calc.totalDoses, peptide.freq)}
          </Text>
        </View>

        {/* Draw callout */}
        <View style={{ marginTop: 28, paddingHorizontal: 24 }}>
          <EyebrowLabel withRule>Draw</EyebrowLabel>
          <View style={{ paddingTop: 18 }}>
            <View style={{ flexDirection: 'row', alignItems: 'baseline' }}>
              <Text
                style={{
                  fontFamily: ed.fraunces('Fraunces_300Light'),
                  fontSize: 64,
                  lineHeight: 64,
                  letterSpacing: -2,
                  color: ed.colors.ink1,
                }}
              >
                {calc.unitsPerDose.toFixed(1)}
              </Text>
              <Text
                style={{
                  marginLeft: 8,
                  fontFamily: ed.typography.label.fontFamily,
                  fontSize: ed.typography.label.fontSize,
                  letterSpacing: ed.typography.label.letterSpacing,
                  color: ed.colors.ink2,
                  textTransform: 'uppercase',
                }}
              >
                Units · U100
              </Text>
            </View>
            <Text
              style={{
                marginTop: 6,
                fontFamily: ed.typography.dataMd.fontFamily,
                fontSize: ed.typography.dataMd.fontSize,
                color: ed.colors.ink3,
              }}
            >
              = {calc.volMlPerDose.toFixed(3)} mL · {targetDoseMcg} mcg per dose
            </Text>
          </View>
          {/* Syringe — retinted hairline. */}
          <View style={{ marginTop: 20, paddingVertical: 12 }}>
            <Svg viewBox="0 0 320 60" width="100%" height={56}>
              <Rect
                x={8}
                y={18}
                width={240}
                height={24}
                fill="none"
                stroke={ed.colors.lineStrong}
                strokeWidth={1}
              />
              {Array.from({ length: 11 }).map((_, i) => (
                <Line
                  key={i}
                  x1={8 + i * 24}
                  y1={14}
                  x2={8 + i * 24}
                  y2={18}
                  stroke={ed.colors.ink4}
                  strokeWidth={1}
                />
              ))}
              <Rect x={9} y={19.5} width={238 * fillPct} height={21} fill={ed.colors.brand} opacity={0.85} />
              <Rect x={248} y={18} width={6} height={24} fill={ed.colors.ink4} />
              <Rect x={254} y={22} width={50} height={16} fill="none" stroke={ed.colors.ink4} strokeWidth={1} />
              <Rect x={304} y={18} width={8} height={24} fill={ed.colors.ink4} />
              <Line x1={0} y1={30} x2={8} y2={30} stroke={ed.colors.ink4} strokeWidth={1} />
            </Svg>
          </View>
        </View>

        {/* Co-reconstitute partners */}
        {coReconstituteOptions.length > 0 ? (
          <View style={{ marginTop: 28, paddingHorizontal: 24 }}>
            <EyebrowLabel withRule>Co-reconstitute with</EyebrowLabel>
            <View style={{ marginTop: 4 }}>
              {coReconstituteOptions.map((ca, idx) => {
                const partner = findPeptide(ca.peptide_id);
                if (!partner) return null;
                const active = coReconstitutePartner === ca.peptide_id;
                return (
                  <View key={ca.peptide_id}>
                    <Pressable
                      onPress={() => setCoReconstitutePartner(active ? null : ca.peptide_id)}
                      accessibilityRole="checkbox"
                      accessibilityState={{ checked: active }}
                      style={{
                        flexDirection: 'row',
                        alignItems: 'flex-start',
                        gap: 14,
                        paddingVertical: 16,
                      }}
                    >
                      <View
                        style={{
                          width: 18,
                          height: 18,
                          marginTop: 2,
                          borderWidth: 1,
                          borderColor: active ? ed.colors.brand : ed.colors.lineStrong,
                          backgroundColor: active ? ed.colors.brand : 'transparent',
                          alignItems: 'center',
                          justifyContent: 'center',
                        }}
                      >
                        {active ? (
                          <Text
                            style={{
                              color: ed.colors.bg,
                              fontFamily: ed.typography.dataMd.fontFamily,
                              fontSize: 12,
                              lineHeight: 14,
                            }}
                          >
                            ✓
                          </Text>
                        ) : null}
                      </View>
                      <View style={{ flex: 1 }}>
                        <Text
                          style={{
                            fontFamily: ed.fraunces('Fraunces_400Regular'),
                            fontSize: 17,
                            color: ed.colors.ink1,
                          }}
                        >
                          + {partner.name}
                        </Text>
                        <Text
                          style={{
                            marginTop: 4,
                            fontFamily: ed.typography.bodySm.fontFamily,
                            fontSize: ed.typography.bodySm.fontSize,
                            lineHeight: ed.typography.bodySm.lineHeight,
                            color: ed.colors.ink3,
                          }}
                        >
                          {ca.note}
                        </Text>
                      </View>
                    </Pressable>
                    {idx < coReconstituteOptions.length - 1 ? <HairlineRow /> : null}
                  </View>
                );
              })}
            </View>
            {coReconstitutePartner ? (
              <Text
                style={{
                  marginTop: 8,
                  fontFamily: ed.typography.dataMd.fontFamily,
                  fontSize: ed.typography.dataMd.fontSize,
                  color: ed.colors.ink3,
                }}
              >
                Saving will create two vial rows sharing {bacMl} mL BAC.
              </Text>
            ) : null}
          </View>
        ) : null}

        {/* Disclaimer + save */}
        <View style={{ marginTop: 28, paddingHorizontal: 24 }}>
          <DosingDisclaimer />
        </View>
        <View style={{ marginTop: 24, paddingHorizontal: 24 }}>
          <EditorialButton fullWidth onPress={save} disabled={saving}>
            {saving ? 'Saving…' : 'Save vial'}
          </EditorialButton>
          <Text
            style={{
              marginTop: 10,
              textAlign: 'center',
              fontFamily: ed.typography.labelSm.fontFamily,
              fontSize: ed.typography.labelSm.fontSize,
              letterSpacing: ed.typography.labelSm.letterSpacing,
              color: ed.colors.ink3,
              textTransform: 'uppercase',
            }}
          >
            Vial expires 30 days after mixing
          </Text>
        </View>
      </ScrollView>
    </View>
  );
}

function WalkthroughStep({ n, title, body }: { n: number; title: string; body: string }) {
  const ed = useEditorialTheme();
  return (
    <View
      style={{
        flexDirection: 'row',
        gap: 14,
        paddingVertical: 14,
        borderTopWidth: 1,
        borderColor: ed.colors.line,
      }}
    >
      <Text
        style={{
          width: 28,
          fontFamily: ed.fraunces('Fraunces_300Light'),
          fontSize: 26,
          color: ed.colors.brand,
          lineHeight: 28,
        }}
      >
        {n}
      </Text>
      <View style={{ flex: 1 }}>
        <Text
          style={{
            fontFamily: ed.fraunces('Fraunces_400Regular'),
            fontSize: 17,
            color: ed.colors.ink1,
            letterSpacing: -0.3,
          }}
        >
          {title}
        </Text>
        <Text
          style={{
            marginTop: 6,
            fontFamily: ed.typography.bodySm.fontFamily,
            fontSize: ed.typography.bodySm.fontSize,
            lineHeight: ed.typography.bodySm.lineHeight,
            color: ed.colors.ink2,
          }}
        >
          {body}
        </Text>
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
  const ed = useEditorialTheme();
  return (
    <View
      style={{
        flexDirection: 'row',
        alignItems: 'center',
        paddingVertical: 18,
        gap: 12,
      }}
    >
      <Text
        style={{
          flex: 1,
          fontFamily: ed.typography.label.fontFamily,
          fontSize: ed.typography.label.fontSize,
          letterSpacing: ed.typography.label.letterSpacing,
          color: ed.colors.ink3,
          textTransform: 'uppercase',
        }}
      >
        {label}
      </Text>
      <Pressable
        onPress={onMinus}
        accessibilityRole="button"
        accessibilityLabel={`Decrease ${label.toLowerCase()}`}
        hitSlop={8}
      >
        <Text
          style={{
            fontFamily: ed.typography.dataLg.fontFamily,
            fontSize: 22,
            color: ed.colors.ink3,
            paddingHorizontal: 10,
          }}
        >
          −
        </Text>
      </Pressable>
      <View style={{ flexDirection: 'row', alignItems: 'baseline' }}>
        <TextInput
          value={value}
          onChangeText={onChangeText}
          onBlur={onCommit}
          onSubmitEditing={onCommit}
          keyboardType="decimal-pad"
          returnKeyType="done"
          selectionColor={ed.colors.brand}
          style={{
            fontFamily: ed.fraunces('Fraunces_400Regular'),
            fontSize: 28,
            letterSpacing: -0.5,
            color: ed.colors.ink1,
            padding: 0,
            minWidth: 64,
            textAlign: 'right',
          }}
        />
        <Text
          style={{
            marginLeft: 6,
            fontFamily: ed.typography.label.fontFamily,
            fontSize: ed.typography.label.fontSize,
            letterSpacing: ed.typography.label.letterSpacing,
            color: ed.colors.ink3,
            textTransform: 'uppercase',
          }}
        >
          {unit}
        </Text>
      </View>
      <Pressable
        onPress={onPlus}
        accessibilityRole="button"
        accessibilityLabel={`Increase ${label.toLowerCase()}`}
        hitSlop={8}
      >
        <Text
          style={{
            fontFamily: ed.typography.dataLg.fontFamily,
            fontSize: 22,
            color: ed.colors.ink3,
            paddingHorizontal: 10,
          }}
        >
          +
        </Text>
      </Pressable>
    </View>
  );
}

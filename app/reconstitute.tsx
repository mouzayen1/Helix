// Reconstitute — editorial rebuild. Same data flow as the v1.2
// implementation (parseRecon, calc, createVial, co-reconstitute partner)
// — only the visual layer is re-skinned. Beginner walkthrough + peptide
// picker preserved; result block uses StatPair instead of an inverted
// black card; the syringe SVG is retinted to the editorial palette.
import { useLocalSearchParams, useRouter } from 'expo-router';
import { useEffect, useMemo, useState } from 'react';
import { Alert, Pressable, ScrollView, Switch, Text, TextInput, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { EditorialButton } from '../components/editorial/EditorialButton';
import { EditorialHeadline } from '../components/editorial/EditorialHeadline';
import { EyebrowLabel } from '../components/editorial/EyebrowLabel';
import { HairlineRow } from '../components/editorial/HairlineRow';
import { StatPair } from '../components/editorial/StatPair';
import { DosingDisclaimer } from '../components/Primitives';
import { SyringeDiagram } from '../components/SyringeDiagram';
import { getActiveCyclesByPeptide } from '../lib/cycle-helpers';
import { useEditorialTheme } from '../lib/design/theme';
import { useDoseUnitPref } from '../lib/profile-context';
import {
  formatDose,
  formatDoseLabel,
  parseDoseInput,
  resolveDoseUnit,
} from '../lib/dose-format';
import { attachVialToCycle, createVial, getActiveVial, type Cycle } from '../lib/db';
import { formatDuration } from '../lib/freq';
import { getPeptideExtras } from '../lib/peptide-extras';
import { derivePrimaryRoute, findPeptide, isInjectionRoute, PEPTIDES } from '../lib/peptides';

// Default vial-strength chip row. Peptides with `commonVialSizes` in the
// catalog override this — GHK-Cu shows 10/50/100/200, NAD+ shows
// 100/250/500/1000, etc.
const STRENGTH_PRESETS_DEFAULT = [2, 5, 10, 15];

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
  const { pref: doseUnitPref } = useDoseUnitPref();
  // cycleId is set when reconstitute is deep-linked from a cycle detail
  // page (alongside peptideId). The new vial auto-attaches to that cycle
  // so the user doesn't have to manually + ATTACH it afterward.
  const { peptideId: initialId, cycleId } = useLocalSearchParams<{
    peptideId?: string;
    cycleId?: string;
  }>();

  // Reconstitution is an injection-only workflow (mg + BAC water →
  // mg/mL concentration math). Non-injectable peptides — Selank
  // intranasal, MK-677 oral, GHK-Cu when used topically — ship in
  // capsules / pre-made nasal sprays / droppers and don't fit this
  // screen. Filter the picker to injectable peptides only and
  // silently redirect deep-links that arrive with a non-injectable
  // peptideId.
  const injectablePeptides = useMemo(
    () => PEPTIDES.filter((p) => isInjectionRoute(derivePrimaryRoute(p.route))),
    [],
  );
  const initialInjectable =
    initialId && injectablePeptides.some((p) => p.id === initialId)
      ? initialId
      : injectablePeptides[0]?.id ?? PEPTIDES[0].id;
  const [showPeptidePicker, setShowPeptidePicker] = useState(false);
  const [peptideId, setPeptideId] = useState<string>(initialInjectable);
  const [activeCycleByPeptide, setActiveCycleByPeptide] = useState<Map<string, Cycle>>(new Map());
  const [needyPeptides, setNeedyPeptides] = useState<Set<string>>(new Set());
  const [strengthMg, setStrengthMg] = useState(5);
  const [strengthText, setStrengthText] = useState('5');
  const [bacMl, setBacMl] = useState(2);
  const [bacText, setBacText] = useState('2');
  const [targetDoseMcg, setTargetDoseMcg] = useState(250);
  const [targetDoseText, setTargetDoseText] = useState('250');
  // Reconstitute is a "passive" context — no chip, but the displayed
  // unit follows the global pref. Recompute on every relevant change.
  const targetDoseUnit = resolveDoseUnit(targetDoseMcg, doseUnitPref);
  useEffect(() => {
    setTargetDoseText(formatDose(targetDoseMcg, targetDoseUnit).value);
  }, [targetDoseMcg, targetDoseUnit]);
  const [beginnerMode, setBeginnerMode] = useState(false);
  const [coReconstitutePartner, setCoReconstitutePartner] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  // v1.2 reverse-calc mode. Forward computes the dose volume from chosen
  // BAC. Reverse flips: pick a clean target draw (e.g. 20u) and the app
  // solves for the BAC needed to make that draw produce the target dose.
  //   forward:  units = (dose_mcg / 1000) * BAC / strength * 100
  //   reverse:  BAC   = units * strength * 10 / dose_mcg
  const [calcMode, setCalcMode] = useState<'forward' | 'reverse'>('forward');
  const [targetUnits, setTargetUnits] = useState(20);
  const [targetUnitsText, setTargetUnitsText] = useState('20');

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

  // Pull active-cycle peptide list once on mount; figure out which of those
  // peptides still need a vial. The picker uses this to pin "needed" pids
  // at the top with a NEEDED pill, and to default-select the first needy
  // peptide if no `?peptideId=` was passed.
  useEffect(() => {
    let cancelled = false;
    (async () => {
      const byPeptide = await getActiveCyclesByPeptide();
      if (cancelled) return;
      setActiveCycleByPeptide(byPeptide);
      const needs = new Set<string>();
      for (const pid of byPeptide.keys()) {
        const v = await getActiveVial(pid);
        if (!v || v.remaining_mg <= 0) needs.add(pid);
      }
      if (cancelled) return;
      setNeedyPeptides(needs);
      if (!initialId && needs.size > 0) {
        const first = Array.from(needs)[0];
        setPeptideId(first);
      }
    })();
    return () => {
      cancelled = true;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Sorted peptide list for the picker — needed (no vial) first, then
  // needed (with vial), then everything else. Restricted to
  // injectable peptides (see comment above injectablePeptides).
  const sortedPeptides = useMemo(() => {
    const bucket = (id: string) => {
      if (needyPeptides.has(id)) return 0;
      if (activeCycleByPeptide.has(id)) return 1;
      return 2;
    };
    return [...injectablePeptides].sort((a, b) => bucket(a.id) - bucket(b.id));
  }, [activeCycleByPeptide, injectablePeptides, needyPeptides]);

  // Reverse mode: BAC water is computed from (target dose, target units,
  // vial strength) and synced into bacMl so save() / result block / soft
  // warn tier all read the same value. Switching back to forward leaves
  // the user's last computed value in place.
  useEffect(() => {
    if (calcMode !== 'reverse') return;
    if (targetUnits <= 0 || targetDoseMcg <= 0 || strengthMg <= 0) return;
    const computed = (targetUnits * strengthMg * 10) / targetDoseMcg;
    if (!isFinite(computed) || computed <= 0) return;
    const rounded = Math.round(computed * 100) / 100;
    setBacMl(rounded);
    setBacText(String(rounded));
  }, [calcMode, targetUnits, targetDoseMcg, strengthMg]);

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
      const newVialId = await createVial({
        peptide_id: peptideId,
        strength_mg: strengthMg,
        bac_water_ml: bacMl,
      });
      // Auto-attach to the originating cycle. Guarded on the peptide still
      // matching the one the cycle deep-linked for — if the user switched
      // peptides in the picker, the cycle context no longer applies and a
      // wrong attachment would be worse than none (manual + ATTACH remains).
      if (cycleId && peptideId === initialId) {
        await attachVialToCycle(newVialId, cycleId);
      }
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
                {sortedPeptides.map((p, idx) => {
                  const needed = needyPeptides.has(p.id);
                  const inActiveCycle = activeCycleByPeptide.has(p.id);
                  return (
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
                        {needed ? (
                          <Text
                            style={{
                              fontFamily: ed.typography.labelSm.fontFamily,
                              fontSize: ed.typography.labelSm.fontSize,
                              letterSpacing: ed.typography.labelSm.letterSpacing,
                              color: ed.colors.brand,
                              textTransform: 'uppercase',
                            }}
                          >
                            ★ Needed
                          </Text>
                        ) : inActiveCycle ? (
                          <Text
                            style={{
                              fontFamily: ed.typography.labelSm.fontFamily,
                              fontSize: ed.typography.labelSm.fontSize,
                              letterSpacing: ed.typography.labelSm.letterSpacing,
                              color: ed.colors.ink3,
                              textTransform: 'uppercase',
                            }}
                          >
                            In cycle
                          </Text>
                        ) : (
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
                        )}
                      </Pressable>
                      {idx < sortedPeptides.length - 1 ? <HairlineRow /> : null}
                    </View>
                  );
                })}
              </ScrollView>
            </View>
          ) : null}
          {/* Research range — passive dose-range reminder pulled from
              the catalog. Same string Log Dose surfaces. Helps users
              think about target dose before they pick a vial strength
              and BAC volume. */}
          {peptide.dose ? (
            <Text
              style={{
                marginTop: 12,
                fontFamily: ed.typography.dataMd.fontFamily,
                fontSize: ed.typography.dataMd.fontSize,
                color: ed.colors.ink3,
              }}
            >
              Research range: {peptide.dose}
            </Text>
          ) : null}
        </View>

        {/* Vial strength presets */}
        <View style={{ marginTop: 28, paddingHorizontal: 24 }}>
          <EyebrowLabel withRule>Vial strength</EyebrowLabel>
          <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 8, marginTop: 16 }}>
            {(peptide.commonVialSizes ?? STRENGTH_PRESETS_DEFAULT).map((s) => {
              const active = s === strengthMg;
              return (
                <Pressable
                  key={s}
                  onPress={() => {
                    setStrengthMg(s);
                    setStrengthText(String(s));
                  }}
                  style={{
                    flexBasis: '22%',
                    flexGrow: 1,
                    paddingVertical: 14,
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

        {/* Calc-mode toggle. Forward = "I'm putting X mg in Y mL, what
            dose do I get?" Reverse = "I want a Z mcg dose at N units,
            how much BAC do I add?" Reverse is a research-grade feature —
            only PeptideFox had it before now. */}
        <View style={{ marginTop: 28, paddingHorizontal: 24 }}>
          <EyebrowLabel withRule>Calculator</EyebrowLabel>
          <View style={{ flexDirection: 'row', gap: 6, marginTop: 14 }}>
            {(['forward', 'reverse'] as const).map((m) => {
              const on = calcMode === m;
              const label = m === 'forward' ? 'Calc concentration' : 'Find ideal BAC';
              return (
                <Pressable
                  key={m}
                  onPress={() => setCalcMode(m)}
                  accessibilityRole="tab"
                  accessibilityState={{ selected: on }}
                  accessibilityLabel={label}
                  style={{
                    flex: 1,
                    paddingVertical: 12,
                    alignItems: 'center',
                    backgroundColor: on ? ed.colors.ink1 : 'transparent',
                    borderWidth: 1,
                    borderColor: on ? ed.colors.ink1 : ed.colors.lineStrong,
                  }}
                >
                  <Text
                    style={{
                      fontFamily: ed.typography.labelSm.fontFamily,
                      fontSize: ed.typography.labelSm.fontSize,
                      letterSpacing: ed.typography.labelSm.letterSpacing,
                      color: on ? ed.colors.bg : ed.colors.ink2,
                      textTransform: 'uppercase',
                    }}
                  >
                    {label}
                  </Text>
                </Pressable>
              );
            })}
          </View>
          {calcMode === 'reverse' ? (
            <Text
              style={{
                marginTop: 10,
                fontFamily: ed.fraunces('Fraunces_400Regular_Italic'),
                fontSize: 13,
                lineHeight: 19,
                color: ed.colors.ink3,
              }}
            >
              Pick the dose you want and how many units to draw — the app solves for the BAC water needed.
            </Text>
          ) : null}
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
            readOnly={calcMode === 'reverse'}
            readOnlyHint={
              calcMode === 'reverse' ? 'Solved from your target dose and target draw.' : undefined
            }
          />
          {/* Soft capacity hint — vial physical capacity isn't knowable
              from peptide data alone. Silent ≤3 mL (most common). */}
          {bacMl > 5 ? (
            <Text
              style={{
                marginTop: 6,
                marginBottom: 8,
                fontFamily: ed.typography.labelSm.fontFamily,
                fontSize: ed.typography.labelSm.fontSize,
                letterSpacing: ed.typography.labelSm.letterSpacing,
                color: ed.colors.stateWarn,
                textTransform: 'uppercase',
              }}
            >
              Most peptide vials hold 2–5 mL. Verify yours fits this volume.
            </Text>
          ) : bacMl > 3 ? (
            <Text
              style={{
                marginTop: 6,
                marginBottom: 8,
                fontFamily: ed.typography.labelSm.fontFamily,
                fontSize: ed.typography.labelSm.fontSize,
                letterSpacing: ed.typography.labelSm.letterSpacing,
                color: ed.colors.ink3,
                textTransform: 'uppercase',
              }}
            >
              Most vials hold 2–5 mL — verify yours fits.
            </Text>
          ) : null}
          <HairlineRow />
          <TypedField
            label="Target dose"
            unit={targetDoseUnit}
            value={targetDoseText}
            onChangeText={setTargetDoseText}
            onCommit={() => {
              // Parse in the displayed unit so the user can type "1" in mg
              // mode and get 1000 mcg back. Fall back to current value on
              // out-of-range or bad input.
              const parsed = parseDoseInput(targetDoseText, targetDoseUnit);
              if (parsed === null || parsed < 1 || parsed > 500000) {
                setTargetDoseText(formatDose(targetDoseMcg, targetDoseUnit).value);
              } else {
                setTargetDoseMcg(parsed);
              }
            }}
            onMinus={() => setTargetDoseMcg(Math.max(1, targetDoseMcg - 25))}
            onPlus={() => setTargetDoseMcg(Math.min(500000, targetDoseMcg + 25))}
          />
          {calcMode === 'reverse' ? (
            <>
              <HairlineRow />
              <TypedField
                label="Target draw"
                unit="units"
                value={targetUnitsText}
                onChangeText={setTargetUnitsText}
                onCommit={() =>
                  commitNum(targetUnitsText, setTargetUnits, setTargetUnitsText, 1, 100, targetUnits)
                }
                onMinus={() => {
                  const v = Math.max(1, targetUnits - 5);
                  setTargetUnits(v);
                  setTargetUnitsText(String(v));
                }}
                onPlus={() => {
                  const v = Math.min(100, targetUnits + 5);
                  setTargetUnits(v);
                  setTargetUnitsText(String(v));
                }}
              />
            </>
          ) : null}
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
                label: `Per ${formatDoseLabel(targetDoseMcg, doseUnitPref)}`,
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
              = {calc.volMlPerDose.toFixed(3)} mL · {formatDoseLabel(targetDoseMcg, doseUnitPref)} per dose
            </Text>
          </View>
          {/* Calibrated syringe — auto-picks the smallest U-100 barrel
              that fits the dose, draws ticks at 1u/5u/10u with numeric
              labels, and shows the plunger arrow under the fill. */}
          <View style={{ marginTop: 20 }}>
            <SyringeDiagram unitsToDraw={calc.unitsPerDose} />
          </View>
          {/* Split-draw guidance for >100u doses. */}
          {calc.unitsPerDose > 100 ? (
            <Text
              style={{
                marginTop: 10,
                fontFamily: ed.fraunces('Fraunces_400Regular_Italic'),
                fontSize: 13,
                lineHeight: 19,
                color: ed.colors.stateWarn,
              }}
            >
              Doesn't fit in one syringe — split into two draws of{' '}
              {(calc.unitsPerDose / 2).toFixed(1)} units each.
            </Text>
          ) : calc.unitsPerDose > 0 && calc.unitsPerDose < 5 ? (
            <Text
              style={{
                marginTop: 10,
                fontFamily: ed.fraunces('Fraunces_400Regular_Italic'),
                fontSize: 13,
                lineHeight: 19,
                color: ed.colors.ink3,
              }}
            >
              Tiny draw — a 30u (0.3 mL) insulin syringe gives the cleanest precision.
            </Text>
          ) : null}
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
  readOnly,
  readOnlyHint,
}: {
  label: string;
  unit: string;
  value: string;
  onChangeText: (s: string) => void;
  onCommit: () => void;
  onMinus: () => void;
  onPlus: () => void;
  readOnly?: boolean;
  readOnlyHint?: string;
}) {
  const ed = useEditorialTheme();
  const valueColor = readOnly ? ed.colors.ink3 : ed.colors.ink1;
  return (
    <View style={{ paddingVertical: 18 }}>
      <View style={{ flexDirection: 'row', alignItems: 'center', gap: 12 }}>
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
          disabled={readOnly}
          accessibilityRole="button"
          accessibilityLabel={`Decrease ${label.toLowerCase()}`}
          hitSlop={8}
        >
          <Text
            style={{
              fontFamily: ed.typography.dataLg.fontFamily,
              fontSize: 22,
              color: readOnly ? ed.colors.ink4 : ed.colors.ink3,
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
            editable={!readOnly}
            selectionColor={ed.colors.brand}
            style={{
              fontFamily: ed.fraunces('Fraunces_400Regular'),
              fontSize: 28,
              letterSpacing: -0.5,
              color: valueColor,
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
          disabled={readOnly}
          accessibilityRole="button"
          accessibilityLabel={`Increase ${label.toLowerCase()}`}
          hitSlop={8}
        >
          <Text
            style={{
              fontFamily: ed.typography.dataLg.fontFamily,
              fontSize: 22,
              color: readOnly ? ed.colors.ink4 : ed.colors.ink3,
              paddingHorizontal: 10,
            }}
          >
            +
          </Text>
        </Pressable>
      </View>
      {readOnly && readOnlyHint ? (
        <Text
          style={{
            marginTop: 6,
            fontFamily: ed.fraunces('Fraunces_400Regular_Italic'),
            fontSize: 12,
            color: ed.colors.ink3,
          }}
        >
          {readOnlyHint}
        </Text>
      ) : null}
    </View>
  );
}

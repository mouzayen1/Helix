// Peptide detail — editorial rebuild. Drops the colored hero block in
// favor of a colored hairline above the title; quick facts grid is
// replaced with a hairline-divided DataRow list; cycle template uses
// the PhaseTimeline primitive (its first proper home); citations use
// hanging serif index marks. Tabs are mono uppercase with a hairline
// rule beneath the active label. Save toggles a star eyebrow.
import * as Linking from 'expo-linking';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { useCallback, useEffect, useMemo, useState } from 'react';
import { Pressable, ScrollView, Text, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { EditorialButton } from '../../components/editorial/EditorialButton';
import { EditorialHeadline } from '../../components/editorial/EditorialHeadline';
import { EyebrowLabel } from '../../components/editorial/EyebrowLabel';
import { HairlineRow } from '../../components/editorial/HairlineRow';
import { PhaseTimeline } from '../../components/editorial/PhaseTimeline';
import { useEditorialTheme } from '../../lib/design/theme';
import { isSaved, savePeptide, unsavePeptide } from '../../lib/db';
import {
  DISCLAIMER_BEGINNER,
  DISCLAIMER_CITATION_FOOTER,
  DISCLAIMER_SHORT,
} from '../../lib/disclaimers';
import { getPeptideExtras } from '../../lib/peptide-extras';
import { derivePrimaryRoute, findPeptide, isInjectionRoute, PEPTIDES } from '../../lib/peptides';

type TabId = 'overview' | 'dosing' | 'research' | 'notes';

function resolvePartnerId(label: string): string | null {
  const lower = label.toLowerCase().trim();
  const exact = PEPTIDES.find((p) => p.name.toLowerCase() === lower);
  if (exact) return exact.id;
  const lenient = PEPTIDES.find(
    (p) =>
      lower.includes(p.name.toLowerCase()) ||
      p.name.toLowerCase().includes(lower.split(' ')[0])
  );
  return lenient?.id ?? null;
}

export default function PeptideDetailScreen() {
  const ed = useEditorialTheme();
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const { id } = useLocalSearchParams<{ id: string }>();
  const p = findPeptide(id ?? '');
  const extras = p ? getPeptideExtras(p.id) : undefined;
  const [tab, setTab] = useState<TabId>('overview');
  const [saved, setSaved] = useState(false);

  const refreshSaved = useCallback(async () => {
    if (!p) return;
    setSaved(await isSaved(p.id));
  }, [p]);

  useEffect(() => {
    refreshSaved();
  }, [refreshSaved]);

  const stackPartnerLinks = useMemo(
    () => (p?.stacks ?? []).map((s) => ({ label: s, id: resolvePartnerId(s) })),
    [p?.stacks]
  );

  if (!p) {
    return (
      <View
        style={{
          flex: 1,
          backgroundColor: ed.colors.bg,
          paddingTop: insets.top + 24,
          paddingHorizontal: 24,
        }}
      >
        <Pressable onPress={() => router.back()} hitSlop={10}>
          <Text
            style={{
              fontFamily: ed.fraunces('Fraunces_300Light'),
              fontSize: 26,
              color: ed.colors.ink2,
            }}
          >
            ←
          </Text>
        </Pressable>
        <Text
          style={{
            marginTop: 36,
            fontFamily: ed.fraunces('Fraunces_400Regular_Italic'),
            fontSize: 22,
            color: ed.colors.ink2,
          }}
        >
          Peptide not found.
        </Text>
      </View>
    );
  }

  const toggleSave = async () => {
    if (saved) await unsavePeptide(p.id);
    else await savePeptide(p.id);
    refreshSaved();
  };

  const mechParagraphs = p.mechanism
    ? p.mechanism.split(/\n\s*\n/).map((s) => s.trim()).filter(Boolean)
    : [];

  return (
    <ScrollView
      style={{ flex: 1, backgroundColor: ed.colors.bg }}
      contentContainerStyle={{ paddingBottom: insets.bottom + 64 }}
      showsVerticalScrollIndicator={false}
    >
      {/* Top bar */}
      <View
        style={{
          paddingTop: insets.top + 12,
          paddingBottom: 12,
          paddingHorizontal: 24,
          flexDirection: 'row',
          justifyContent: 'space-between',
          alignItems: 'center',
        }}
      >
        <Pressable onPress={() => router.back()} hitSlop={10}>
          <Text
            style={{
              fontFamily: ed.fraunces('Fraunces_300Light'),
              fontSize: 26,
              color: ed.colors.ink2,
              lineHeight: 26,
            }}
          >
            ←
          </Text>
        </Pressable>
        <Pressable onPress={toggleSave} hitSlop={6}>
          <Text
            style={{
              fontFamily: ed.typography.label.fontFamily,
              fontSize: ed.typography.label.fontSize,
              letterSpacing: ed.typography.label.letterSpacing,
              color: saved ? ed.colors.brand : ed.colors.ink3,
              textTransform: 'uppercase',
            }}
          >
            {saved ? '★ Saved' : '☆ Save'}
          </Text>
        </Pressable>
      </View>

      {/* Title block — colored hairline above class eyebrow + serif name */}
      <View style={{ paddingHorizontal: 24 }}>
        <View style={{ height: 2, backgroundColor: p.color, marginBottom: 18, width: 56 }} />
        <Text
          style={{
            fontFamily: ed.typography.eyebrow.fontFamily,
            fontSize: ed.typography.eyebrow.fontSize,
            letterSpacing: ed.typography.eyebrow.letterSpacing,
            color: p.color,
            textTransform: 'uppercase',
            marginBottom: 14,
          }}
        >
          {p.class}
        </Text>
        <EditorialHeadline size="display">{p.name}</EditorialHeadline>
        <Text
          style={{
            marginTop: 12,
            fontFamily: ed.fraunces('Fraunces_400Regular_Italic'),
            fontSize: 17,
            lineHeight: 24,
            color: ed.colors.ink2,
          }}
        >
          {p.subtitle}
        </Text>
        <Text
          style={{
            marginTop: 14,
            fontFamily: ed.typography.dataMd.fontFamily,
            fontSize: ed.typography.dataMd.fontSize,
            color: ed.colors.ink3,
          }}
        >
          {p.formula} · {p.mw} · t½ {p.halfLife}
        </Text>
        <Text
          style={{
            marginTop: 8,
            fontFamily: ed.typography.labelSm.fontFamily,
            fontSize: ed.typography.labelSm.fontSize,
            letterSpacing: ed.typography.labelSm.letterSpacing,
            color: ed.colors.stateWarn,
            textTransform: 'uppercase',
          }}
        >
          Not FDA-approved · research only
        </Text>
      </View>

      {/* Quick facts — hairline-divided DataRow list. */}
      <View style={{ marginTop: 28, paddingHorizontal: 24 }}>
        <HairlineRow strong />
        {[
          { label: 'Dose · research', val: p.dose || '—' },
          { label: 'Frequency', val: p.freq || '—' },
          { label: 'Route', val: p.route || '—' },
          { label: 'Half-life', val: p.halfLife || '—' },
        ].map((f, idx, arr) => (
          <View key={f.label}>
            <View
              style={{
                flexDirection: 'row',
                alignItems: 'baseline',
                paddingVertical: 16,
                gap: 14,
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
                {f.label}
              </Text>
              <Text
                style={{
                  flex: 2,
                  fontFamily: ed.fraunces('Fraunces_400Regular'),
                  fontSize: 17,
                  letterSpacing: -0.2,
                  color: ed.colors.ink1,
                  textAlign: 'right',
                }}
              >
                {f.val}
              </Text>
            </View>
            {idx < arr.length - 1 ? <HairlineRow /> : null}
          </View>
        ))}
        <HairlineRow strong />
      </View>

      {/* Suggested reconstitution */}
      {p.reconstitution ? (
        <View style={{ marginTop: 24, paddingHorizontal: 24 }}>
          <EyebrowLabel withRule>Suggested reconstitution</EyebrowLabel>
          <Text
            style={{
              marginTop: 14,
              fontFamily: ed.typography.dataLg.fontFamily,
              fontSize: 18,
              lineHeight: 26,
              color: ed.colors.ink1,
            }}
          >
            {p.reconstitution}
          </Text>
        </View>
      ) : null}

      {/* Tabs */}
      <View
        style={{
          flexDirection: 'row',
          paddingHorizontal: 24,
          marginTop: 32,
          borderBottomWidth: 1,
          borderBottomColor: ed.colors.line,
        }}
      >
        {(['overview', 'dosing', 'research', 'notes'] as TabId[]).map((tid) => {
          const active = tid === tab;
          return (
            <Pressable
              key={tid}
              onPress={() => setTab(tid)}
              style={{
                paddingVertical: 14,
                marginRight: 24,
                borderBottomWidth: 2,
                borderBottomColor: active ? ed.colors.ink1 : 'transparent',
                marginBottom: -1,
              }}
            >
              <Text
                style={{
                  fontFamily: ed.typography.label.fontFamily,
                  fontSize: ed.typography.label.fontSize,
                  letterSpacing: ed.typography.label.letterSpacing,
                  color: active ? ed.colors.ink1 : ed.colors.ink3,
                  textTransform: 'uppercase',
                }}
              >
                {tid}
              </Text>
            </Pressable>
          );
        })}
      </View>

      {/* OVERVIEW */}
      {tab === 'overview' ? (
        <View style={{ paddingHorizontal: 24, marginTop: 24, gap: 28 }}>
          {/* MIGRATED LAYOUT — when extras.overview.whatItDoes exists,
              Overview becomes the friendly orientation layer. Side
              effects + contraindications move here from Research. */}
          {extras?.overview?.whatItDoes ? (
            <>
              <View>
                <EyebrowLabel withRule>What it does</EyebrowLabel>
                <Text
                  style={{
                    marginTop: 14,
                    fontFamily: ed.fraunces('Fraunces_400Regular'),
                    fontSize: 17,
                    lineHeight: 26,
                    color: ed.colors.ink2,
                  }}
                >
                  {extras.overview.whatItDoes}
                </Text>
              </View>
              {extras.sideEffects?.length ? (
                <View>
                  <EyebrowLabel withRule>Side effects</EyebrowLabel>
                  <View
                    style={{
                      marginTop: 14,
                      borderTopWidth: 1,
                      borderBottomWidth: 1,
                      borderColor: ed.colors.stateModerate,
                      paddingVertical: 14,
                      gap: 8,
                    }}
                  >
                    {extras.sideEffects.map((s) => (
                      <Text
                        key={s}
                        style={{
                          fontFamily: ed.typography.bodyMd.fontFamily,
                          fontSize: 14,
                          lineHeight: 21,
                          color: ed.colors.ink2,
                        }}
                      >
                        · {s}
                      </Text>
                    ))}
                  </View>
                  <Text
                    style={{
                      marginTop: 8,
                      fontFamily: ed.fraunces('Fraunces_400Regular_Italic'),
                      fontSize: 13,
                      lineHeight: 19,
                      color: ed.colors.ink3,
                    }}
                  >
                    Not a complete list. Reactions vary person to person.
                  </Text>
                </View>
              ) : null}
              {extras.contraindications?.length ? (
                <View>
                  <EyebrowLabel withRule>Contraindications</EyebrowLabel>
                  <View
                    style={{
                      marginTop: 14,
                      borderTopWidth: 1,
                      borderBottomWidth: 1,
                      borderColor: ed.colors.stateWarn,
                      paddingVertical: 14,
                      gap: 8,
                    }}
                  >
                    {extras.contraindications.map((c) => (
                      <Text
                        key={c}
                        style={{
                          fontFamily: ed.typography.bodyMd.fontFamily,
                          fontSize: 14,
                          lineHeight: 21,
                          color: ed.colors.ink2,
                        }}
                      >
                        ✕ {c}
                      </Text>
                    ))}
                  </View>
                  {/* Attorney-reviewed single-source disclaimer string.
                      Italic ink3, hairline-separated, NOT an eyebrow —
                      reads as fine-print attached to the section above,
                      not a separate categorical block. */}
                  <View
                    style={{
                      marginTop: 12,
                      paddingTop: 12,
                      borderTopWidth: 1,
                      borderTopColor: ed.colors.line,
                    }}
                  >
                    <Text
                      style={{
                        fontFamily: ed.fraunces('Fraunces_400Regular_Italic'),
                        fontSize: 13,
                        lineHeight: 19,
                        color: ed.colors.ink3,
                      }}
                    >
                      {DISCLAIMER_SHORT}
                    </Text>
                  </View>
                </View>
              ) : null}
              {extras.overview.storage ? (
                <View>
                  <EyebrowLabel withRule>Storage</EyebrowLabel>
                  <View style={{ marginTop: 14, gap: 16 }}>
                    <View>
                      <Text
                        style={{
                          fontFamily: ed.typography.labelSm.fontFamily,
                          fontSize: ed.typography.labelSm.fontSize,
                          letterSpacing: ed.typography.labelSm.letterSpacing,
                          color: ed.colors.brand,
                          textTransform: 'uppercase',
                          marginBottom: 6,
                        }}
                      >
                        Before mixing
                      </Text>
                      <Text
                        style={{
                          fontFamily: ed.typography.bodyMd.fontFamily,
                          fontSize: 14,
                          lineHeight: 21,
                          color: ed.colors.ink2,
                        }}
                      >
                        {extras.overview.storage.beforeMixing}
                      </Text>
                    </View>
                    <View>
                      <Text
                        style={{
                          fontFamily: ed.typography.labelSm.fontFamily,
                          fontSize: ed.typography.labelSm.fontSize,
                          letterSpacing: ed.typography.labelSm.letterSpacing,
                          color: ed.colors.brand,
                          textTransform: 'uppercase',
                          marginBottom: 6,
                        }}
                      >
                        After mixing
                      </Text>
                      <Text
                        style={{
                          fontFamily: ed.typography.bodyMd.fontFamily,
                          fontSize: 14,
                          lineHeight: 21,
                          color: ed.colors.ink2,
                        }}
                      >
                        {extras.overview.storage.afterMixing}
                      </Text>
                    </View>
                    {extras.overview.storage.handling ? (
                      <View>
                        <Text
                          style={{
                            fontFamily: ed.typography.labelSm.fontFamily,
                            fontSize: ed.typography.labelSm.fontSize,
                            letterSpacing: ed.typography.labelSm.letterSpacing,
                            color: ed.colors.brand,
                            textTransform: 'uppercase',
                            marginBottom: 6,
                          }}
                        >
                          Handling
                        </Text>
                        <Text
                          style={{
                            fontFamily: ed.typography.bodyMd.fontFamily,
                            fontSize: 14,
                            lineHeight: 21,
                            color: ed.colors.ink2,
                          }}
                        >
                          {extras.overview.storage.handling}
                        </Text>
                      </View>
                    ) : null}
                  </View>
                </View>
              ) : null}
            </>
          ) : (
            /* LEGACY LAYOUT — peptides without authored overview content
               keep the v1.3 Overview structure (sequence + research
               summary + benefits). Side effects + contraindications
               stay on Research for these peptides. */
            <>
              {p.sequence ? (
                <View>
                  <EyebrowLabel withRule>Sequence</EyebrowLabel>
                  <Text
                    style={{
                      marginTop: 12,
                      fontFamily: ed.typography.dataMd.fontFamily,
                      fontSize: 13,
                      lineHeight: 20,
                      color: ed.colors.ink2,
                    }}
                  >
                    {p.sequence}
                  </Text>
                </View>
              ) : null}
              <View>
                <EyebrowLabel withRule>Research summary</EyebrowLabel>
                <Text
                  style={{
                    marginTop: 14,
                    fontFamily: ed.fraunces('Fraunces_400Regular'),
                    fontSize: 17,
                    lineHeight: 26,
                    color: ed.colors.ink2,
                  }}
                >
                  {p.summary || 'Research summary is being prepared for this entry.'}
                </Text>
              </View>
              {extras?.benefits ? (
                <View>
                  <EyebrowLabel withRule>What this peptide is for</EyebrowLabel>
                  <Text
                    style={{
                      marginTop: 14,
                      fontFamily: ed.typography.bodyMd.fontFamily,
                      fontSize: 15,
                      lineHeight: 23,
                      color: ed.colors.ink2,
                    }}
                  >
                    {extras.benefits}
                  </Text>
                </View>
              ) : null}
            </>
          )}
          {stackPartnerLinks.length > 0 ? (
            <View>
              <EyebrowLabel withRule>Common stack partners</EyebrowLabel>
              <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 6, marginTop: 14 }}>
                {stackPartnerLinks.map(({ label, id: pid }) => {
                  const isLink = !!pid;
                  const Wrap: any = isLink ? Pressable : View;
                  return (
                    <Wrap
                      key={label}
                      onPress={isLink ? () => router.push(`/peptide/${pid}` as any) : undefined}
                      style={{
                        paddingVertical: 8,
                        paddingHorizontal: 12,
                        borderWidth: 1,
                        borderColor: isLink ? ed.colors.brandLine : ed.colors.lineStrong,
                      }}
                    >
                      <Text
                        style={{
                          fontFamily: ed.typography.labelSm.fontFamily,
                          fontSize: ed.typography.labelSm.fontSize,
                          letterSpacing: ed.typography.labelSm.letterSpacing,
                          color: isLink ? ed.colors.brand : ed.colors.ink3,
                          textTransform: 'uppercase',
                        }}
                      >
                        {label}
                      </Text>
                    </Wrap>
                  );
                })}
              </View>
            </View>
          ) : null}
        </View>
      ) : null}

      {/* DOSING */}
      {tab === 'dosing' ? (
        <View style={{ paddingHorizontal: 24, marginTop: 24, gap: 28 }}>
          <View>
            <EyebrowLabel withRule>Research range</EyebrowLabel>
            <Text
              style={{
                marginTop: 12,
                fontFamily: ed.fraunces('Fraunces_300Light'),
                fontSize: 36,
                lineHeight: 38,
                letterSpacing: -1,
                color: ed.colors.ink1,
              }}
            >
              {p.dose || '—'}
            </Text>
            <Text
              style={{
                marginTop: 8,
                fontFamily: ed.typography.dataMd.fontFamily,
                fontSize: ed.typography.dataMd.fontSize,
                color: ed.colors.ink2,
              }}
            >
              {p.freq} · {p.route}
            </Text>
          </View>

          {extras?.beginnerProtocol ? (
            <View>
              <EyebrowLabel withRule>Beginner protocol</EyebrowLabel>
              <Text
                style={{
                  marginTop: 14,
                  fontFamily: ed.fraunces('Fraunces_400Regular_Italic'),
                  fontSize: 14,
                  lineHeight: 21,
                  color: ed.colors.stateWarn,
                }}
              >
                {DISCLAIMER_BEGINNER}
              </Text>
              <Text
                style={{
                  marginTop: 12,
                  fontFamily: ed.typography.bodyMd.fontFamily,
                  fontSize: 15,
                  lineHeight: 23,
                  color: ed.colors.ink2,
                }}
              >
                {extras.beginnerProtocol}
              </Text>
            </View>
          ) : null}

          {extras?.cycleTemplate ? (
            <View>
              <EyebrowLabel withRule>Suggested cycle</EyebrowLabel>
              <Text
                style={{
                  marginTop: 14,
                  fontFamily: ed.fraunces('Fraunces_400Regular'),
                  fontSize: 19,
                  letterSpacing: -0.3,
                  color: ed.colors.ink1,
                }}
              >
                {extras.cycleTemplate.duration_weeks > 0
                  ? `${extras.cycleTemplate.duration_weeks}-week cycle`
                  : 'As-needed (no continuous cycle)'}
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
                {extras.cycleTemplate.phase_notes}
              </Text>
              {extras.cycleTemplate.phases && extras.cycleTemplate.phases.length > 0 ? (
                <PhaseTimeline
                  phases={extras.cycleTemplate.phases.map((ph) => ({
                    name: ph.name,
                    days: Math.max(1, ph.weeks * 7),
                  }))}
                  currentDay={0}
                />
              ) : (
                <Text
                  style={{
                    marginTop: 10,
                    fontFamily: ed.typography.dataMd.fontFamily,
                    fontSize: ed.typography.dataMd.fontSize,
                    lineHeight: 20,
                    color: ed.colors.ink3,
                  }}
                >
                  {extras.cycleTemplate.schedule}
                </Text>
              )}
              {extras.cycleTemplate.phases?.some((ph) => ph.dose_modifier) ? (
                <View style={{ marginTop: 10, gap: 4 }}>
                  {extras.cycleTemplate.phases.map((ph, i) =>
                    ph.dose_modifier ? (
                      <Text
                        key={i}
                        style={{
                          fontFamily: ed.typography.dataMd.fontFamily,
                          fontSize: 13,
                          color: ed.colors.ink3,
                        }}
                      >
                        <Text style={{ color: ed.colors.ink2 }}>{ph.name}.</Text>{' '}
                        {ph.dose_modifier}
                      </Text>
                    ) : null
                  )}
                </View>
              ) : null}
            </View>
          ) : null}

          {extras?.timing ? (
            <View>
              <EyebrowLabel withRule>Best timing</EyebrowLabel>
              <Text
                style={{
                  marginTop: 14,
                  fontFamily: ed.typography.bodyMd.fontFamily,
                  fontSize: 15,
                  lineHeight: 23,
                  color: ed.colors.ink2,
                }}
              >
                {extras.timing}
              </Text>
            </View>
          ) : null}

          {extras?.proTips && extras.proTips.length > 0 ? (
            <View>
              <EyebrowLabel withRule>Pro tips</EyebrowLabel>
              <View style={{ marginTop: 12, gap: 10 }}>
                {extras.proTips.map((tip, i) => (
                  <View key={i} style={{ flexDirection: 'row', gap: 12 }}>
                    <Text
                      style={{
                        fontFamily: ed.fraunces('Fraunces_300Light'),
                        fontSize: 18,
                        color: ed.colors.brand,
                        lineHeight: 22,
                      }}
                    >
                      {i + 1}
                    </Text>
                    <Text
                      style={{
                        flex: 1,
                        fontFamily: ed.typography.bodyMd.fontFamily,
                        fontSize: 14,
                        lineHeight: 21,
                        color: ed.colors.ink2,
                      }}
                    >
                      {tip}
                    </Text>
                  </View>
                ))}
              </View>
            </View>
          ) : null}

          {extras?.commonMistakes && extras.commonMistakes.length > 0 ? (
            <View>
              <Text
                style={{
                  fontFamily: ed.typography.label.fontFamily,
                  fontSize: ed.typography.label.fontSize,
                  letterSpacing: ed.typography.label.letterSpacing,
                  color: ed.colors.stateWarn,
                  textTransform: 'uppercase',
                  marginBottom: 12,
                }}
              >
                Common mistakes
              </Text>
              <View
                style={{
                  borderTopWidth: 1,
                  borderBottomWidth: 1,
                  borderColor: ed.colors.stateWarn,
                  paddingVertical: 14,
                  gap: 8,
                }}
              >
                {extras.commonMistakes.map((m, i) => (
                  <Text
                    key={i}
                    style={{
                      fontFamily: ed.typography.bodyMd.fontFamily,
                      fontSize: 14,
                      lineHeight: 21,
                      color: ed.colors.ink2,
                    }}
                  >
                    × {m}
                  </Text>
                ))}
              </View>
            </View>
          ) : null}

          <Text
            style={{
              fontFamily: ed.typography.bodySm.fontFamily,
              fontSize: ed.typography.bodySm.fontSize,
              lineHeight: ed.typography.bodySm.lineHeight,
              color: ed.colors.ink3,
            }}
          >
            {DISCLAIMER_CITATION_FOOTER}
          </Text>
        </View>
      ) : null}

      {/* RESEARCH */}
      {tab === 'research' ? (
        <View style={{ paddingHorizontal: 24, marginTop: 24, gap: 28 }}>
          {/* When migrated, sequence + p.summary move here from Overview
              so the technical content has a home. Legacy peptides keep
              these on Overview and skip this block. */}
          {extras?.overview?.whatItDoes && p.sequence ? (
            <View>
              <EyebrowLabel withRule>Sequence</EyebrowLabel>
              <Text
                style={{
                  marginTop: 12,
                  fontFamily: ed.typography.dataMd.fontFamily,
                  fontSize: 13,
                  lineHeight: 20,
                  color: ed.colors.ink2,
                }}
              >
                {p.sequence}
              </Text>
            </View>
          ) : null}
          {extras?.overview?.whatItDoes && p.summary ? (
            <View>
              <EyebrowLabel withRule>Research summary</EyebrowLabel>
              <Text
                style={{
                  marginTop: 14,
                  fontFamily: ed.fraunces('Fraunces_400Regular'),
                  fontSize: 17,
                  lineHeight: 26,
                  color: ed.colors.ink2,
                }}
              >
                {p.summary}
              </Text>
            </View>
          ) : null}
          {mechParagraphs.length > 0 ? (
            <View>
              <EyebrowLabel withRule>Mechanism</EyebrowLabel>
              <View style={{ marginTop: 14, gap: 18 }}>
                {mechParagraphs.map((para, i) => {
                  const idx = para.indexOf('. ');
                  const title = idx > 0 && idx < 80 ? para.slice(0, idx) : '';
                  const body = title ? para.slice(idx + 2) : para;
                  return (
                    <View key={i} style={{ flexDirection: 'row', gap: 14 }}>
                      <Text
                        style={{
                          width: 24,
                          fontFamily: ed.fraunces('Fraunces_300Light'),
                          fontSize: 28,
                          lineHeight: 30,
                          color: ed.colors.brand,
                        }}
                      >
                        {i + 1}
                      </Text>
                      <View style={{ flex: 1 }}>
                        {title ? (
                          <Text
                            style={{
                              fontFamily: ed.fraunces('Fraunces_400Regular'),
                              fontSize: 17,
                              letterSpacing: -0.2,
                              color: ed.colors.ink1,
                              marginBottom: 6,
                            }}
                          >
                            {title}.
                          </Text>
                        ) : null}
                        <Text
                          style={{
                            fontFamily: ed.typography.bodyMd.fontFamily,
                            fontSize: 14,
                            lineHeight: 22,
                            color: ed.colors.ink2,
                          }}
                        >
                          {body}
                        </Text>
                      </View>
                    </View>
                  );
                })}
              </View>
            </View>
          ) : null}

          {extras && extras.coAdministration.length > 0 ? (
            <View>
              <EyebrowLabel withRule>Co-administration</EyebrowLabel>
              <View style={{ marginTop: 4 }}>
                {extras.coAdministration.map((ca, idx) => {
                  const partner = findPeptide(ca.peptide_id);
                  if (!partner) return null;
                  return (
                    <View key={ca.peptide_id}>
                      <Pressable
                        onPress={() => router.push(`/peptide/${partner.id}` as any)}
                        accessibilityRole="button"
                        accessibilityLabel={`Open ${partner.name}`}
                        style={{
                          flexDirection: 'row',
                          alignItems: 'flex-start',
                          paddingVertical: 16,
                          gap: 14,
                        }}
                      >
                        <View
                          style={{
                            width: 6,
                            height: 6,
                            borderRadius: 3,
                            marginTop: 8,
                            backgroundColor: partner.color,
                          }}
                        />
                        <View style={{ flex: 1 }}>
                          <Text
                            style={{
                              fontFamily: ed.fraunces('Fraunces_400Regular'),
                              fontSize: 17,
                              letterSpacing: -0.2,
                              color: ed.colors.ink1,
                            }}
                          >
                            + {partner.name}
                            {ca.co_reconstitute ? (
                              <Text
                                style={{
                                  fontFamily: ed.typography.labelSm.fontFamily,
                                  fontSize: ed.typography.labelSm.fontSize,
                                  letterSpacing: ed.typography.labelSm.letterSpacing,
                                  color: ed.colors.brand,
                                }}
                              >
                                {'  ·  CO-RECONSTITUTE'}
                              </Text>
                            ) : null}
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
                        <Text
                          style={{
                            fontFamily: ed.fraunces('Fraunces_300Light'),
                            fontSize: 22,
                            color: ed.colors.ink3,
                          }}
                        >
                          →
                        </Text>
                      </Pressable>
                      {idx < extras.coAdministration.length - 1 ? <HairlineRow /> : null}
                    </View>
                  );
                })}
              </View>
            </View>
          ) : null}

          {extras && extras.stackConflicts.length > 0 ? (
            <View>
              <Text
                style={{
                  fontFamily: ed.typography.label.fontFamily,
                  fontSize: ed.typography.label.fontSize,
                  letterSpacing: ed.typography.label.letterSpacing,
                  color: ed.colors.stateWarn,
                  textTransform: 'uppercase',
                  marginBottom: 12,
                }}
              >
                Stack conflicts
              </Text>
              <View
                style={{
                  borderTopWidth: 1,
                  borderBottomWidth: 1,
                  borderColor: ed.colors.stateWarn,
                }}
              >
                {extras.stackConflicts.map((sc, idx) => {
                  const partner = findPeptide(sc.peptide_id);
                  if (!partner) return null;
                  return (
                    <View
                      key={sc.peptide_id}
                      style={{
                        paddingVertical: 14,
                        borderTopWidth: idx === 0 ? 0 : 1,
                        borderTopColor: ed.colors.line,
                      }}
                    >
                      <Text
                        style={{
                          fontFamily: ed.fraunces('Fraunces_400Regular'),
                          fontSize: 17,
                          color: ed.colors.ink1,
                        }}
                      >
                        ✕ {partner.name}
                      </Text>
                      <Text
                        style={{
                          marginTop: 4,
                          fontFamily: ed.typography.bodySm.fontFamily,
                          fontSize: ed.typography.bodySm.fontSize,
                          lineHeight: ed.typography.bodySm.lineHeight,
                          color: ed.colors.ink2,
                        }}
                      >
                        {sc.reason}
                      </Text>
                    </View>
                  );
                })}
              </View>
            </View>
          ) : null}

          {/* Side effects + contraindications move to Overview when the
              peptide is migrated. Legacy peptides keep them here. */}
          {!extras?.overview?.whatItDoes &&
          extras &&
          (extras.sideEffects?.length || extras.contraindications?.length) ? (
            <View>
              <EyebrowLabel withRule>Side effects & cautions</EyebrowLabel>
              {extras.sideEffects?.length ? (
                <View style={{ marginTop: 14 }}>
                  <Text
                    style={{
                      fontFamily: ed.typography.labelSm.fontFamily,
                      fontSize: ed.typography.labelSm.fontSize,
                      letterSpacing: ed.typography.labelSm.letterSpacing,
                      color: ed.colors.stateModerate,
                      textTransform: 'uppercase',
                      marginBottom: 10,
                    }}
                  >
                    Side effects
                  </Text>
                  <View
                    style={{
                      borderTopWidth: 1,
                      borderBottomWidth: 1,
                      borderColor: ed.colors.stateModerate,
                      paddingVertical: 14,
                      gap: 8,
                    }}
                  >
                    {extras.sideEffects.map((s) => (
                      <Text
                        key={s}
                        style={{
                          fontFamily: ed.typography.bodyMd.fontFamily,
                          fontSize: 14,
                          lineHeight: 21,
                          color: ed.colors.ink2,
                        }}
                      >
                        · {s}
                      </Text>
                    ))}
                  </View>
                </View>
              ) : null}
              {extras.contraindications?.length ? (
                <View style={{ marginTop: 18 }}>
                  <Text
                    style={{
                      fontFamily: ed.typography.labelSm.fontFamily,
                      fontSize: ed.typography.labelSm.fontSize,
                      letterSpacing: ed.typography.labelSm.letterSpacing,
                      color: ed.colors.stateWarn,
                      textTransform: 'uppercase',
                      marginBottom: 10,
                    }}
                  >
                    Contraindications
                  </Text>
                  <View
                    style={{
                      borderTopWidth: 1,
                      borderBottomWidth: 1,
                      borderColor: ed.colors.stateWarn,
                      paddingVertical: 14,
                      gap: 8,
                    }}
                  >
                    {extras.contraindications.map((c) => (
                      <Text
                        key={c}
                        style={{
                          fontFamily: ed.typography.bodyMd.fontFamily,
                          fontSize: 14,
                          lineHeight: 21,
                          color: ed.colors.ink2,
                        }}
                      >
                        ✕ {c}
                      </Text>
                    ))}
                  </View>
                </View>
              ) : null}
            </View>
          ) : null}

          {p.citations.length > 0 ? (
            <View>
              <EyebrowLabel withRule>Citations</EyebrowLabel>
              <View style={{ marginTop: 4 }}>
                {p.citations.map((c, i) => (
                  <View key={i}>
                    <Pressable
                      disabled={!c.url}
                      onPress={() => c.url && Linking.openURL(c.url)}
                      style={{ flexDirection: 'row', gap: 12, paddingVertical: 16 }}
                    >
                      <Text
                        style={{
                          width: 28,
                          fontFamily: ed.typography.dataMd.fontFamily,
                          fontSize: 13,
                          color: ed.colors.ink3,
                        }}
                      >
                        [{i + 1}]
                      </Text>
                      <View style={{ flex: 1 }}>
                        <Text
                          style={{
                            fontFamily: ed.fraunces('Fraunces_400Regular'),
                            fontSize: 15,
                            lineHeight: 22,
                            color: ed.colors.ink1,
                          }}
                        >
                          {c.title}
                        </Text>
                        {c.url ? (
                          <Text
                            style={{
                              marginTop: 4,
                              fontFamily: ed.typography.dataMd.fontFamily,
                              fontSize: 12,
                              color: ed.colors.brand,
                            }}
                            numberOfLines={1}
                          >
                            {c.url}
                          </Text>
                        ) : null}
                      </View>
                    </Pressable>
                    {i < p.citations.length - 1 ? <HairlineRow /> : null}
                  </View>
                ))}
              </View>
            </View>
          ) : null}
        </View>
      ) : null}

      {/* NOTES */}
      {tab === 'notes' ? (
        <View style={{ paddingHorizontal: 24, marginTop: 24 }}>
          <Text
            style={{
              fontFamily: ed.fraunces('Fraunces_400Regular'),
              fontSize: 17,
              lineHeight: 26,
              color: ed.colors.ink2,
            }}
          >
            {p.notes || 'No additional cautions recorded for this entry.'}
          </Text>
        </View>
      ) : null}

      {/* CTAs */}
      <View style={{ marginTop: 40, paddingHorizontal: 24, gap: 12 }}>
        <EditorialButton
          fullWidth
          onPress={() =>
            router.push({ pathname: '/log-dose', params: { peptideId: p.id } } as any)
          }
        >
          Log a dose
        </EditorialButton>
        {/* Reconstitute is an injection-only workflow. Hide the
            button for oral / intranasal / topical peptides so users
            don't tap into a screen calibrated for vial math that
            doesn't apply to capsules / nasal sprays / droppers. */}
        {isInjectionRoute(derivePrimaryRoute(p.route)) ? (
          <EditorialButton
            variant="secondary"
            fullWidth
            onPress={() =>
              router.push({ pathname: '/reconstitute', params: { peptideId: p.id } } as any)
            }
          >
            Reconstitute
          </EditorialButton>
        ) : null}
      </View>
    </ScrollView>
  );
}

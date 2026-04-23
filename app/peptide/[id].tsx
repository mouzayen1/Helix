// Peptide detail — spec v2.0 §10 "Peptide Detail".
// Hero, quick-facts, summary, mechanism, interactions, citations.
import * as Linking from 'expo-linking';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { useCallback, useEffect, useState } from 'react';
import { Pressable, ScrollView, Text, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { IconChevronLeft } from '../../components/Icons';
import { HFormula, HSectionHeader, HTag } from '../../components/Primitives';
import { isSaved, savePeptide, unsavePeptide } from '../../lib/db';
import { DISCLAIMER_CITATION_FOOTER, DISCLAIMER_PEPTIDE_UNAPPROVED } from '../../lib/disclaimers';
import { findPeptide, peptideClassTopLevel } from '../../lib/peptides';
import { useTheme } from '../../theme/ThemeContext';
import { font, radius, space } from '../../theme/tokens';

type TabId = 'overview' | 'dosing' | 'research' | 'notes';

export default function PeptideDetailScreen() {
  const { t } = useTheme();
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const { id } = useLocalSearchParams<{ id: string }>();
  const p = findPeptide(id ?? '');
  const [tab, setTab] = useState<TabId>('overview');
  const [saved, setSaved] = useState(false);

  const refreshSaved = useCallback(async () => {
    if (!p) return;
    setSaved(await isSaved(p.id));
  }, [p]);

  useEffect(() => {
    refreshSaved();
  }, [refreshSaved]);

  if (!p) {
    return (
      <View
        style={{
          flex: 1,
          backgroundColor: t.bg,
          paddingTop: insets.top + space.xl,
          paddingHorizontal: space.xl,
        }}
      >
        <Pressable onPress={() => router.back()} hitSlop={10}>
          <IconChevronLeft size={18} color={t.ink2} />
        </Pressable>
        <Text style={{ marginTop: space.xl, color: t.ink, fontFamily: font.sansSemi, fontSize: 18 }}>
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
      style={{ flex: 1, backgroundColor: t.bg }}
      contentContainerStyle={{ paddingBottom: insets.bottom + space.xl }}
      showsVerticalScrollIndicator={false}
    >
      {/* Hero */}
      <View
        style={{
          backgroundColor: p.color + '20',
          paddingTop: insets.top + space.sm,
          paddingBottom: space.lg,
        }}
      >
        <View
          style={{
            flexDirection: 'row',
            justifyContent: 'space-between',
            alignItems: 'center',
            paddingHorizontal: space.xl,
          }}
        >
          <Pressable
            onPress={() => router.back()}
            style={{
              width: 36,
              height: 36,
              borderRadius: 18,
              backgroundColor: t.surface,
              alignItems: 'center',
              justifyContent: 'center',
              borderWidth: 1,
              borderColor: t.line,
            }}
            hitSlop={8}
          >
            <IconChevronLeft size={16} color={t.ink2} />
          </Pressable>
          <Pressable
            onPress={toggleSave}
            style={{
              height: 36,
              paddingHorizontal: 14,
              borderRadius: 18,
              backgroundColor: saved ? t.accent : t.surface,
              alignItems: 'center',
              justifyContent: 'center',
              borderWidth: 1,
              borderColor: saved ? t.accent : t.line,
            }}
            hitSlop={8}
          >
            <Text
              style={{
                color: saved ? '#fff' : t.ink2,
                fontSize: 13,
                fontFamily: font.sansSemi,
              }}
            >
              {saved ? '★ Saved' : '☆ Save'}
            </Text>
          </Pressable>
        </View>

        <View style={{ paddingHorizontal: space.xl, paddingTop: space.lg }}>
          <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}>
            <Text
              style={{
                fontSize: 11,
                fontFamily: font.sansBold,
                letterSpacing: 1.2,
                color: p.color,
                textTransform: 'uppercase',
              }}
            >
              {p.class}
            </Text>
          </View>
          <Text
            style={{
              fontSize: 34,
              fontFamily: font.sansBold,
              color: t.ink,
              letterSpacing: -1,
              lineHeight: 38,
              marginTop: 6,
            }}
          >
            {p.name}
          </Text>
          <Text
            style={{
              fontSize: 14,
              color: t.ink2,
              marginTop: 4,
              fontStyle: 'italic',
            }}
          >
            {p.subtitle}
          </Text>
          <View style={{ marginTop: space.md }}>
            <HFormula formula={p.formula} />
            <Text style={{ fontSize: 11, color: t.ink4, fontFamily: font.mono, marginTop: 2 }}>
              {p.mw} · t½ {p.halfLife}
            </Text>
          </View>
        </View>
      </View>

      {/* Quick facts grid */}
      <View
        style={{
          paddingHorizontal: space.xl,
          paddingTop: space.lg,
          flexDirection: 'row',
          flexWrap: 'wrap',
          gap: 8,
        }}
      >
        {[
          { label: 'Dose (research)', val: p.dose || '—' },
          { label: 'Frequency', val: p.freq || '—' },
          { label: 'Route', val: p.route || '—' },
          { label: 'Half-life', val: p.halfLife || '—' },
        ].map((f) => (
          <View
            key={f.label}
            style={{
              width: '48.5%',
              backgroundColor: t.surface,
              borderRadius: radius.md,
              padding: space.md,
              borderWidth: 1,
              borderColor: t.line,
            }}
          >
            <Text
              style={{
                fontSize: 10,
                letterSpacing: 0.8,
                color: t.ink3,
                fontFamily: font.sansSemi,
                textTransform: 'uppercase',
              }}
            >
              {f.label}
            </Text>
            <Text
              style={{
                fontSize: 14,
                fontFamily: font.monoSemi,
                color: t.ink,
                marginTop: 6,
                letterSpacing: -0.1,
              }}
            >
              {f.val}
            </Text>
          </View>
        ))}
      </View>

      {/* Reconstitution card */}
      {p.reconstitution ? (
        <View style={{ paddingHorizontal: space.xl, marginTop: space.md }}>
          <View
            style={{
              padding: space.md,
              borderRadius: radius.md,
              backgroundColor: t.accentSoft,
              borderLeftWidth: 3,
              borderLeftColor: t.accent,
            }}
          >
            <Text
              style={{
                fontSize: 10,
                color: t.accentInk,
                fontFamily: font.sansSemi,
                letterSpacing: 0.8,
                textTransform: 'uppercase',
              }}
            >
              Suggested reconstitution
            </Text>
            <Text
              style={{
                marginTop: 4,
                color: t.ink,
                fontFamily: font.monoSemi,
                fontSize: 14,
              }}
            >
              {p.reconstitution}
            </Text>
          </View>
        </View>
      ) : null}

      {/* Research-use banner */}
      <View style={{ paddingHorizontal: space.xl, marginTop: space.md }}>
        <View
          style={{
            padding: space.md,
            borderRadius: radius.md,
            backgroundColor: t.warnSoft + '90',
            borderWidth: 1,
            borderColor: t.warn + '40',
          }}
        >
          <Text style={{ fontSize: 12, color: t.ink2, lineHeight: 18 }}>
            {DISCLAIMER_PEPTIDE_UNAPPROVED}
          </Text>
        </View>
      </View>

      {/* Tabs */}
      <View
        style={{
          flexDirection: 'row',
          paddingHorizontal: space.xl,
          marginTop: space.lg,
          borderBottomWidth: 1,
          borderBottomColor: t.line,
        }}
      >
        {(['overview', 'dosing', 'research', 'notes'] as TabId[]).map((tid) => {
          const active = tid === tab;
          return (
            <Pressable
              key={tid}
              onPress={() => setTab(tid)}
              style={{
                paddingVertical: space.md,
                paddingHorizontal: 2,
                marginRight: space.lg,
                borderBottomWidth: 2,
                borderBottomColor: active ? t.ink : 'transparent',
                marginBottom: -1,
              }}
            >
              <Text
                style={{
                  fontSize: 14,
                  fontFamily: active ? font.sansSemi : font.sansMed,
                  color: active ? t.ink : t.ink3,
                  textTransform: 'capitalize',
                }}
              >
                {tid}
              </Text>
            </Pressable>
          );
        })}
      </View>

      {/* Tab content */}
      {tab === 'overview' ? (
        <View style={{ paddingHorizontal: space.xl, marginTop: space.lg, gap: space.lg }}>
          {p.sequence ? (
            <View>
              <Text
                style={{
                  fontSize: 11,
                  fontFamily: font.sansSemi,
                  letterSpacing: 1,
                  color: t.ink3,
                  textTransform: 'uppercase',
                  marginBottom: 6,
                }}
              >
                Sequence
              </Text>
              <Text
                style={{
                  fontSize: 13,
                  fontFamily: font.mono,
                  color: t.ink2,
                  lineHeight: 20,
                }}
              >
                {p.sequence}
              </Text>
            </View>
          ) : null}
          <View>
            <Text
              style={{
                fontSize: 11,
                fontFamily: font.sansSemi,
                letterSpacing: 1,
                color: t.ink3,
                textTransform: 'uppercase',
                marginBottom: 6,
              }}
            >
              Research summary
            </Text>
            <Text style={{ fontSize: 15, color: t.ink2, lineHeight: 23 }}>
              {p.summary || 'Research summary is being prepared for this entry.'}
            </Text>
          </View>
          {p.stacks.length > 0 ? (
            <View>
              <Text
                style={{
                  fontSize: 11,
                  fontFamily: font.sansSemi,
                  letterSpacing: 1,
                  color: t.ink3,
                  textTransform: 'uppercase',
                  marginBottom: 8,
                }}
              >
                Common stack partners
              </Text>
              <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 6 }}>
                {p.stacks.map((s) => (
                  <HTag key={s}>{s}</HTag>
                ))}
              </View>
            </View>
          ) : null}
        </View>
      ) : null}

      {tab === 'dosing' ? (
        <View style={{ paddingHorizontal: space.xl, marginTop: space.lg, gap: space.md }}>
          <View
            style={{
              padding: space.md,
              borderRadius: radius.md,
              backgroundColor: t.surface,
              borderWidth: 1,
              borderColor: t.line,
            }}
          >
            <Text
              style={{
                fontSize: 10,
                color: t.ink3,
                fontFamily: font.sansSemi,
                letterSpacing: 0.8,
                textTransform: 'uppercase',
              }}
            >
              Research range
            </Text>
            <Text
              style={{
                marginTop: 6,
                fontSize: 20,
                fontFamily: font.monoSemi,
                color: t.ink,
              }}
            >
              {p.dose || '—'}
            </Text>
            <Text style={{ fontSize: 13, color: t.ink2, marginTop: 4 }}>{p.freq}</Text>
            <Text style={{ fontSize: 13, color: t.ink2 }}>{p.route}</Text>
          </View>
          <Text style={{ fontSize: 12, color: t.ink3, lineHeight: 18 }}>
            {DISCLAIMER_CITATION_FOOTER}
          </Text>
          <Pressable
            onPress={() => router.push('/log-dose' as any)}
            style={{
              padding: space.md,
              borderRadius: radius.md,
              backgroundColor: t.ink,
              alignItems: 'center',
            }}
          >
            <Text style={{ color: t.bg, fontSize: 14, fontFamily: font.sansSemi }}>
              Log a dose
            </Text>
          </Pressable>
        </View>
      ) : null}

      {tab === 'research' ? (
        <View style={{ paddingHorizontal: space.xl, marginTop: space.lg, gap: space.lg }}>
          {mechParagraphs.length > 0 ? (
            <View>
              <Text
                style={{
                  fontSize: 11,
                  fontFamily: font.sansSemi,
                  letterSpacing: 1,
                  color: t.ink3,
                  textTransform: 'uppercase',
                  marginBottom: 8,
                }}
              >
                Mechanism
              </Text>
              <View
                style={{
                  backgroundColor: t.surface,
                  borderRadius: radius.md,
                  borderWidth: 1,
                  borderColor: t.line,
                  padding: space.md,
                  gap: space.md,
                }}
              >
                {mechParagraphs.map((para, i) => {
                  const idx = para.indexOf('. ');
                  const title = idx > 0 && idx < 80 ? para.slice(0, idx) : '';
                  const body = title ? para.slice(idx + 2) : para;
                  return (
                    <View
                      key={i}
                      style={{
                        flexDirection: 'row',
                        gap: space.md,
                        borderTopWidth: i === 0 ? 0 : 1,
                        borderTopColor: t.line,
                        paddingTop: i === 0 ? 0 : space.md,
                      }}
                    >
                      <View
                        style={{
                          width: 22,
                          height: 22,
                          borderRadius: 11,
                          backgroundColor: p.color + '22',
                          alignItems: 'center',
                          justifyContent: 'center',
                          marginTop: 2,
                        }}
                      >
                        <Text
                          style={{
                            fontSize: 11,
                            fontFamily: font.monoSemi,
                            color: p.color,
                          }}
                        >
                          {i + 1}
                        </Text>
                      </View>
                      <View style={{ flex: 1 }}>
                        {title ? (
                          <Text
                            style={{
                              fontSize: 14,
                              fontFamily: font.sansSemi,
                              color: t.ink,
                              marginBottom: 4,
                            }}
                          >
                            {title}.
                          </Text>
                        ) : null}
                        <Text
                          style={{
                            fontSize: 13,
                            color: t.ink2,
                            lineHeight: 20,
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

          {p.citations.length > 0 ? (
            <View>
              <Text
                style={{
                  fontSize: 11,
                  fontFamily: font.sansSemi,
                  letterSpacing: 1,
                  color: t.ink3,
                  textTransform: 'uppercase',
                  marginBottom: 8,
                }}
              >
                Citations
              </Text>
              <View style={{ gap: space.sm }}>
                {p.citations.map((c, i) => (
                  <Pressable
                    key={i}
                    disabled={!c.url}
                    onPress={() => c.url && Linking.openURL(c.url)}
                    style={{
                      backgroundColor: t.surface,
                      borderRadius: radius.md,
                      borderWidth: 1,
                      borderColor: t.line,
                      padding: space.md,
                      gap: 4,
                    }}
                  >
                    <Text
                      style={{
                        fontSize: 10,
                        fontFamily: font.monoSemi,
                        color: t.ink3,
                        letterSpacing: 0.5,
                      }}
                    >
                      [{i + 1}]
                    </Text>
                    <Text style={{ fontSize: 13, color: t.ink, lineHeight: 19 }}>
                      {c.title}
                    </Text>
                    {c.url ? (
                      <Text
                        style={{
                          fontSize: 11,
                          color: t.accent,
                          fontFamily: font.mono,
                          marginTop: 2,
                        }}
                        numberOfLines={1}
                      >
                        {c.url}
                      </Text>
                    ) : null}
                  </Pressable>
                ))}
              </View>
            </View>
          ) : null}
        </View>
      ) : null}

      {tab === 'notes' ? (
        <View style={{ paddingHorizontal: space.xl, marginTop: space.lg }}>
          <Text style={{ fontSize: 15, color: t.ink2, lineHeight: 23 }}>
            {p.notes || 'No additional cautions recorded for this entry.'}
          </Text>
        </View>
      ) : null}

      {/* CTAs */}
      <View
        style={{
          flexDirection: 'row',
          paddingHorizontal: space.xl,
          marginTop: space['2xl'],
          gap: space.sm,
        }}
      >
        <Pressable
          onPress={() => router.push('/log-dose' as any)}
          style={{
            flex: 1,
            padding: space.md,
            borderRadius: radius.md,
            backgroundColor: t.ink,
            alignItems: 'center',
          }}
        >
          <Text style={{ color: t.bg, fontSize: 14, fontFamily: font.sansSemi }}>
            Log a dose
          </Text>
        </Pressable>
        <Pressable
          onPress={() => router.push('/reconstitute' as any)}
          style={{
            flex: 1,
            padding: space.md,
            borderRadius: radius.md,
            borderWidth: 1,
            borderColor: t.lineStrong,
            alignItems: 'center',
          }}
        >
          <Text style={{ color: t.ink, fontSize: 14, fontFamily: font.sansSemi }}>
            Reconstitute
          </Text>
        </Pressable>
      </View>
    </ScrollView>
  );
}

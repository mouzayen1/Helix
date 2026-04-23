// Today / Home — spec §10.1
// Greeting, today's protocol, active cycle progress bar, quick actions, insight card.
import { useRouter } from 'expo-router';
import { Pressable, ScrollView, Text, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { HCard, HMetric, HSectionHeader } from '../../components/Primitives';
import {
  IconBolt,
  IconBook,
  IconCheck,
  IconFlame,
  IconSyringe,
} from '../../components/Icons';
import { useTheme } from '../../theme/ThemeContext';
import { font, radius, space } from '../../theme/tokens';

type ScheduledDose = {
  id: string;
  name: string;
  dose: string;
  time: string;
  color: string;
  done: boolean;
};

const TODAY: ScheduledDose[] = [
  { id: 'bpc157', name: 'BPC-157', dose: '250 mcg', time: '8:00 AM', color: '#0A8E83', done: true },
  {
    id: 'ipamor',
    name: 'Ipamorelin + CJC-1295',
    dose: '200 mcg',
    time: '10:30 PM',
    color: '#7A4FC9',
    done: false,
  },
];

function formatHeaderDate(d: Date) {
  return d
    .toLocaleDateString('en-US', { weekday: 'long', month: 'short', day: 'numeric' })
    .toUpperCase()
    .replace(',', ' ·');
}

export default function HomeScreen() {
  const { t } = useTheme();
  const router = useRouter();
  const insets = useSafeAreaInsets();

  const quickActions = [
    { label: 'Reconstitute', sub: 'BAC calculator', Icon: IconBolt, dest: '/reconstitute' },
    { label: 'Site rotation', sub: 'Next: R.Abdomen', Icon: IconSyringe, dest: '/' },
    { label: 'Journal entry', sub: 'How do you feel?', Icon: IconBook, dest: '/' },
    { label: 'Learn', sub: '3 new articles', Icon: IconBook, dest: '/library' },
  ] as const;

  return (
    <ScrollView
      style={{ flex: 1, backgroundColor: t.bg }}
      contentContainerStyle={{
        paddingTop: insets.top + 12,
        paddingBottom: 120,
      }}
      showsVerticalScrollIndicator={false}
    >
      {/* Greeting */}
      <View style={{ paddingHorizontal: space.xl }}>
        <View
          style={{
            flexDirection: 'row',
            justifyContent: 'space-between',
            alignItems: 'flex-end',
          }}
        >
          <View style={{ flex: 1 }}>
            <Text
              style={{
                fontSize: 12,
                color: t.ink3,
                letterSpacing: 1.2,
                fontFamily: font.sansSemi,
              }}
            >
              {formatHeaderDate(new Date())}
            </Text>
            <Text
              style={{
                fontSize: 32,
                fontFamily: font.sansBold,
                color: t.ink,
                letterSpacing: -0.8,
                marginTop: 4,
                lineHeight: 38,
              }}
            >
              Good morning,{'\n'}Alex.
            </Text>
          </View>
          <View
            style={{
              width: 40,
              height: 40,
              borderRadius: 20,
              backgroundColor: t.surfaceAlt,
              alignItems: 'center',
              justifyContent: 'center',
            }}
          >
            <Text style={{ fontFamily: font.sansSemi, color: t.ink2 }}>A</Text>
          </View>
        </View>
      </View>

      {/* Today's protocol */}
      <View style={{ paddingHorizontal: space.xl, marginTop: space.xxl }}>
        <HCard style={{ padding: space.xl, borderRadius: radius.xl }}>
          <View
            style={{
              flexDirection: 'row',
              justifyContent: 'space-between',
              alignItems: 'center',
              marginBottom: space.md,
            }}
          >
            <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}>
              <Text
                style={{
                  fontSize: 11,
                  fontFamily: font.sansSemi,
                  letterSpacing: 1.2,
                  color: t.ink3,
                  textTransform: 'uppercase',
                }}
              >
                Today's protocol
              </Text>
              <View
                style={{
                  paddingVertical: 2,
                  paddingHorizontal: 7,
                  borderRadius: 4,
                  backgroundColor: t.accentSoft,
                }}
              >
                <Text
                  style={{
                    fontSize: 10,
                    fontFamily: font.sansSemi,
                    color: t.accentInk,
                    letterSpacing: 0.3,
                  }}
                >
                  WEEK 4 / 8
                </Text>
              </View>
            </View>
            <View style={{ flexDirection: 'row', alignItems: 'center', gap: 4 }}>
              <IconFlame size={14} color={t.warn} />
              <Text style={{ fontSize: 13, fontFamily: font.monoSemi, color: t.warn }}>23</Text>
            </View>
          </View>

          {TODAY.map((d, i) => (
            <View
              key={d.id}
              style={{
                flexDirection: 'row',
                alignItems: 'center',
                gap: 14,
                paddingVertical: 14,
                borderTopWidth: i === 0 ? 0 : 1,
                borderTopColor: t.line,
              }}
            >
              <View
                style={{
                  width: 36,
                  height: 36,
                  borderRadius: 10,
                  backgroundColor: d.color + '22',
                  alignItems: 'center',
                  justifyContent: 'center',
                }}
              >
                <IconSyringe size={18} color={d.color} />
              </View>
              <View style={{ flex: 1 }}>
                <Text style={{ fontSize: 15, fontFamily: font.sansSemi, color: t.ink }}>
                  {d.name}
                </Text>
                <Text
                  style={{
                    fontSize: 12,
                    color: t.ink3,
                    fontFamily: font.mono,
                    marginTop: 2,
                  }}
                >
                  {d.dose} · {d.time} · SubQ
                </Text>
              </View>
              {d.done ? (
                <View
                  style={{
                    width: 28,
                    height: 28,
                    borderRadius: 14,
                    backgroundColor: t.accent,
                    alignItems: 'center',
                    justifyContent: 'center',
                  }}
                >
                  <IconCheck size={12} color="#fff" />
                </View>
              ) : (
                <Pressable
                  onPress={() => router.push('/log-dose')}
                  style={{
                    paddingVertical: 7,
                    paddingHorizontal: 14,
                    borderRadius: radius.pill,
                    backgroundColor: t.ink,
                  }}
                >
                  <Text style={{ fontSize: 12, fontFamily: font.sansSemi, color: t.bg }}>Log</Text>
                </Pressable>
              )}
            </View>
          ))}
        </HCard>
      </View>

      {/* Cycle progress */}
      <HSectionHeader title="Active cycle" action="Details" />
      <View style={{ paddingHorizontal: space.xl }}>
        <HCard style={{ borderRadius: radius.xl }}>
          <View
            style={{
              flexDirection: 'row',
              justifyContent: 'space-between',
              alignItems: 'flex-end',
              marginBottom: 10,
            }}
          >
            <Text style={{ fontSize: 15, fontFamily: font.sansSemi, color: t.ink }}>
              Healing Stack
            </Text>
            <Text style={{ fontSize: 12, color: t.ink3, fontFamily: font.mono }}>Day 24 / 56</Text>
          </View>

          <View style={{ flexDirection: 'row', gap: 2, marginBottom: 14 }}>
            {Array.from({ length: 56 }).map((_, i) => (
              <View
                key={i}
                style={{
                  flex: 1,
                  height: 22,
                  borderRadius: 2,
                  backgroundColor: i < 24 ? t.accent : t.surfaceAlt,
                  opacity: i < 24 ? Math.min(1, 0.55 + i / 40) : 1,
                }}
              />
            ))}
          </View>

          <View style={{ flexDirection: 'row', gap: 20 }}>
            <HMetric value="57" unit="%" label="Complete" />
            <HMetric value="32" unit="d" label="Remaining" />
            <HMetric value="48" unit="dose" label="Total logged" />
          </View>
        </HCard>
      </View>

      {/* Quick actions */}
      <HSectionHeader title="Quick actions" />
      <View
        style={{
          paddingHorizontal: space.xl,
          flexDirection: 'row',
          flexWrap: 'wrap',
          gap: 10,
        }}
      >
        {quickActions.map((q) => (
          <Pressable
            key={q.label}
            onPress={() => router.push(q.dest as any)}
            style={{
              width: '48.5%',
              backgroundColor: t.surface,
              borderRadius: radius.lg,
              borderWidth: 1,
              borderColor: t.line,
              padding: 14,
            }}
          >
            <View
              style={{
                width: 32,
                height: 32,
                borderRadius: 8,
                backgroundColor: t.surfaceAlt,
                alignItems: 'center',
                justifyContent: 'center',
                marginBottom: 10,
              }}
            >
              <q.Icon size={16} color={t.ink2} />
            </View>
            <Text style={{ fontSize: 13, fontFamily: font.sansSemi, color: t.ink }}>
              {q.label}
            </Text>
            <Text style={{ fontSize: 11, color: t.ink3, marginTop: 2 }}>{q.sub}</Text>
          </Pressable>
        ))}
      </View>

      {/* Insight */}
      <HSectionHeader title="Insight" />
      <View style={{ paddingHorizontal: space.xl }}>
        <View
          style={{
            backgroundColor: t.ink,
            borderRadius: radius.xl,
            padding: 20,
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
            Pattern detected
          </Text>
          <Text
            style={{
              fontSize: 18,
              color: t.bg,
              fontFamily: font.sansSemi,
              marginTop: 8,
              lineHeight: 24,
              letterSpacing: -0.2,
            }}
          >
            Sleep quality ↑ 18% on days you dose Ipamorelin before 10 PM.
          </Text>
          <Text
            style={{
              fontSize: 12,
              color: t.bg,
              opacity: 0.7,
              marginTop: 12,
              fontFamily: font.mono,
            }}
          >
            n = 14 nights · p &lt; 0.05
          </Text>
        </View>
      </View>
    </ScrollView>
  );
}

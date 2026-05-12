// One-time data attribution prompt. Fires after sign-in if the local
// SQLite has NULL-user_id rows (pre-auth legacy data) AND the user
// hasn't already chosen on this device. Two paths:
//
//   1. "Keep my data" — backfills user_id on every legacy row, stamps
//      profile.local_data_attributed_at so the prompt never re-fires.
//   2. "Start fresh" — confirms once more, then wipes legacy rows.
//      Existing rows belonging to this user (none, on a first sign-in)
//      are preserved.
//
// Either path stamps the attributed-at flag, so the screen is truly
// one-shot per device. The root auth gate skips this route once the
// flag is set even if legacy NULL rows somehow re-appear.
import { useRouter } from 'expo-router';
import { useEffect, useState } from 'react';
import { ActivityIndicator, Alert, Pressable, ScrollView, Text, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { EditorialButton } from '../../components/editorial/EditorialButton';
import { EditorialHeadline } from '../../components/editorial/EditorialHeadline';
import { EyebrowLabel } from '../../components/editorial/EyebrowLabel';
import { useEditorialTheme } from '../../lib/design/theme';
import {
  attributeLocalDataToUser,
  discardLegacyLocalData,
  legacyLocalDataCounts,
} from '../../lib/db';
import { getAuthState } from '../../lib/auth/session';
import { useProfile } from '../../lib/profile-context';
import { haptic } from '../../lib/haptics';

type Counts = Awaited<ReturnType<typeof legacyLocalDataCounts>>;

export default function AttributeDataScreen() {
  const ed = useEditorialTheme();
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const { refresh } = useProfile();
  const [counts, setCounts] = useState<Counts | null>(null);
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    legacyLocalDataCounts().then(setCounts);
  }, []);

  const onKeep = async () => {
    if (busy) return;
    const state = getAuthState();
    if (state.status !== 'signed-in') {
      // Shouldn't happen — the auth gate doesn't route here unless
      // we're signed in. Defensive bail-out.
      router.replace('/(auth)/sign-up');
      return;
    }
    setBusy(true);
    try {
      await attributeLocalDataToUser(state.session.user.id);
      await refresh();
      haptic.success();
      router.replace('/(tabs)' as never);
    } catch (err) {
      setBusy(false);
      haptic.error();
      Alert.alert(
        'Could not attribute data',
        err instanceof Error ? err.message : 'Please try again.',
      );
    }
  };

  const onDiscard = () => {
    Alert.alert(
      'Start fresh?',
      'This will permanently delete the data you accumulated on this device before signing in. Your account stays intact and you start with an empty Helix.',
      [
        { text: 'Keep my data', style: 'cancel' },
        {
          text: 'Delete and start fresh',
          style: 'destructive',
          onPress: async () => {
            if (busy) return;
            setBusy(true);
            try {
              await discardLegacyLocalData();
              await refresh();
              haptic.success();
              router.replace('/(tabs)' as never);
            } catch (err) {
              setBusy(false);
              haptic.error();
              Alert.alert(
                'Could not delete data',
                err instanceof Error ? err.message : 'Please try again.',
              );
            }
          },
        },
      ],
    );
  };

  if (!counts) {
    return (
      <View
        style={{
          flex: 1,
          backgroundColor: ed.colors.bg,
          alignItems: 'center',
          justifyContent: 'center',
        }}
      >
        <ActivityIndicator color={ed.colors.brand} />
      </View>
    );
  }

  return (
    <ScrollView
      style={{ flex: 1, backgroundColor: ed.colors.bg }}
      contentContainerStyle={{
        paddingTop: insets.top + 40,
        paddingHorizontal: 32,
        paddingBottom: insets.bottom + 32,
      }}
    >
      <EyebrowLabel>Welcome back</EyebrowLabel>
      <View style={{ marginTop: 16 }}>
        <EditorialHeadline size="title1">Keep your *Helix data*?</EditorialHeadline>
      </View>

      <Text
        style={{
          marginTop: 16,
          fontFamily: ed.fraunces('Fraunces_400Regular'),
          fontSize: 17,
          lineHeight: 25,
          color: ed.colors.ink2,
        }}
      >
        We found data on this device from before accounts existed. Want
        to attach it to your new account?
      </Text>

      <View
        style={{
          marginTop: 36,
          paddingVertical: 18,
          borderTopWidth: 1,
          borderBottomWidth: 1,
          borderColor: ed.colors.line,
        }}
      >
        <CountRow label="doses logged" count={counts.doses} />
        <CountRow label="active vials" count={counts.vials} />
        <CountRow label="cycles" count={counts.cycles} />
        <CountRow label="stacks" count={counts.stacks} />
        <CountRow label="journal entries" count={counts.journal} />
        <CountRow label="biomarker readings" count={counts.metrics} />
        <CountRow label="saved peptides" count={counts.saved} />
        <CountRow label="dose skips" count={counts.skips} last />
      </View>

      <View style={{ marginTop: 36 }}>
        <EditorialButton fullWidth onPress={onKeep} disabled={busy}>
          {busy ? 'Saving…' : 'Yes, keep my data'}
        </EditorialButton>
      </View>

      <Pressable
        onPress={onDiscard}
        disabled={busy}
        accessibilityRole="button"
        style={{ marginTop: 20, paddingVertical: 14, alignItems: 'center' }}
      >
        <Text
          style={{
            fontFamily: ed.typography.labelSm.fontFamily,
            fontSize: ed.typography.labelSm.fontSize,
            letterSpacing: ed.typography.labelSm.letterSpacing,
            color: ed.colors.stateWarn,
            textTransform: 'uppercase',
          }}
        >
          Start fresh — delete local data
        </Text>
      </Pressable>
    </ScrollView>
  );
}

function CountRow({
  label,
  count,
  last,
}: {
  label: string;
  count: number;
  last?: boolean;
}) {
  const ed = useEditorialTheme();
  if (count === 0) return null;
  return (
    <View
      style={{
        flexDirection: 'row',
        justifyContent: 'space-between',
        alignItems: 'baseline',
        paddingVertical: 8,
        borderBottomWidth: last ? 0 : 1,
        borderBottomColor: ed.colors.line,
      }}
    >
      <Text
        style={{
          fontFamily: ed.fraunces('Fraunces_400Regular'),
          fontSize: 16,
          color: ed.colors.ink2,
        }}
      >
        {label}
      </Text>
      <Text
        style={{
          fontFamily: ed.typography.dataMd.fontFamily,
          fontSize: ed.typography.dataMd.fontSize,
          color: ed.colors.ink1,
        }}
      >
        {count}
      </Text>
    </View>
  );
}

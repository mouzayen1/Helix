// Founder celebration modal — full-screen, fires once per founder
// after their slot is granted. Auth gate in app/_layout.tsx mounts
// this beneath the route stack; it polls getMyFounderStatus() once
// the session hydrates and renders the modal if the user is a founder
// and the banner hasn't been seen.
//
// Dismissing the modal calls markFounderBannerSeen() so it never
// fires again — even across reinstalls, since the seen-at timestamp
// is stored server-side on the profile row.
import { Modal, Pressable, Text, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { EditorialButton } from './editorial/EditorialButton';
import { EditorialHeadline } from './editorial/EditorialHeadline';
import { useEditorialTheme } from '../lib/design/theme';

export function FounderCelebrationModal({
  visible,
  founderNumber,
  onDismiss,
}: {
  visible: boolean;
  founderNumber: number;
  onDismiss: () => void;
}) {
  const ed = useEditorialTheme();
  const insets = useSafeAreaInsets();

  return (
    <Modal
      visible={visible}
      transparent={false}
      animationType="fade"
      statusBarTranslucent
      onRequestClose={onDismiss}
    >
      <View
        style={{
          flex: 1,
          backgroundColor: ed.colors.bg,
          paddingTop: insets.top + 64,
          paddingBottom: insets.bottom + 32,
          paddingHorizontal: 32,
        }}
      >
        {/* Eyebrow — brass mono caps, ringed by hairline rules on both
            sides to evoke a press/launch headline. */}
        <View
          style={{
            flexDirection: 'row',
            alignItems: 'center',
            gap: 14,
            marginBottom: 36,
          }}
        >
          <View style={{ flex: 1, height: 1, backgroundColor: ed.colors.brandLine }} />
          <Text
            style={{
              fontFamily: ed.typography.eyebrow.fontFamily,
              fontSize: ed.typography.eyebrow.fontSize,
              letterSpacing: ed.typography.eyebrow.letterSpacing,
              color: ed.colors.brand,
              textTransform: 'uppercase',
            }}
          >
            Founder
          </Text>
          <View style={{ flex: 1, height: 1, backgroundColor: ed.colors.brandLine }} />
        </View>

        {/* The big number — the moment. Brass Fraunces, generous size. */}
        <Text
          style={{
            fontFamily: ed.fraunces('Fraunces_300Light'),
            fontSize: 96,
            lineHeight: 96,
            letterSpacing: -4,
            color: ed.colors.brand,
            textAlign: 'center',
          }}
        >
          #{founderNumber}
        </Text>

        <View style={{ marginTop: 32 }}>
          <EditorialHeadline size="title1" style={{ textAlign: 'center' }}>
            {`Welcome, *Founder*.`}
          </EditorialHeadline>
        </View>

        <Text
          style={{
            marginTop: 20,
            textAlign: 'center',
            fontFamily: ed.fraunces('Fraunces_400Regular_Italic'),
            fontSize: 18,
            lineHeight: 28,
            color: ed.colors.ink2,
          }}
        >
          You&apos;re one of the first 100 to join Helix.
        </Text>

        <View
          style={{
            marginTop: 36,
            paddingVertical: 18,
            borderTopWidth: 1,
            borderBottomWidth: 1,
            borderColor: ed.colors.brandLine,
          }}
        >
          <Text
            style={{
              fontFamily: ed.fraunces('Fraunces_400Regular'),
              fontSize: 16,
              lineHeight: 25,
              color: ed.colors.ink2,
              textAlign: 'center',
            }}
          >
            As a founder, you get lifetime free access to every premium
            feature we ship — cloud sync, advanced charts, unlimited
            cycles, container tracking, and everything that comes next.
          </Text>
        </View>

        <View style={{ flex: 1 }} />

        <EditorialButton fullWidth onPress={onDismiss}>
          Got it →
        </EditorialButton>

        <Pressable
          onPress={onDismiss}
          accessibilityLabel="Close founder banner"
          hitSlop={20}
          style={{
            position: 'absolute',
            top: insets.top + 12,
            right: 20,
            padding: 8,
          }}
        >
          <Text
            style={{
              fontFamily: ed.fraunces('Fraunces_300Light'),
              fontSize: 26,
              color: ed.colors.ink3,
            }}
          >
            ×
          </Text>
        </Pressable>
      </View>
    </Modal>
  );
}

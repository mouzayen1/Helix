// Welcome — editorial rebuild. Helix mark sits above an italic-emphasis
// serif headline. The CTA is the first EditorialButton primary the user
// sees, setting the tone for everything else in the app.
import { useRouter } from 'expo-router';
import { Text, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import Svg, { Path } from 'react-native-svg';
import { EditorialButton } from '../components/editorial/EditorialButton';
import { EditorialHeadline } from '../components/editorial/EditorialHeadline';
import { useWideWeb } from '../components/editorial/WebColumn';
import { useEditorialTheme } from '../lib/design/theme';

function HelixMark({ color }: { color: string }) {
  return (
    <Svg width={56} height={56} viewBox="0 0 64 64" style={{ width: 56, height: 56 }}>
      <Path
        d="M18 10 Q32 32 18 54 M46 10 Q32 32 46 54 M18 24 L46 24 M18 40 L46 40"
        stroke={color}
        strokeWidth={2}
        strokeLinecap="round"
        fill="none"
      />
    </Svg>
  );
}

export default function Welcome() {
  const ed = useEditorialTheme();
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const wide = useWideWeb();

  return (
    <View
      style={{
        flex: 1,
        backgroundColor: ed.colors.bg,
        paddingTop: wide ? 48 : insets.top + 64,
        paddingBottom: wide ? 48 : insets.bottom + 24,
        paddingHorizontal: wide ? 24 : 32,
        alignItems: wide ? 'center' : 'stretch',
        justifyContent: wide ? 'center' : 'flex-start',
      }}
    >
      <View style={{ width: '100%', maxWidth: wide ? 460 : undefined, flex: wide ? 0 : 1 }}>
        <View
          style={{
            flex: wide ? 0 : 1,
            alignItems: 'center',
            justifyContent: 'center',
            minHeight: wide ? 180 : undefined,
          }}
        >
          <View style={{ width: 56, height: 56, alignItems: 'center', justifyContent: 'center' }}>
            <HelixMark color={ed.colors.brand} />
          </View>
          <View style={{ marginTop: wide ? 36 : 48, alignItems: 'center' }}>
            <EditorialHeadline size="display" style={{ textAlign: 'center' }}>
              {`Precise peptide *tracking*.`}
            </EditorialHeadline>
          </View>
          <Text
            style={{
              marginTop: 24,
              fontFamily: ed.typography.bodyMd.fontFamily,
              fontSize: 15,
              lineHeight: 23,
              color: ed.colors.ink2,
              textAlign: 'center',
              maxWidth: 320,
            }}
          >
            A research-grade library and a precise log of every dose, cycle, and vial.
          </Text>
        </View>

        <View style={{ gap: 18, alignItems: 'center', marginTop: wide ? 52 : 0 }}>
          <EditorialButton fullWidth onPress={() => router.push('/(onboarding)/age-gate')}>
            Get started
          </EditorialButton>
          <Text
            style={{
              textAlign: 'center',
              fontFamily: ed.typography.labelSm.fontFamily,
              fontSize: ed.typography.labelSm.fontSize,
              letterSpacing: ed.typography.labelSm.letterSpacing,
              color: ed.colors.ink3,
              textTransform: 'uppercase',
            }}
          >
            Education / research tool · Not medical advice · 18+
          </Text>
        </View>
      </View>
    </View>
  );
}

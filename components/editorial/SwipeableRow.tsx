// Editorial swipe-to-act row. Wraps a list row in a ReanimatedSwipeable
// that reveals a single destructive action on left-swipe (drag from the
// right edge). The action panel is mono-uppercase on a warn-tinted field
// to match the editorial language; tapping it closes the row and fires
// `onAction`. Confirmation/Alert is the caller's responsibility so this
// stays pure presentation and reusable across lists (schedule, vials).
import { useRef } from 'react';
import { Pressable, Text } from 'react-native';
import ReanimatedSwipeable, {
  type SwipeableMethods,
} from 'react-native-gesture-handler/ReanimatedSwipeable';
import { useEditorialTheme } from '../../lib/design/theme';

export function SwipeableRow({
  children,
  actionLabel,
  onAction,
  accessibilityActionLabel,
}: {
  children: React.ReactNode;
  /** Mono-uppercase label shown in the revealed action panel. */
  actionLabel: string;
  /** Fired when the revealed action is tapped. The row auto-closes first. */
  onAction: () => void;
  /** Screen-reader label for the action button; defaults to actionLabel. */
  accessibilityActionLabel?: string;
}) {
  const ed = useEditorialTheme();
  const ref = useRef<SwipeableMethods>(null);

  const renderRightActions = () => (
    <Pressable
      onPress={() => {
        ref.current?.close();
        onAction();
      }}
      accessibilityRole="button"
      accessibilityLabel={accessibilityActionLabel ?? actionLabel}
      style={{
        backgroundColor: ed.colors.stateWarn,
        justifyContent: 'center',
        alignItems: 'center',
        paddingHorizontal: 24,
      }}
    >
      <Text
        style={{
          fontFamily: ed.typography.labelSm.fontFamily,
          fontSize: ed.typography.labelSm.fontSize,
          letterSpacing: ed.typography.labelSm.letterSpacing,
          color: ed.colors.bg,
          textTransform: 'uppercase',
        }}
      >
        {actionLabel}
      </Text>
    </Pressable>
  );

  return (
    <ReanimatedSwipeable
      ref={ref}
      friction={2}
      rightThreshold={40}
      overshootRight={false}
      renderRightActions={renderRightActions}
      // Opaque so the row content slides over the warn panel rather than
      // letting it bleed through behind the text while swiping.
      childrenContainerStyle={{ backgroundColor: ed.colors.bg }}
    >
      {children}
    </ReanimatedSwipeable>
  );
}

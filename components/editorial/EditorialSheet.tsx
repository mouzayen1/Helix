// Editorial bottom sheet — the bottom-anchored modal pattern. Sharp
// top corners (no rounded), hairline-strong divider rule across the
// top, generous bottom padding for safe area. The dim backdrop is
// pure-black 0.5 opacity in both modes; the sheet itself uses the
// active palette's bg.
//
// Comes with a `SheetHeader` helper for the standard "title + mono
// detail line" you see at the top of most action sheets.
import { Modal, Pressable, Text, View, type ViewProps } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useEditorialTheme } from '../../lib/design/theme';

export function EditorialSheet({
  visible,
  onClose,
  children,
  contentStyle,
}: {
  visible: boolean;
  onClose: () => void;
  children: React.ReactNode;
  contentStyle?: ViewProps['style'];
}) {
  const ed = useEditorialTheme();
  const insets = useSafeAreaInsets();

  return (
    <Modal
      visible={visible}
      transparent
      animationType="fade"
      onRequestClose={onClose}
      statusBarTranslucent
    >
      <Pressable
        onPress={onClose}
        style={{
          flex: 1,
          backgroundColor: 'rgba(0,0,0,0.55)',
          justifyContent: 'flex-end',
        }}
      >
        <Pressable
          // Stop propagation so taps on the sheet don't dismiss it.
          onPress={(e) => e.stopPropagation()}
          style={[
            {
              backgroundColor: ed.colors.bg,
              borderTopWidth: 1,
              borderTopColor: ed.colors.lineStrong,
              paddingTop: 24,
              paddingHorizontal: 24,
              paddingBottom: insets.bottom + 24,
            },
            contentStyle,
          ]}
        >
          {/* Tiny grabber rail above the sheet content. */}
          <View
            style={{
              width: 36,
              height: 2,
              backgroundColor: ed.colors.lineStrong,
              alignSelf: 'center',
              marginBottom: 18,
            }}
          />
          {children}
        </Pressable>
      </Pressable>
    </Modal>
  );
}

export function SheetHeader({ title, detail }: { title: string; detail?: string }) {
  const ed = useEditorialTheme();
  return (
    <View>
      <Text
        style={{
          fontFamily: ed.fraunces('Fraunces_400Regular'),
          fontSize: 22,
          lineHeight: 28,
          letterSpacing: -0.4,
          color: ed.colors.ink1,
        }}
      >
        {title}
      </Text>
      {detail ? (
        <Text
          style={{
            marginTop: 4,
            fontFamily: ed.typography.dataMd.fontFamily,
            fontSize: ed.typography.dataMd.fontSize,
            color: ed.colors.ink3,
          }}
        >
          {detail}
        </Text>
      ) : null}
    </View>
  );
}

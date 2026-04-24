// Tiny haptic wrapper. Silent-no-op on platforms where it's unsupported,
// so call sites don't need to guard Platform.OS every time.
import * as Haptics from 'expo-haptics';

function safe(fn: () => Promise<void>) {
  fn().catch(() => {});
}

export const haptic = {
  light() {
    safe(() => Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light));
  },
  medium() {
    safe(() => Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium));
  },
  success() {
    safe(() => Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success));
  },
  warn() {
    safe(() => Haptics.notificationAsync(Haptics.NotificationFeedbackType.Warning));
  },
  error() {
    safe(() => Haptics.notificationAsync(Haptics.NotificationFeedbackType.Error));
  },
};

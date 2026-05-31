// React Native's Alert.alert is a no-op on react-native-web (it just
// logs a warning), which silently breaks every confirm/error dialog the
// app uses — sign-out, sign-up errors, dose-log errors, account delete,
// etc. Rather than rewrite every call site, monkey-patch Alert.alert on
// web only with a window.confirm / window.alert bridge.
//
// Two-button (cancel + confirm) dialogs map to window.confirm: native
// "cancel"-styled button fires when the user cancels, the non-cancel
// button fires when they OK. One-button (or zero-button) dialogs map
// to window.alert and run the single button's onPress after dismissal.
// Three-button dialogs (rare — only the "discard changes" prompt uses
// it) collapse to confirm with the destructive/primary action winning.
//
// Import this once from the root layout, BEFORE any screen module that
// might wire up an Alert handler. The module body runs at import time,
// so the patch is in place before React begins rendering.

import { Alert, Platform } from 'react-native';

type AlertButton = {
  text?: string;
  onPress?: (value?: string) => void;
  style?: 'default' | 'cancel' | 'destructive';
};

if (Platform.OS === 'web') {
  (Alert as { alert: typeof Alert.alert }).alert = ((
    title: string,
    message?: string,
    buttons?: AlertButton[],
  ): void => {
    const text = message ? `${title}\n\n${message}` : title;

    // No buttons or a single OK-style button → window.alert (informational).
    if (!buttons || buttons.length === 0) {
      window.alert(text);
      return;
    }
    if (buttons.length === 1) {
      window.alert(text);
      try {
        buttons[0].onPress?.();
      } catch {
        // user onPress can throw async — swallow synchronously, the call
        // site's own catch handles it.
      }
      return;
    }

    // 2+ buttons → window.confirm. Pick the cancel and primary actions
    // from the array (defaults: first cancel-styled = cancel, first
    // non-cancel = primary).
    const cancelBtn = buttons.find((b) => b.style === 'cancel') ?? null;
    const primaryBtn = buttons.find((b) => b.style !== 'cancel') ?? buttons[buttons.length - 1];
    const confirmed = window.confirm(text);
    try {
      if (confirmed) {
        primaryBtn?.onPress?.();
      } else {
        cancelBtn?.onPress?.();
      }
    } catch {
      // see note above
    }
  }) as typeof Alert.alert;
}

// Email + password sign-up / sign-in / password reset.
//
// Configuration knobs (set in Supabase Dashboard → Auth → Providers → Email):
//   - "Confirm email" — recommended OFF for v1.0 (signup friction is
//     too high). When OFF, signUp returns a session immediately; when
//     ON, signUp returns null session and the user must click an email
//     link first. Both code paths handled below.
//   - Password min length — Supabase default is 6. The client-side
//     validation in PasswordRules below is stricter (8+).
//
// Edge cases:
//   - "User already registered" error from signUp — silently retries
//     as signInWithPassword. If the password matches, great; if not,
//     surfaces the canonical "account exists with this email" error.
//   - Forgot password — Supabase emails the user a reset link that
//     deep-links back into the app via the redirect URL. The app must
//     have a route at /auth/reset to handle this; see app/(auth)/
//     in slice A3.

import type { Session } from '@supabase/supabase-js';
import { requireSupabase } from '../supabase';

export class EmailAuthError extends Error {
  constructor(message: string, public code?: string) {
    super(message);
    this.name = 'EmailAuthError';
  }
}

// ---- Validation ----------------------------------------------------------

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

export function validateEmail(email: string): string | null {
  const trimmed = email.trim();
  if (!trimmed) return 'Enter an email address.';
  if (!EMAIL_RE.test(trimmed)) return 'Enter a valid email address.';
  return null;
}

/** Client-side password rules; stricter than Supabase's default (6). */
export function validatePassword(password: string): string | null {
  if (!password) return 'Enter a password.';
  if (password.length < 8) return 'Password must be at least 8 characters.';
  if (!/[A-Za-z]/.test(password)) return 'Password must contain at least one letter.';
  if (!/[0-9]/.test(password)) return 'Password must contain at least one number.';
  return null;
}

// ---- Flows ---------------------------------------------------------------

/**
 * Sign up with email + password. Returns:
 *   - { session, requiresEmailVerification: false } — happy path,
 *     user is signed in immediately.
 *   - { session: null, requiresEmailVerification: true } — Supabase
 *     project has email confirmation ON; user must click the email
 *     link before signing in. The UI shows "Check your email."
 *
 * If the email is already registered, falls through to signIn with
 * the same password. The user may have forgotten they already
 * have an account.
 */
export async function signUpWithEmail(
  email: string,
  password: string,
): Promise<{ session: Session | null; requiresEmailVerification: boolean }> {
  const emailErr = validateEmail(email);
  if (emailErr) throw new EmailAuthError(emailErr, 'INVALID_EMAIL');
  const pwErr = validatePassword(password);
  if (pwErr) throw new EmailAuthError(pwErr, 'INVALID_PASSWORD');

  const sb = requireSupabase();
  const { data, error } = await sb.auth.signUp({
    email: email.trim(),
    password,
    options: {
      // Default display name pulled from the email prefix; users can
      // edit in Settings later. The handle_new_user trigger reads
      // raw_user_meta_data.display_name on profile creation.
      data: { display_name: email.trim().split('@')[0] },
    },
  });

  if (error) {
    const msg = error.message.toLowerCase();
    if (msg.includes('already registered') || msg.includes('user already')) {
      // Silently retry as sign-in — the user may have forgotten the account.
      return signInWithEmail(email, password).then((session) => ({
        session,
        requiresEmailVerification: false,
      }));
    }
    throw new EmailAuthError(error.message, error.name);
  }

  // When email confirmation is enabled, signUp returns a user but no
  // session. The user must verify their email first. UI shows
  // "Check your email — we sent a verification link."
  if (data.user && !data.session) {
    return { session: null, requiresEmailVerification: true };
  }
  if (!data.session) {
    throw new EmailAuthError('Sign-up did not return a session.');
  }
  return { session: data.session, requiresEmailVerification: false };
}

/**
 * Sign in with an existing email + password. Throws on bad creds.
 * Used both for the standalone sign-in screen and as a fallback when
 * signUp reports "already registered".
 */
export async function signInWithEmail(email: string, password: string): Promise<Session> {
  const emailErr = validateEmail(email);
  if (emailErr) throw new EmailAuthError(emailErr, 'INVALID_EMAIL');
  if (!password) throw new EmailAuthError('Enter your password.', 'INVALID_PASSWORD');

  const sb = requireSupabase();
  const { data, error } = await sb.auth.signInWithPassword({
    email: email.trim(),
    password,
  });
  if (error) {
    const msg = error.message.toLowerCase();
    if (msg.includes('invalid login')) {
      throw new EmailAuthError(
        'No account with that email and password. Check your details or try a different sign-in method.',
        'BAD_CREDENTIALS',
      );
    }
    throw new EmailAuthError(error.message, error.name);
  }
  if (!data.session) {
    throw new EmailAuthError('Sign-in did not return a session.');
  }
  return data.session;
}

/**
 * Send a password-reset email. The link lands in the user's inbox and
 * deep-links back into the app at /(auth)/reset-password (see slice
 * A3 routes). The redirectTo URL must be registered in the Supabase
 * Dashboard → Auth → URL Configuration.
 */
export async function sendPasswordReset(email: string): Promise<void> {
  const emailErr = validateEmail(email);
  if (emailErr) throw new EmailAuthError(emailErr, 'INVALID_EMAIL');

  const sb = requireSupabase();
  const { error } = await sb.auth.resetPasswordForEmail(email.trim(), {
    redirectTo: 'helix://auth/reset-password',
  });
  if (error) {
    throw new EmailAuthError(error.message, error.name);
  }
}

/**
 * Update the password for the currently-signed-in user. Used after the
 * reset-password deep-link lands the user back in the app.
 */
export async function updatePassword(newPassword: string): Promise<void> {
  const pwErr = validatePassword(newPassword);
  if (pwErr) throw new EmailAuthError(pwErr, 'INVALID_PASSWORD');

  const sb = requireSupabase();
  const { error } = await sb.auth.updateUser({ password: newPassword });
  if (error) {
    throw new EmailAuthError(error.message, error.name);
  }
}

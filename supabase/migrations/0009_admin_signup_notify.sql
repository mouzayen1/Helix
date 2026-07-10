-- Admin signup notifications — email an admin whenever a new profile row
-- is created (i.e. a new user signs up via Apple / Google / email, on web
-- or native).
--
-- Pipeline:
--   auth signup → public.profiles INSERT → this trigger → net.http_post →
--   supabase/functions/admin-signup-email (Resend) → admin inbox.
--
-- The edge function authenticates the call via a shared secret sent in the
-- `x-helix-webhook-secret` header. The secret is NOT stored in this file
-- (the repo is public). It lives in Supabase Vault under the name
-- `admin_signup_webhook_secret`, and the trigger reads it at call time.
--
-- One-time out-of-band setup (NOT in version control — run once per project):
--   1. Deploy the function:
--        supabase functions deploy admin-signup-email --no-verify-jwt
--      (or via the Management API with verify_jwt=false, since the caller
--       is a DB trigger, not an authenticated user)
--   2. Set the function's secrets (Dashboard → Edge Functions → Secrets,
--      or `supabase secrets set`):
--        RESEND_API_KEY               = <resend sending key>
--        ADMIN_SIGNUP_EMAILS          = comma-separated recipient list
--        ADMIN_SIGNUP_WEBHOOK_SECRET  = <same value as the Vault secret below>
--        ADMIN_SIGNUP_FROM            = optional; defaults to
--                                       "Helix <notifications@gethelixapp.org>"
--   3. Store the shared secret in Vault (value must match
--      ADMIN_SIGNUP_WEBHOOK_SECRET above):
--        select vault.create_secret(
--          '<random-hex-secret>',
--          'admin_signup_webhook_secret',
--          'Shared secret the profiles signup trigger sends to admin-signup-email'
--        );
--   4. Verify the Resend sending domain (gethelixapp.org) so the
--      notifications@ from-address is allowed.

-- pg_net provides net.http_post for the async outbound call.
create extension if not exists pg_net;

create or replace function public.notify_admin_on_signup()
returns trigger
language plpgsql
security definer
set search_path = public
as $fn$
declare
  webhook_secret text;
begin
  -- Read the shared secret from Vault (never hardcoded here).
  select decrypted_secret into webhook_secret
    from vault.decrypted_secrets
   where name = 'admin_signup_webhook_secret'
   limit 1;

  -- Fire-and-forget: net.http_post queues the request and returns
  -- immediately, so signup latency is unaffected. Delivery failures are
  -- visible in Resend's dashboard and the pg_net response tables; they do
  -- not roll back the signup.
  perform net.http_post(
    url := 'https://fmmeapqiqujriggsmhzw.supabase.co/functions/v1/admin-signup-email',
    headers := jsonb_build_object(
      'Content-Type', 'application/json',
      'x-helix-webhook-secret', coalesce(webhook_secret, '')
    ),
    body := jsonb_build_object(
      'type', 'INSERT',
      'schema', 'public',
      'table', 'profiles',
      'record', to_jsonb(NEW)
    )
  );

  return NEW;
end;
$fn$;

drop trigger if exists on_profile_created_notify_admin on public.profiles;
create trigger on_profile_created_notify_admin
  after insert on public.profiles
  for each row execute function public.notify_admin_on_signup();

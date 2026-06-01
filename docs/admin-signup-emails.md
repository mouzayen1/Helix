# Admin signup emails

Helix sends admin notification emails from a Supabase Database Webhook when a
new row is inserted into `public.profiles`. The `profiles` row is created by the
existing `on_auth_user_created` trigger after Supabase Auth creates a user, so
the notification represents a new account, not a returning sign-in.

## Recipients

Admin signup notifications go to:

- `mouzayen1@gmail.com`
- `smitty6123@gmail.com`

## Secrets

Set these on the linked Supabase project:

```sh
supabase secrets set \
  RESEND_API_KEY=... \
  ADMIN_SIGNUP_EMAILS=mouzayen1@gmail.com,smitty6123@gmail.com \
  "ADMIN_SIGNUP_FROM=Helix <notifications@gethelixapp.org>" \
  ADMIN_SIGNUP_WEBHOOK_SECRET=...
```

`ADMIN_SIGNUP_FROM` must use a domain verified in Resend before production use.

## Deploy

Deploy the Edge Function without JWT verification. The database webhook is
authenticated by `x-helix-webhook-secret` instead.

```sh
supabase functions deploy admin-signup-email --no-verify-jwt
```

## Database webhook

Create a Supabase Database Webhook with:

- Table: `public.profiles`
- Event: `INSERT`
- Target: Supabase Edge Function
- Function: `admin-signup-email`
- Method: `POST`
- Header: `x-helix-webhook-secret: <ADMIN_SIGNUP_WEBHOOK_SECRET>`

The email includes the user email, user id, display name, signup time, and
Supabase project URL.

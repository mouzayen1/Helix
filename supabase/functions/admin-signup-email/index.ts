declare const Deno: {
  env: {
    get(name: string): string | undefined;
  };
  serve(handler: (req: Request) => Response | Promise<Response>): void;
};

type ProfileRecord = {
  user_id?: string | null;
  email?: string | null;
  display_name?: string | null;
  created_at?: string | null;
};

type DatabaseWebhookPayload = {
  type?: string;
  table?: string;
  schema?: string;
  record?: ProfileRecord | null;
};

const RESEND_ENDPOINT = 'https://api.resend.com/emails';

function requiredEnv(name: string): string {
  const value = Deno.env.get(name)?.trim();
  if (!value) throw new Error(`Missing required environment variable: ${name}`);
  return value;
}

function adminEmails(): string[] {
  return requiredEnv('ADMIN_SIGNUP_EMAILS')
    .split(',')
    .map((email) => email.trim())
    .filter(Boolean);
}

function escapeHtml(value: string): string {
  return value
    .replaceAll('&', '&amp;')
    .replaceAll('<', '&lt;')
    .replaceAll('>', '&gt;')
    .replaceAll('"', '&quot;')
    .replaceAll("'", '&#39;');
}

function textLine(label: string, value: string): string {
  return `${label}: ${value}`;
}

function htmlLine(label: string, value: string): string {
  return `<p><strong>${escapeHtml(label)}:</strong> ${escapeHtml(value)}</p>`;
}

async function sendSignupEmail(record: ProfileRecord): Promise<void> {
  const apiKey = requiredEnv('RESEND_API_KEY');
  const to = adminEmails();
  const from = Deno.env.get('ADMIN_SIGNUP_FROM')?.trim() || 'Helix <notifications@gethelixapp.org>';
  const projectUrl = Deno.env.get('SUPABASE_URL')?.trim() || 'unknown project';

  if (to.length === 0) {
    throw new Error('ADMIN_SIGNUP_EMAILS must include at least one recipient');
  }

  const email = record.email?.trim() || 'unknown email';
  const userId = record.user_id?.trim() || 'unknown user id';
  const displayName = record.display_name?.trim() || 'unknown display name';
  const createdAt = record.created_at?.trim() || new Date().toISOString();

  const subject = `New Helix signup: ${email}`;
  const lines = [
    textLine('User email', email),
    textLine('User id', userId),
    textLine('Display name', displayName),
    textLine('Signup time', createdAt),
    textLine('Supabase project', projectUrl),
  ];
  const html = [
    '<h1>New Helix signup</h1>',
    htmlLine('User email', email),
    htmlLine('User id', userId),
    htmlLine('Display name', displayName),
    htmlLine('Signup time', createdAt),
    htmlLine('Supabase project', projectUrl),
  ].join('\n');

  const response = await fetch(RESEND_ENDPOINT, {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${apiKey}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      from,
      to,
      subject,
      text: lines.join('\n'),
      html,
    }),
  });

  if (!response.ok) {
    const body = await response.text();
    throw new Error(`Resend request failed with ${response.status}: ${body}`);
  }
}

Deno.serve(async (req) => {
  if (req.method !== 'POST') {
    return new Response(JSON.stringify({ error: 'Method not allowed' }), {
      status: 405,
      headers: { 'Content-Type': 'application/json' },
    });
  }

  try {
    const expectedSecret = requiredEnv('ADMIN_SIGNUP_WEBHOOK_SECRET');
    const actualSecret = req.headers.get('x-helix-webhook-secret')?.trim();
    if (!actualSecret || actualSecret !== expectedSecret) {
      return new Response(JSON.stringify({ error: 'Unauthorized' }), {
        status: 401,
        headers: { 'Content-Type': 'application/json' },
      });
    }

    const payload = (await req.json()) as DatabaseWebhookPayload;
    if (
      payload.type !== 'INSERT' ||
      payload.schema !== 'public' ||
      payload.table !== 'profiles'
    ) {
      return new Response(JSON.stringify({ ignored: true }), {
        status: 200,
        headers: { 'Content-Type': 'application/json' },
      });
    }

    if (!payload.record || typeof payload.record !== 'object') {
      return new Response(JSON.stringify({ error: 'Missing profile record' }), {
        status: 400,
        headers: { 'Content-Type': 'application/json' },
      });
    }

    await sendSignupEmail(payload.record);
    return new Response(JSON.stringify({ ok: true }), {
      status: 200,
      headers: { 'Content-Type': 'application/json' },
    });
  } catch (err) {
    console.error(err);
    return new Response(
      JSON.stringify({
        error: err instanceof Error ? err.message : 'Unexpected error',
      }),
      {
        status: 500,
        headers: { 'Content-Type': 'application/json' },
      },
    );
  }
});

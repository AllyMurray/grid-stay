import { sendMemberInviteEmail } from '../app/lib/email/member-invite.server';

const to = process.argv[2];

if (!to) {
  throw new Error('Usage: jiti scripts/send-member-invite-email-preview.ts <email>');
}

const expiresAt = new Date(Date.now() + 30 * 24 * 60 * 60 * 1000).toISOString();

await sendMemberInviteEmail({
  expiresAt,
  invitedByName: 'Ally Murray',
  request: new Request(process.env.BETTER_AUTH_URL ?? 'https://gridstay.app'),
  to,
});

console.log(`Sent Grid Stay invite email preview to ${to}.`);

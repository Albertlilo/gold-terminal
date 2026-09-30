// Creates a private, git-ignored configuration file; never prints secrets.
// Does not start a server, subscribe a device or make market requests.
const { writeFileSync } = require('node:fs');
const { resolve } = require('node:path');
const { randomBytes } = require('node:crypto');
const { generateVAPIDKeys } = require('web-push');
const { publicKey, privateKey } = generateVAPIDKeys();
const target = resolve(__dirname, '../.env.push.local');
const origin = 'https://gold-terminal-1.onrender.com';
const contents = [
  '# Private server configuration. Do not commit or share this file.',
  '# Copy into Render backend environment settings. This file is not auto-loaded.',
  'PUSH_ENABLED=true', `PUSH_ALLOWED_ORIGINS=${origin}`, `VAPID_SUBJECT=${origin}`,
  `VAPID_PUBLIC_KEY=${publicKey}`, `VAPID_PRIVATE_KEY=${privateKey}`,
  `PUSH_ENROLLMENT_CODE=${randomBytes(32).toString('base64url')}`,
  `PUSH_SCHEDULER_SECRET=${randomBytes(32).toString('base64url')}`,
  'PUSH_RUN_SCHEDULER=false', '',
].join('\n');
try {
  writeFileSync(target, contents, { flag: 'wx', mode: 0o600 });
  console.log('Created backend/.env.push.local. Keep it private; see PUSH_NOTIFICATIONS.md for activation.');
} catch (error) {
  if (error.code === 'EEXIST') console.log('Private push configuration already exists. Keeping the existing keys.');
  else throw error;
}

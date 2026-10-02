const { createAccountAccess } = require('./accountAccess');
let firebase;
function publicConfig() {
  const config = { apiKey: process.env.FIREBASE_WEB_API_KEY, authDomain: process.env.FIREBASE_AUTH_DOMAIN,
    projectId: process.env.FIREBASE_PROJECT_ID, appId: process.env.FIREBASE_WEB_APP_ID };
  return Object.values(config).every(Boolean) && process.env.FIREBASE_SERVICE_ACCOUNT_JSON ? config : null;
}
function auth() {
  if (!firebase) {
    try {
      if (!publicConfig()) throw new Error('Missing configuration');
      const serviceAccount = JSON.parse(process.env.FIREBASE_SERVICE_ACCOUNT_JSON);
      if (serviceAccount.project_id !== process.env.FIREBASE_PROJECT_ID) throw new Error('Project mismatch');
      const { initializeApp, cert } = require('firebase-admin/app');
      firebase = require('firebase-admin/auth').getAuth(initializeApp({ credential: cert(serviceAccount), projectId: serviceAccount.project_id }, 'gold-accounts'));
    } catch { const error = new Error('Authentication unavailable'); error.code = 'auth/configuration-unavailable'; throw error; }
  }
  return firebase;
}
const access = createAccountAccess({
  verify: token => auth().verifyIdToken(token, true), // Also rejects revoked/disabled accounts.
  owners: () => (process.env.OWNER_FIREBASE_UIDS || '').split(',').map(value => value.trim()).filter(Boolean),
  readGrant: async uid => (await require('./candleStore').getAccessCollection()).findOne({ _id: uid }, { maxTimeMS: 3000 }),
});
async function canReceive(device) {
  if (!device?.ownerUid) return false; // Shared-code legacy devices must reconnect.
  let user;
  try { user = await auth().getUser(device.ownerUid); }
  catch (error) { if (error.code === 'auth/user-not-found') return false; throw error; }
  return !user.disabled && user.emailVerified && (await access.entitlement(device.ownerUid)).premium;
}
module.exports = { ...access, publicConfig, canReceive };

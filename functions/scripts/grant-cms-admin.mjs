import { initializeApp, applicationDefault } from "firebase-admin/app";
import { getAuth } from "firebase-admin/auth";
import { createRequire } from "node:module";
import { resolve } from "node:path";
const [projectId, email, action, firebaseCliPath] = process.argv.slice(2);
if (!projectId || !email || !["grant", "revoke"].includes(action)) {
  throw new Error(
    "Usage: node scripts/grant-cms-admin.mjs PROJECT_ID GOOGLE_EMAIL grant|revoke [FIREBASE_CLI_PACKAGE_PATH]",
  );
}
let credential = applicationDefault();
if (firebaseCliPath) {
  const require = createRequire(resolve(firebaseCliPath, "package.json"));
  const cliAuth = require("./lib/auth.js");
  const account = cliAuth.getGlobalDefaultAccount();
  if (!account) throw new Error("Sign in with firebase login first.");
  credential = {
    async getAccessToken() {
      const token = account.tokens.access_token && account.tokens.expires_at > Date.now() + 60000
        ? account.tokens : await cliAuth.getAccessToken(account.tokens.refresh_token, []);
      return { access_token: token.access_token, expires_in: token.expires_in ?? 3600 };
    },
  };
}
initializeApp({ projectId, credential });
const auth = getAuth();
const user = await auth.getUserByEmail(email);
if (
  !user.emailVerified ||
  !user.providerData.some((p) => p.providerId === "google.com")
)
  throw new Error(
    "Account must be a verified Google identity. Sign in once first.",
  );
const claims = { ...user.customClaims };
if (action === "grant") claims.cmsAdmin = true;
else delete claims.cmsAdmin;
await auth.setCustomUserClaims(user.uid, claims);
if (action === "revoke") await auth.revokeRefreshTokens(user.uid);
const verified = await auth.getUser(user.uid);
if ((verified.customClaims?.cmsAdmin === true) !== (action === "grant")) {
  throw new Error("CMS role read-back did not match the requested action.");
}
console.log(
  `CMS role ${action} completed. Sign out and sign in to refresh claims.`,
);

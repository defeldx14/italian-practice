# Google Drive sync setup (optional)

Export/import and local practice work before any of this. Do not enable paid Cloud Translation or add payment information. You need only the **Google Drive API**, an OAuth consent configuration and **two public OAuth client IDs**. This code does not use the assistant's Drive account/connector.

## A. One Google Cloud project and consent screen
1. Open https://console.cloud.google.com/ and create a project named **Parole Italian** (or use a dedicated project you own).
2. In **APIs & Services → Library**, find **Google Drive API**, open it and click **Enable**. Do not enable Cloud Translation. A billing account is not part of these instructions.
3. Open **Google Auth Platform** (or **APIs & Services → OAuth consent screen** if the console shows the older navigation). Complete Branding: app name, your user-support email and developer-contact email.
4. Choose **External** audience for a personal Gmail account. For initial personal testing, leave the publishing state **Testing** and add your own Google email under **Audience → Test users**. Testing is limited to allowlisted users (up to 100). Workspace admins may independently block access.
5. Under **Data Access → Add or remove scopes**, add exactly **https://www.googleapis.com/auth/drive.appdata**. It is classified non-sensitive. Do not add drive, drive.readonly, userinfo, profile or email scopes for this implementation.
6. Create both clients below inside this exact same project. The account and project identify the application's private hidden Drive data; separate projects are separate apps and will not share this data. Test that both clients list the same data after setup.

## B. Chrome-extension OAuth client
1. Keep the extension folder at its permanent path and load it unpacked. Open **chrome://extensions** and copy Italian Hover's **ID**.
2. In Google Auth Platform → **Clients → Create client**, choose **Chrome Extension** (older console may call this Chrome app). Enter a name, and paste that exact extension ID in **Item ID/Application ID**. Create it.
3. Copy the **Client ID**, which ends in **.apps.googleusercontent.com**. This ID is public, not a secret. Never copy a client secret into the extension.
4. Open the extension's **manifest.json** in Notepad. Add this top-level field, with your actual public ID and proper JSON commas:

```json
"oauth2": {
  "client_id": "YOUR-EXTENSION-CLIENT-ID.apps.googleusercontent.com",
  "scopes": ["https://www.googleapis.com/auth/drive.appdata"]
}
```

Alternatively, in PowerShell run the supplied **configure-sync.ps1** from the extension folder. It asks only for the public client ID and edits the manifest. It does not store tokens or secrets.
5. Save, then click **Reload** on the extension in chrome://extensions. Keep the same folder and extension ID; moving/reinstalling unpacked extensions may change the ID and storage. Export first before moving. If the ID changes, update/recreate the Chrome OAuth client to match. A matching stable manifest public key can preserve IDs for distribution, but no signing/private key is included here.
6. In Chrome's normal browser profile, sign in to the intended Google account (getAuthToken uses Chrome identity; Guest/private contexts may fail). Open toolbar popup → **My saved words & sync → Sync & backup**, tick the account confirmation, then **Connect Google Drive**. Approve Chrome's optional identity/API-host permission and Google's app-data consent. If denied, local functionality still works.

## C. Web OAuth client for GitHub Pages / iPhone
1. In that same Cloud project → Clients → Create client, choose **Web application**.
2. Under **Authorized JavaScript origins**, add your actual Pages origin, for example **https://YOUR-USERNAME.github.io**. Do not include **/italian-practice/** or a trailing path. If you use a custom domain, use its exact HTTPS origin instead.
3. For local HTTP testing you can add **http://localhost** and **http://localhost:8765**. The web app must be served via HTTP/HTTPS, not file://. Only localhost can use HTTP; production uses HTTPS.
4. This implementation uses Google Identity Services' popup token model, not a server authorization-code flow. No redirect URI or client secret is used by this app. Leave redirect URIs unused unless required for another client/application you own. Do not put a secret or downloaded credentials JSON in GitHub.
5. Copy the public **Web Client ID**. On the installed iPhone app → **Sync & backup**, paste it into Web OAuth client ID and tap **Save client ID**. Or set webClientId in config.js before uploading; public IDs may safely be committed. These are two different client IDs; do not put the extension client ID in the web setting.
6. Wait for Google sign-in to load, tick the account confirmation, then tap **Connect Google Drive**. Choose the same Google account used by the extension and approve app-data access. If popup blocking occurs, allow the popup or try initial connection in Safari; then connect within the Home Screen app too if it has a separate session. Do not assume Safari's local storage was copied into the Home Screen app.
7. Save one word and sentence on the computer, sync there, then sync on the phone. Confirm the exact word and sentence appear. Rate a card on the phone, sync phone then computer, and confirm review progress. Until this passes, live cross-device sync is not validated.

## Authorization lifetime, publishing and verification
Web tokens are in memory only; refreshing/closing the app requires Connect again. Google controls access-token lifetime (typically around an hour); the app checks expiry. Chrome caches extension tokens through its identity API. A 401 asks you to reconnect. No server or refresh token is stored in this project.

External apps in Testing can have seven-day authorization/refresh-token restrictions when non-basic-identity scopes are requested. This app does not itself issue or keep refresh tokens; nevertheless you may need renewed consent while testing. Only allowlisted test users may authorize the Drive scope. For broader use, change Audience to **In production** and satisfy Google's current branding, domain and policy requirements. The app-data scope is non-sensitive, so it does not by itself require the restricted-scope security assessment; this does not waive branding verification or policy checks Google may require. Production/publishing in Google Auth Platform is separate from publishing code on GitHub or distributing an extension.

If asked for app home page and privacy policy, use your actual Pages URL and **.../italian-practice/privacy.html**, and provide your contact details in Google's configuration. Google may require verified ownership of an authorized domain; if a shared GitHub domain is not accepted for verification, use a domain you control or keep personal testing with allowlisted users. Do not claim a domain you do not own. Do not bypass an unverified-app, admin or consent block; correct the configuration instead.

## Operation and troubleshooting
- Manual sync only. Connect authorizes and starts the first sync; Sync now uses that session. After each device sends changes, the other must sync to receive them.
- Existing local words are merged into whichever Google account you choose. The app asks you to confirm the intended account first; it does not request extra profile/email scopes to identify the account. To switch accounts without merging libraries, export, use a separate browser profile/installation or clear the old local data first.
- Retry Sync for transient failures. Tokens are not persisted on the phone. Reconnect for expired tokens. Scope/client/origin errors require setup fixes, not another paid service.
- 403: verify Drive API is enabled, app-data scope is consented, test user is listed, correct client type/extension ID/origin, and Workspace policy permits access.
- Empty phone library: ensure both clients are in one Cloud project, same Google account, computer synced first, and you connected within the installed app.
- appDataFolder is hidden and cannot be shared or accessed like a normal Drive document. Back up using the app's JSON export.
- Disconnect only stops this client's connection and discards its token. To revoke app access use https://myaccount.google.com/connections . To remove remote app data use Google Drive settings → Manage apps → the app's options for hidden data (UI labels may change).
- Deletion tombstones and historical text remain until all local/remote/backups are removed. Stop other devices before clearing everything.

## Official references (checked 2026-10-15)
- App-data scope, hidden storage, create/list constraints: https://developers.google.com/workspace/drive/api/guides/appdata
- Chrome OAuth client and manifest setup: https://developer.chrome.com/docs/extensions/how-to/integrate/oauth
- Chrome identity API: https://developer.chrome.com/docs/extensions/reference/api/identity
- Google web token model and user-gesture requirement: https://developers.google.com/identity/oauth2/web/guides/use-token-model
- Authorized JavaScript origins: https://developers.google.com/identity/oauth2/web/guides/get-google-api-clientid
- OAuth testing/production: https://developers.google.com/identity/protocols/oauth2/production-readiness/overview
- Drive usage limits/pricing: https://developers.google.com/workspace/drive/api/guides/limits

Google currently lists standard Drive API use at no additional cost and describes future over-quota billing changes. This personal app stays far below the published daily threshold in ordinary use. Do not add billing or paid quota upgrades for this project; consult current Google policy if the console later requires a change.

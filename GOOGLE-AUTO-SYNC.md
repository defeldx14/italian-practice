# Google-only automatic sync

No Domshop account or password is created. Connect Google in the app. Google account identity is obtained directly from Google's userinfo endpoint using the granted access token and openid/email scopes. The stable sub ID selects a separate local data profile and sync journal. Tokens remain in page memory.

Changes are saved locally and synced automatically after a short debounce, on reconnect/focus, and periodically while visible. Expired Google authorization requires an explicit reconnect; there are no silent login popups. Offline changes remain queued. The status line distinguishes offline/pending changes from saved-to-Google progress.

Existing device progress is preserved as an unlinked profile. It is not automatically merged into a new account. After connecting the intended account, use Earlier progress on this device → Add earlier device progress to this account once. Disconnect switches back to unlinked local data. Switching accounts saves and restores separate profiles. This is application-level separation, not encryption against people inspecting an unlocked browser.

Storie and Atlante use separate app-tagged Drive journals. Parola keeps its existing italian-hover-v1 Drive format and remains compatible with its current vocabulary import/export format. Storie-to-Parola vocabulary transfer is still manual.

Google client authorized origins must include https://defeldx14.github.io and https://atlante-italia-dom.airy-bison-8343.chatgpt.site. This release additionally requests openid and email for account identification, plus drive.appdata. It does not request access to ordinary Drive files.

Keep backups. Real Google authorization and a two-device transfer require the user to complete sign-in and have not been validated by the automated tests. Tests cover account isolation, intentional guest import, automatic scheduling, network recovery and unchanged-write loop prevention.

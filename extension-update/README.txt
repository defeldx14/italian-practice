PAROLA: GRAMMAR AND INFINITIVE LIBRARY UPDATE

This overlay adds the Grammar tab, the ten-form reference, an interactive form
quiz, and links saved verb entries to a shared infinitive (for example, messo →
mettere). Existing saved entries are retained. Link forms in the Grammar tab; the
infinitive is not guessed automatically. The extension uses its existing local
or Google-synced vocabulary store and adds no permissions.

PAROLA: BULK PASTE UPDATE

Website: My words > Bulk paste > paste your list > Preview list > Import valid entries.

One entry per line:
Italian | English meaning | Italian sentence | English sentence

The final field is optional. An Italian sentence is required so each entry keeps
its context. Include the exact word or phrase as it occurs in the Italian sentence.
Do not use | characters or line breaks inside a field. Tabs can also separate fields.
Maximum: 1,000 entries per paste, 2 million characters. No headings are needed.

Examples (original practice sentences, not quotes from a news source):
magari | maybe / if only | Magari possiamo partire domani. | Maybe we can leave tomorrow.
accorgersi | to notice / realize | È difficile accorgersi di ogni errore. | It is difficult to notice every mistake.
mano d’opera | workforce / labor | In questa regione manca la mano d’opera. | There is a shortage of labor in this region.

Preview shows invalid lines and duplicates. Only valid new entries are imported.
Deleted entries are not restored. Different sentences may contain the same word.
No translation requests run during paste/import. Missing English sentence translations
remain blank and follow the existing quiz-answer translation feature.
Existing meanings and sentences are never overwritten. The import is one atomic
local save; failed imports leave the existing library unchanged. The app's existing
25,000-event history limit still applies. Export backups regularly.

CHROME EXTENSION UPDATE
This release was prepared away from your Windows computer. It has not modified the
folder from which Chrome loads your unpacked extension.
1. Extract this ZIP.
2. Copy the app folder into your existing Italian Hover extension folder. Merge
   folders and replace matching files. Do not replace your manifest or storage.
3. Reload Italian Hover at chrome://extensions and reopen its Parola tab.
Do not remove the extension or clear its data. No new permissions/OAuth setup.

MAINTENANCE
tools/sync-extension.cjs creates this overlay from the shared web practice source.
The web and extension controllers, importer and styles are identical. The extension
HTML only removes the web-only Google scripts/header and version query strings.

TESTING
Five automated tests passed: actual parser/data-model/controller with mocked DOM
and storage, plus atomic 1000-entry and JSON round-trip tests. Chromium was not
installed in this environment, so live Chrome/iPhone UI tests were not performed.

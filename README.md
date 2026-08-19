# ScriptNovaa website

Upload the contents of this folder to the root of the GitHub Pages website
repository for `scriptnovaa.com`.

## Before publishing

1. Add `music.mp3` at this folder's root if the licensed music file is ready.
2. Confirm `downloads/ShareBrowser.hta` is the current launcher.
3. Keep `CNAME`, `.nojekyll`, `robots.txt`, `sitemap.xml`, and
   `site.webmanifest`.
4. Do not add `node_modules`; this website is static and does not need them.

The website calls `https://api.scriptnovaa.com` for accounts, points, pairing,
tokens, rewards, support, and the timed online demo. Deploy the updated API
folder before publishing this website update so the demo routes are ready.

## New public pages

- `/scriptnova` is the official ScriptNova, ScriptNovaa, and Share Browser guide.
- `/online-demo` is a safe 10-minute interface preview, not a proxy or IP changer.
- `/developer-program` explains the two beta tracks and application process.
- `/points-info` publishes the age-based sponsored-reward wait chances.

## Music

The default daily pick uses `/music.mp3`. Additional licensed tracks can be
listed in `music/playlist.json`. Music never autoplays.

## Google

After GitHub Pages publishes the files, submit
`https://scriptnovaa.com/sitemap.xml` in Google Search Console. Search ranking
and crawl timing are controlled by Google and cannot be guaranteed. Inspect the
home page, `/scriptnova`, `/share-browser`, and `/developer-program`, then
request indexing after the live checks succeed.

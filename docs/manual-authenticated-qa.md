# Manual Authenticated QA Checklist

Run this checklist once Manus OAuth login is accessible without a CAPTCHA block. It closes the two intentionally open TODO items in `todo.md`.

| Step | Action | Expected result |
|---|---|---|
| 1 | Open `/dashboard` and complete Manus OAuth. | Dashboard loads and shows the authenticated account. |
| 2 | Select **New portfolio**. | A draft opens at `/dashboard/portfolios/:id/edit`; the default slug is unique. |
| 3 | Change title, biography, template, palette and font. | The right-hand preview changes instantly with no network request per keystroke. |
| 4 | Upload a JPG, PNG or WebP below 2 MB. | A local preview appears immediately; Save is disabled while upload is pending; the final image URL is managed storage. |
| 5 | Make a valid form change and wait 30 seconds. | Bottom-right toast follows `dirty → saving → saved`; reload retains the data. |
| 6 | Switch to another tab while the form is dirty. | The best-effort visibility-change save runs; browser unload confirmation appears for remaining changes. |
| 7 | Turn on **Publish**, press Save, and open `/<slug>` in a new tab. | The public portfolio loads with the selected template and public content only. |
| 8 | Turn off **Publish**, save, then open the same URL. | The URL returns the designed noindex 404 response. |
| 9 | Try opening or editing another user's portfolio ID. | tRPC rejects access; no user data or image upload is exposed. |

Record the browser and network outcome for every failed step before making code changes. Avoid copying OAuth cookies, passwords, or CAPTCHA data into tickets or chat.

# Project TODO

- [x] Define Drizzle schema for portfolios, social links, publication state, and indexes
- [x] Implement protected portfolio tRPC procedures with ownership checks and slug deduplication
- [x] Implement secure S3-backed avatar and logo upload flow with validation
- [x] Build polished landing page with sign-up and login calls to action
- [x] Build protected dashboard with portfolio list, create, edit, and delete actions
- [x] Build responsive two-column portfolio editor with real-time local preview
- [x] Implement Minimal, Gallery, Cards, and Blog preview templates with CSS variables
- [x] Implement form validation, Cyrillic slug generation, template controls, and social links editor
- [x] Implement 30-second autosave, manual save, four-state status toast, and unsaved-changes guard
- [x] Build public published portfolio route and server-side HTTP 404 handling for drafts or unknown slugs
- [x] Add responsive dark-mode-ready visual polish and motion with reduced-motion support
- [x] Add Vitest coverage for slug generation and protected portfolio procedures, including list/create/remove ownership scopes
- [ ] Manually verify editor save/autosave and published portfolio success flow in an authenticated session
- [ ] Complete the same end-to-end verification after Manus OAuth CAPTCHA can be completed in a browser session
- [x] Document local setup and environment requirements
- [x] Add Vitest coverage proving protected portfolio procedures reject cross-user access
- [x] Run final server typecheck and verify protected portfolio procedures after migration

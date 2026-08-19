# Project Management System

Portfolio Pro now stores projects in the normalized `portfolio_projects` table instead of relying on the legacy portfolio JSON content block. The implementation follows the project’s active stack: **React + tRPC + Drizzle + managed S3**, rather than the Next.js/Prisma/Vercel route conventions referenced in the uploaded brief.

| Requirement area | Implemented location | Behaviour |
|---|---|---|
| Data model | `drizzle/schema.ts` | Stores title, description, images, project URL, tags, dates, sort order and portfolio relation. |
| Secure API | `server/routers.ts` → `projects` | Owner-scoped `list`, `get`, `create`, `update`, `remove`, `reorder`, and `uploadImage` procedures. |
| Image storage | `server/storage.ts` + `ProjectImageDropzone.tsx` | Managed S3 URLs are persisted; original bytes are never stored in MySQL. |
| Create/edit | `ProjectFormPage.tsx` | Shared React Hook Form + Zod form with tags, dates, image previews and upload progress. |
| List management | `ProjectsPage.tsx` | Search, pagination, optimistic delete and Framer Reorder with explicit Save order. |
| Public portfolios | `hydratePortfolioProjects` | Every public or editor portfolio query reads sorted persisted project records for the seven templates. |

## Routes

| Route | Purpose |
|---|---|
| `/dashboard/portfolios/:id/projects` | Searchable, paginated list and drag-to-reorder workspace. |
| `/dashboard/portfolios/:id/projects/new` | Add a project. |
| `/dashboard/portfolios/:id/projects/:projectId/edit` | Edit a project and its images. |

## Image safeguards

The browser accepts JPG, PNG and WebP files only. A file may be at most **5 MB** before upload, and each project has a maximum of **five images**. The client creates a resized WebP derivative (maximum 2048px on its longest side) where Canvas is available, presents a local preview first, then uploads the bytes through the protected server procedure. The server independently validates both size and file signature before calling managed storage. Unreferenced S3 keys are not displayed after a project or image reference is removed; the storage service intentionally exposes no direct object delete helper.

## Manual QA

After OAuth becomes available, run the following checks:

1. Create a project with a valid title, 10+ character description, tags, optional URL and date range.
2. Drag one to five allowed images into the dropzone. Confirm `Подготовка → Загрузка → Готово` progress and local preview.
3. Attempt a sixth image, an unsupported format, and a file above 5 MB. Confirm each produces an accessible error message.
4. Edit the project, reorder its images, remove an image, and save. Reload to confirm persistence.
5. Search project titles, page through a list larger than 12 records, drag cards into a new order, and press **Сохранить порядок**.
6. Delete a project from the confirmation dialog and confirm it disappears immediately. Verify public portfolio templates no longer render it.
7. Attempt project routes with a portfolio that does not belong to the current user. The server should respond with `NOT_FOUND` and reveal no project data.

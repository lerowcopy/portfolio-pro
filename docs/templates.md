# Portfolio Pro Template System

The portfolio renderer lives in `client/src/components/portfolio/PortfolioPreview.tsx`. It selects one of seven typed TSX components according to `portfolio.template`, then injects colour and typography values as safe CSS custom properties. The public `/templates` route is a no-login visual reference with a query-configurable sample state.

| Template | Component | Structure | Responsive behaviour | Motion and interaction |
|---|---|---|---|---|
| **Minimal** | `templates/MinimalTemplate.tsx` | Single-column profile, selected projects, contact form, footer | Projects become a single reading flow below 640px | The parent preview changes template with a 220ms opacity/transform transition. |
| **Gallery** | `templates/GalleryTemplate.tsx` | Compact hero and visual work grid | 1 column by default, 2 at `sm`, 3 at `xl` | Image scale and an accessible details overlay on hover/focus; overlay expands for print. |
| **Cards** | `templates/CardsTemplate.tsx` | Hero panel and detailed project cards | 1 column by default, 2 at `md` | Cards lift on hover with a short transform-only transition. |
| **Blog** | `templates/BlogTemplate.tsx` | Profile, recent projects, notes/archive, contact | Project grid becomes 2 columns at `sm`; notes stay legible as a reading column | Preview transition only; links retain visible keyboard focus. |
| **Creative** | `templates/CreativeTemplate.tsx` | Asymmetric hero and alternating project rows | Alternating media/text layout becomes a linear feed below `md` | Colour-forward hero; no distracting per-item animation. |
| **Agency** | `templates/AgencyTemplate.tsx` | Navigation, services, case studies, team statement, contact | Navigation hides below `sm`; services change to 3 columns at `md` | CTA uses a subtle transform on hover. |
| **Showcase** | `templates/ShowcaseTemplate.tsx` | Full-bleed hero, interactive reel, timeline, about, contact | Project stage becomes one column below `lg`; timeline becomes three columns at `md` | “Play next preview” and project buttons update local React state with no network request. |

## Visual tokens

| Palette | Accent | Intended character |
|---|---|---|
| Blue | `#2764d8` | Clear, product-minded and calm. |
| Dark | `#a78bfa` | Cinematic, high-contrast and immersive. |
| Purple | `#7544d7` | Editorial, expressive and considered. |
| Green | `#0f8b55` | Organic, optimistic and grounded. |
| Warm | `#c2410c` | Energetic, human and memorable. |

Typography options are **Inter** (the default pragmatic sans), **Playfair** (elegant editorial serif), and **Georgia** (classic long-form serif). The template renderer maps the choice through `--p-font`, keeping each component free of hardcoded visual palette values.

## Data contract

The shared `PortfolioInput` type defines projects, services, posts, contact email, social profiles, template, font and palette values. The mock profile used by `/templates` represents development-only sample content; it is not persisted to user portfolios.

```ts
type Project = {
  id: string;
  title: string;
  description: string;
  images: string[];
  tags: string[];
  year: string;
  href?: string;
};
```

## Performance, accessibility and print

The `OptimizedImage` primitive uses native responsive-browser optimisations: `loading="lazy"`, `decoding="async"`, and eager/high-priority loading only for an above-the-fold portrait. Every template begins with a single `h1`, groups content beneath `h2` headings, provides labelled navigation/forms, supports visible focus states, and preserves meaningful image alternative text.

Motion is limited to transform and opacity, is under 500ms, and uses Framer Motion’s reduced-motion hook for the template swap. Tailwind `print:` utilities remove nonessential editor/gallery controls, expose a contact email instead of a form, open Gallery labels, remove preview framing, and mark cards/contact areas as page-break-safe.

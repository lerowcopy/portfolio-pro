import React from "react";
import { ContactForm, ProfileHero, ProjectLink, ProjectMedia, ProjectTags, SectionHeading, SocialNav, TemplateFooter, type TemplatePortfolio } from "./TemplatePrimitives";

export function MinimalTemplate({ portfolio }: { portfolio: TemplatePortfolio }) {
  const projects = portfolio.projects.slice(0, 4);
  return <article className="mx-auto max-w-3xl space-y-14 px-5 py-12 sm:px-10 sm:py-16 print:max-w-none print:px-0"><ProfileHero portfolio={portfolio} /><SocialNav portfolio={portfolio} /><section aria-labelledby="minimal-work"><SectionHeading title="Featured projects" /><div className="space-y-8">{projects.map((project, index) => <article key={project.id} className="grid gap-5 border-b border-[var(--p-border)] pb-8 sm:grid-cols-[11rem_1fr]"><ProjectMedia project={project} index={index} className="aspect-[4/3] w-full rounded-2xl" /><div><p className="text-xs font-semibold text-[var(--p-muted)]">{project.year}</p><h3 className="mt-1 text-xl font-semibold tracking-[-0.035em]">{project.title}</h3><p className="mt-2 text-sm leading-6 text-[var(--p-muted)]">{project.description}</p><div className="mt-4"><ProjectTags tags={project.tags} /></div><ProjectLink project={project} className="mt-4" /></div></article>)}</div></section><ContactForm portfolio={portfolio} /><TemplateFooter portfolio={portfolio} /></article>;
}

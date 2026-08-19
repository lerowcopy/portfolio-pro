import React from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";
import type { PortfolioInput } from "@shared/portfolio";
import { AgencyTemplate } from "./AgencyTemplate";
import { BlogTemplate } from "./BlogTemplate";
import { CardsTemplate } from "./CardsTemplate";
import { CreativeTemplate } from "./CreativeTemplate";
import { GalleryTemplate } from "./GalleryTemplate";
import { MinimalTemplate } from "./MinimalTemplate";
import { ShowcaseTemplate } from "./ShowcaseTemplate";

const portfolio: PortfolioInput = {
  title: "John Doe — Product Designer",
  bio: "Crafting digital experiences that matter.",
  avatarUrl: "/avatar.jpg",
  logoUrl: "/logo.png",
  socialLinks: [{ id: "linkedin", platform: "linkedin", url: "https://linkedin.com/in/johndoe" }],
  template: "minimal",
  colorScheme: "warm",
  fontFamily: "inter",
  projects: [{ id: "fitness", title: "Mobile App Redesign", description: "Complete overhaul of a fitness app.", images: ["/project1-1.jpg"], tags: ["UI Design", "UX"], year: "2026" }],
  services: [{ id: "strategy", title: "Product strategy", description: "Finding focus before execution." }],
  posts: [{ id: "note", title: "Designing for momentum", excerpt: "A short note about making progress visible.", date: "June 2026" }],
  contactEmail: "john@example.com",
  slug: "john-doe",
  slugManuallyEdited: false,
  isPublished: true,
};

const templates = [MinimalTemplate, GalleryTemplate, CardsTemplate, BlogTemplate, CreativeTemplate, AgencyTemplate, ShowcaseTemplate];

describe("portfolio templates", () => {
  it.each(templates)("renders a semantic accessible structure for %p", (Template) => {
    const html = renderToStaticMarkup(<Template portfolio={portfolio} />);
    expect(html).toContain("<h1");
    expect(html).toContain("<h2");
    expect(html).toContain("John Doe");
  });

  it("keeps Showcase stable when a new portfolio has no projects", () => {
    const html = renderToStaticMarkup(<ShowcaseTemplate portfolio={{ ...portfolio, projects: [] }} />);
    expect(html).toContain("A work in progress");
  });

  it("exposes print-safe contact, gallery overlay and interactive control handling", () => {
    const gallery = renderToStaticMarkup(<GalleryTemplate portfolio={portfolio} />);
    const showcase = renderToStaticMarkup(<ShowcaseTemplate portfolio={portfolio} />);
    const minimal = renderToStaticMarkup(<MinimalTemplate portfolio={portfolio} />);
    expect(gallery).toContain("print:opacity-100");
    expect(showcase).toContain("print:hidden");
    expect(minimal).toContain("print:break-inside-avoid");
  });
});

import { Loader2 } from "lucide-react";
import { useRoute } from "wouter";
import { PortfolioPreview, type PreviewPortfolio } from "@/components/portfolio/PortfolioPreview";
import { trpc } from "@/lib/trpc";

export default function PublicPortfolioPage() {
  const [, params] = useRoute("/:slug");
  const slug = params?.slug || "";
  const query = trpc.publicPortfolio.bySlug.useQuery({ slug }, { enabled: slug.length >= 3 });
  if (query.isLoading) return <div className="grid min-h-svh place-items-center bg-white"><Loader2 className="size-5 animate-spin text-violet-600" /></div>;
  if (query.error || !query.data) return <main className="grid min-h-svh place-items-center bg-slate-950 p-6 text-center text-white"><div><p className="text-xs font-bold uppercase tracking-[0.15em] text-violet-300">404</p><h1 className="mt-3 font-display text-5xl tracking-[-0.06em]">This page is private.</h1><p className="mt-4 text-sm text-slate-400">It may have moved, or its maker has chosen not to publish it yet.</p><a href="/" className="mt-8 inline-flex rounded-full bg-white px-5 py-2.5 text-sm font-semibold text-slate-950">Visit Portfolio Pro</a></div></main>;
  const portfolio: PreviewPortfolio = { title: query.data.title, bio: query.data.bio, logoUrl: query.data.logoUrl, avatarUrl: query.data.avatarUrl, socialLinks: query.data.socialLinks, template: query.data.template, colorScheme: query.data.colorScheme, fontFamily: query.data.fontFamily };
  return <div className="min-h-svh"><PortfolioPreview portfolio={portfolio} showFrame={false} className="min-h-svh" /></div>;
}

import { zodResolver } from "@hookform/resolvers/zod";
import { useCallback, useEffect, useRef, useState } from "react";
import { Controller, useFieldArray, useForm, useWatch } from "react-hook-form";
import { ArrowLeft, ExternalLink, ImagePlus, Loader2, Plus, Save, Trash2, UploadCloud } from "lucide-react";
import { Link, useLocation, useRoute } from "wouter";
import { AppMark } from "@/components/AppMark";
import { ThemeToggle } from "@/components/ThemeToggle";
import { EditorStatusToast, type EditorStatus } from "@/components/portfolio/EditorStatusToast";
import { PortfolioPreview } from "@/components/portfolio/PortfolioPreview";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Switch } from "@/components/ui/switch";
import { Textarea } from "@/components/ui/textarea";
import { useAuth } from "@/_core/hooks/useAuth";
import { trpc } from "@/lib/trpc";
import { isExternalRuntime } from "@/lib/externalRuntime";
import { shouldRedirectUnauthenticatedRoute } from "@/lib/authRouteGuard";
import { portfolioColorSchemes, portfolioFontFamilies, portfolioInputSchema, portfolioTemplates, socialPlatforms, type PortfolioInput, type SocialPlatform } from "@shared/portfolio";

const AUTOSAVE_MS = 30_000;
const cyrillic: Record<string, string> = { а:"a",б:"b",в:"v",г:"g",д:"d",е:"e",ё:"e",ж:"zh",з:"z",и:"i",й:"y",к:"k",л:"l",м:"m",н:"n",о:"o",п:"p",р:"r",с:"s",т:"t",у:"u",ф:"f",х:"h",ц:"ts",ч:"ch",ш:"sh",щ:"sch",ъ:"",ы:"y",ь:"",э:"e",ю:"yu",я:"ya" };
const slugSuggestion = (value: string) => { const slug = value.toLowerCase().replace(/[а-яё]/g, (letter) => cyrillic[letter] || "").normalize("NFD").replace(/[\u0300-\u036f]/g, "").replace(/[^a-z0-9]+/g,"-").replace(/^-+|-+$/g,"").slice(0,50); return slug.length >= 3 ? slug : "portfolio"; };
const templateLabels = { minimal: "Minimal", gallery: "Gallery", cards: "Cards", blog: "Blog", creative: "Creative", agency: "Agency", showcase: "Showcase" } as const;
const colorLabels = { blue: "Blue", dark: "Dark", purple: "Purple", green: "Green", warm: "Warm" } as const;
const fontLabels = { inter: "Inter", playfair: "Playfair", georgia: "Georgia" } as const;

type ExternalPortfolioPayload = PortfolioInput & { logoStoragePath?: string; avatarStoragePath?: string };

function toFormValues(portfolio: PortfolioInput): PortfolioInput { return { ...portfolio, projects: portfolio.projects ?? [], services: portfolio.services ?? [], posts: portfolio.posts ?? [], contactEmail: portfolio.contactEmail ?? "" }; }

export default function PortfolioEditorPage() {
  const [, params] = useRoute("/dashboard/portfolios/:id/edit");
  const id = isExternalRuntime ? params?.id ?? "" : Number(params?.id);
  const [, setLocation] = useLocation();
  const { isAuthenticated, loading } = useAuth();
  const query = trpc.portfolios.get.useQuery({ id: id as never }, { enabled: isAuthenticated && (isExternalRuntime ? Boolean(id) : Number.isInteger(id) && Number(id) > 0) });
  useEffect(() => { if (shouldRedirectUnauthenticatedRoute(loading, isAuthenticated)) setLocation("/dashboard"); }, [isAuthenticated, loading, setLocation]);
  if (loading) return <div className="grid min-h-svh place-items-center"><Loader2 className="size-5 animate-spin text-violet-600" /></div>;
  if (!isAuthenticated) return null;
  if (query.isLoading) return <div className="grid min-h-svh place-items-center"><Loader2 className="size-5 animate-spin text-violet-600" /></div>;
  if (query.error || !query.data) return <div className="grid min-h-svh place-items-center p-6 text-center"><div><p className="text-sm text-slate-500">This portfolio could not be found.</p><Button asChild className="mt-4 rounded-full"><Link href="/dashboard">Back to dashboard</Link></Button></div></div>;
  const initial = query.data as unknown as ExternalPortfolioPayload;
  return <PortfolioEditor portfolioId={id} initialValues={toFormValues(initial)} initialStoragePaths={{ logo: initial.logoStoragePath ?? "", avatar: initial.avatarStoragePath ?? "" }} />;
}

function PortfolioEditor({ portfolioId, initialValues, initialStoragePaths }: { portfolioId: string | number; initialValues: PortfolioInput; initialStoragePaths: { logo: string; avatar: string } }) {
  const [, setLocation] = useLocation();
  const form = useForm<PortfolioInput>({ resolver: zodResolver(portfolioInputSchema), defaultValues: initialValues, mode: "onTouched", reValidateMode: "onChange" });
  const watched = useWatch({ control: form.control }) as PortfolioInput;
  const { fields, append, remove } = useFieldArray({ control: form.control, name: "socialLinks", keyName: "fieldId" });
  const [status, setStatus] = useState<EditorStatus>("idle");
  const [message, setMessage] = useState<string>();
  const [uploadingFields, setUploadingFields] = useState({ logo: false, avatar: false });
  const saving = useRef(false);
  const storagePaths = useRef(initialStoragePaths);
  const utils = trpc.useUtils();
  const update = trpc.portfolios.update.useMutation();
  const upload = trpc.portfolios.uploadImage.useMutation();
  const usedPlatforms = new Set((watched.socialLinks || []).map((link) => link.platform));
  const nextPlatform = socialPlatforms.find((platform) => !usedPlatforms.has(platform));

  const save = useCallback(async () => {
    if (saving.current || !form.formState.isDirty) return;
    if (uploadingFields.logo || uploadingFields.avatar) {
      setStatus("dirty");
      setMessage("Finish the image upload before saving changes.");
      return;
    }
    if (!(await form.trigger())) { setStatus("error"); setMessage("Complete the highlighted fields before saving."); return; }
    saving.current = true; setStatus("saving"); setMessage(undefined);
    try {
      const displayedValues = form.getValues();
      const values = isExternalRuntime ? { ...displayedValues, logoUrl: storagePaths.current.logo, avatarUrl: storagePaths.current.avatar } : displayedValues;
      const saved = await update.mutateAsync({ id: portfolioId as never, values });
      const externalSaved = saved as unknown as ExternalPortfolioPayload;
      storagePaths.current = { logo: externalSaved.logoStoragePath ?? "", avatar: externalSaved.avatarStoragePath ?? "" };
      form.reset(toFormValues(externalSaved));
      await utils.portfolios.list.invalidate();
      setStatus("saved");
    }
    catch (error) { setStatus("error"); setMessage(error instanceof Error ? error.message : "Please check your connection and try again."); }
    finally { saving.current = false; }
  }, [form, portfolioId, update, uploadingFields, utils.portfolios.list]);

  useEffect(() => { if (form.formState.isDirty && !saving.current) setStatus("dirty"); }, [form.formState.isDirty]);
  useEffect(() => { if (!watched.logoUrl) storagePaths.current.logo = ""; if (!watched.avatarUrl) storagePaths.current.avatar = ""; }, [watched.avatarUrl, watched.logoUrl]);
  useEffect(() => { const timer = window.setInterval(() => { void save(); }, AUTOSAVE_MS); return () => window.clearInterval(timer); }, [save]);
  useEffect(() => { if (!uploadingFields.logo && !uploadingFields.avatar && form.formState.isDirty) void save(); }, [form.formState.isDirty, save, uploadingFields]);
  useEffect(() => { const beforeUnload = (event: BeforeUnloadEvent) => { if (!form.formState.isDirty) return; event.preventDefault(); event.returnValue = ""; }; const visibility = () => { if (document.visibilityState === "hidden" && form.formState.isDirty) void save(); }; window.addEventListener("beforeunload", beforeUnload); document.addEventListener("visibilitychange", visibility); return () => { window.removeEventListener("beforeunload", beforeUnload); document.removeEventListener("visibilitychange", visibility); }; }, [form.formState.isDirty, save]);

  async function uploadFile(file: File, kind: "logo" | "avatar") {
    if (!["image/jpeg", "image/png", "image/webp"].includes(file.type) || file.size > 2 * 1024 * 1024) throw new Error("Use JPG, PNG or WebP under 2 MB.");
    const field = kind === "logo" ? "logoUrl" : "avatarUrl";
    const previousUrl = form.getValues(field);
    const localUrl = URL.createObjectURL(file); form.setValue(field, localUrl, { shouldDirty: true });
    const base64 = await new Promise<string>((resolve, reject) => { const reader = new FileReader(); reader.onload = () => resolve(String(reader.result).split(",")[1] || ""); reader.onerror = () => reject(new Error("Could not read this image.")); reader.readAsDataURL(file); });
    setUploadingFields((current) => ({ ...current, [kind]: true }));
    try {
      const result = await upload.mutateAsync({ portfolioId: portfolioId as never, kind, mimeType: file.type as "image/jpeg" | "image/png" | "image/webp", base64 }) as unknown as { url: string; storagePath?: string };
      if (isExternalRuntime && !result.storagePath) throw new Error("Хранилище не вернуло защищённый путь изображения.");
      storagePaths.current[kind] = result.storagePath ?? "";
      form.setValue(field, result.url, { shouldDirty: true });
      URL.revokeObjectURL(localUrl);
    }
    catch (error) { form.setValue(field, previousUrl, { shouldDirty: true }); URL.revokeObjectURL(localUrl); throw error; }
    finally { setUploadingFields((current) => ({ ...current, [kind]: false })); }
  }

  function updateTitle(value: string) { form.setValue("title", value, { shouldDirty: true, shouldValidate: true }); if (!form.getValues("slugManuallyEdited")) form.setValue("slug", slugSuggestion(value), { shouldDirty: true, shouldValidate: true }); }
  const fieldError = (name: keyof PortfolioInput) => form.formState.errors[name]?.message as string | undefined;

  return <div className="min-h-svh bg-[#f8f8fa] text-slate-950 dark:bg-[#090a0f] dark:text-white"><header className="sticky top-0 z-30 border-b border-slate-200/80 bg-[#f8f8fa]/90 backdrop-blur-xl dark:border-white/10 dark:bg-[#090a0f]/90"><div className="mx-auto flex h-[4.5rem] max-w-[100rem] items-center justify-between gap-4 px-5 sm:px-7"><div className="flex min-w-0 items-center gap-3"><Button variant="ghost" size="icon" className="rounded-full" onClick={() => setLocation("/dashboard")} aria-label="Back to dashboard"><ArrowLeft className="size-4" /></Button><div className="min-w-0"><p className="truncate text-sm font-semibold">{watched.title || "Untitled portfolio"}</p><p className="truncate text-xs text-slate-500 dark:text-slate-400">portfolio.pro/{watched.slug || "portfolio"}</p></div></div><div className="flex items-center gap-2"><ThemeToggle /><Button asChild variant="outline" size="sm" className="hidden rounded-full sm:inline-flex"><Link href={`/dashboard/portfolios/${portfolioId}/projects`}>Projects</Link></Button>{watched.isPublished ? <Button asChild variant="outline" size="sm" className="hidden rounded-full sm:inline-flex"><a href={`/${watched.slug}`} target="_blank" rel="noreferrer"><ExternalLink className="mr-1.5 size-3.5" />View</a></Button> : null}<Button type="button" onClick={() => void save()} disabled={!form.formState.isDirty || status === "saving" || uploadingFields.logo || uploadingFields.avatar} className="rounded-full bg-violet-700 text-white hover:bg-violet-800 dark:bg-violet-500 dark:hover:bg-violet-400"><Save className="mr-1.5 size-3.5" />{status === "saving" ? "Saving" : uploadingFields.logo || uploadingFields.avatar ? "Uploading" : "Save"}</Button></div></div></header><main className="mx-auto grid max-w-[100rem] gap-6 p-5 sm:p-7 lg:grid-cols-[minmax(23rem,0.8fr)_minmax(0,1.2fr)] lg:gap-8"><section className="h-fit overflow-hidden rounded-[1.5rem] border border-slate-200 bg-white shadow-[0_10px_35px_-28px_rgba(15,23,42,0.35)] dark:border-white/10 dark:bg-slate-900"><div className="border-b border-slate-200 px-5 py-4 dark:border-white/10"><AppMark href="/dashboard" className="text-sm" /></div><form onSubmit={(event) => { event.preventDefault(); void save(); }} className="space-y-8 p-5 sm:p-6"><section className="space-y-4"><div><h1 className="text-lg font-semibold tracking-[-0.03em]">Your profile</h1><p className="mt-1 text-sm leading-6 text-slate-500 dark:text-slate-400">Shape the story visitors meet first.</p></div><div><Label htmlFor="title">Portfolio title</Label><Input id="title" value={watched.title} onChange={(event) => updateTitle(event.target.value)} className="mt-2 h-11 rounded-xl" aria-invalid={!!fieldError("title")} /><FieldError message={fieldError("title")} /></div><div><div className="flex justify-between gap-3"><Label htmlFor="bio">Biography</Label><span className="text-xs text-slate-400">{(watched.bio || "").length}/2000</span></div><Textarea id="bio" rows={5} value={watched.bio} onChange={(event) => form.setValue("bio", event.target.value, { shouldDirty: true })} className="mt-2 rounded-xl" /><FieldError message={fieldError("bio")} /></div><div className="grid gap-4 sm:grid-cols-2"><ImageField label="Avatar" value={watched.avatarUrl} onChange={(file) => uploadFile(file,"avatar")} onClear={() => form.setValue("avatarUrl", "", { shouldDirty: true })} /><ImageField label="Logo" value={watched.logoUrl} onChange={(file) => uploadFile(file,"logo")} onClear={() => form.setValue("logoUrl", "", { shouldDirty: true })} /></div></section><section className="space-y-4 border-t border-slate-200 pt-7 dark:border-white/10"><div><h2 className="text-base font-semibold">Public URL</h2><p className="mt-1 text-sm text-slate-500 dark:text-slate-400">Generated from your name, or make it your own.</p></div><div><Label htmlFor="slug">portfolio.pro/</Label><Input id="slug" value={watched.slug} onChange={(event) => { form.setValue("slug", slugSuggestion(event.target.value), { shouldDirty: true, shouldValidate: true }); form.setValue("slugManuallyEdited", true, { shouldDirty: true }); }} className="mt-2 h-11 rounded-xl font-mono text-sm" /><FieldError message={fieldError("slug")} /></div></section><section className="space-y-4 border-t border-slate-200 pt-7 dark:border-white/10"><div><h2 className="text-base font-semibold">Art direction</h2><p className="mt-1 text-sm text-slate-500 dark:text-slate-400">Every selection is reflected on the right, instantly.</p></div><div className="grid gap-4"><SelectField label="Template" value={watched.template} items={portfolioTemplates} labels={templateLabels} onChange={(value) => form.setValue("template", value as PortfolioInput["template"], { shouldDirty: true })} /><SelectField label="Colour scheme" value={watched.colorScheme} items={portfolioColorSchemes} labels={colorLabels} onChange={(value) => form.setValue("colorScheme", value as PortfolioInput["colorScheme"], { shouldDirty: true })} /><SelectField label="Typography" value={watched.fontFamily} items={portfolioFontFamilies} labels={fontLabels} onChange={(value) => form.setValue("fontFamily", value as PortfolioInput["fontFamily"], { shouldDirty: true })} /></div></section><section className="space-y-4 border-t border-slate-200 pt-7 dark:border-white/10"><div className="flex items-start justify-between gap-3"><div><h2 className="text-base font-semibold">Social links</h2><p className="mt-1 text-sm text-slate-500 dark:text-slate-400">Add up to five places to find you.</p></div><Button type="button" variant="outline" size="sm" className="rounded-full" disabled={!nextPlatform} onClick={() => nextPlatform && append({ id: crypto.randomUUID(), platform: nextPlatform, url: "" })}><Plus className="mr-1 size-3.5" />Add</Button></div><div className="space-y-3">{fields.map((item, index) => <div className="rounded-xl border border-slate-200 p-3 dark:border-white/10" key={item.fieldId}><div className="grid gap-2 sm:grid-cols-[8.25rem_1fr_auto]"><Controller control={form.control} name={`socialLinks.${index}.platform`} render={({ field }) => <Select value={field.value} onValueChange={field.onChange}><SelectTrigger className="h-10 rounded-lg"><SelectValue /></SelectTrigger><SelectContent>{socialPlatforms.map((platform) => <SelectItem key={platform} value={platform} disabled={platform !== field.value && usedPlatforms.has(platform)}>{platform}</SelectItem>)}</SelectContent></Select>} /><Input className="h-10 rounded-lg" placeholder="https://…" {...form.register(`socialLinks.${index}.url`)} /><Button type="button" variant="ghost" size="icon" className="size-10 rounded-lg text-slate-500 hover:text-red-600" onClick={() => remove(index)} aria-label="Remove social link"><Trash2 className="size-4" /></Button></div><FieldError message={form.formState.errors.socialLinks?.[index]?.url?.message} /></div>)}</div></section><section className="border-t border-slate-200 pt-7 dark:border-white/10"><div className="flex items-start justify-between gap-4 rounded-2xl bg-violet-50 p-4 dark:bg-violet-400/10"><div><Label htmlFor="publish" className="text-sm font-semibold">Publish this portfolio</Label><p className="mt-1 max-w-md text-xs leading-5 text-violet-900/65 dark:text-violet-100/65">When turned off, your public URL returns a 404 page.</p></div><Switch id="publish" checked={watched.isPublished} onCheckedChange={(value) => form.setValue("isPublished", value, { shouldDirty: true })} /></div></section></form></section><aside className="min-w-0 lg:sticky lg:top-[6.15rem] lg:h-[calc(100svh-7.5rem)] lg:overflow-y-auto"><PortfolioPreview portfolio={watched} /></aside></main><EditorStatusToast status={status} message={message} /></div>;
}

function FieldError({ message }: { message?: string }) { return message ? <p role="alert" className="mt-1.5 text-xs font-medium text-red-600 dark:text-red-400">{message}</p> : null; }
function SelectField({ label, value, items, labels, onChange }: { label: string; value: string; items: readonly string[]; labels: Record<string,string>; onChange: (value: string) => void }) { return <div><Label>{label}</Label><Select value={value} onValueChange={onChange}><SelectTrigger className="mt-2 h-11 rounded-xl"><SelectValue /></SelectTrigger><SelectContent>{items.map((item) => <SelectItem key={item} value={item}>{labels[item]}</SelectItem>)}</SelectContent></Select></div>; }
function ImageField({ label, value, onChange, onClear }: { label: string; value: string; onChange: (file: File) => Promise<void>; onClear: () => void }) { const [busy, setBusy] = useState(false); const [error, setError] = useState<string>(); const inputId = `upload-${label.toLowerCase()}`; return <div><Label htmlFor={inputId}>{label}</Label><div className="mt-2 flex gap-3 rounded-xl border border-dashed border-slate-300 bg-slate-50/70 p-3 dark:border-white/15 dark:bg-white/[0.025]"><div className="grid size-12 shrink-0 place-items-center overflow-hidden rounded-lg bg-white text-slate-400 dark:bg-slate-800">{value ? <img src={value} alt={`${label} preview`} className="size-full object-cover" /> : <ImagePlus className="size-4" />}</div><div className="min-w-0 flex-1"><input id={inputId} className="sr-only" type="file" accept="image/jpeg,image/png,image/webp" onChange={async (event) => { const file = event.target.files?.[0]; event.target.value=""; if (!file) return; setBusy(true); setError(undefined); try { await onChange(file); } catch (caught) { setError(caught instanceof Error ? caught.message : "Upload failed."); } finally { setBusy(false); } }} /><div className="flex flex-wrap gap-1.5"><Button asChild type="button" variant="outline" size="sm" disabled={busy} className="h-8 rounded-lg text-xs"><label htmlFor={inputId} className="cursor-pointer"><UploadCloud className="mr-1 size-3.5" />{busy ? "Uploading" : "Upload"}</label></Button>{value ? <Button type="button" size="sm" variant="ghost" onClick={onClear} className="h-8 rounded-lg text-xs text-slate-500">Remove</Button> : null}</div>{error ? <p className="mt-1 text-xs text-red-600">{error}</p> : <p className="mt-1 text-xs text-slate-400">JPG, PNG or WebP · 2 MB max</p>}</div></div></div>; }

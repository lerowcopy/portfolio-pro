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
import { useLanguage } from "@/contexts/LanguageContext";
import { shouldRedirectUnauthenticatedRoute } from "@/lib/authRouteGuard";
import { cloneEditorStoragePaths } from "@/lib/editorSaveBarState";
import { translateEditorValidationMessage } from "@/lib/editorValidation";
import { isExternalRuntime } from "@/lib/externalRuntime";
import { trpc } from "@/lib/trpc";
import { portfolioColorSchemes, portfolioFontFamilies, portfolioInputSchema, portfolioTemplates, socialPlatforms, type PortfolioInput } from "@shared/portfolio";

const cyrillic: Record<string, string> = { а: "a", б: "b", в: "v", г: "g", д: "d", е: "e", ё: "e", ж: "zh", з: "z", и: "i", й: "y", к: "k", л: "l", м: "m", н: "n", о: "o", п: "p", р: "r", с: "s", т: "t", у: "u", ф: "f", х: "h", ц: "ts", ч: "ch", ш: "sh", щ: "sch", ъ: "", ы: "y", ь: "", э: "e", ю: "yu", я: "ya" };
const slugSuggestion = (value: string) => {
  const slug = value.toLowerCase().replace(/[а-яё]/g, (letter) => cyrillic[letter] || "").normalize("NFD").replace(/[\u0300-\u036f]/g, "").replace(/[^a-z0-9]+/g, "-").replace(/^-+|-+$/g, "").slice(0, 50);
  return slug.length >= 3 ? slug : "portfolio";
};

type ExternalPortfolioPayload = PortfolioInput & { logoStoragePath?: string; avatarStoragePath?: string };
type StoragePaths = { logo: string; avatar: string };

function toFormValues(portfolio: PortfolioInput): PortfolioInput {
  return { ...portfolio, projects: portfolio.projects ?? [], services: portfolio.services ?? [], posts: portfolio.posts ?? [], contactEmail: portfolio.contactEmail ?? "" };
}

export default function PortfolioEditorPage() {
  const [, params] = useRoute("/dashboard/portfolios/:id/edit");
  const id = isExternalRuntime ? params?.id ?? "" : Number(params?.id);
  const [, setLocation] = useLocation();
  const { isAuthenticated, loading } = useAuth();
  const { t } = useLanguage();
  const query = trpc.portfolios.get.useQuery({ id: id as never }, { enabled: isAuthenticated && (isExternalRuntime ? Boolean(id) : Number.isInteger(id) && Number(id) > 0) });

  useEffect(() => {
    if (shouldRedirectUnauthenticatedRoute(loading, isAuthenticated)) setLocation("/dashboard");
  }, [isAuthenticated, loading, setLocation]);

  if (loading || query.isLoading) return <div className="grid min-h-svh place-items-center"><Loader2 className="size-5 animate-spin text-violet-600" /></div>;
  if (!isAuthenticated) return null;
  if (query.error || !query.data) return <div className="grid min-h-svh place-items-center p-6 text-center"><div><p className="text-sm text-slate-500">{t("editor.notFound")}</p><Button asChild className="mt-4 rounded-full"><Link href="/dashboard">{t("editor.backDashboard")}</Link></Button></div></div>;

  const initial = query.data as unknown as ExternalPortfolioPayload;
  return <PortfolioEditor initialStoragePaths={{ logo: initial.logoStoragePath ?? "", avatar: initial.avatarStoragePath ?? "" }} initialValues={toFormValues(initial)} portfolioId={id} />;
}

function PortfolioEditor({ portfolioId, initialValues, initialStoragePaths }: { portfolioId: string | number; initialValues: PortfolioInput; initialStoragePaths: StoragePaths }) {
  const [, setLocation] = useLocation();
  const { locale, t } = useLanguage();
  const form = useForm<PortfolioInput>({ resolver: zodResolver(portfolioInputSchema), defaultValues: initialValues, mode: "onTouched", reValidateMode: "onChange" });
  const watched = useWatch({ control: form.control }) as PortfolioInput;
  const { fields, append, remove } = useFieldArray({ control: form.control, name: "socialLinks", keyName: "fieldId" });
  const [status, setStatus] = useState<EditorStatus>("idle");
  const [message, setMessage] = useState<string>();
  const [uploadingFields, setUploadingFields] = useState({ logo: false, avatar: false });
  const saving = useRef(false);
  const storagePaths = useRef(cloneEditorStoragePaths(initialStoragePaths));
  const savedStoragePaths = useRef(cloneEditorStoragePaths(initialStoragePaths));
  const utils = trpc.useUtils();
  const update = trpc.portfolios.update.useMutation();
  const upload = trpc.portfolios.uploadImage.useMutation();
  const usedPlatforms = new Set((watched.socialLinks || []).map((link) => link.platform));
  const nextPlatform = socialPlatforms.find((platform) => !usedPlatforms.has(platform));
  const templateLabels = { minimal: t("editor.templateMinimal"), gallery: t("editor.templateGallery"), cards: t("editor.templateCards"), blog: t("editor.templateBlog"), creative: t("editor.templateCreative"), agency: t("editor.templateAgency"), showcase: t("editor.templateShowcase") } as const;
  const colorLabels = { blue: t("editor.colorBlue"), dark: t("editor.colorDark"), purple: t("editor.colorPurple"), green: t("editor.colorGreen"), warm: t("editor.colorWarm") } as const;
  const fontLabels = { inter: "Inter", playfair: "Playfair", georgia: "Georgia" } as const;

  const save = useCallback(async () => {
    if (saving.current || !form.formState.isDirty) return;
    if (uploadingFields.logo || uploadingFields.avatar) {
      setStatus("dirty");
      setMessage(t("editor.completeUpload"));
      return;
    }
    if (!(await form.trigger())) {
      setStatus("error");
      setMessage(t("editor.completeFields"));
      return;
    }
    saving.current = true;
    setStatus("saving");
    setMessage(undefined);
    try {
      const displayedValues = form.getValues();
      const values = isExternalRuntime ? { ...displayedValues, logoUrl: storagePaths.current.logo, avatarUrl: storagePaths.current.avatar } : displayedValues;
      const saved = await update.mutateAsync({ id: portfolioId as never, values });
      const externalSaved = saved as unknown as ExternalPortfolioPayload;
      storagePaths.current = { logo: externalSaved.logoStoragePath ?? "", avatar: externalSaved.avatarStoragePath ?? "" };
      savedStoragePaths.current = cloneEditorStoragePaths(storagePaths.current);
      form.reset(toFormValues(externalSaved));
      await utils.portfolios.list.invalidate();
      setStatus("saved");
    } catch (error) {
      setStatus("error");
      setMessage(error instanceof Error ? error.message : t("editor.connection"));
    } finally {
      saving.current = false;
    }
  }, [form, portfolioId, t, update, uploadingFields, utils.portfolios.list]);

  useEffect(() => { if (form.formState.isDirty && !saving.current) setStatus("dirty"); }, [form.formState.isDirty]);
  useEffect(() => { if (!watched.logoUrl) storagePaths.current.logo = ""; if (!watched.avatarUrl) storagePaths.current.avatar = ""; }, [watched.avatarUrl, watched.logoUrl]);
  const cancelChanges = useCallback(() => { if (saving.current) return; storagePaths.current = cloneEditorStoragePaths(savedStoragePaths.current); form.reset(); setMessage(undefined); setStatus("idle"); }, [form]);
  useEffect(() => {
    const beforeUnload = (event: BeforeUnloadEvent) => { if (!form.formState.isDirty) return; event.preventDefault(); event.returnValue = ""; };
    window.addEventListener("beforeunload", beforeUnload);
    return () => window.removeEventListener("beforeunload", beforeUnload);
  }, [form.formState.isDirty]);

  async function uploadFile(file: File, kind: "logo" | "avatar") {
    if (!["image/jpeg", "image/png", "image/webp"].includes(file.type) || file.size > 2 * 1024 * 1024) throw new Error(t("editor.invalidImage"));
    const field = kind === "logo" ? "logoUrl" : "avatarUrl";
    const previousUrl = form.getValues(field);
    const localUrl = URL.createObjectURL(file);
    form.setValue(field, localUrl, { shouldDirty: true });
    const base64 = await new Promise<string>((resolve, reject) => {
      const reader = new FileReader();
      reader.onload = () => resolve(String(reader.result).split(",")[1] || "");
      reader.onerror = () => reject(new Error(t("editor.readImage")));
      reader.readAsDataURL(file);
    });
    setUploadingFields((current) => ({ ...current, [kind]: true }));
    try {
      const result = await upload.mutateAsync({ portfolioId: portfolioId as never, kind, mimeType: file.type as "image/jpeg" | "image/png" | "image/webp", base64 }) as unknown as { url: string; storagePath?: string };
      if (isExternalRuntime && !result.storagePath) throw new Error(t("editor.storagePath"));
      storagePaths.current[kind] = result.storagePath ?? "";
      form.setValue(field, result.url, { shouldDirty: true });
      URL.revokeObjectURL(localUrl);
    } catch (error) {
      form.setValue(field, previousUrl, { shouldDirty: true });
      URL.revokeObjectURL(localUrl);
      throw error;
    } finally {
      setUploadingFields((current) => ({ ...current, [kind]: false }));
    }
  }

  function updateTitle(value: string) {
    form.setValue("title", value, { shouldDirty: true, shouldValidate: true });
    if (!form.getValues("slugManuallyEdited")) form.setValue("slug", slugSuggestion(value), { shouldDirty: true, shouldValidate: true });
  }
  const fieldError = (name: keyof PortfolioInput) => translateEditorValidationMessage(form.formState.errors[name]?.message as string | undefined, locale);

  return <div className="min-h-svh bg-[#f8f8fa] text-slate-950 dark:bg-[#090a0f] dark:text-white"><header className="sticky top-0 z-30 border-b border-slate-200/80 bg-[#f8f8fa]/90 backdrop-blur-xl dark:border-white/10 dark:bg-[#090a0f]/90"><div className="mx-auto flex h-[4.5rem] max-w-[100rem] items-center justify-between gap-4 px-5 sm:px-7"><div className="flex min-w-0 items-center gap-3"><Button aria-label={t("editor.backDashboard")} className="rounded-full" onClick={() => setLocation("/dashboard")} size="icon" variant="ghost"><ArrowLeft className="size-4" /></Button><div className="min-w-0"><p className="truncate text-sm font-semibold">{watched.title || t("editor.untitled")}</p><p className="truncate text-xs text-slate-500 dark:text-slate-400">portfolio.pro/{watched.slug || "portfolio"}</p></div></div><div className="flex items-center gap-2"><ThemeToggle /><Button asChild className="hidden rounded-full sm:inline-flex" size="sm" variant="outline"><Link href={`/dashboard/portfolios/${portfolioId}/projects`}>{t("editor.projects")}</Link></Button>{watched.isPublished ? <Button asChild className="hidden rounded-full sm:inline-flex" size="sm" variant="outline"><a href={`/${watched.slug}`} rel="noreferrer" target="_blank"><ExternalLink className="mr-1.5 size-3.5" />{t("editor.view")}</a></Button> : null}<Button className="rounded-full bg-violet-700 text-white hover:bg-violet-800 dark:bg-violet-500 dark:hover:bg-violet-400" disabled={!form.formState.isDirty || status === "saving" || uploadingFields.logo || uploadingFields.avatar} onClick={() => void save()} type="button"><Save className="mr-1.5 size-3.5" />{status === "saving" ? t("editor.saving") : uploadingFields.logo || uploadingFields.avatar ? t("editor.uploading") : t("editor.save")}</Button></div></div></header><main className="mx-auto grid max-w-[100rem] gap-6 p-5 sm:p-7 lg:grid-cols-[minmax(23rem,0.8fr)_minmax(0,1.2fr)] lg:gap-8"><section className="h-fit overflow-hidden rounded-[1.5rem] border border-slate-200 bg-white shadow-[0_10px_35px_-28px_rgba(15,23,42,0.35)] dark:border-white/10 dark:bg-slate-900"><div className="border-b border-slate-200 px-5 py-4 dark:border-white/10"><AppMark className="text-sm" href="/dashboard" /></div><form className="space-y-8 p-5 sm:p-6" onSubmit={(event) => { event.preventDefault(); void save(); }}><section className="space-y-4"><div><h1 className="text-lg font-semibold tracking-[-0.03em]">{t("editor.profileTitle")}</h1><p className="mt-1 text-sm leading-6 text-slate-500 dark:text-slate-400">{t("editor.profileDescription")}</p></div><div><Label htmlFor="title">{t("editor.portfolioTitle")}</Label><Input aria-invalid={!!fieldError("title")} className="mt-2 h-11 rounded-xl" id="title" onChange={(event) => updateTitle(event.target.value)} value={watched.title} /><FieldError message={fieldError("title")} /></div><div><div className="flex justify-between gap-3"><Label htmlFor="bio">{t("editor.biography")}</Label><span className="text-xs text-slate-400">{(watched.bio || "").length}/2000</span></div><Textarea className="mt-2 rounded-xl" id="bio" onChange={(event) => form.setValue("bio", event.target.value, { shouldDirty: true })} rows={5} value={watched.bio} /><FieldError message={fieldError("bio")} /></div><div className="grid gap-4 sm:grid-cols-2"><ImageField kind="avatar" label={t("editor.avatar")} onChange={(file) => uploadFile(file, "avatar")} onClear={() => form.setValue("avatarUrl", "", { shouldDirty: true })} value={watched.avatarUrl} /><ImageField kind="logo" label={t("editor.logo")} onChange={(file) => uploadFile(file, "logo")} onClear={() => form.setValue("logoUrl", "", { shouldDirty: true })} value={watched.logoUrl} /></div></section><section className="space-y-4 border-t border-slate-200 pt-7 dark:border-white/10"><div><h2 className="text-base font-semibold">{t("editor.publicUrl")}</h2><p className="mt-1 text-sm text-slate-500 dark:text-slate-400">{t("editor.publicUrlDescription")}</p></div><div><Label htmlFor="slug">portfolio.pro/</Label><Input className="mt-2 h-11 rounded-xl font-mono text-sm" id="slug" onChange={(event) => { form.setValue("slug", slugSuggestion(event.target.value), { shouldDirty: true, shouldValidate: true }); form.setValue("slugManuallyEdited", true, { shouldDirty: true }); }} value={watched.slug} /><FieldError message={fieldError("slug")} /></div></section><section className="space-y-4 border-t border-slate-200 pt-7 dark:border-white/10"><div><h2 className="text-base font-semibold">{t("editor.artDirection")}</h2><p className="mt-1 text-sm text-slate-500 dark:text-slate-400">{t("editor.artDescription")}</p></div><div className="grid gap-4"><SelectField items={portfolioTemplates} label={t("editor.template")} labels={templateLabels} onChange={(value) => form.setValue("template", value as PortfolioInput["template"], { shouldDirty: true })} value={watched.template} /><SelectField items={portfolioColorSchemes} label={t("editor.colorScheme")} labels={colorLabels} onChange={(value) => form.setValue("colorScheme", value as PortfolioInput["colorScheme"], { shouldDirty: true })} value={watched.colorScheme} /><SelectField items={portfolioFontFamilies} label={t("editor.typography")} labels={fontLabels} onChange={(value) => form.setValue("fontFamily", value as PortfolioInput["fontFamily"], { shouldDirty: true })} value={watched.fontFamily} /></div></section><section className="space-y-4 border-t border-slate-200 pt-7 dark:border-white/10"><div className="flex items-start justify-between gap-3"><div><h2 className="text-base font-semibold">{t("editor.socialLinks")}</h2><p className="mt-1 text-sm text-slate-500 dark:text-slate-400">{t("editor.socialDescription")}</p></div><Button className="rounded-full" disabled={!nextPlatform} onClick={() => nextPlatform && append({ id: crypto.randomUUID(), platform: nextPlatform, url: "" })} size="sm" type="button" variant="outline"><Plus className="mr-1 size-3.5" />{t("editor.add")}</Button></div><div className="space-y-3">{fields.map((item, index) => <div className="rounded-xl border border-slate-200 p-3 dark:border-white/10" key={item.fieldId}><div className="grid gap-2 sm:grid-cols-[8.25rem_1fr_auto]"><Controller control={form.control} name={`socialLinks.${index}.platform`} render={({ field }) => <Select onValueChange={field.onChange} value={field.value}><SelectTrigger className="h-10 rounded-lg"><SelectValue /></SelectTrigger><SelectContent>{socialPlatforms.map((platform) => <SelectItem disabled={platform !== field.value && usedPlatforms.has(platform)} key={platform} value={platform}>{platform}</SelectItem>)}</SelectContent></Select>} /><Input className="h-10 rounded-lg" placeholder="https://…" {...form.register(`socialLinks.${index}.url`)} /><Button aria-label={t("editor.removeSocial")} className="size-10 rounded-lg text-slate-500 hover:text-red-600" onClick={() => remove(index)} size="icon" type="button" variant="ghost"><Trash2 className="size-4" /></Button></div><FieldError message={translateEditorValidationMessage(form.formState.errors.socialLinks?.[index]?.url?.message, locale)} /></div>)}</div></section><section className="border-t border-slate-200 pt-7 dark:border-white/10"><div className="flex items-start justify-between gap-4 rounded-2xl bg-violet-50 p-4 dark:bg-violet-400/10"><div><Label className="text-sm font-semibold" htmlFor="publish">{t("editor.publish")}</Label><p className="mt-1 max-w-md text-xs leading-5 text-violet-900/65 dark:text-violet-100/65">{t("editor.publishDescription")}</p></div><Switch checked={watched.isPublished} id="publish" onCheckedChange={(value) => form.setValue("isPublished", value, { shouldDirty: true })} /></div></section></form></section><aside className="min-w-0 lg:sticky lg:top-[6.15rem] lg:h-[calc(100svh-7.5rem)] lg:overflow-y-auto"><PortfolioPreview portfolio={watched} /></aside></main><EditorStatusToast message={message} onCancel={cancelChanges} onSave={() => void save()} status={status} /></div>;
}

function FieldError({ message }: { message?: string }) {
  return message ? <p className="mt-1.5 text-xs font-medium text-red-600 dark:text-red-400" role="alert">{message}</p> : null;
}

function SelectField({ label, value, items, labels, onChange }: { label: string; value: string; items: readonly string[]; labels: Record<string, string>; onChange: (value: string) => void }) {
  return <div><Label>{label}</Label><Select onValueChange={onChange} value={value}><SelectTrigger className="mt-2 h-11 rounded-xl"><SelectValue /></SelectTrigger><SelectContent>{items.map((item) => <SelectItem key={item} value={item}>{labels[item]}</SelectItem>)}</SelectContent></Select></div>;
}

function ImageField({ kind, label, value, onChange, onClear }: { kind: "logo" | "avatar"; label: string; value: string; onChange: (file: File) => Promise<void>; onClear: () => void }) {
  const { t } = useLanguage();
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string>();
  const inputId = `upload-${kind}`;
  return <div><Label htmlFor={inputId}>{label}</Label><div className="mt-2 flex gap-3 rounded-xl border border-dashed border-slate-300 bg-slate-50/70 p-3 dark:border-white/15 dark:bg-white/[0.025]"><div className="grid size-12 shrink-0 place-items-center overflow-hidden rounded-lg bg-white text-slate-400 dark:bg-slate-800">{value ? <img alt={t("editor.imagePreview", { label })} className="size-full object-cover" src={value} /> : <ImagePlus className="size-4" />}</div><div className="min-w-0 flex-1"><input accept="image/jpeg,image/png,image/webp" className="sr-only" id={inputId} onChange={async (event) => { const file = event.target.files?.[0]; event.target.value = ""; if (!file) return; setBusy(true); setError(undefined); try { await onChange(file); } catch (caught) { setError(caught instanceof Error ? caught.message : t("editor.uploadFailed")); } finally { setBusy(false); } }} type="file" /><div className="flex flex-wrap gap-1.5"><Button asChild className="h-8 rounded-lg text-xs" disabled={busy} size="sm" type="button" variant="outline"><label className="cursor-pointer" htmlFor={inputId}><UploadCloud className="mr-1 size-3.5" />{busy ? t("editor.uploading") : t("editor.upload")}</label></Button>{value ? <Button className="h-8 rounded-lg text-xs text-slate-500" onClick={onClear} size="sm" type="button" variant="ghost">{t("editor.remove")}</Button> : null}</div>{error ? <p className="mt-1 text-xs text-red-600">{error}</p> : <p className="mt-1 text-xs text-slate-400">{t("editor.imageHelp")}</p>}</div></div></div>;
}

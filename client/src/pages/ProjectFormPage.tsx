import { zodResolver } from "@hookform/resolvers/zod";
import { ArrowLeft, Loader2, Plus, Save, Tag, X } from "lucide-react";
import { useState } from "react";
import { useForm } from "react-hook-form";
import { Link, useLocation, useRoute } from "wouter";
import { ProjectImageDropzone } from "@/components/projects/ProjectImageDropzone";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { useAuth } from "@/_core/hooks/useAuth";
import { trpc } from "@/lib/trpc";
import { projectInputSchema, type ProjectInput } from "@shared/portfolio";

const emptyProject: ProjectInput = { title: "", description: "", images: [], tags: [], projectUrl: "", startDate: "", endDate: "" };

export default function ProjectFormPage() {
  const [, createParams] = useRoute("/dashboard/portfolios/:id/projects/new");
  const [, editParams] = useRoute("/dashboard/portfolios/:id/projects/:projectId/edit");
  const portfolioId = Number(createParams?.id || editParams?.id);
  const projectId = editParams?.projectId ? Number(editParams.projectId) : undefined;
  const { isAuthenticated } = useAuth();
  const [, setLocation] = useLocation();
  const projectQuery = trpc.projects.get.useQuery({ portfolioId, projectId: projectId ?? 0 }, { enabled: isAuthenticated && Boolean(projectId) && portfolioId > 0 });
  if (!isAuthenticated) return <AuthPrompt />;
  if (projectId && projectQuery.isLoading) return <div className="grid min-h-svh place-items-center"><Loader2 className="size-5 animate-spin text-violet-600" /></div>;
  if (projectId && (projectQuery.error || !projectQuery.data)) return <div className="grid min-h-svh place-items-center p-6 text-center"><div><p className="text-sm text-slate-500">Проект не найден.</p><Button asChild className="mt-4 rounded-full"><Link href={`/dashboard/portfolios/${portfolioId}/projects`}>К списку проектов</Link></Button></div></div>;
  const initial = projectQuery.data ? { title: projectQuery.data.title, description: projectQuery.data.description, images: projectQuery.data.images, tags: projectQuery.data.tags, projectUrl: projectQuery.data.projectUrl, startDate: projectQuery.data.startDate, endDate: projectQuery.data.endDate } : emptyProject;
  return <ProjectForm portfolioId={portfolioId} projectId={projectId} initial={initial} onDone={() => setLocation(`/dashboard/portfolios/${portfolioId}/projects`)} />;
}

function ProjectForm({ portfolioId, projectId, initial, onDone }: { portfolioId: number; projectId?: number; initial: ProjectInput; onDone: () => void }) {
  const [tagDraft, setTagDraft] = useState("");
  const [uploading, setUploading] = useState(false);
  const form = useForm<ProjectInput>({ resolver: zodResolver(projectInputSchema), defaultValues: initial, mode: "onBlur", reValidateMode: "onChange" });
  const utils = trpc.useUtils();
  const create = trpc.projects.create.useMutation();
  const update = trpc.projects.update.useMutation();
  const upload = trpc.projects.uploadImage.useMutation();
  const values = form.watch();
  const busy = form.formState.isSubmitting || uploading;

  async function uploadImage(file: File) { setUploading(true); try { const base64 = await fileToBase64(file); const result = await upload.mutateAsync({ portfolioId, mimeType: file.type as "image/jpeg" | "image/png" | "image/webp", base64 }); return result.url; } finally { setUploading(false); } }
  async function submit(values: ProjectInput) { if (uploading) return; if (projectId) await update.mutateAsync({ portfolioId, projectId, values }); else await create.mutateAsync({ portfolioId, values }); await utils.projects.list.invalidate(); await utils.portfolios.get.invalidate({ id: portfolioId }); onDone(); }
  function addTag() { const tag = tagDraft.trim(); if (!tag || values.tags.includes(tag) || values.tags.length >= 12) return; form.setValue("tags", [...values.tags, tag], { shouldDirty: true, shouldValidate: true }); setTagDraft(""); }

  return <div className="min-h-svh bg-[#f8f8fa] px-5 py-7 dark:bg-[#090a0f] sm:px-8"><main className="mx-auto max-w-3xl"><Button asChild variant="ghost" className="-ml-3 rounded-full"><Link href={`/dashboard/portfolios/${portfolioId}/projects`}><ArrowLeft className="mr-1.5 size-4" />К проектам</Link></Button><div className="mt-5"><p className="text-xs font-bold uppercase tracking-[0.16em] text-violet-700 dark:text-violet-300">Portfolio project</p><h1 className="mt-2 font-display text-4xl font-semibold tracking-[-0.06em]">{projectId ? "Редактирование проекта" : "Новый проект"}</h1><p className="mt-3 text-sm leading-6 text-slate-500 dark:text-slate-400">Добавьте историю, изображения и ссылку — изменения сразу станут доступны в preview портфолио после сохранения.</p></div><form onSubmit={form.handleSubmit(submit)} className="mt-8 space-y-7 rounded-[1.5rem] border border-slate-200 bg-white p-5 shadow-sm dark:border-white/10 dark:bg-slate-900 sm:p-7"><Field label="Название" htmlFor="project-title" error={form.formState.errors.title?.message}><Input id="project-title" className="h-11 rounded-xl" placeholder="Mobile App Redesign" {...form.register("title")} /></Field><Field label="Описание" htmlFor="project-description" error={form.formState.errors.description?.message}><Textarea id="project-description" rows={6} className="rounded-xl" placeholder="Расскажите о задаче, результате и вашей роли." {...form.register("description")} /></Field><Field label="Изображения" error={form.formState.errors.images?.message}><ProjectImageDropzone value={values.images} disabled={busy} onChange={(images) => form.setValue("images", images, { shouldDirty: true, shouldValidate: true })} onUpload={uploadImage} /></Field><Field label="Теги" htmlFor="project-tag" error={form.formState.errors.tags?.message}><div className="flex gap-2"><Input id="project-tag" value={tagDraft} onChange={(event) => setTagDraft(event.target.value)} onKeyDown={(event) => { if (event.key === "Enter") { event.preventDefault(); addTag(); } }} className="h-11 rounded-xl" placeholder="Например, UI Design" /><Button type="button" variant="outline" className="h-11 rounded-xl" onClick={addTag}><Plus className="mr-1 size-4" />Добавить</Button></div><div className="mt-3 flex flex-wrap gap-2">{values.tags.map((tag) => <span key={tag} className="inline-flex items-center gap-1.5 rounded-full bg-violet-100 px-3 py-1.5 text-xs font-semibold text-violet-900 dark:bg-violet-400/15 dark:text-violet-100"><Tag className="size-3" />{tag}<button type="button" onClick={() => form.setValue("tags", values.tags.filter((item) => item !== tag), { shouldDirty: true, shouldValidate: true })} aria-label={`Удалить тег ${tag}`} className="rounded-full outline-none hover:text-violet-600 focus-visible:ring-2 focus-visible:ring-violet-600"><X className="size-3.5" /></button></span>)}</div></Field><Field label="Ссылка на проект (необязательно)" htmlFor="project-url" error={form.formState.errors.projectUrl?.message}><Input id="project-url" type="url" className="h-11 rounded-xl" placeholder="https://example.com/case-study" {...form.register("projectUrl")} /></Field><div className="grid gap-5 sm:grid-cols-2"><Field label="Дата начала (необязательно)" htmlFor="project-start" error={form.formState.errors.startDate?.message}><Input id="project-start" type="date" className="h-11 rounded-xl" {...form.register("startDate")} /></Field><Field label="Дата окончания (необязательно)" htmlFor="project-end" error={form.formState.errors.endDate?.message}><Input id="project-end" type="date" className="h-11 rounded-xl" {...form.register("endDate")} /></Field></div>{create.error || update.error ? <p role="alert" className="rounded-xl bg-red-50 p-3 text-sm font-medium text-red-700 dark:bg-red-950/30 dark:text-red-200">{create.error?.message || update.error?.message || "Не удалось сохранить проект."}</p> : null}<div className="flex flex-col-reverse gap-3 border-t border-slate-200 pt-6 sm:flex-row sm:justify-end dark:border-white/10"><Button asChild type="button" variant="outline" className="rounded-full"><Link href={`/dashboard/portfolios/${portfolioId}/projects`}>Отмена</Link></Button><Button type="submit" disabled={busy} className="rounded-full bg-violet-700 text-white hover:bg-violet-800"><Save className="mr-1.5 size-4" />{busy ? "Сохранение…" : projectId ? "Сохранить изменения" : "Создать проект"}</Button></div></form></main></div>;
}

function Field({ label, htmlFor, error, children }: { label: string; htmlFor?: string; error?: string; children: React.ReactNode }) { return <div><Label htmlFor={htmlFor}>{label}</Label><div className="mt-2">{children}</div>{error ? <p role="alert" className="mt-1.5 text-xs font-medium text-red-600 dark:text-red-400">{error}</p> : null}</div>; }
function AuthPrompt() { return <div className="grid min-h-svh place-items-center p-6 text-center"><div><p className="text-sm text-slate-500">Войдите, чтобы управлять проектами портфолио.</p><Button asChild className="mt-4 rounded-full"><Link href="/dashboard">К dashboard</Link></Button></div></div>; }
async function fileToBase64(file: File): Promise<string> { return new Promise((resolve, reject) => { const reader = new FileReader(); reader.onload = () => resolve(String(reader.result).split(",")[1] || ""); reader.onerror = () => reject(new Error("Не удалось прочитать изображение.")); reader.readAsDataURL(file); }); }

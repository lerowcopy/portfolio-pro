import { Reorder } from "framer-motion";
import { GripVertical, ImagePlus, Loader2, Trash2, UploadCloud } from "lucide-react";
import { useRef, useState } from "react";
import { Button } from "@/components/ui/button";

type PendingImage = { id: string; name: string; previewUrl: string; status: "preparing" | "uploading" };

type ProjectImageDropzoneProps = {
  value: string[];
  onChange: (urls: string[]) => void;
  onUpload: (file: File) => Promise<string>;
  disabled?: boolean;
};

const MAX_FILES = 5;
const MAX_BYTES = 5 * 1024 * 1024;
const ACCEPTED = new Set(["image/jpeg", "image/png", "image/webp"]);

async function compressForUpload(file: File): Promise<File> {
  const objectUrl = URL.createObjectURL(file);
  try {
    const image = await new Promise<HTMLImageElement>((resolve, reject) => { const element = new Image(); element.onload = () => resolve(element); element.onerror = () => reject(new Error("Не удалось прочитать изображение.")); element.src = objectUrl; });
    const scale = Math.min(1, 2048 / Math.max(image.naturalWidth, image.naturalHeight));
    const canvas = document.createElement("canvas");
    canvas.width = Math.max(1, Math.round(image.naturalWidth * scale));
    canvas.height = Math.max(1, Math.round(image.naturalHeight * scale));
    const context = canvas.getContext("2d");
    if (!context) throw new Error("Сжатие изображения недоступно в этом браузере.");
    context.drawImage(image, 0, 0, canvas.width, canvas.height);
    const blob = await new Promise<Blob | null>((resolve) => canvas.toBlob(resolve, "image/webp", 0.86));
    if (!blob) throw new Error("Не удалось сжать изображение.");
    return new File([blob], `${file.name.replace(/\.[^.]+$/, "") || "project-image"}.webp`, { type: "image/webp" });
  } finally { URL.revokeObjectURL(objectUrl); }
}

export function ProjectImageDropzone({ value, onChange, onUpload, disabled }: ProjectImageDropzoneProps) {
  const inputRef = useRef<HTMLInputElement>(null);
  const [pending, setPending] = useState<PendingImage[]>([]);
  const [error, setError] = useState<string>();

  async function handleFiles(files: FileList | File[]) {
    if (disabled) return;
    const candidates = Array.from(files);
    setError(undefined);
    if (value.length + pending.length + candidates.length > MAX_FILES) { setError("Можно добавить не более 5 изображений к одному проекту."); return; }
    const accepted = candidates.filter((file) => {
      if (!ACCEPTED.has(file.type)) { setError("Поддерживаются только JPG, PNG и WebP."); return false; }
      if (file.size > MAX_BYTES) { setError(`Файл «${file.name}» превышает лимит 5 МБ.`); return false; }
      return true;
    });
    const queued = accepted.map((file) => ({ file, preview: { id: crypto.randomUUID(), name: file.name, previewUrl: URL.createObjectURL(file), status: "preparing" as const } }));
    setPending((current) => [...current, ...queued.map((item) => item.preview)]);
    const uploaded: string[] = [];
    for (const item of queued) {
      try {
        const compressed = await compressForUpload(item.file);
        setPending((current) => current.map((preview) => preview.id === item.preview.id ? { ...preview, status: "uploading" } : preview));
        const url = await onUpload(compressed);
        uploaded.push(url);
      } catch (caught) { setError(caught instanceof Error ? caught.message : "Загрузка изображения не удалась."); }
      finally {
        URL.revokeObjectURL(item.preview.previewUrl);
        setPending((current) => current.filter((preview) => preview.id !== item.preview.id));
      }
    }
    if (uploaded.length) onChange([...value, ...uploaded]);
  }

  return <div className="space-y-3"><input ref={inputRef} className="sr-only" type="file" accept="image/jpeg,image/png,image/webp" multiple onChange={(event) => { const files = event.target.files; event.target.value = ""; if (files) void handleFiles(files); }} /><div role="button" tabIndex={disabled ? -1 : 0} aria-disabled={disabled} aria-label="Добавить изображения проекта" onClick={() => !disabled && inputRef.current?.click()} onKeyDown={(event) => { if (!disabled && (event.key === "Enter" || event.key === " ")) { event.preventDefault(); inputRef.current?.click(); } }} onDragOver={(event) => event.preventDefault()} onDrop={(event) => { event.preventDefault(); void handleFiles(event.dataTransfer.files); }} className="flex min-h-36 cursor-pointer flex-col items-center justify-center rounded-2xl border border-dashed border-slate-300 bg-slate-50 px-5 text-center outline-none transition-colors hover:border-violet-400 hover:bg-violet-50 focus-visible:ring-2 focus-visible:ring-violet-600 aria-disabled:cursor-not-allowed aria-disabled:opacity-60 dark:border-white/15 dark:bg-white/[0.03] dark:hover:border-violet-400 dark:hover:bg-violet-400/10"><div className="grid size-10 place-items-center rounded-xl bg-white text-violet-700 shadow-sm dark:bg-slate-800 dark:text-violet-300"><UploadCloud className="size-5" /></div><p className="mt-3 text-sm font-semibold">Перетащите изображения или нажмите для выбора</p><p className="mt-1 text-xs text-slate-500 dark:text-slate-400">До 5 файлов · JPG, PNG или WebP · до 5 МБ каждый</p></div>{pending.length ? <div className="space-y-2" aria-live="polite">{pending.map((item) => <div key={item.id} className="rounded-xl border border-violet-100 bg-violet-50 p-3 dark:border-violet-400/20 dark:bg-violet-400/10"><div className="flex items-center justify-between gap-3 text-xs"><span className="truncate font-medium">{item.name}</span><span className="inline-flex shrink-0 items-center gap-1 text-violet-700 dark:text-violet-300"><Loader2 className="size-3 animate-spin" />{item.status === "preparing" ? "Подготовка изображения" : "Загрузка в хранилище"}</span></div><div aria-label={item.status === "preparing" ? "Изображение подготавливается" : "Изображение загружается"} className="mt-2 h-1.5 overflow-hidden rounded-full bg-violet-100 dark:bg-violet-950"><div className="h-full w-full origin-left animate-pulse rounded-full bg-violet-600" /></div></div>)}</div> : null}{error ? <p role="alert" className="text-xs font-medium text-red-600 dark:text-red-400">{error}</p> : null}<div className="grid gap-3 sm:grid-cols-2">{pending.map((item) => <div key={`preview-${item.id}`} className="relative overflow-hidden rounded-xl border border-violet-300 bg-white shadow-sm dark:border-violet-400/40 dark:bg-slate-800"><img src={item.previewUrl} alt={`Локальный preview ${item.name}`} className="aspect-[4/3] w-full object-cover" /><div className="absolute inset-x-0 bottom-0 bg-black/65 p-2 text-xs font-semibold text-white">Локальный preview · {item.status === "preparing" ? "подготовка" : "загрузка"}</div></div>)}</div><Reorder.Group axis="y" values={value} onReorder={onChange} className="grid gap-3 sm:grid-cols-2">{value.map((url, index) => <Reorder.Item value={url} key={url} className="group relative overflow-hidden rounded-xl border border-slate-200 bg-white shadow-sm dark:border-white/10 dark:bg-slate-800"><img src={url} alt={`Изображение проекта ${index + 1}`} loading="lazy" decoding="async" className="aspect-[4/3] w-full object-cover" /><div className="absolute inset-x-0 bottom-0 flex items-center justify-between bg-gradient-to-t from-black/70 to-transparent p-2 text-white"><span className="inline-flex items-center gap-1 text-xs font-semibold"><GripVertical className="size-3.5" />Перетащить</span><Button type="button" size="icon" variant="ghost" disabled={disabled} onClick={(event) => { event.stopPropagation(); onChange(value.filter((item) => item !== url)); }} className="size-8 text-white hover:bg-white/20 hover:text-white" aria-label={`Удалить изображение ${index + 1}`}><Trash2 className="size-4" /></Button></div></Reorder.Item>)}</Reorder.Group>{!value.length && !pending.length ? <div className="flex items-center gap-2 text-xs text-slate-500"><ImagePlus className="size-4" />Добавьте до пяти изображений, чтобы показать проект в шаблонах.</div> : null}</div>;
}

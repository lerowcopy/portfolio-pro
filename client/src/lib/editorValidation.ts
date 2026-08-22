import type { Locale } from "@/lib/languagePreference";

const validationMessages = {
  en: {
    title: "Title must contain at least 3 characters.",
    imageUrl: "Invalid image URL.",
    socialDuplicate: "Each social platform can only be added once.",
    email: "Enter a valid email address.",
    invalid: "Check the highlighted field.",
  },
  ru: {
    title: "Название должно содержать минимум 3 символа.",
    imageUrl: "Некорректный URL изображения.",
    socialDuplicate: "Каждую социальную платформу можно добавить только один раз.",
    email: "Введите корректный email.",
    invalid: "Проверьте выделенное поле.",
  },
} as const;

const sourceMessageKinds: Record<string, keyof typeof validationMessages.en> = {
  "Название должно содержать минимум 3 символа.": "title",
  "Некорректный URL изображения.": "imageUrl",
  "Каждую социальную платформу можно добавить только один раз.": "socialDuplicate",
  "Введите корректный email.": "email",
  "Invalid URL": "invalid",
};

/** Возвращает текст validation error на активном языке, не меняя server-side schema contract. */
export function translateEditorValidationMessage(message: string | undefined, locale: Locale): string | undefined {
  if (!message) return undefined;
  const kind = sourceMessageKinds[message];
  return kind ? validationMessages[locale][kind] : message;
}

export const editorInvariantOptionLabels = {
  fonts: ["Inter", "Playfair", "Georgia"],
  socialPlatforms: ["LinkedIn", "X / Twitter", "Instagram", "GitHub", "Behance"],
} as const;

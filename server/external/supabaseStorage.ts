import { createClient } from "@supabase/supabase-js";
import { z } from "zod";

const storageBuckets = {
  avatar: "portfolio-avatars",
  logo: "portfolio-logos",
  project: "portfolio-project-images",
} as const;

const acceptedMimeTypes = ["image/jpeg", "image/png", "image/webp"] as const;
const uuidSchema = z.string().uuid();

export type ExternalStorageKind = keyof typeof storageBuckets;
export type ExternalStorageConfig = {
  url: string;
  secretKey: string;
};

function extensionForMimeType(mimeType: (typeof acceptedMimeTypes)[number]): string {
  return mimeType === "image/jpeg" ? "jpg" : mimeType.slice("image/".length);
}

function assertValidImage(buffer: Buffer, mimeType: string, sizeLimitBytes: number): asserts mimeType is (typeof acceptedMimeTypes)[number] {
  const jpeg = buffer.length >= 3 && buffer[0] === 0xff && buffer[1] === 0xd8 && buffer[2] === 0xff;
  const png = buffer.length >= 8 && buffer.subarray(0, 8).equals(Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]));
  const webp = buffer.length >= 12 && buffer.subarray(0, 4).toString("ascii") === "RIFF" && buffer.subarray(8, 12).toString("ascii") === "WEBP";
  const signatureMatches = (mimeType === "image/jpeg" && jpeg) || (mimeType === "image/png" && png) || (mimeType === "image/webp" && webp);
  if (!buffer.length || buffer.length > sizeLimitBytes || !signatureMatches) {
    throw new Error("Поддерживаются корректные JPG, PNG и WebP в разрешённом размере.");
  }
}

export function readExternalStorageConfig(env: NodeJS.ProcessEnv = process.env): ExternalStorageConfig {
  const url = env.SUPABASE_URL;
  const secretKey = env.SUPABASE_SECRET_KEY ?? env.SUPABASE_SERVICE_ROLE_KEY;
  if (!url || !/^https:\/\/[a-z0-9-]+\.supabase\.co\/?$/i.test(url)) {
    throw new Error("SUPABASE_URL must contain a valid Supabase project URL");
  }
  if (!secretKey || !(secretKey.startsWith("sb_secret_") || secretKey.startsWith("eyJ"))) {
    throw new Error("A server-only Supabase secret key must be configured for Storage");
  }
  return { url, secretKey };
}

function createStorageClient(config = readExternalStorageConfig()) {
  return createClient(config.url, config.secretKey, {
    auth: { autoRefreshToken: false, persistSession: false, detectSessionInUrl: false },
  });
}

export function createExternalStoragePath(userId: string, kind: ExternalStorageKind, mimeType: (typeof acceptedMimeTypes)[number]): string {
  const verifiedUserId = uuidSchema.parse(userId);
  const bucket = storageBuckets[kind];
  return `storage://${bucket}/${verifiedUserId}/${crypto.randomUUID()}.${extensionForMimeType(mimeType)}`;
}

export function parseOwnedExternalStoragePath(storagePath: string, userId: string): { bucket: string; objectPath: string } {
  const verifiedUserId = uuidSchema.parse(userId);
  const matched = /^storage:\/\/(portfolio-avatars|portfolio-logos|portfolio-project-images)\/([0-9a-f-]{36})\/([a-z0-9-]{1,80}\.(?:jpg|png|webp))$/i.exec(storagePath);
  if (!matched || matched[2] !== verifiedUserId) throw new Error("Недопустимый путь к приватному файлу.");
  return { bucket: matched[1], objectPath: `${matched[2]}/${matched[3]}` };
}

export async function uploadExternalImage(input: { userId: string; kind: ExternalStorageKind; mimeType: string; buffer: Buffer }): Promise<{ storagePath: string; url: string }> {
  const sizeLimitBytes = input.kind === "project" ? 5 * 1024 * 1024 : 2 * 1024 * 1024;
  assertValidImage(input.buffer, input.mimeType, sizeLimitBytes);
  const storagePath = createExternalStoragePath(input.userId, input.kind, input.mimeType);
  const { bucket, objectPath } = parseOwnedExternalStoragePath(storagePath, input.userId);
  const client = createStorageClient();
  const { error } = await client.storage.from(bucket).upload(objectPath, input.buffer, {
    contentType: input.mimeType,
    cacheControl: "31536000",
    upsert: false,
  });
  if (error) throw new Error("Не удалось загрузить изображение в защищённое хранилище.");
  const url = await createExternalSignedImageUrl(storagePath, input.userId);
  return { storagePath, url };
}

export async function createExternalSignedImageUrl(storagePath: string, userId: string, expiresIn = 300): Promise<string> {
  if (!Number.isInteger(expiresIn) || expiresIn < 60 || expiresIn > 3600) throw new Error("Недопустимый срок действия signed URL.");
  const { bucket, objectPath } = parseOwnedExternalStoragePath(storagePath, userId);
  const client = createStorageClient();
  const { data, error } = await client.storage.from(bucket).createSignedUrl(objectPath, expiresIn);
  if (error || !data?.signedUrl) throw new Error("Не удалось выдать временную ссылку на изображение.");
  return data.signedUrl;
}

export async function deleteExternalImage(storagePath: string, userId: string): Promise<void> {
  const { bucket, objectPath } = parseOwnedExternalStoragePath(storagePath, userId);
  const client = createStorageClient();
  const { error } = await client.storage.from(bucket).remove([objectPath]);
  if (error) throw new Error("Не удалось удалить изображение из защищённого хранилища.");
}

export const externalStorageInternals = {
  acceptedMimeTypes,
  assertValidImage,
  storageBuckets,
};

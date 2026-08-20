import { getExternalPostgresPool } from "./postgres";

export async function recordExternalStorageCleanupFailure(userId: string, storagePath: string, error: unknown): Promise<void> {
  const message = error instanceof Error ? error.message.slice(0, 500) : "Неизвестная ошибка удаления объекта.";
  await getExternalPostgresPool().query(
    `insert into public.storage_cleanup_tasks (user_id, storage_path, last_error)
     values ($1::uuid, $2, $3)
     on conflict (storage_path) do update
       set attempt_count = public.storage_cleanup_tasks.attempt_count + 1,
           last_error = excluded.last_error,
           last_attempt_at = timezone('utc', now()),
           resolved_at = null`,
    [userId, storagePath, message],
  );
}

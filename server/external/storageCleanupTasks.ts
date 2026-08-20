export type SqlQuery = { text: string; values: readonly unknown[] };

export function listPendingStorageCleanupTasksQuery(limit: number): SqlQuery {
  return {
    text: `select id::text, user_id::text, storage_path
           from public.storage_cleanup_tasks
           where resolved_at is null
           order by last_attempt_at asc
           limit $1`,
    values: [limit],
  };
}

export function resolveStorageCleanupTaskQuery(id: string): SqlQuery {
  return {
    text: "update public.storage_cleanup_tasks set resolved_at = timezone('utc', now()), last_attempt_at = timezone('utc', now()) where id = $1::uuid",
    values: [id],
  };
}

export function retryStorageCleanupTaskQuery(id: string, error: string): SqlQuery {
  return {
    text: `update public.storage_cleanup_tasks
           set attempt_count = attempt_count + 1,
               last_error = $2,
               last_attempt_at = timezone('utc', now())
           where id = $1::uuid`,
    values: [id, error.slice(0, 500)],
  };
}

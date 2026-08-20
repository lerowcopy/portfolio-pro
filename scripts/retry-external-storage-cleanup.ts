import { getExternalPostgresPool } from "../server/external/postgres";
import { deleteExternalImage } from "../server/external/supabaseStorage";
import { listPendingStorageCleanupTasksQuery, resolveStorageCleanupTaskQuery, retryStorageCleanupTaskQuery } from "../server/external/storageCleanupTasks";

const batchSize = Number.parseInt(process.env.STORAGE_CLEANUP_BATCH_SIZE ?? "100", 10);
if (!Number.isInteger(batchSize) || batchSize < 1 || batchSize > 500) throw new Error("STORAGE_CLEANUP_BATCH_SIZE must be an integer from 1 to 500");

const pool = getExternalPostgresPool();
const pendingQuery = listPendingStorageCleanupTasksQuery(batchSize);
const pending = await pool.query(pendingQuery.text, [...pendingQuery.values]);
let resolved = 0;
let failed = 0;

for (const task of pending.rows as Array<{ id: string; user_id: string; storage_path: string }>) {
  try {
    await deleteExternalImage(task.storage_path, task.user_id);
    const query = resolveStorageCleanupTaskQuery(task.id);
    await pool.query(query.text, [...query.values]);
    resolved += 1;
  } catch (error) {
    const query = retryStorageCleanupTaskQuery(task.id, error instanceof Error ? error.message : "Неизвестная ошибка повторной очистки.");
    await pool.query(query.text, [...query.values]);
    failed += 1;
  }
}

await pool.end();
console.log(JSON.stringify({ pending: pending.rowCount ?? 0, resolved, failed }));
if (failed > 0) process.exitCode = 1;

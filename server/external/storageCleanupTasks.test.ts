import { describe, expect, it } from "vitest";
import { listPendingStorageCleanupTasksQuery, resolveStorageCleanupTaskQuery, retryStorageCleanupTaskQuery } from "./storageCleanupTasks";

describe("Storage cleanup recovery queries", () => {
  it("lists only unresolved tasks with a parameterized limit", () => {
    const query = listPendingStorageCleanupTasksQuery(100);
    expect(query.text).toContain("where resolved_at is null");
    expect(query.values).toEqual([100]);
  });

  it("resolves and retries tasks using parameterized UUID inputs", () => {
    const id = "550e8400-e29b-41d4-a716-446655440000";
    expect(resolveStorageCleanupTaskQuery(id).values).toEqual([id]);
    expect(retryStorageCleanupTaskQuery(id, "x".repeat(600)).values).toEqual([id, "x".repeat(500)]);
  });
});

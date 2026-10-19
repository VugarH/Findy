import { describe, expect, it, vi } from "vitest";

vi.mock("@/db/client", () => ({ db: {} }));

const { dueForRetry, nextHealth } = await import("./health");

const fresh = { failingDays: 0, lastFailedOn: null, pausedAt: null };
const now = new Date("2026-10-20T05:00:00Z");

describe("store health", () => {
  it("pauses after three failed days in a row, counting days not runs", () => {
    let health = nextHealth(fresh, false, "2026-10-18", now);
    health = nextHealth(health, false, "2026-10-18", now); // second run, same day
    expect(health.failingDays).toBe(1);
    health = nextHealth(health, false, "2026-10-19", now);
    expect(health.change).toBeNull();
    health = nextHealth(health, false, "2026-10-20", now);
    expect(health).toMatchObject({ failingDays: 3, change: "paused", pausedAt: now });
  });

  it("starts counting again after a day without a failure", () => {
    const after = nextHealth({ failingDays: 2, lastFailedOn: "2026-10-17", pausedAt: null }, false, "2026-10-19", now);
    expect(after).toMatchObject({ failingDays: 1, change: null });
  });

  it("a success resets the count and resumes a paused store", () => {
    const paused = { failingDays: 5, lastFailedOn: "2026-10-12", pausedAt: new Date("2026-10-10") };
    expect(nextHealth(paused, true, "2026-10-19", now)).toMatchObject({ failingDays: 0, pausedAt: null, change: "resumed" });
    expect(nextHealth(fresh, true, "2026-10-19", now).change).toBeNull();
  });

  it("stays paused (not paused again) while it keeps failing", () => {
    const paused = { failingDays: 3, lastFailedOn: "2026-10-12", pausedAt: new Date("2026-10-12") };
    expect(nextHealth(paused, false, "2026-10-19", now)).toMatchObject({ change: null, pausedAt: paused.pausedAt });
  });

  it("retries a paused store once a week", () => {
    expect(dueForRetry({ lastErrorAt: new Date("2026-10-15T05:00:00Z") }, now)).toBe(false);
    expect(dueForRetry({ lastErrorAt: new Date("2026-10-13T05:00:00Z") }, now)).toBe(true);
  });
});

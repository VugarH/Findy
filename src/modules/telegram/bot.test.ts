import { describe, expect, it, vi } from "vitest";

vi.mock("@/db/client", () => ({ db: {} }));

const { parseCommand } = await import("./bot");

describe("parseCommand", () => {
  it("reads the start link's token", () => {
    expect(parseCommand("/start abc_DEF-123")).toEqual({ command: "start", payload: "abc_DEF-123" });
  });

  it("reads commands addressed to the bot by name, without a payload", () => {
    expect(parseCommand("/stop@SerfeliBot")).toEqual({ command: "stop", payload: "" });
    expect(parseCommand("  /HELP ")).toEqual({ command: "help", payload: "" });
  });

  it("ignores ordinary text", () => {
    expect(parseCommand("hello")).toBeNull();
    expect(parseCommand(undefined)).toBeNull();
  });
});

import { describe, it, expect, vi, afterEach } from "vitest";
import { logger } from "./logger";

afterEach(() => {
  vi.restoreAllMocks();
});

describe("logger", () => {
  it("logs info as structured JSON via console.log", () => {
    const spy = vi.spyOn(console, "log").mockImplementation(() => {});
    logger.info("hello", { userId: "u1" });
    expect(spy).toHaveBeenCalledTimes(1);
    const parsed = JSON.parse(spy.mock.calls[0][0]);
    expect(parsed).toMatchObject({ level: "info", message: "hello", userId: "u1" });
    expect(typeof parsed.timestamp).toBe("string");
  });

  it("logs warnings via console.warn", () => {
    const spy = vi.spyOn(console, "warn").mockImplementation(() => {});
    logger.warn("careful");
    expect(spy).toHaveBeenCalledTimes(1);
    expect(JSON.parse(spy.mock.calls[0][0])).toMatchObject({ level: "warn", message: "careful" });
  });

  it("serializes an Error's name/message/stack via console.error", () => {
    const spy = vi.spyOn(console, "error").mockImplementation(() => {});
    logger.error("boom", new Error("bad input"), { entity: "Course" });
    const parsed = JSON.parse(spy.mock.calls[0][0]);
    expect(parsed.level).toBe("error");
    expect(parsed.entity).toBe("Course");
    expect(parsed.error.message).toBe("bad input");
    expect(parsed.error.name).toBe("Error");
  });

  it("passes through non-Error error values as-is", () => {
    const spy = vi.spyOn(console, "error").mockImplementation(() => {});
    logger.error("boom", "plain string error");
    const parsed = JSON.parse(spy.mock.calls[0][0]);
    expect(parsed.error).toBe("plain string error");
  });
});

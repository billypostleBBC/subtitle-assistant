import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({ constructor: vi.fn(), parse: vi.fn() }));
vi.mock("openai", () => ({ default: class {
  constructor(options: unknown) { mocks.constructor(options); }
  responses = { parse: mocks.parse };
} }));
import { POST } from "./route";
import { BBC_SUBTITLE_GUIDE_URL } from "../../../lib/review";

const cues = [{ id: "1", text: "One simple habit." }, { id: "2", text: "Writing." }];
const finding = { kind: "edit", cues: [{ cueId: "1", proposedText: "One simple habit:" }, { cueId: "2", proposedText: "writing." }], reason: "The second cue explains the first.", question: null, referenceEntry: "3.4 Break at natural points", referenceUrl: BBC_SUBTITLE_GUIDE_URL };
const request = (body: unknown = { cues }) => new Request("http://localhost/api/review", { method: "POST", body: JSON.stringify(body), headers: { "content-type": "application/json" } });
const completed = (value: unknown) => ({ status: "completed", output: [], output_parsed: value });

describe("POST /api/review", () => {
  beforeEach(() => {
    vi.stubEnv("OPENAI_API_KEY", "test-key");
    vi.stubEnv("OPENAI_MODEL", "gpt-5.4-mini");
    mocks.constructor.mockClear();
    mocks.parse.mockReset();
  });
  afterEach(() => vi.unstubAllEnvs());

  it("returns a complete linked finding with one bounded stateless request", async () => {
    mocks.parse.mockResolvedValue(completed({ findings: [finding] }));
    const response = await POST(request());
    expect(response.status).toBe(200);
    expect(await response.json()).toEqual({ findings: [finding] });
    expect(mocks.parse).toHaveBeenCalledTimes(1);
    expect(mocks.constructor).toHaveBeenCalledWith(expect.objectContaining({ timeout: 25_000, maxRetries: 0 }));
    expect(mocks.parse).toHaveBeenCalledWith(expect.objectContaining({ store: false, max_output_tokens: 12_000 }));
    expect(mocks.parse).toHaveBeenCalledWith(expect.objectContaining({ reasoning: { effort: "medium" } }));
    expect(mocks.parse.mock.calls[0][0]).not.toHaveProperty("temperature");
  });

  it("returns 503 without requesting a review when not configured", async () => {
    vi.stubEnv("OPENAI_API_KEY", "");
    expect((await POST(request())).status).toBe(503);
    expect(mocks.parse).not.toHaveBeenCalled();
  });

  it.each([null, { cues: [] }, { cues: [cues[0], cues[0]] }, { cues: [{ id: "1", text: " " }] }, { cues: Array.from({ length: 21 }, (_, i) => ({ id: String(i), text: "x".repeat(4000) })) }])("rejects invalid or oversized input", async (body) => {
    expect((await POST(request(body))).status).toBe(400);
    expect(mocks.parse).not.toHaveBeenCalled();
  });

  it.each([
    { findings: [{ ...finding, cues: [{ cueId: "missing", proposedText: "Hello" }] }] },
    { findings: [finding, finding] },
    { findings: [{ ...finding, referenceEntry: "invented" }] },
    { suggestions: [] },
    null,
  ])("fails visibly for unsafe output instead of silently returning a clean review", async (value) => {
    mocks.parse.mockResolvedValue(completed(value));
    const response = await POST(request());
    expect(response.status).toBe(502);
    expect(await response.json()).toMatchObject({ error: expect.any(String) });
  });

  it("does not expose a partial review when the output limit is reached", async () => {
    mocks.parse.mockResolvedValue({ ...completed({ findings: [finding] }), status: "incomplete", incomplete_details: { reason: "max_output_tokens" } });
    const response = await POST(request());
    expect(response.status).toBe(502);
    expect(await response.json()).toMatchObject({ error: expect.stringContaining("shorter") });
  });

  it("handles refusals without showing no changes", async () => {
    mocks.parse.mockResolvedValue({ ...completed(null), output: [{ type: "message", content: [{ type: "refusal", refusal: "Refused" }] }] });
    const response = await POST(request());
    expect(response.status).toBe(422);
    expect(await response.json()).toMatchObject({ error: expect.stringContaining("manual") });
  });

  it.each([
    [Object.assign(new Error("private upstream detail"), { name: "APIConnectionTimeoutError" }), 504, "timed out"],
    [Object.assign(new Error("private upstream detail"), { status: 429 }), 429, "busy"],
    [new Error("private upstream detail"), 502, "try again"],
  ])("returns an actionable safe service error", async (error, status, message) => {
    mocks.parse.mockRejectedValue(error);
    const response = await POST(request());
    expect(response.status).toBe(status);
    const body = await response.json();
    expect(body.error).toContain(message);
    expect(body.error).not.toContain("private");
  });
});

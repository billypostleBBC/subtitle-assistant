import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const openAiMocks = vi.hoisted(() => ({ constructor: vi.fn(), parse: vi.fn() }));

vi.mock("openai", () => ({
  default: class {
    constructor(options: unknown) {
      openAiMocks.constructor(options);
    }
    responses = { parse: openAiMocks.parse };
  },
}));

import { POST } from "./route";

const validLines = [
  { id: "line-1", text: "Programme title" },
  { id: "line-2", text: "1" },
  { id: "line-3", text: "00:00:01:00 - 00:00:03:00" },
  { id: "line-4", text: "Hello from London." },
];

const deterministicLines = [
  { id: "line-1", text: "1" },
  { id: "line-2", text: "00:00:01:00 - 00:00:03:00" },
  { id: "line-3", text: "Hello from London." },
];

function importRequest(lines = validLines) {
  return new Request("http://localhost/api/import", {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({ lines }),
  });
}

describe("POST /api/import", () => {
  const originalApiKey = process.env.OPENAI_API_KEY;

  beforeEach(() => {
    process.env.OPENAI_API_KEY = "test-key";
    openAiMocks.constructor.mockReset();
    openAiMocks.parse.mockReset();
  });

  afterEach(() => {
    if (originalApiKey === undefined) delete process.env.OPENAI_API_KEY;
    else process.env.OPENAI_API_KEY = originalApiKey;
  });

  it("returns 503 when the server API key is missing", async () => {
    delete process.env.OPENAI_API_KEY;
    const response = await POST(importRequest());
    expect(response.status).toBe(503);
    expect(await response.json()).toMatchObject({ error: expect.stringContaining("not configured") });
  });

  it("imports a known-good subtitle structure without an API key or model wait", async () => {
    delete process.env.OPENAI_API_KEY;
    const response = await POST(importRequest(deterministicLines));

    expect(response.status).toBe(200);
    expect(openAiMocks.parse).not.toHaveBeenCalled();
    expect(await response.json()).toEqual({
      cues: [{ id: "1", start: "00:00:01.000", end: "00:00:03.000", text: "Hello from London." }],
      ignoredLines: [{ id: "line-1", text: "1", category: "cue_number" }],
    });
  });

  it("uses one stateless structured request and returns reconstructed source text", async () => {
    openAiMocks.parse.mockResolvedValue({
      output_parsed: {
        cues: [{ timestampLineId: "line-3", textLineIds: ["line-4"] }],
        ignoredLines: [
          { lineId: "line-1", category: "heading" },
          { lineId: "line-2", category: "cue_number" },
        ],
      },
    });

    const response = await POST(importRequest());
    expect(response.status).toBe(200);
    expect(openAiMocks.parse).toHaveBeenCalledTimes(1);
    expect(openAiMocks.constructor).toHaveBeenCalledWith(expect.objectContaining({
      maxRetries: 0,
      timeout: 15_000,
    }));
    expect(openAiMocks.parse).toHaveBeenCalledWith(expect.objectContaining({
      store: false,
      model: process.env.OPENAI_MODEL || "gpt-5.4-mini",
      text: { format: expect.any(Object) },
    }));
    expect(await response.json()).toEqual({
      cues: [{ id: "1", start: "00:00:01.000", end: "00:00:03.000", text: "Hello from London." }],
      ignoredLines: [
        { id: "line-1", text: "Programme title", category: "heading" },
        { id: "line-2", text: "1", category: "cue_number" },
      ],
    });
  });

  it("returns 422 without partial cues when model classification is unsafe", async () => {
    openAiMocks.parse.mockResolvedValue({
      output_parsed: {
        cues: [{ timestampLineId: "line-3", textLineIds: ["line-4"] }],
        ignoredLines: [],
      },
    });
    const response = await POST(importRequest());
    expect(response.status).toBe(422);
    expect(await response.json()).toMatchObject({ error: expect.stringContaining("not classified") });
  });

  it("returns 502 when the upstream import request fails", async () => {
    openAiMocks.parse.mockRejectedValue(new Error("upstream unavailable"));
    const consoleError = vi.spyOn(console, "error").mockImplementation(() => undefined);
    const response = await POST(importRequest());
    consoleError.mockRestore();
    expect(response.status).toBe(502);
    expect(await response.json()).toMatchObject({ error: expect.stringContaining("could not interpret") });
  });
});

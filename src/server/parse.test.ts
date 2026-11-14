import { describe, expect, it } from "vitest";
import {
  detectAgyAuthRequired,
  detectAgyQuotaExhausted,
  isAgySessionUnrecoverableError,
  isAgySuccessResult,
  isAgyTransientNetworkError,
  isAgyUnknownSessionError,
  parseAgyJsonl,
  parseAgyUsage,
} from "./parse.js";
import { SIMPLE_RUN, TOOL_RUN, TRUNCATED_RUN } from "./fixtures.test-util.js";

describe("parseAgyUsage", () => {
  it("extracts usage token counts", () => {
    const result = parseAgyUsage({
      input_tokens: 1500,
      output_tokens: 250,
      cache_read_tokens: 500,
      thinking_tokens: 80,
      total_tokens: 2250,
    });
    expect(result?.usage).toEqual({
      inputTokens: 1500,
      outputTokens: 250,
      cachedInputTokens: 500,
    });
    expect(result?.thinkingTokens).toBe(80);
  });

  it("returns null for non-object", () => {
    expect(parseAgyUsage(null)).toBeNull();
    expect(parseAgyUsage("invalid")).toBeNull();
  });
});

describe("parseAgyJsonl", () => {
  it("parses a simple run: conversation id, status, response, usage", () => {
    const parsed = parseAgyJsonl(SIMPLE_RUN);
    expect(parsed.conversationId).toBe("1d4068bc-62e4-47ec-ad8b-6e83372b5f32");
    expect(parsed.sessionId).toBe("1d4068bc-62e4-47ec-ad8b-6e83372b5f32");
    expect(parsed.status).toBe("SUCCESS");
    expect(parsed.response).toBe("HELLO_AGY\n");
    expect(parsed.summary).toBe("HELLO_AGY");
    expect(parsed.numTurns).toBe(1);
    expect(parsed.usage).toEqual({
      inputTokens: 5286,
      outputTokens: 90,
      cachedInputTokens: 8128,
    });
    expect(parsed.thinkingTokens).toBe(86);
    expect(parsed.errorMessage).toBeNull();
    expect(parsed.malformedLines).toBe(0);
    expect(isAgySuccessResult(parsed)).toBe(true);
  });

  it("concatenates assistant text deltas in order", () => {
    const parsed = parseAgyJsonl(TOOL_RUN);
    expect(parsed.assistantText).toBe("I have created probe.txt and read it back.");
  });

  it("pairs ACTIVE and DONE tool events into one invocation per step", () => {
    const parsed = parseAgyJsonl(TOOL_RUN);
    expect(parsed.tools.length).toBe(2);

    const [write, view] = parsed.tools;
    expect(write.name).toBe("write_to_file");
    expect(write.stepIndex).toBe(2);
    expect(write.completed).toBe(true);
    expect(write.parameters).toEqual({ TargetFile: "/tmp/agyprobe/probe.txt" });
    expect(write.durationSeconds).toBe(0.01667);

    expect(view.name).toBe("view_file");
    expect(view.output).toBe("2 lines, 7 bytes");
    expect(view.completed).toBe(true);
    expect(view.isError).toBe(false);
  });

  it("uses the result event's run total for usage, not the last step", () => {
    const parsed = parseAgyJsonl(TOOL_RUN);
    expect(parsed.usage?.inputTokens).toBe(18259);
    expect(parsed.usage?.outputTokens).toBe(1111);
    expect(parsed.usage?.cachedInputTokens).toBe(24379);
  });

  it("records the init event's advertised tools and permission mode", () => {
    const parsed = parseAgyJsonl(SIMPLE_RUN);
    expect(parsed.availableTools).toEqual(["view_file", "write_to_file", "run_command"]);
    expect(parsed.permissionMode).toBe("always-proceed");
  });

  it("a truncated stream yields no result event but keeps partial usage", () => {
    const parsed = parseAgyJsonl(TRUNCATED_RUN);
    expect(parsed.resultEvent).toBeNull();
    expect(parsed.status).toBeNull();
    expect(parsed.conversationId).toBe("abc-123");
    expect(parsed.usage?.inputTokens).toBe(10);
    expect(isAgySuccessResult(parsed)).toBe(false);
  });

  it("a non-SUCCESS status produces an error message", () => {
    const parsed = parseAgyJsonl(
      '{"event":"result","result":{"conversation_id":"x","status":"ERROR","error":"model refused"}}',
    );
    expect(parsed.status).toBe("ERROR");
    expect(parsed.errorMessage).toBe("model refused");
  });

  it("a non-SUCCESS status with no error field still explains itself", () => {
    const parsed = parseAgyJsonl('{"event":"result","result":{"status":"CANCELLED"}}');
    expect(parsed.errorMessage).toBe("agy finished with status CANCELLED");
  });

  it("counts malformed JSON lines instead of throwing", () => {
    const parsed = parseAgyJsonl(['{"event":"init","conversation_id":"a"}', "{not json", ""].join("\n"));
    expect(parsed.conversationId).toBe("a");
    expect(parsed.malformedLines).toBe(1);
  });

  it("ignores non-JSON banner lines without counting them as malformed", () => {
    const parsed = parseAgyJsonl(["Fetching...", SIMPLE_RUN].join("\n"));
    expect(parsed.malformedLines).toBe(0);
    expect(parsed.status).toBe("SUCCESS");
  });

  it("falls back to raw stdout when no JSONL events are present", () => {
    const parsed = parseAgyJsonl("Hello! Systems are operational.");
    expect(parsed.summary).toBe("Hello! Systems are operational.");
    expect(parsed.sessionId).toBeNull();
    expect(parsed.isError).toBe(false);
  });

  it("preserves full multi-line Markdown response in summary without truncating to the first line", () => {
    const markdown = "## Compte-rendu d'exécution — MAR-29\n\n1. Premier point\n2. Deuxième point";
    const parsed = parseAgyJsonl(
      [
        JSON.stringify({ event: "init", conversation_id: "conv-md-1" }),
        JSON.stringify({
          event: "result",
          result: { conversation_id: "conv-md-1", status: "SUCCESS", response: markdown },
        }),
      ].join("\n"),
    );
    expect(parsed.summary).toBe(markdown);
    expect(parsed.isError).toBe(false);
  });

  it("falls back to assistantText when result.response is empty and never dumps raw NDJSON", () => {
    const withAssistant = parseAgyJsonl(
      [
        JSON.stringify({ event: "init", conversation_id: "conv-empty-1" }),
        JSON.stringify({
          event: "step_update",
          step_update: {
            conversation_id: "conv-empty-1",
            step_index: 1,
            state: "ACTIVE",
            step_type: "agent_response",
            text_delta: "Partial assistant text",
          },
        }),
        JSON.stringify({
          event: "result",
          result: { conversation_id: "conv-empty-1", status: "SUCCESS", response: "" },
        }),
      ].join("\n"),
    );
    expect(withAssistant.summary).toBe("Partial assistant text");

    const completelyEmpty = parseAgyJsonl(
      [
        JSON.stringify({ event: "init", conversation_id: "conv-empty-2" }),
        JSON.stringify({
          event: "result",
          result: { conversation_id: "conv-empty-2", status: "SUCCESS", response: "" },
        }),
      ].join("\n"),
    );
    expect(completelyEmpty.summary).toBe("");
    expect(completelyEmpty.isError).toBe(false);
  });

  it("does not fail a SUCCESS run after a recovered mid-run tool error", () => {
    const parsed = parseAgyJsonl(
      [
        JSON.stringify({ event: "init", conversation_id: "conv-rec-1" }),
        JSON.stringify({
          event: "step_update",
          step_update: {
            conversation_id: "conv-rec-1",
            step_index: 49,
            state: "ERROR",
            step_type: "tool",
            tool_name: "manage_task",
            tool_info: {
              name: "manage_task",
              error: { type: "TOOL_ERROR", message: "cannot kill task" },
            },
          },
        }),
        JSON.stringify({
          event: "result",
          result: { conversation_id: "conv-rec-1", status: "SUCCESS", response: "Recovered fine." },
        }),
      ].join("\n"),
    );
    expect(parsed.isError).toBe(false);
    expect(parsed.errorMessage).toBeNull();
    expect(parsed.summary).toBe("Recovered fine.");
    expect(parsed.tools).toHaveLength(1);
    expect(parsed.tools[0].isError).toBe(true);
    expect(parsed.tools[0].completed).toBe(true);
  });
});

describe("failure and session error classification", () => {
  it("classifies auth, quota, network and dead-session failures", () => {
    expect(detectAgyAuthRequired({ stderr: "Error: not logged in" }).requiresAuth).toBe(true);
    expect(detectAgyAuthRequired({ stderr: "authentication required" }).requiresAuth).toBe(true);
    expect(detectAgyAuthRequired({ stderr: "some other failure" }).requiresAuth).toBe(false);

    expect(detectAgyQuotaExhausted({ stderr: "RESOURCE_EXHAUSTED" })).toBe(true);
    expect(detectAgyQuotaExhausted({ stderr: "429 too many requests" })).toBe(true);
    expect(detectAgyQuotaExhausted({ stderr: "file not found" })).toBe(false);

    expect(isAgyTransientNetworkError("", "read ECONNRESET")).toBe(true);
    expect(isAgyTransientNetworkError("", "503 Service Unavailable")).toBe(true);
    expect(isAgyTransientNetworkError("", "syntax error")).toBe(false);

    expect(isAgySessionUnrecoverableError("", "conversation abc-123 not found")).toBe(true);
    expect(isAgySessionUnrecoverableError("", "invalid conversation")).toBe(true);
    expect(isAgySessionUnrecoverableError("", "tool call failed")).toBe(false);
  });

  it("detects conversation not found via isAgyUnknownSessionError", () => {
    expect(
      isAgyUnknownSessionError({
        stdout: 'conversation "conv-123" not found',
      }),
    ).toBe(true);

    expect(
      isAgyUnknownSessionError({
        stderr: "No conversation found with id conv-456",
      }),
    ).toBe(true);

    expect(
      isAgyUnknownSessionError({
        errorMessage: "Unknown conversation",
      }),
    ).toBe(true);

    expect(
      isAgyUnknownSessionError({
        stdout: "All tasks completed successfully",
      }),
    ).toBe(false);
  });
});

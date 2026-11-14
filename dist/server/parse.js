import { asString, asNumber, parseObject, } from "@paperclipai/adapter-utils/server-utils";
export const AGY_SUCCESS_STATUS = "SUCCESS";
export function parseAgyUsage(rawUsage) {
    const obj = parseObject(rawUsage);
    if (Object.keys(obj).length === 0)
        return null;
    const inputTokens = asNumber(obj.input_tokens, 0);
    const outputTokens = asNumber(obj.output_tokens, 0);
    const cachedInputTokens = obj.cache_read_tokens !== undefined ? asNumber(obj.cache_read_tokens, 0) : undefined;
    const thinkingTokens = obj.thinking_tokens !== undefined ? asNumber(obj.thinking_tokens, 0) : null;
    const usage = {
        inputTokens,
        outputTokens,
        ...(cachedInputTokens !== undefined ? { cachedInputTokens } : {}),
    };
    return { usage, thinkingTokens };
}
function readResultError(result) {
    for (const key of ["error", "error_message", "errorMessage", "message", "detail"]) {
        const val = asString(result[key], "").trim();
        if (val)
            return val;
    }
    const nested = parseObject(result.error);
    if (Object.keys(nested).length > 0) {
        for (const key of ["message", "detail", "description"]) {
            const val = asString(nested[key], "").trim();
            if (val)
                return val;
        }
    }
    return null;
}
export function parseAgyJsonl(stdout) {
    let sessionId = null;
    let model = "";
    let status = null;
    let response = null;
    let resultEvent = null;
    let finalUsage = null;
    let thinkingTokens = null;
    let numTurns = null;
    let durationSeconds = null;
    let isError = false;
    let errorMessage = null;
    let firstToolErrorMessage = null;
    let permissionMode = null;
    const availableTools = [];
    let assistantText = "";
    let malformedLines = 0;
    const toolsByStep = new Map();
    let lastStepUsage = null;
    for (const rawLine of stdout.split(/\r?\n/)) {
        const line = rawLine.trim();
        if (line.length === 0)
            continue;
        if (!line.startsWith("{"))
            continue;
        let event;
        try {
            event = JSON.parse(line);
            if (typeof event !== "object" || event === null || Array.isArray(event)) {
                malformedLines += 1;
                continue;
            }
        }
        catch {
            malformedLines += 1;
            continue;
        }
        const eventType = asString(event.event, "");
        if (eventType === "init") {
            const rawConv = asString(event.conversation_id, "");
            if (rawConv)
                sessionId = rawConv;
            const init = parseObject(event.init);
            if (Array.isArray(init.tools)) {
                for (const t of init.tools) {
                    if (typeof t === "string" && t.trim())
                        availableTools.push(t.trim());
                }
            }
            const perm = asString(init.permission_mode, "");
            if (perm)
                permissionMode = perm;
            continue;
        }
        if (eventType === "step_update") {
            const stepUpdate = parseObject(event.step_update);
            const rawConv = asString(stepUpdate.conversation_id, "");
            if (rawConv)
                sessionId = rawConv;
            const parsedStepUsage = parseAgyUsage(stepUpdate.usage);
            if (parsedStepUsage)
                lastStepUsage = parsedStepUsage;
            const stepType = asString(stepUpdate.step_type, "");
            const state = asString(stepUpdate.state, "");
            if (stepType === "agent_response") {
                const delta = typeof stepUpdate.text_delta === "string" ? stepUpdate.text_delta : "";
                if (delta)
                    assistantText += delta;
            }
            if (stepType === "tool") {
                const stepIndex = asNumber(stepUpdate.step_index, -1);
                if (stepIndex >= 0) {
                    const toolInfo = parseObject(stepUpdate.tool_info);
                    const name = asString(stepUpdate.tool_name, "") ||
                        asString(toolInfo.name, "") ||
                        "tool";
                    const existing = toolsByStep.get(stepIndex);
                    const invocation = existing ?? {
                        stepIndex,
                        name,
                        parameters: null,
                        output: null,
                        durationSeconds: null,
                        completed: false,
                        isError: false,
                    };
                    invocation.name = name;
                    if (toolInfo && Object.keys(toolInfo).length > 0) {
                        const params = parseObject(toolInfo.parameters);
                        if (Object.keys(params).length > 0)
                            invocation.parameters = params;
                        const out = asString(toolInfo.output, "");
                        if (out)
                            invocation.output = out;
                    }
                    const rawToolError = toolInfo.error !== undefined && toolInfo.error !== null
                        ? toolInfo.error
                        : stepUpdate.err;
                    if (rawToolError !== undefined && rawToolError !== null) {
                        invocation.isError = true;
                        const errorObj = parseObject(rawToolError);
                        const msg = asString(errorObj.message, "") || asString(rawToolError, "");
                        if (msg && !firstToolErrorMessage)
                            firstToolErrorMessage = msg;
                    }
                    else if (state === "ERROR") {
                        invocation.isError = true;
                    }
                    const dur = asNumber(stepUpdate.duration_seconds, -1);
                    if (dur >= 0)
                        invocation.durationSeconds = dur;
                    if (state === "DONE" || state === "ERROR")
                        invocation.completed = true;
                    toolsByStep.set(stepIndex, invocation);
                }
            }
            continue;
        }
        if (eventType === "result") {
            const resultObj = parseObject(event.result);
            resultEvent = resultObj;
            const rawConv = asString(resultObj.conversation_id, "");
            if (rawConv)
                sessionId = rawConv;
            status = asString(resultObj.status, "") || null;
            if (status && status !== AGY_SUCCESS_STATUS) {
                isError = true;
            }
            if (resultObj.usage) {
                const parsedResultUsage = parseAgyUsage(resultObj.usage);
                if (parsedResultUsage) {
                    finalUsage = parsedResultUsage.usage;
                    thinkingTokens = parsedResultUsage.thinkingTokens;
                }
            }
            if (typeof resultObj.response === "string") {
                response = resultObj.response;
            }
            if (resultObj.num_turns !== undefined) {
                numTurns = asNumber(resultObj.num_turns, 0);
            }
            if (resultObj.duration_seconds !== undefined) {
                durationSeconds = asNumber(resultObj.duration_seconds, 0);
            }
            const err = readResultError(resultObj);
            if (err) {
                errorMessage = err;
                isError = true;
            }
        }
    }
    const tools = [...toolsByStep.values()].sort((a, b) => a.stepIndex - b.stepIndex);
    if (!finalUsage && lastStepUsage) {
        finalUsage = lastStepUsage.usage;
        thinkingTokens = lastStepUsage.thinkingTokens;
    }
    const responseText = typeof response === "string" && response.trim().length > 0
        ? response
        : assistantText;
    const trimmedResponseText = responseText.trim();
    const nonJsonStdout = stdout
        .split(/\r?\n/)
        .map((line) => line.trim())
        .filter((line) => line.length > 0 && !line.startsWith("{"))
        .join("\n")
        .trim();
    const summary = trimmedResponseText ||
        (sessionId === null && resultEvent === null ? nonJsonStdout : "");
    if (!errorMessage && status !== null && status !== AGY_SUCCESS_STATUS) {
        errorMessage = firstToolErrorMessage || `agy finished with status ${status}`;
        isError = true;
    }
    return {
        sessionId,
        conversationId: sessionId,
        model,
        status,
        response,
        costUsd: null,
        usage: finalUsage,
        usageBasis: "per_run",
        thinkingTokens,
        numTurns,
        durationSeconds,
        summary,
        resultJson: resultEvent,
        resultEvent,
        isError,
        errorMessage,
        tools,
        availableTools,
        permissionMode,
        assistantText,
        malformedLines,
    };
}
export function isAgySuccessResult(parsed) {
    return parsed.status === AGY_SUCCESS_STATUS;
}
export const AUTH_PATTERNS = [
    /not\s+(?:logged\s?in|authenticated|signed\s?in)/i,
    /please\s+(?:log|sign)\s?in/i,
    /authentication\s+(?:required|failed|error)/i,
    /\bunauthenticated\b/i,
    /\bunauthorized\b/i,
    /credentials?\s+(?:not\s+found|missing|expired|invalid)/i,
    /(?:run|use)\s+`?agy\s+(?:login|auth)/i,
    /\b401\b/,
];
export const QUOTA_PATTERNS = [
    /\bquota\s+(?:exceeded|exhausted)/i,
    /\brate\s?limit(?:ed|s)?\b/i,
    /resource[_\s]exhausted/i,
    /too\s+many\s+requests/i,
    /\b429\b/,
];
export const TRANSIENT_PATTERNS = [
    /\b(?:ECONNRESET|ECONNREFUSED|ETIMEDOUT|ENOTFOUND|EAI_AGAIN|EPIPE)\b/,
    /socket\s+hang\s?up/i,
    /network\s+(?:is\s+)?(?:unreachable|error|unavailable)/i,
    /temporarily\s+unavailable/i,
    /connection\s+(?:reset|refused|closed|timed\s?out)/i,
    /\b50[234]\b/,
    /\bUNAVAILABLE\b/,
    /\bDEADLINE_EXCEEDED\b/,
];
export const SESSION_UNRECOVERABLE_PATTERNS = [
    /conversation[^\n]{0,80}not\s+found/i,
    /(?:unknown|invalid|missing|expired)\s+conversation/i,
    /no\s+such\s+conversation/i,
    /conversation[_\s]not[_\s]found/i,
    /failed\s+to\s+(?:load|resume|open)\s+conversation/i,
    /no\s+conversation\s+found\s+with\s+id/i,
    /session\s+.*not\s+found/i,
];
function matchesAny(patterns, ...texts) {
    for (const text of texts) {
        if (!text)
            continue;
        for (const pattern of patterns) {
            if (pattern.test(text))
                return true;
        }
    }
    return false;
}
export function detectAgyAuthRequired(input) {
    const resultError = input.parsed?.errorMessage ?? null;
    return {
        requiresAuth: matchesAny(AUTH_PATTERNS, input.stdout, input.stderr, resultError),
    };
}
export function detectAgyQuotaExhausted(input) {
    const resultError = input.parsed?.errorMessage ?? null;
    return matchesAny(QUOTA_PATTERNS, input.stdout, input.stderr, resultError);
}
export function isAgyTransientNetworkError(stdout, stderr) {
    return matchesAny(TRANSIENT_PATTERNS, stdout, stderr);
}
export function isAgySessionUnrecoverableError(stdout, stderr) {
    return matchesAny(SESSION_UNRECOVERABLE_PATTERNS, stdout, stderr);
}
export function isAgyUnknownSessionError(input) {
    return matchesAny(SESSION_UNRECOVERABLE_PATTERNS, input.errorMessage, input.stdout, input.stderr);
}
export function describeAgyFailure(parsed) {
    if (parsed.errorMessage)
        return parsed.errorMessage;
    if (parsed.status !== null && parsed.status !== AGY_SUCCESS_STATUS) {
        return `agy finished with status ${parsed.status}`;
    }
    return null;
}
//# sourceMappingURL=parse.js.map
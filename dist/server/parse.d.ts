import type { UsageSummary } from "@paperclipai/adapter-utils";
export declare const AGY_SUCCESS_STATUS = "SUCCESS";
export interface AgyToolInvocation {
    stepIndex: number;
    name: string;
    parameters: Record<string, unknown> | null;
    output: string | null;
    durationSeconds: number | null;
    completed: boolean;
    isError: boolean;
}
export interface ParsedAgyOutput {
    sessionId: string | null;
    conversationId: string | null;
    model: string;
    status: string | null;
    response: string | null;
    costUsd: number | null;
    usage: UsageSummary | null;
    usageBasis: "per_run" | null;
    thinkingTokens: number | null;
    numTurns: number | null;
    durationSeconds: number | null;
    summary: string;
    resultJson: Record<string, unknown> | null;
    resultEvent: Record<string, unknown> | null;
    isError: boolean;
    errorMessage: string | null;
    tools: AgyToolInvocation[];
    availableTools: string[];
    permissionMode: string | null;
    assistantText: string;
    malformedLines: number;
}
export type AgyParsedStream = ParsedAgyOutput;
export declare function parseAgyUsage(rawUsage: unknown): {
    usage: UsageSummary;
    thinkingTokens: number | null;
} | null;
export declare function parseAgyJsonl(stdout: string): ParsedAgyOutput;
export declare function isAgySuccessResult(parsed: ParsedAgyOutput): boolean;
export declare const AUTH_PATTERNS: RegExp[];
export declare const QUOTA_PATTERNS: RegExp[];
export declare const TRANSIENT_PATTERNS: RegExp[];
export declare const SESSION_UNRECOVERABLE_PATTERNS: RegExp[];
export declare function detectAgyAuthRequired(input: {
    stdout?: string | null;
    stderr?: string | null;
    parsed?: ParsedAgyOutput | null;
}): {
    requiresAuth: boolean;
};
export declare function detectAgyQuotaExhausted(input: {
    stdout?: string | null;
    stderr?: string | null;
    parsed?: ParsedAgyOutput | null;
}): boolean;
export declare function isAgyTransientNetworkError(stdout?: string | null, stderr?: string | null): boolean;
export declare function isAgySessionUnrecoverableError(stdout?: string | null, stderr?: string | null): boolean;
export declare function isAgyUnknownSessionError(input: {
    stdout?: string | null;
    stderr?: string | null;
    errorMessage?: string | null;
}): boolean;
export declare function describeAgyFailure(parsed: ParsedAgyOutput): string | null;
//# sourceMappingURL=parse.d.ts.map
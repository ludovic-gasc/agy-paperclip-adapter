import { asString, parseObject } from "@paperclipai/adapter-utils/server-utils";
import { agentConfigurationDoc, models } from "../metadata.js";
import { execute } from "./execute.js";
import { testEnvironment } from "./test.js";
import { listAgySkills, syncAgySkills } from "./skills.js";
import { listAgyModels } from "./models.js";
export { execute, modelHasEffortSuffix, resolveAgyPrintTimeoutSec } from "./execute.js";
export { testEnvironment } from "./test.js";
export { listAgySkills as listSkills, syncAgySkills as syncSkills, resolveAgySkillRoot, resolveAgySkillsHome, syncSkillsForRun, describeRunSkillSync, sanitizeAgentIdSegment, AGY_WORKSPACE_SKILL_SUBPATH, AGY_GLOBAL_SKILLS_HOME_SEGMENTS, AGY_AGENT_SKILL_ROOT_SEGMENTS, } from "./skills.js";
export { listAgyModels, inferModelProvider } from "./models.js";
export { listAgyAgents as listAgents, listAgyAgents, parseAgyAgentsOutput } from "./agents.js";
export { parseAgyJsonl, isAgyUnknownSessionError, detectAgyAuthRequired, detectAgyQuotaExhausted, isAgyTransientNetworkError, isAgySessionUnrecoverableError, isAgySuccessResult, } from "./parse.js";
export const sessionCodec = {
    deserialize(raw) {
        if (typeof raw === "string" && raw.trim().length > 0) {
            const sessionId = raw.trim();
            return { sessionId };
        }
        const obj = parseObject(raw);
        const sessionId = asString(obj.sessionId, "") ||
            asString(obj.conversationId, "") ||
            asString(obj.session_id, "") ||
            asString(obj.conversation_id, "");
        if (!sessionId)
            return null;
        const cwd = asString(obj.cwd, "");
        const workspaceId = asString(obj.workspaceId, "") || asString(obj.workspace_id, "");
        const repoUrl = asString(obj.repoUrl, "") || asString(obj.repo_url, "");
        const repoRef = asString(obj.repoRef, "") || asString(obj.repo_ref, "");
        const remoteExecution = typeof obj.remoteExecution === "object" && obj.remoteExecution !== null && !Array.isArray(obj.remoteExecution)
            ? { ...obj.remoteExecution }
            : null;
        return {
            sessionId,
            ...(cwd ? { cwd } : {}),
            ...(workspaceId ? { workspaceId } : {}),
            ...(repoUrl ? { repoUrl } : {}),
            ...(repoRef ? { repoRef } : {}),
            ...(remoteExecution ? { remoteExecution } : {}),
        };
    },
    serialize(params) {
        if (!params)
            return null;
        const sessionId = asString(params.sessionId, "") ||
            asString(params.conversationId, "") ||
            asString(params.session_id, "") ||
            asString(params.conversation_id, "");
        if (!sessionId)
            return null;
        const cwd = asString(params.cwd, "");
        const workspaceId = asString(params.workspaceId, "") || asString(params.workspace_id, "");
        const repoUrl = asString(params.repoUrl, "") || asString(params.repo_url, "");
        const repoRef = asString(params.repoRef, "") || asString(params.repo_ref, "");
        const remoteExecution = typeof params.remoteExecution === "object" &&
            params.remoteExecution !== null &&
            !Array.isArray(params.remoteExecution)
            ? { ...params.remoteExecution }
            : null;
        return {
            sessionId,
            ...(cwd ? { cwd } : {}),
            ...(workspaceId ? { workspaceId } : {}),
            ...(repoUrl ? { repoUrl } : {}),
            ...(repoRef ? { repoRef } : {}),
            ...(remoteExecution ? { remoteExecution } : {}),
        };
    },
    getDisplayId(params) {
        if (!params)
            return null;
        return (asString(params.sessionId, "") ||
            asString(params.conversationId, "") ||
            asString(params.session_id, "") ||
            asString(params.conversation_id, "") ||
            null);
    },
};
export function getAgyConfigSchema() {
    return {
        fields: [
            {
                key: "mode",
                label: "Execution mode",
                type: "select",
                default: "",
                hint: "Antigravity --mode (default edit mode when unset, accept-edits, auto, or plan).",
                options: [
                    { label: "Default (edit mode)", value: "" },
                    { label: "Accept Edits (accept-edits)", value: "accept-edits" },
                    { label: "Auto (auto)", value: "auto" },
                    { label: "Plan (plan — read-only planning)", value: "plan" },
                ],
            },
            {
                key: "effort",
                label: "Reasoning effort",
                type: "select",
                default: "",
                hint: "Reasoning effort tier passed via --effort (omit when already encoded in model ID).",
                options: [
                    { label: "Auto / Model Default", value: "" },
                    { label: "Low", value: "low" },
                    { label: "Medium", value: "medium" },
                    { label: "High", value: "high" },
                    { label: "Extra High (xhigh)", value: "xhigh" },
                    { label: "Max", value: "max" },
                ],
            },
            {
                key: "agent",
                label: "Agent persona (--agent)",
                type: "text",
                hint: "Optional Antigravity subagent persona name (e.g. research).",
            },
            {
                key: "project",
                label: "Project name (--project)",
                type: "text",
                hint: "Optional Antigravity project ID or name for conversation and memory grouping.",
            },
            {
                key: "printTimeout",
                label: "Print timeout (--print-timeout)",
                type: "text",
                default: "24h",
                hint: "CLI print mode timeout (e.g. 30m, 1h, 24h, or 0 to disable). Defaults to 24h.",
            },
            {
                key: "sandbox",
                label: "Terminal sandbox (--sandbox)",
                type: "toggle",
                default: false,
                hint: "Run with Antigravity kernel terminal sandbox enabled (--sandbox). Disabled by default so agents can reach the Paperclip API.",
            },
            {
                key: "disableSlashCommands",
                label: "Disable slash commands",
                type: "toggle",
                default: true,
                hint: "Disable slash command and skill expansion in print mode (--disable-slash-commands).",
            },
            {
                key: "dangerouslySkipPermissions",
                label: "Skip permission prompts",
                type: "toggle",
                default: false,
                hint: "Pass --dangerously-skip-permissions (bypass settings.json rules). Keep false in hardened environments.",
            },
            {
                key: "skillsScope",
                label: "Skills scope",
                type: "select",
                default: "agent",
                hint: "Per-agent keeps Paperclip skills isolated and passes them via --add-dir.",
                options: [
                    { label: "Per-agent (isolated --add-dir)", value: "agent" },
                    { label: "Global (~/.gemini/config/skills)", value: "global" },
                ],
            },
            {
                key: "skillsRootPath",
                label: "Custom skills root path",
                type: "text",
                hint: "Optional override for per-agent skills directory (<root>/.agents/skills).",
            },
            {
                key: "jsonSchema",
                label: "Structured output schema (--json-schema)",
                type: "text",
                hint: "Optional JSON schema string or file path for structured final output.",
            },
        ],
    };
}
export function createServerAdapter() {
    return {
        type: "agy_local",
        runtimeToolDelivery: "environment",
        execute,
        testEnvironment,
        listSkills: listAgySkills,
        syncSkills: syncAgySkills,
        sessionCodec,
        sessionManagement: {
            supportsSessionResume: true,
            nativeContextManagement: "confirmed",
            defaultSessionCompaction: {
                enabled: true,
                maxSessionRuns: 0,
                maxRawInputTokens: 0,
                maxSessionAgeHours: 0,
            },
        },
        models: models.map((m) => ({ ...m })),
        listModels: () => listAgyModels(),
        supportsLocalAgentJwt: true,
        supportsInstructionsBundle: true,
        instructionsPathKey: "instructionsFilePath",
        requiresMaterializedRuntimeSkills: true,
        getRuntimeCommandSpec: (config) => {
            const cmd = typeof config.command === "string" && config.command.trim().length > 0
                ? config.command.trim()
                : "agy";
            return {
                command: cmd,
                detectCommand: cmd,
                installCommand: null,
            };
        },
        agentConfigurationDoc,
        getConfigSchema: async () => getAgyConfigSchema(),
    };
}
//# sourceMappingURL=index.js.map
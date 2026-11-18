// src/metadata.ts
var type = "agy_local";
var label = "Antigravity (agy)";
var DEFAULT_AGY_LOCAL_MODEL = "gemini-3.8-flash-high";
var models = [
  { id: "gemini-3.8-flash-high", label: "Gemini 3.8 Flash (High)" },
  { id: "gemini-3.8-flash-medium", label: "Gemini 3.8 Flash (Medium)" },
  { id: "gemini-3.8-flash-low", label: "Gemini 3.8 Flash (Low)" },
  { id: "gemini-3.7-flash-high", label: "Gemini 3.7 Flash (High)" },
  { id: "gemini-3.7-flash-medium", label: "Gemini 3.7 Flash (Medium)" },
  { id: "gemini-3.7-flash-low", label: "Gemini 3.7 Flash (Low)" },
  { id: "gemini-3.6-flash-high", label: "Gemini 3.6 Flash (High)" },
  { id: "gemini-3.6-flash-medium", label: "Gemini 3.6 Flash (Medium)" },
  { id: "gemini-3.6-flash-low", label: "Gemini 3.6 Flash (Low)" },
  { id: "gemini-3.5-flash-high", label: "Gemini 3.5 Flash (High)" },
  { id: "gemini-3.5-flash-medium", label: "Gemini 3.5 Flash (Medium)" },
  { id: "gemini-3.5-flash-low", label: "Gemini 3.5 Flash (Low)" },
  { id: "gemini-3.1-pro-high", label: "Gemini 3.1 Pro (High)" },
  { id: "gemini-3.1-pro-low", label: "Gemini 3.1 Pro (Low)" },
  { id: "claude-sonnet-4-6", label: "Claude Sonnet 4.6 (Thinking)" },
  { id: "claude-opus-4-6-thinking", label: "Claude Opus 4.6 (Thinking)" },
  { id: "gpt-oss-120b-medium", label: "GPT-OSS 120B (Medium)" }
];
var agentConfigurationDoc = `# agy_local agent configuration

Adapter: agy_local

Use when:
- You want Paperclip to run the Antigravity (agy) CLI locally on the host machine
- You want conversation sessions resumed across heartbeats with --conversation <id>
- You want Paperclip skills and workspace directories injected via --add-dir

Don't use when:
- You need webhook-style external HTTP invocation (use http or openclaw_gateway)
- You only need a one-shot process without agentic tool execution (use process adapter)
- Antigravity CLI (agy) is not installed on the machine running Paperclip

Core fields:
- cwd (string, optional): absolute working directory fallback for the agent process (defaults to workspace directory)
- instructionsFilePath (string, optional): absolute path to a markdown instructions file (e.g. AGENTS.md) prepended to the run prompt
- promptTemplate (string, optional): run prompt template
- model (string, optional): model ID. Defaults to "gemini-3.8-flash-high"
- effort (string, optional): reasoning effort (low | medium | high)
- mode (string, optional): execution mode (agent | ask | plan)
- dangerouslySkipPermissions (boolean, optional, default false): allow non-interactive tool calls without prompting
- project (string, optional): Antigravity project ID or project name passed via --project
- printTimeout (string, optional, default "24h"): CLI print mode timeout (e.g. "30m", "1h", "24h", or "0" to disable)
- disableSlashCommands (boolean, optional, default true): disable slash command and skill expansion in print mode (--disable-slash-commands)
- agent (string, optional): optional Antigravity subagent persona name passed via --agent <name>
- sandbox (boolean, optional, default false): run in sandbox with terminal restrictions enabled (--sandbox)
- jsonSchema (string, optional): JSON schema string or path to schema file to enforce structured output (--json-schema)
- addDirs (string[], optional): additional workspace directories passed via --add-dir
- workspaceStrategy (object, optional): execution workspace strategy; currently supports { type: "git_worktree", baseRef?, branchTemplate?, worktreeParentDir? }
- skillsScope (string, optional): "agent" (default) keeps this agent's Paperclip skills in its own private root (~/.agy-paperclip/agents/<agentId>/.agents/skills) delivered with an extra --add-dir. "global" uses agy's shared ~/.gemini/config/skills.
- skillsRootPath (string, optional): overrides the per-agent skill root; agy reads skills from <root>/.agents/skills. Ignored when skillsScope is "global".
- command (string, optional): executable command name or path (defaults to "agy")
- extraArgs (string[], optional): additional CLI args passed to agy
- env (object, optional): KEY=VALUE environment variables

Operational fields:
- timeoutSec (number, optional): run timeout in seconds
- graceSec (number, optional): SIGTERM grace period in seconds

Notes:
- Runs execute via non-interactive print mode: \`agy --print <prompt> --output-format stream-json --input-format text\`.
- Sessions are maintained using \`--conversation <id>\` and automatically retried if a session is missing.
- Workspace directory is added to Antigravity's context via \`--add-dir <cwd>\`.
- Skills are delivered to Antigravity via an extra \`--add-dir\` pointing to the agent's isolated skill root, avoiding workspace repo pollution.
- Live structured execution logs and tool calls render in the Paperclip UI via \`./ui-parser\` (contract 1.0.0).
`;

// src/server/index.ts
import { asString as asString5, parseObject as parseObject4 } from "@paperclipai/adapter-utils/server-utils";

// src/server/execute.ts
import fs2 from "node:fs/promises";
import os2 from "node:os";
import path2 from "node:path";
import { fileURLToPath as fileURLToPath2 } from "node:url";
import {
  adapterExecutionTargetIsRemote,
  adapterExecutionTargetRemoteCwd,
  overrideAdapterExecutionTargetRemoteCwd,
  adapterExecutionTargetSessionIdentity,
  adapterExecutionTargetSessionMatches,
  ensureAdapterExecutionTargetCommandResolvable,
  ensureAdapterExecutionTargetRuntimeCommandInstalled,
  readAdapterExecutionTarget,
  resolveAdapterExecutionTargetTimeoutSec,
  resolveAdapterExecutionTargetCommandForLogs,
  runAdapterExecutionTargetProcess
} from "@paperclipai/adapter-utils/execution-target";
import {
  asBoolean,
  asNumber as asNumber2,
  asString as asString3,
  asStringArray,
  buildInvocationEnvForLogs,
  buildPaperclipEnv,
  DEFAULT_PAPERCLIP_AGENT_PROMPT_TEMPLATE,
  ensureAbsoluteDirectory,
  ensurePathInEnv,
  isPaperclipRecoveryWakePayload,
  joinPromptSections,
  parseObject as parseObject2,
  readPaperclipIssueWorkModeFromContext,
  refreshPaperclipWorkspaceEnvForExecution,
  renderPaperclipWakePrompt,
  renderTemplate,
  stringifyPaperclipWakePayload
} from "@paperclipai/adapter-utils/server-utils";

// src/server/parse.ts
import {
  asString,
  asNumber,
  parseObject
} from "@paperclipai/adapter-utils/server-utils";
var AGY_SUCCESS_STATUS = "SUCCESS";
function parseAgyUsage(rawUsage) {
  const obj = parseObject(rawUsage);
  if (Object.keys(obj).length === 0) return null;
  const inputTokens = asNumber(obj.input_tokens, 0);
  const outputTokens = asNumber(obj.output_tokens, 0);
  const cachedInputTokens = obj.cache_read_tokens !== void 0 ? asNumber(obj.cache_read_tokens, 0) : void 0;
  const thinkingTokens = obj.thinking_tokens !== void 0 ? asNumber(obj.thinking_tokens, 0) : null;
  const usage = {
    inputTokens,
    outputTokens,
    ...cachedInputTokens !== void 0 ? { cachedInputTokens } : {}
  };
  return { usage, thinkingTokens };
}
function readResultError(result) {
  for (const key of ["error", "error_message", "errorMessage", "message", "detail"]) {
    const val = asString(result[key], "").trim();
    if (val) return val;
  }
  const nested = parseObject(result.error);
  if (Object.keys(nested).length > 0) {
    for (const key of ["message", "detail", "description"]) {
      const val = asString(nested[key], "").trim();
      if (val) return val;
    }
  }
  return null;
}
function parseAgyJsonl(stdout) {
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
  const toolsByStep = /* @__PURE__ */ new Map();
  let lastStepUsage = null;
  for (const rawLine of stdout.split(/\r?\n/)) {
    const line = rawLine.trim();
    if (line.length === 0) continue;
    if (!line.startsWith("{")) continue;
    let event;
    try {
      event = JSON.parse(line);
      if (typeof event !== "object" || event === null || Array.isArray(event)) {
        malformedLines += 1;
        continue;
      }
    } catch {
      malformedLines += 1;
      continue;
    }
    const eventType = asString(event.event, "");
    if (eventType === "init") {
      const rawConv = asString(event.conversation_id, "");
      if (rawConv) sessionId = rawConv;
      const init = parseObject(event.init);
      if (Array.isArray(init.tools)) {
        for (const t of init.tools) {
          if (typeof t === "string" && t.trim()) availableTools.push(t.trim());
        }
      }
      const perm = asString(init.permission_mode, "");
      if (perm) permissionMode = perm;
      continue;
    }
    if (eventType === "step_update") {
      const stepUpdate = parseObject(event.step_update);
      const rawConv = asString(stepUpdate.conversation_id, "");
      if (rawConv) sessionId = rawConv;
      const parsedStepUsage = parseAgyUsage(stepUpdate.usage);
      if (parsedStepUsage) lastStepUsage = parsedStepUsage;
      const stepType = asString(stepUpdate.step_type, "");
      const state = asString(stepUpdate.state, "");
      if (stepType === "agent_response") {
        const delta = typeof stepUpdate.text_delta === "string" ? stepUpdate.text_delta : "";
        if (delta) assistantText += delta;
      }
      if (stepType === "tool") {
        const stepIndex = asNumber(stepUpdate.step_index, -1);
        if (stepIndex >= 0) {
          const toolInfo = parseObject(stepUpdate.tool_info);
          const name = asString(stepUpdate.tool_name, "") || asString(toolInfo.name, "") || "tool";
          const existing = toolsByStep.get(stepIndex);
          const invocation = existing ?? {
            stepIndex,
            name,
            parameters: null,
            output: null,
            durationSeconds: null,
            completed: false,
            isError: false
          };
          invocation.name = name;
          if (toolInfo && Object.keys(toolInfo).length > 0) {
            const params = parseObject(toolInfo.parameters);
            if (Object.keys(params).length > 0) invocation.parameters = params;
            const out = asString(toolInfo.output, "");
            if (out) invocation.output = out;
          }
          const rawToolError = toolInfo.error !== void 0 && toolInfo.error !== null ? toolInfo.error : stepUpdate.err;
          if (rawToolError !== void 0 && rawToolError !== null) {
            invocation.isError = true;
            const errorObj = parseObject(rawToolError);
            const msg = asString(errorObj.message, "") || asString(rawToolError, "");
            if (msg && !firstToolErrorMessage) firstToolErrorMessage = msg;
          } else if (state === "ERROR") {
            invocation.isError = true;
          }
          const dur = asNumber(stepUpdate.duration_seconds, -1);
          if (dur >= 0) invocation.durationSeconds = dur;
          if (state === "DONE" || state === "ERROR") invocation.completed = true;
          toolsByStep.set(stepIndex, invocation);
        }
      }
      continue;
    }
    if (eventType === "result") {
      const resultObj = parseObject(event.result);
      resultEvent = resultObj;
      const rawConv = asString(resultObj.conversation_id, "");
      if (rawConv) sessionId = rawConv;
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
      if (resultObj.num_turns !== void 0) {
        numTurns = asNumber(resultObj.num_turns, 0);
      }
      if (resultObj.duration_seconds !== void 0) {
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
  const responseText = typeof response === "string" && response.trim().length > 0 ? response : assistantText;
  const trimmedResponseText = responseText.trim();
  const nonJsonStdout = stdout.split(/\r?\n/).map((line) => line.trim()).filter((line) => line.length > 0 && !line.startsWith("{")).join("\n").trim();
  const summary = trimmedResponseText || (sessionId === null && resultEvent === null ? nonJsonStdout : "");
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
    malformedLines
  };
}
var AUTH_PATTERNS = [
  /not\s+(?:logged\s?in|authenticated|signed\s?in)/i,
  /please\s+(?:log|sign)\s?in/i,
  /authentication\s+(?:required|failed|error)/i,
  /\bunauthenticated\b/i,
  /\bunauthorized\b/i,
  /credentials?\s+(?:not\s+found|missing|expired|invalid)/i,
  /(?:run|use)\s+`?agy\s+(?:login|auth)/i,
  /\b401\b/
];
var QUOTA_PATTERNS = [
  /\bquota\s+(?:exceeded|exhausted)/i,
  /\brate\s?limit(?:ed|s)?\b/i,
  /resource[_\s]exhausted/i,
  /too\s+many\s+requests/i,
  /\b429\b/
];
var TRANSIENT_PATTERNS = [
  /\b(?:ECONNRESET|ECONNREFUSED|ETIMEDOUT|ENOTFOUND|EAI_AGAIN|EPIPE)\b/,
  /socket\s+hang\s?up/i,
  /network\s+(?:is\s+)?(?:unreachable|error|unavailable)/i,
  /temporarily\s+unavailable/i,
  /connection\s+(?:reset|refused|closed|timed\s?out)/i,
  /\b50[234]\b/,
  /\bUNAVAILABLE\b/,
  /\bDEADLINE_EXCEEDED\b/
];
var SESSION_UNRECOVERABLE_PATTERNS = [
  /conversation[^\n]{0,80}not\s+found/i,
  /(?:unknown|invalid|missing|expired)\s+conversation/i,
  /no\s+such\s+conversation/i,
  /conversation[_\s]not[_\s]found/i,
  /failed\s+to\s+(?:load|resume|open)\s+conversation/i,
  /no\s+conversation\s+found\s+with\s+id/i,
  /session\s+.*not\s+found/i
];
function matchesAny(patterns, ...texts) {
  for (const text of texts) {
    if (!text) continue;
    for (const pattern of patterns) {
      if (pattern.test(text)) return true;
    }
  }
  return false;
}
function detectAgyAuthRequired(input) {
  const resultError = input.parsed?.errorMessage ?? null;
  return {
    requiresAuth: matchesAny(AUTH_PATTERNS, input.stdout, input.stderr, resultError)
  };
}
function detectAgyQuotaExhausted(input) {
  const resultError = input.parsed?.errorMessage ?? null;
  return matchesAny(QUOTA_PATTERNS, input.stdout, input.stderr, resultError);
}
function isAgyTransientNetworkError(stdout, stderr) {
  return matchesAny(TRANSIENT_PATTERNS, stdout, stderr);
}
function isAgySessionUnrecoverableError(stdout, stderr) {
  return matchesAny(SESSION_UNRECOVERABLE_PATTERNS, stdout, stderr);
}
function isAgyUnknownSessionError(input) {
  return matchesAny(
    SESSION_UNRECOVERABLE_PATTERNS,
    input.errorMessage,
    input.stdout,
    input.stderr
  );
}

// src/server/skills.ts
import fs from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import { fileURLToPath } from "node:url";
import {
  asString as asString2,
  buildPersistentSkillSnapshot,
  ensurePaperclipSkillSymlink,
  isPaperclipSkillSourceMissing,
  readInstalledSkillTargets,
  readPaperclipRuntimeSkillEntries,
  resolveLegacyPaperclipDesiredSkillNames
} from "@paperclipai/adapter-utils/server-utils";
var __moduleDir = path.dirname(fileURLToPath(import.meta.url));
var ADAPTER_TYPE = "agy_local";
var AGY_WORKSPACE_SKILL_SUBPATH = path.join(".agents", "skills");
var AGY_GLOBAL_SKILLS_HOME_SEGMENTS = [".gemini", "config", "skills"];
var AGY_AGENT_SKILL_ROOT_SEGMENTS = [".agy-paperclip", "agents"];
function normalizeScope(value) {
  return typeof value === "string" && value.trim().toLowerCase() === "global" ? "global" : "agent";
}
function sanitizeAgentIdSegment(agentId) {
  const cleaned = agentId.trim().replace(/[^A-Za-z0-9._-]/g, "-");
  if (cleaned.length === 0 || /^\.+$/.test(cleaned)) return "unknown-agent";
  return cleaned;
}
function resolveAgySkillRoot(input) {
  const { config } = input;
  const agentId = input.agentId ?? "default";
  const homeDir = input.homeDir ?? os.homedir();
  const scope = normalizeScope(config.skillsScope);
  if (scope === "global") {
    const skillsHome = path.join(homeDir, ...AGY_GLOBAL_SKILLS_HOME_SEGMENTS);
    return {
      scope,
      addDir: null,
      skillsHome,
      locationLabel: skillsHome
    };
  }
  const configuredRoot = asString2(config.skillsRootPath, "").trim();
  const addDir = configuredRoot ? path.resolve(configuredRoot) : path.join(homeDir, ...AGY_AGENT_SKILL_ROOT_SEGMENTS, sanitizeAgentIdSegment(agentId));
  return {
    scope,
    addDir,
    skillsHome: path.join(addDir, AGY_WORKSPACE_SKILL_SUBPATH),
    locationLabel: path.join(addDir, AGY_WORKSPACE_SKILL_SUBPATH)
  };
}
function warningsForRoot(root) {
  if (root.scope !== "global") return [];
  return [
    `skillsScope is "global": every agy agent on this host shares ${root.skillsHome}, so skills synced for one agent are visible to all of them.`
  ];
}
function buildSnapshot(options) {
  const { availableEntries, desiredSkills, installed, root, warnings } = options;
  return buildPersistentSkillSnapshot({
    adapterType: ADAPTER_TYPE,
    availableEntries,
    desiredSkills,
    installed,
    skillsHome: root.skillsHome,
    locationLabel: root.locationLabel,
    installedDetail: root.scope === "global" ? "Linked into agy's global skills directory." : "Linked into this agent's agy skill root and passed to the run with --add-dir.",
    missingDetail: "Not linked into an agy skills directory yet; run a skill sync.",
    externalConflictDetail: "A different skill directory already occupies this name in agy's skills directory. Paperclip will not overwrite it.",
    externalDetail: "Installed in agy's skills directory outside Paperclip management.",
    warnings
  });
}
async function listAgySkills(ctx) {
  const root = resolveAgySkillRoot({ config: ctx.config, agentId: ctx.agentId });
  const availableEntries = await readPaperclipRuntimeSkillEntries(ctx.config, __moduleDir);
  const desiredSkills = resolveLegacyPaperclipDesiredSkillNames(ctx.config, availableEntries);
  const installed = await readInstalledSkillTargets(root.skillsHome);
  return buildSnapshot({
    availableEntries,
    desiredSkills,
    installed,
    root,
    warnings: warningsForRoot(root)
  });
}
async function syncAgySkills(ctx, desiredSkills) {
  const root = resolveAgySkillRoot({ config: ctx.config, agentId: ctx.agentId });
  const availableEntries = await readPaperclipRuntimeSkillEntries(ctx.config, __moduleDir);
  const desiredSet = new Set(desiredSkills);
  const warnings = warningsForRoot(root);
  await fs.mkdir(root.skillsHome, { recursive: true });
  for (const entry of availableEntries) {
    if (!desiredSet.has(entry.key)) continue;
    if (isPaperclipSkillSourceMissing(entry)) {
      warnings.push(`Skipped "${entry.runtimeName}": its skill files are not available on disk.`);
      continue;
    }
    const target = path.join(root.skillsHome, entry.runtimeName);
    try {
      const outcome = await ensurePaperclipSkillSymlink(entry.source, target);
      if (outcome === "skipped") {
        const existing = await fs.lstat(target).catch(() => null);
        if (existing && !existing.isSymbolicLink()) {
          warnings.push(
            `Left "${entry.runtimeName}" alone: ${target} exists and is not a Paperclip-managed link.`
          );
        }
      }
    } catch (err) {
      warnings.push(
        `Failed to link "${entry.runtimeName}": ${err instanceof Error ? err.message : String(err)}`
      );
    }
  }
  const installedBefore = await readInstalledSkillTargets(root.skillsHome);
  const managedSources = new Set(availableEntries.map((entry) => entry.source));
  for (const [runtimeName, installedEntry] of installedBefore) {
    if (installedEntry.kind !== "symlink") continue;
    if (!installedEntry.targetPath || !managedSources.has(installedEntry.targetPath)) continue;
    const entry = availableEntries.find((candidate) => candidate.runtimeName === runtimeName);
    if (entry && desiredSet.has(entry.key)) continue;
    await fs.unlink(path.join(root.skillsHome, runtimeName)).catch(() => {
    });
  }
  const installed = await readInstalledSkillTargets(root.skillsHome);
  return buildSnapshot({ availableEntries, desiredSkills, installed, root, warnings });
}
async function syncSkillsForRun(input) {
  const { config, agentId, companyId } = input;
  const root = resolveAgySkillRoot({ config, agentId });
  const availableEntries = await readPaperclipRuntimeSkillEntries(config, __moduleDir);
  const desiredSkills = resolveLegacyPaperclipDesiredSkillNames(config, availableEntries);
  if (root.scope === "global") {
    return { root, snapshot: null, desiredSkills, warnings: [] };
  }
  if (desiredSkills.length === 0 && availableEntries.length === 0) {
    return { root, snapshot: null, desiredSkills, warnings: [] };
  }
  const snapshot = await syncAgySkills(
    { agentId, companyId, adapterType: ADAPTER_TYPE, config },
    desiredSkills
  );
  return { root, snapshot, desiredSkills, warnings: snapshot.warnings };
}
var SKILL_SYNC_LOG_PREFIX = "[paperclip] skill sync:";
function shortVersion(versionId) {
  const value = (versionId ?? "").trim();
  if (!value) return "unpinned";
  return value.length > 8 ? value.slice(0, 8) : value;
}
function describeRunSkillSync(sync) {
  const { root, snapshot, desiredSkills } = sync;
  if (root.scope === "global") {
    return [
      `${SKILL_SYNC_LOG_PREFIX} skipped \u2014 skillsScope is "global"; ${root.skillsHome} is shared host-wide and is only reconciled by an explicit sync, never per run.`
    ];
  }
  if (!snapshot) {
    return [
      `${SKILL_SYNC_LOG_PREFIX} nothing to deliver \u2014 no skills are assigned to this agent. Root: ${root.skillsHome}`
    ];
  }
  const desiredSet = new Set(desiredSkills);
  const delivered = snapshot.entries.filter((entry) => entry.desired && entry.state === "installed");
  const undelivered = snapshot.entries.filter(
    (entry) => entry.desired && entry.state !== "installed"
  );
  const lines = [
    `${SKILL_SYNC_LOG_PREFIX} ${delivered.length}/${desiredSet.size} desired skill(s) installed${undelivered.length > 0 ? `, ${undelivered.length} not installed` : ""}. Root: ${root.skillsHome}`
  ];
  for (const entry of delivered) {
    lines.push(
      `${SKILL_SYNC_LOG_PREFIX}   installed ${entry.runtimeName ?? "(unnamed)"} version=${shortVersion(entry.versionId)} key=${entry.key}`
    );
  }
  for (const entry of undelivered) {
    lines.push(
      `${SKILL_SYNC_LOG_PREFIX}   ${entry.state}${entry.runtimeName ? ` ${entry.runtimeName}` : ""} key=${entry.key}`
    );
  }
  return lines;
}

// src/server/models.ts
import { runChildProcess } from "@paperclipai/adapter-utils/server-utils";
function parseAgyModelsOutput(output) {
  const models2 = [];
  const lines = output.split(/\r?\n/);
  for (const rawLine of lines) {
    const cleanLine = rawLine.replace(/\x1b\[[0-9;]*[a-zA-Z]/g, "").replace(/[⠋⠙⠹⠸⠼⠴⠦⠧⠇⠏]/g, "").replace(/Fetching available models\.\.\./g, "").trim();
    if (!cleanLine || cleanLine.startsWith("Available")) {
      continue;
    }
    const match = cleanLine.match(/^([a-zA-Z0-9_.-]+)\s{2,}(.+)$/) || cleanLine.match(/^([a-zA-Z0-9_.-]+)\s+(.+)$/);
    if (match) {
      const id = match[1].trim();
      const label2 = match[2].trim();
      if (id && label2 && !models2.some((m) => m.id === id)) {
        models2.push({ id, label: label2 });
      }
    }
  }
  return models2;
}
async function listAgyModels(command = "agy") {
  try {
    const runId = `agy-models-${Date.now()}`;
    const proc = await runChildProcess(runId, command, ["models"], {
      cwd: process.cwd(),
      env: Object.fromEntries(
        Object.entries(process.env).filter((e) => typeof e[1] === "string")
      ),
      timeoutSec: 15,
      graceSec: 3,
      onLog: async () => {
      }
    });
    if (proc.exitCode === 0 && proc.stdout.trim().length > 0) {
      const discovered = parseAgyModelsOutput(proc.stdout);
      if (discovered.length > 0) {
        return discovered;
      }
    }
  } catch {
  }
  return models;
}
function inferModelProvider(model) {
  const normalized = model.trim().toLowerCase();
  if (normalized.startsWith("claude")) return "anthropic";
  if (normalized.startsWith("gpt") || normalized.startsWith("openai") || normalized.startsWith("o1") || normalized.startsWith("o3")) {
    return "openai";
  }
  return "google";
}

// src/server/execute.ts
var __moduleDir2 = path2.dirname(fileURLToPath2(import.meta.url));
function firstNonEmptyLine(text) {
  return text.split(/\r?\n/).map((line) => line.trim()).find(Boolean) ?? "";
}
async function discoverAgySessionArtifacts(sessionId) {
  if (!sessionId || typeof sessionId !== "string") return [];
  const homedir = os2.homedir();
  const candidateDirs = [
    path2.join(homedir, ".gemini", "antigravity-cli", "brain", sessionId),
    path2.join(homedir, ".gemini", "antigravity", "brain", sessionId)
  ];
  const artifacts = [];
  async function walk(currentDir) {
    try {
      const entries = await fs2.readdir(currentDir, { withFileTypes: true });
      for (const entry of entries) {
        if (entry.name.startsWith(".")) continue;
        const fullPath = path2.join(currentDir, entry.name);
        if (entry.isDirectory()) {
          await walk(fullPath);
        } else if (entry.isFile()) {
          artifacts.push(fullPath);
        }
      }
    } catch {
    }
  }
  for (const dir of candidateDirs) {
    await walk(dir);
  }
  return [...new Set(artifacts)];
}
async function execute(ctx) {
  const { runId, agent, runtime, config: rawConfig, context, onLog, onMeta, onSpawn, authToken } = ctx;
  const executionTarget = readAdapterExecutionTarget({
    executionTarget: ctx.executionTarget,
    legacyRemoteExecution: ctx.executionTransport?.remoteExecution
  });
  const executionTargetIsRemote = adapterExecutionTargetIsRemote(executionTarget);
  const config = parseObject2({ ...parseObject2(agent?.adapterConfig), ...parseObject2(rawConfig) });
  const promptTemplate = asString3(
    config.promptTemplate,
    DEFAULT_PAPERCLIP_AGENT_PROMPT_TEMPLATE
  );
  const command = asString3(config.command, "agy");
  const model = asString3(config.model, DEFAULT_AGY_LOCAL_MODEL).trim();
  const effort = asString3(config.effort, "").trim();
  const mode = asString3(config.mode, "").trim();
  const agentPersona = asString3(config.agent ?? config.agentPersona, "").trim();
  const jsonSchema = asString3(config.jsonSchema ?? config.json_schema, "").trim();
  const sandbox = config.sandbox !== void 0 ? asBoolean(config.sandbox, false) : false;
  const dangerouslySkipPermissions = asBoolean(config.dangerouslySkipPermissions, false);
  const additionalDirs = Array.isArray(config.addDirs) ? config.addDirs.map((d) => asString3(d, "").trim()).filter(Boolean) : [];
  const project = asString3(config.project, "").trim() || asString3(context.project?.slug, "").trim() || asString3(context.project?.name, "").trim();
  const rawPrintTimeout = config.printTimeout !== void 0 ? asString3(config.printTimeout, "").trim() : "";
  const disableSlashCommands = config.disableSlashCommands !== void 0 ? asBoolean(config.disableSlashCommands, true) : true;
  const workspaceContext = parseObject2(context.paperclipWorkspace);
  const workspaceCwd = asString3(workspaceContext.cwd, "");
  const workspaceSource = asString3(workspaceContext.source, "");
  const workspaceId = asString3(workspaceContext.workspaceId, "");
  const workspaceRepoUrl = asString3(workspaceContext.repoUrl, "");
  const workspaceRepoRef = asString3(workspaceContext.repoRef, "");
  const agentHome = asString3(workspaceContext.agentHome, "");
  const workspaceHints = Array.isArray(context.paperclipWorkspaces) ? context.paperclipWorkspaces.filter(
    (value) => typeof value === "object" && value !== null
  ) : [];
  const configuredCwd = asString3(config.cwd, "");
  const useConfiguredInsteadOfAgentHome = workspaceSource === "agent_home" && configuredCwd.length > 0;
  const effectiveWorkspaceCwd = useConfiguredInsteadOfAgentHome ? "" : workspaceCwd;
  const cwd = effectiveWorkspaceCwd || configuredCwd || process.cwd();
  const effectiveExecutionCwd = adapterExecutionTargetRemoteCwd(executionTarget, cwd);
  await ensureAbsoluteDirectory(cwd, { createIfMissing: true });
  let skillRoot = resolveAgySkillRoot({ config, agentId: agent.id });
  let skillsAddDir = null;
  const skillTargetDirs = [];
  if (skillRoot.addDir && !executionTargetIsRemote) {
    try {
      const runSync = await syncSkillsForRun({
        config,
        agentId: agent.id,
        companyId: agent.companyId
      });
      skillRoot = runSync.root;
      for (const line of describeRunSkillSync(runSync)) {
        await onLog("stdout", `${line}
`);
      }
      for (const warning of runSync.warnings) {
        await onLog("stdout", `[paperclip] skill sync: ${warning}
`);
      }
    } catch (err) {
      await onLog(
        "stdout",
        `[paperclip] Skill sync failed; the run continues without freshly synced skills: ${err instanceof Error ? err.message : String(err)}
`
      );
    }
    const skillsHomeExists = await fs2.stat(skillRoot.skillsHome).then((stats) => stats.isDirectory()).catch(() => false);
    if (skillsHomeExists) {
      skillsAddDir = skillRoot.addDir;
      try {
        const entries = await fs2.readdir(skillRoot.skillsHome, { withFileTypes: true });
        for (const entry of entries) {
          const fullPath = path2.join(skillRoot.skillsHome, entry.name);
          const real = await fs2.realpath(fullPath).catch(() => null);
          if (real) {
            skillTargetDirs.push(path2.dirname(real));
          }
        }
      } catch {
      }
    }
  } else if (skillRoot.addDir && executionTargetIsRemote) {
    await onLog(
      "stdout",
      `[paperclip] Skills synced to ${skillRoot.skillsHome} are not delivered to remote execution targets; set skillsScope to "global" and provision ~/.gemini/config/skills in the target instead.
`
    );
  }
  const envConfig = parseObject2(config.env);
  const env = { ...buildPaperclipEnv(agent) };
  env.PAPERCLIP_RUN_ID = runId;
  const wakeTaskId = typeof context.taskId === "string" && context.taskId.trim().length > 0 && context.taskId.trim() || typeof context.issueId === "string" && context.issueId.trim().length > 0 && context.issueId.trim() || null;
  const wakeReason = typeof context.wakeReason === "string" && context.wakeReason.trim().length > 0 ? context.wakeReason.trim() : null;
  const wakeCommentId = typeof context.wakeCommentId === "string" && context.wakeCommentId.trim().length > 0 && context.wakeCommentId.trim() || typeof context.commentId === "string" && context.commentId.trim().length > 0 && context.commentId.trim() || null;
  const approvalId = typeof context.approvalId === "string" && context.approvalId.trim().length > 0 ? context.approvalId.trim() : null;
  const approvalStatus = typeof context.approvalStatus === "string" && context.approvalStatus.trim().length > 0 ? context.approvalStatus.trim() : null;
  const linkedIssueIds = Array.isArray(context.issueIds) ? context.issueIds.filter((value) => typeof value === "string" && value.trim().length > 0) : [];
  const wakePayloadJson = stringifyPaperclipWakePayload(context.paperclipWake);
  const issueWorkMode = readPaperclipIssueWorkModeFromContext(context);
  if (wakeTaskId) env.PAPERCLIP_TASK_ID = wakeTaskId;
  if (issueWorkMode) env.PAPERCLIP_ISSUE_WORK_MODE = issueWorkMode;
  if (wakeReason) env.PAPERCLIP_WAKE_REASON = wakeReason;
  if (wakeCommentId) env.PAPERCLIP_WAKE_COMMENT_ID = wakeCommentId;
  if (approvalId) env.PAPERCLIP_APPROVAL_ID = approvalId;
  if (approvalStatus) env.PAPERCLIP_APPROVAL_STATUS = approvalStatus;
  if (linkedIssueIds.length > 0) env.PAPERCLIP_LINKED_ISSUE_IDS = linkedIssueIds.join(",");
  if (wakePayloadJson) env.PAPERCLIP_WAKE_PAYLOAD_JSON = wakePayloadJson;
  refreshPaperclipWorkspaceEnvForExecution({
    env,
    envConfig,
    workspaceCwd: effectiveWorkspaceCwd,
    workspaceSource,
    workspaceId,
    workspaceRepoUrl,
    workspaceRepoRef,
    workspaceHints,
    agentHome,
    executionTargetIsRemote,
    executionCwd: effectiveExecutionCwd
  });
  if (authToken) {
    env.PAPERCLIP_API_KEY = authToken;
  }
  const rawEnv = ensurePathInEnv({ ...process.env, ...env });
  const runtimeEnv = Object.fromEntries(
    Object.entries(rawEnv).filter((entry) => typeof entry[1] === "string")
  );
  delete runtimeEnv.NOTIFY_SOCKET;
  delete runtimeEnv.LISTEN_FDS;
  delete runtimeEnv.LISTEN_PID;
  delete runtimeEnv.LISTEN_FDNAMES;
  const timeoutSec = resolveAdapterExecutionTargetTimeoutSec(
    executionTarget,
    asNumber2(config.timeoutSec, 0)
  );
  const graceSec = asNumber2(config.graceSec, 15);
  await ensureAdapterExecutionTargetRuntimeCommandInstalled({
    runId,
    target: executionTarget,
    installCommand: ctx.runtimeCommandSpec?.installCommand,
    detectCommand: ctx.runtimeCommandSpec?.detectCommand,
    cwd,
    env: runtimeEnv,
    timeoutSec,
    graceSec,
    onLog
  });
  await ensureAdapterExecutionTargetCommandResolvable(command, executionTarget, cwd, runtimeEnv, {
    timeoutSec
  });
  const resolvedCommand = await resolveAdapterExecutionTargetCommandForLogs(
    command,
    executionTarget,
    cwd,
    runtimeEnv
  );
  const loggedEnv = buildInvocationEnvForLogs(env, {
    runtimeEnv,
    includeRuntimeKeys: ["HOME", "PATH"],
    resolvedCommand
  });
  const extraArgs = (() => {
    const fromExtraArgs = asStringArray(config.extraArgs);
    if (fromExtraArgs.length > 0) return fromExtraArgs;
    return asStringArray(config.args);
  })();
  const runtimeExecutionTarget = overrideAdapterExecutionTargetRemoteCwd(
    executionTarget,
    effectiveExecutionCwd
  );
  const runtimeSessionParams = parseObject2(runtime.sessionParams);
  const runtimeSessionId = asString3(runtimeSessionParams.sessionId, "") || asString3(runtimeSessionParams.conversationId, "") || asString3(runtime.sessionId, "");
  const runtimeSessionCwd = asString3(runtimeSessionParams.cwd, "");
  const runtimeRemoteExecution = parseObject2(runtimeSessionParams.remoteExecution);
  const canResumeSession = runtimeSessionId.length > 0 && (runtimeSessionCwd.length === 0 || path2.resolve(runtimeSessionCwd) === path2.resolve(effectiveExecutionCwd)) && adapterExecutionTargetSessionMatches(runtimeRemoteExecution, runtimeExecutionTarget);
  const sessionId = canResumeSession ? runtimeSessionId : null;
  const instructionsFilePath = asString3(config.instructionsFilePath, "").trim();
  const resolvedInstructionsFilePath = instructionsFilePath ? path2.resolve(cwd, instructionsFilePath) : "";
  const instructionsDir = resolvedInstructionsFilePath ? `${path2.dirname(resolvedInstructionsFilePath)}/` : "";
  let instructionsPrefix = "";
  if (resolvedInstructionsFilePath) {
    try {
      const instructionsContents = await fs2.readFile(resolvedInstructionsFilePath, "utf8");
      instructionsPrefix = `${instructionsContents}

The above agent instructions were loaded from ${resolvedInstructionsFilePath}. Resolve any relative file references from ${instructionsDir}.

`;
    } catch (err) {
      const reason = err instanceof Error ? err.message : String(err);
      await onLog(
        "stdout",
        `[paperclip] Warning: could not read agent instructions file "${resolvedInstructionsFilePath}": ${reason}
`
      );
    }
  }
  const bootstrapPromptTemplate = asString3(config.bootstrapPromptTemplate, "");
  const templateData = {
    agentId: agent.id,
    companyId: agent.companyId,
    runId,
    company: { id: agent.companyId },
    agent,
    run: { id: runId, source: "on_demand" },
    context
  };
  const renderedBootstrapPrompt = !sessionId && bootstrapPromptTemplate.trim().length > 0 ? renderTemplate(bootstrapPromptTemplate, templateData).trim() : "";
  const wakePrompt = renderPaperclipWakePrompt(context.paperclipWake, {
    resumedSession: Boolean(sessionId)
  });
  const shouldUseResumeDeltaPrompt = Boolean(sessionId) && wakePrompt.length > 0;
  const renderedPrompt = shouldUseResumeDeltaPrompt || isPaperclipRecoveryWakePayload(context.paperclipWake) ? "" : renderTemplate(promptTemplate, templateData);
  const sessionHandoffNote = asString3(context.paperclipSessionHandoffMarkdown, "").trim();
  const prompt = joinPromptSections([
    instructionsPrefix,
    renderedBootstrapPrompt,
    wakePrompt,
    sessionHandoffNote,
    renderedPrompt
  ]);
  const promptMetrics = {
    promptChars: prompt.length,
    instructionsChars: instructionsPrefix.length,
    bootstrapPromptChars: renderedBootstrapPrompt.length,
    wakePromptChars: wakePrompt.length,
    sessionHandoffChars: sessionHandoffNote.length,
    heartbeatPromptChars: renderedPrompt.length
  };
  const buildArgs = (resumeSessionId) => {
    const args = [
      "--output-format",
      "stream-json",
      "--input-format",
      "text",
      "--add-dir",
      cwd
    ];
    const addedDirs = /* @__PURE__ */ new Set([path2.resolve(cwd)]);
    const addDirUnique = (dir) => {
      if (!dir) return;
      const resolved = path2.resolve(dir);
      if (!addedDirs.has(resolved)) {
        addedDirs.add(resolved);
        args.push("--add-dir", dir);
      }
    };
    for (const hint of workspaceHints) {
      addDirUnique(asString3(hint.cwd, "").trim());
    }
    for (const addDir of additionalDirs) {
      addDirUnique(addDir);
    }
    addDirUnique(skillsAddDir);
    for (const targetDir of skillTargetDirs) {
      addDirUnique(targetDir);
    }
    if (resolvedInstructionsFilePath) {
      addDirUnique(path2.dirname(resolvedInstructionsFilePath));
    }
    if (dangerouslySkipPermissions) {
      args.push("--dangerously-skip-permissions");
    }
    if (sandbox) {
      args.push("--sandbox");
    }
    args.push(
      "--settings",
      JSON.stringify({
        enableTerminalSandbox: sandbox,
        allowNonWorkspaceAccess: true,
        toolPermission: "always-proceed"
      })
    );
    if (resumeSessionId) {
      args.push("--conversation", resumeSessionId);
    }
    if (agentPersona) {
      args.push("--agent", agentPersona);
    }
    if (model) {
      args.push("--model", model);
    }
    if (effort) {
      args.push("--effort", effort);
    }
    if (mode) {
      args.push("--mode", mode);
    }
    if (jsonSchema) {
      args.push("--json-schema", jsonSchema);
    }
    if (project) {
      args.push("--project", project);
    }
    const effectivePrintTimeout = rawPrintTimeout === "0" ? "" : rawPrintTimeout || (timeoutSec > 0 ? `${timeoutSec}s` : "24h");
    if (effectivePrintTimeout) {
      args.push("--print-timeout", effectivePrintTimeout);
    }
    if (disableSlashCommands) {
      args.push("--disable-slash-commands");
    }
    if (extraArgs.length > 0) {
      args.push(...extraArgs);
    }
    args.push("--print", prompt);
    return args;
  };
  const runAttempt = async (resumeSessionId) => {
    const args = buildArgs(resumeSessionId);
    if (onMeta) {
      await onMeta({
        adapterType: "agy_local",
        command: resolvedCommand,
        cwd: effectiveExecutionCwd,
        commandArgs: args.map((arg) => arg === prompt ? `<prompt ${prompt.length} chars>` : arg),
        env: loggedEnv,
        prompt,
        promptMetrics,
        context
      });
    }
    const proc = await runAdapterExecutionTargetProcess(
      runId,
      runtimeExecutionTarget,
      command,
      args,
      {
        cwd,
        env: runtimeEnv,
        timeoutSec,
        graceSec,
        onSpawn,
        onRuntimeProgress: ctx.onRuntimeProgress,
        onLog
      }
    );
    return {
      proc,
      rawStderr: proc.stderr,
      parsed: parseAgyJsonl(proc.stdout)
    };
  };
  const toResult = (attempt, clearSessionOnMissingSession = false) => {
    const requiresAuth = detectAgyAuthRequired({
      stdout: attempt.proc.stdout,
      stderr: attempt.proc.stderr,
      parsed: attempt.parsed
    }).requiresAuth;
    const quotaExhausted = detectAgyQuotaExhausted({
      stdout: attempt.proc.stdout,
      stderr: attempt.proc.stderr,
      parsed: attempt.parsed
    });
    const networkUnavailable = isAgyTransientNetworkError(
      attempt.proc.stdout,
      attempt.proc.stderr
    );
    const classifyErrorCode = () => {
      if (attempt.proc.errorCode) return attempt.proc.errorCode;
      if (requiresAuth) return "agy_auth_required";
      if (quotaExhausted) return "agy_quota_exhausted";
      if (networkUnavailable) return "agy_network_unavailable";
      return null;
    };
    const errorFamily = quotaExhausted ? "provider_quota" : networkUnavailable ? "transient_upstream" : null;
    if (attempt.proc.timedOut) {
      return {
        exitCode: attempt.proc.exitCode,
        signal: attempt.proc.signal,
        timedOut: true,
        errorMessage: `Timed out after ${timeoutSec}s`,
        errorCode: classifyErrorCode(),
        errorFamily,
        clearSession: clearSessionOnMissingSession
      };
    }
    const resolvedSessionId = attempt.parsed.sessionId ?? (clearSessionOnMissingSession ? null : runtimeSessionId ?? runtime.sessionId ?? null);
    const resolvedSessionParams = resolvedSessionId ? {
      sessionId: resolvedSessionId,
      conversationId: resolvedSessionId,
      cwd: effectiveExecutionCwd,
      ...workspaceId ? { workspaceId } : {},
      ...workspaceRepoUrl ? { repoUrl: workspaceRepoUrl } : {},
      ...workspaceRepoRef ? { repoRef: workspaceRepoRef } : {},
      ...executionTargetIsRemote ? {
        remoteExecution: adapterExecutionTargetSessionIdentity(runtimeExecutionTarget)
      } : {}
    } : null;
    const parsedError = typeof attempt.parsed.errorMessage === "string" ? attempt.parsed.errorMessage.trim() : "";
    const stderrLine = firstNonEmptyLine(attempt.proc.stderr);
    const rawExitCode = attempt.proc.exitCode;
    const synthesizedExitCode = (parsedError || attempt.parsed.isError) && (rawExitCode ?? 0) === 0 ? 1 : rawExitCode;
    const fallbackErrorMessage = parsedError || stderrLine || `Antigravity exited with code ${synthesizedExitCode ?? -1}`;
    const failed = (synthesizedExitCode ?? 0) !== 0;
    const provider = inferModelProvider(model);
    return {
      exitCode: synthesizedExitCode,
      signal: attempt.proc.signal,
      timedOut: false,
      errorMessage: failed ? fallbackErrorMessage : null,
      errorCode: failed ? classifyErrorCode() : null,
      errorFamily: failed ? errorFamily : null,
      usage: attempt.parsed.usage ? {
        inputTokens: attempt.parsed.usage.inputTokens,
        outputTokens: attempt.parsed.usage.outputTokens,
        cachedInputTokens: attempt.parsed.usage.cachedInputTokens
      } : void 0,
      usageBasis: "per_run",
      sessionId: resolvedSessionId,
      sessionParams: resolvedSessionParams,
      sessionDisplayId: resolvedSessionId,
      provider,
      biller: "google",
      model: model || null,
      billingType: "subscription",
      costUsd: attempt.parsed.costUsd ?? 0,
      resultJson: {
        conversationContinuation: "continue_conversation_v1",
        stdout: attempt.proc.stdout,
        stderr: attempt.proc.stderr,
        ...attempt.parsed.resultJson ? attempt.parsed.resultJson : {},
        ...attempt.parsed.thinkingTokens !== null ? { thinking_tokens: attempt.parsed.thinkingTokens } : {},
        ...attempt.parsed.tools.length > 0 ? { tool_invocations: attempt.parsed.tools.map((t) => t.name) } : {},
        ...attempt.parsed.malformedLines > 0 ? { malformed_stream_lines: attempt.parsed.malformedLines } : {},
        ...attempt.parsed.summary.trim().length > 0 && !failed ? {
          finalResponse: {
            disposition: "final",
            text: attempt.parsed.summary
          }
        } : {}
      },
      summary: attempt.parsed.summary,
      clearSession: Boolean(clearSessionOnMissingSession && !attempt.parsed.sessionId)
    };
  };
  const initial = await runAttempt(sessionId);
  const initialFailed = !initial.proc.timedOut && ((initial.proc.exitCode ?? 0) !== 0 || Boolean(initial.parsed.errorMessage) || initial.parsed.isError);
  let finalResult;
  if (sessionId && initialFailed && (isAgyUnknownSessionError({
    stdout: initial.proc.stdout,
    stderr: initial.rawStderr,
    errorMessage: initial.parsed.errorMessage
  }) || isAgySessionUnrecoverableError(initial.proc.stdout, initial.rawStderr))) {
    await onLog(
      "stdout",
      `[paperclip] Antigravity conversation "${sessionId}" is unavailable; retrying with a fresh session.
`
    );
    const retry = await runAttempt(null);
    finalResult = toResult(retry, true);
  } else {
    finalResult = toResult(initial);
  }
  if (finalResult.sessionId && !executionTargetIsRemote) {
    const artifacts = await discoverAgySessionArtifacts(finalResult.sessionId);
    if (artifacts.length > 0) {
      await onLog(
        "stdout",
        `[paperclip] Discovered ${artifacts.length} Antigravity artifact(s):
${artifacts.map((a) => `  - ${a}`).join("\n")}
`
      );
      finalResult.resultJson = {
        ...finalResult.resultJson,
        artifacts
      };
    }
  }
  return finalResult;
}

// src/server/test.ts
import {
  asBoolean as asBoolean2,
  asNumber as asNumber3,
  asString as asString4,
  asStringArray as asStringArray2,
  ensurePathInEnv as ensurePathInEnv2,
  parseObject as parseObject3
} from "@paperclipai/adapter-utils/server-utils";
import {
  ensureAdapterExecutionTargetCommandResolvable as ensureAdapterExecutionTargetCommandResolvable2,
  ensureAdapterExecutionTargetDirectory,
  runAdapterExecutionTargetProcess as runAdapterExecutionTargetProcess2,
  describeAdapterExecutionTarget,
  resolveAdapterExecutionTargetCwd
} from "@paperclipai/adapter-utils/execution-target";
function summarizeStatus(checks) {
  if (checks.some((check) => check.level === "error")) return "fail";
  if (checks.some((check) => check.level === "warn")) return "warn";
  return "pass";
}
function firstNonEmptyLine2(text) {
  return text.split(/\r?\n/).map((line) => line.trim()).find(Boolean) ?? "";
}
function summarizeProbeDetail(stdout, stderr, parsedError) {
  const raw = parsedError?.trim() || firstNonEmptyLine2(stderr) || firstNonEmptyLine2(stdout);
  if (!raw) return null;
  const clean = raw.replace(/\s+/g, " ").trim();
  const max = 240;
  return clean.length > max ? `${clean.slice(0, max - 1)}\u2026` : clean;
}
async function testEnvironment(ctx) {
  const checks = [];
  const config = parseObject3(ctx.config);
  const command = asString4(config.command, "agy");
  const target = ctx.executionTarget ?? null;
  const targetIsRemote = target?.kind === "remote";
  const cwd = resolveAdapterExecutionTargetCwd(target, asString4(config.cwd, ""), process.cwd());
  const targetLabel = targetIsRemote ? ctx.environmentName ?? describeAdapterExecutionTarget(target) : null;
  const runId = `agy-envtest-${Date.now()}-${Math.random().toString(16).slice(2)}`;
  if (targetLabel) {
    checks.push({
      code: "agy_environment_target",
      level: "info",
      message: `Probing inside environment: ${targetLabel}`
    });
  }
  try {
    await ensureAdapterExecutionTargetDirectory(runId, target, cwd, {
      cwd,
      env: {},
      createIfMissing: true
    });
    checks.push({
      code: "agy_cwd_valid",
      level: "info",
      message: `Working directory is valid: ${cwd}`
    });
  } catch (err) {
    checks.push({
      code: "agy_cwd_invalid",
      level: "error",
      message: err instanceof Error ? err.message : "Invalid working directory",
      detail: cwd
    });
  }
  const envConfig = parseObject3(config.env);
  const env = {};
  for (const [key, value] of Object.entries(envConfig)) {
    if (typeof value === "string") env[key] = value;
  }
  const runtimeEnv = ensurePathInEnv2({ ...process.env, ...env });
  try {
    await ensureAdapterExecutionTargetCommandResolvable2(command, target, cwd, runtimeEnv);
    checks.push({
      code: "agy_command_resolvable",
      level: "info",
      message: `Command is executable: ${command}`
    });
  } catch (err) {
    checks.push({
      code: "agy_command_unresolvable",
      level: "error",
      message: err instanceof Error ? err.message : "Command is not executable",
      detail: command
    });
  }
  const canRunProbe = checks.every(
    (check) => check.code !== "agy_cwd_invalid" && check.code !== "agy_command_unresolvable"
  );
  if (canRunProbe) {
    const model = asString4(config.model, DEFAULT_AGY_LOCAL_MODEL).trim();
    const effort = asString4(config.effort, "").trim();
    const mode = asString4(config.mode, "").trim();
    const agentPersona = asString4(config.agent ?? config.agentPersona, "").trim();
    const sandbox = config.sandbox !== void 0 ? asBoolean2(config.sandbox, true) : true;
    const disableSlashCommands = config.disableSlashCommands !== void 0 ? asBoolean2(config.disableSlashCommands, true) : true;
    const dangerouslySkipPermissions = asBoolean2(config.dangerouslySkipPermissions, false);
    const helloProbeTimeoutSec = Math.max(1, asNumber3(config.helloProbeTimeoutSec, 60));
    const extraArgs = asStringArray2(config.extraArgs);
    const args = [
      "--print",
      "Respond with hello.",
      "--output-format",
      "stream-json",
      "--input-format",
      "text",
      "--add-dir",
      cwd
    ];
    if (sandbox) args.push("--sandbox");
    if (disableSlashCommands) args.push("--disable-slash-commands");
    if (agentPersona) args.push("--agent", agentPersona);
    if (model) args.push("--model", model);
    if (effort) args.push("--effort", effort);
    if (mode) args.push("--mode", mode);
    if (dangerouslySkipPermissions) args.push("--dangerously-skip-permissions");
    if (extraArgs.length > 0) args.push(...extraArgs);
    const probe = await runAdapterExecutionTargetProcess2(
      runId,
      target,
      command,
      args,
      {
        cwd,
        env,
        timeoutSec: helloProbeTimeoutSec,
        graceSec: 5,
        onLog: async () => {
        }
      }
    );
    const parsed = parseAgyJsonl(probe.stdout);
    const detail = summarizeProbeDetail(probe.stdout, probe.stderr, parsed.errorMessage);
    if (probe.timedOut) {
      checks.push({
        code: "agy_hello_probe_timed_out",
        level: "warn",
        message: "Antigravity hello probe timed out.",
        hint: 'Verify agy can run `agy --print "hello"` from this directory manually.'
      });
    } else if ((probe.exitCode ?? 1) === 0) {
      const summary = parsed.summary.trim();
      const hasHello = /\bhello\b/i.test(summary);
      checks.push({
        code: hasHello ? "agy_hello_probe_passed" : "agy_hello_probe_unexpected_output",
        level: hasHello ? "info" : "warn",
        message: hasHello ? "Antigravity hello probe succeeded." : "Antigravity probe ran but did not return `hello` as expected.",
        ...summary ? { detail: summary.replace(/\s+/g, " ").trim().slice(0, 240) } : {}
      });
    } else {
      checks.push({
        code: "agy_hello_probe_failed",
        level: "error",
        message: "Antigravity hello probe failed.",
        ...detail ? { detail } : {},
        hint: 'Run `agy --print "hello" --output-format stream-json` in this working directory to debug.'
      });
    }
  }
  return {
    adapterType: ctx.adapterType,
    status: summarizeStatus(checks),
    checks,
    testedAt: (/* @__PURE__ */ new Date()).toISOString()
  };
}

// src/server/agents.ts
import { runChildProcess as runChildProcess2 } from "@paperclipai/adapter-utils/server-utils";

// src/server/index.ts
var sessionCodec = {
  deserialize(raw) {
    if (typeof raw === "string" && raw.trim().length > 0) {
      const sessionId2 = raw.trim();
      return { sessionId: sessionId2 };
    }
    const obj = parseObject4(raw);
    const sessionId = asString5(obj.sessionId, "") || asString5(obj.conversationId, "") || asString5(obj.session_id, "") || asString5(obj.conversation_id, "");
    if (!sessionId) return null;
    const cwd = asString5(obj.cwd, "");
    const workspaceId = asString5(obj.workspaceId, "") || asString5(obj.workspace_id, "");
    const repoUrl = asString5(obj.repoUrl, "") || asString5(obj.repo_url, "");
    const repoRef = asString5(obj.repoRef, "") || asString5(obj.repo_ref, "");
    const remoteExecution = typeof obj.remoteExecution === "object" && obj.remoteExecution !== null && !Array.isArray(obj.remoteExecution) ? { ...obj.remoteExecution } : null;
    return {
      sessionId,
      ...cwd ? { cwd } : {},
      ...workspaceId ? { workspaceId } : {},
      ...repoUrl ? { repoUrl } : {},
      ...repoRef ? { repoRef } : {},
      ...remoteExecution ? { remoteExecution } : {}
    };
  },
  serialize(params) {
    if (!params) return null;
    const sessionId = asString5(params.sessionId, "") || asString5(params.conversationId, "") || asString5(params.session_id, "") || asString5(params.conversation_id, "");
    if (!sessionId) return null;
    const cwd = asString5(params.cwd, "");
    const workspaceId = asString5(params.workspaceId, "") || asString5(params.workspace_id, "");
    const repoUrl = asString5(params.repoUrl, "") || asString5(params.repo_url, "");
    const repoRef = asString5(params.repoRef, "") || asString5(params.repo_ref, "");
    const remoteExecution = typeof params.remoteExecution === "object" && params.remoteExecution !== null && !Array.isArray(params.remoteExecution) ? { ...params.remoteExecution } : null;
    return {
      sessionId,
      ...cwd ? { cwd } : {},
      ...workspaceId ? { workspaceId } : {},
      ...repoUrl ? { repoUrl } : {},
      ...repoRef ? { repoRef } : {},
      ...remoteExecution ? { remoteExecution } : {}
    };
  },
  getDisplayId(params) {
    if (!params) return null;
    return asString5(params.sessionId, "") || asString5(params.conversationId, "") || asString5(params.session_id, "") || asString5(params.conversation_id, "") || null;
  }
};
function getAgyConfigSchema() {
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
          { label: "Plan (plan \u2014 read-only planning)", value: "plan" }
        ]
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
          { label: "Max", value: "max" }
        ]
      },
      {
        key: "agent",
        label: "Agent persona (--agent)",
        type: "text",
        hint: "Optional Antigravity subagent persona name (e.g. research)."
      },
      {
        key: "project",
        label: "Project name (--project)",
        type: "text",
        hint: "Optional Antigravity project ID or name for conversation and memory grouping."
      },
      {
        key: "printTimeout",
        label: "Print timeout (--print-timeout)",
        type: "text",
        default: "24h",
        hint: "CLI print mode timeout (e.g. 30m, 1h, 24h, or 0 to disable). Defaults to 24h."
      },
      {
        key: "sandbox",
        label: "Terminal sandbox (--sandbox)",
        type: "toggle",
        default: false,
        hint: "Run with Antigravity kernel terminal sandbox enabled (--sandbox). Disabled by default so agents can reach the Paperclip API."
      },
      {
        key: "disableSlashCommands",
        label: "Disable slash commands",
        type: "toggle",
        default: true,
        hint: "Disable slash command and skill expansion in print mode (--disable-slash-commands)."
      },
      {
        key: "dangerouslySkipPermissions",
        label: "Skip permission prompts",
        type: "toggle",
        default: false,
        hint: "Pass --dangerously-skip-permissions (bypass settings.json rules). Keep false in hardened environments."
      },
      {
        key: "skillsScope",
        label: "Skills scope",
        type: "select",
        default: "agent",
        hint: "Per-agent keeps Paperclip skills isolated and passes them via --add-dir.",
        options: [
          { label: "Per-agent (isolated --add-dir)", value: "agent" },
          { label: "Global (~/.gemini/config/skills)", value: "global" }
        ]
      },
      {
        key: "skillsRootPath",
        label: "Custom skills root path",
        type: "text",
        hint: "Optional override for per-agent skills directory (<root>/.agents/skills)."
      },
      {
        key: "jsonSchema",
        label: "Structured output schema (--json-schema)",
        type: "text",
        hint: "Optional JSON schema string or file path for structured final output."
      }
    ]
  };
}
function createServerAdapter() {
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
        maxSessionAgeHours: 0
      }
    },
    models: models.map((m) => ({ ...m })),
    listModels: () => listAgyModels(),
    supportsLocalAgentJwt: true,
    supportsInstructionsBundle: true,
    instructionsPathKey: "instructionsFilePath",
    requiresMaterializedRuntimeSkills: true,
    getRuntimeCommandSpec: (config) => {
      const cmd = typeof config.command === "string" && config.command.trim().length > 0 ? config.command.trim() : "agy";
      return {
        command: cmd,
        detectCommand: cmd,
        installCommand: null
      };
    },
    agentConfigurationDoc,
    getConfigSchema: async () => getAgyConfigSchema()
  };
}
export {
  DEFAULT_AGY_LOCAL_MODEL,
  agentConfigurationDoc,
  createServerAdapter,
  getAgyConfigSchema,
  label,
  models,
  type
};

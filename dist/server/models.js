import { models as fallbackModels } from "../metadata.js";
import { runChildProcess } from "@paperclipai/adapter-utils/server-utils";
export function parseAgyModelsOutput(output) {
    const models = [];
    const lines = output.split(/\r?\n/);
    for (const rawLine of lines) {
        // Strip ANSI codes, spinners, and progress messages
        const cleanLine = rawLine
            .replace(/\x1b\[[0-9;]*[a-zA-Z]/g, "")
            .replace(/[⠋⠙⠹⠸⠼⠴⠦⠧⠇⠏]/g, "")
            .replace(/Fetching available models\.\.\./g, "")
            .trim();
        if (!cleanLine || cleanLine.startsWith("Available")) {
            continue;
        }
        const match = cleanLine.match(/^([a-zA-Z0-9_.-]+)\s{2,}(.+)$/) || cleanLine.match(/^([a-zA-Z0-9_.-]+)\s+(.+)$/);
        if (match) {
            const id = match[1].trim();
            const label = match[2].trim();
            if (id && label && !models.some((m) => m.id === id)) {
                models.push({ id, label });
            }
        }
    }
    return models;
}
export async function listAgyModels(command = "agy") {
    try {
        const runId = `agy-models-${Date.now()}`;
        const proc = await runChildProcess(runId, command, ["models"], {
            cwd: process.cwd(),
            env: Object.fromEntries(Object.entries(process.env).filter((e) => typeof e[1] === "string")),
            timeoutSec: 15,
            graceSec: 3,
            onLog: async () => { },
        });
        if (proc.exitCode === 0 && proc.stdout.trim().length > 0) {
            const discovered = parseAgyModelsOutput(proc.stdout);
            if (discovered.length > 0) {
                return discovered;
            }
        }
    }
    catch {
        // Probing unavailable; fallback to static model list
    }
    return fallbackModels;
}
export function inferModelProvider(model) {
    const normalized = model.trim().toLowerCase();
    if (normalized.startsWith("claude"))
        return "anthropic";
    if (normalized.startsWith("gpt") ||
        normalized.startsWith("openai") ||
        normalized.startsWith("o1") ||
        normalized.startsWith("o3")) {
        return "openai";
    }
    return "google";
}
//# sourceMappingURL=models.js.map
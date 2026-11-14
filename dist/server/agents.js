import { runChildProcess } from "@paperclipai/adapter-utils/server-utils";
export function parseAgyAgentsOutput(output) {
    const agents = [];
    const lines = output.split(/\r?\n/);
    for (const rawLine of lines) {
        const cleanLine = rawLine
            .replace(/\x1b\[[0-9;]*[a-zA-Z]/g, "")
            .replace(/[⠋⠙⠹⠸⠼⠴⠦⠧⠇⠏]/g, "")
            .trim();
        if (!cleanLine || cleanLine.toLowerCase().startsWith("available agents")) {
            continue;
        }
        const match = cleanLine.match(/^([a-zA-Z0-9_.-]+)(?:\s{2,}(.+))?$/) || cleanLine.match(/^([a-zA-Z0-9_.-]+)(?:\s+(.+))?$/);
        if (match) {
            const id = match[1].trim();
            const desc = match[2]?.trim();
            if (id && !agents.some((a) => a.id === id)) {
                agents.push({
                    id,
                    label: desc ? `${id} (${desc})` : id,
                    ...(desc ? { description: desc } : {}),
                });
            }
        }
    }
    return agents;
}
export async function listAgyAgents(command = "agy") {
    try {
        const runId = `agy-agents-${Date.now()}`;
        const proc = await runChildProcess(runId, command, ["agents"], {
            cwd: process.cwd(),
            env: Object.fromEntries(Object.entries(process.env).filter((e) => typeof e[1] === "string")),
            timeoutSec: 15,
            graceSec: 3,
            onLog: async () => { },
        });
        if (proc.exitCode === 0 && proc.stdout.trim().length > 0) {
            return parseAgyAgentsOutput(proc.stdout);
        }
    }
    catch {
        // Probing unavailable
    }
    return [];
}
//# sourceMappingURL=agents.js.map
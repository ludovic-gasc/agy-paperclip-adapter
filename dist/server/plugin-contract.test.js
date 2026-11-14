import { describe, expect, it } from "vitest";
import { createServerAdapter, getAgyConfigSchema } from "../index.js";
describe("agy-paperclip-adapter plugin contract", () => {
    it("exports createServerAdapter returning a complete ServerAdapterModule", async () => {
        const mod = createServerAdapter();
        expect(mod.type).toBe("agy_local");
        expect(typeof mod.execute).toBe("function");
        expect(typeof mod.testEnvironment).toBe("function");
        expect(typeof mod.listSkills).toBe("function");
        expect(typeof mod.syncSkills).toBe("function");
        expect(typeof mod.listModels).toBe("function");
        expect(mod.supportsLocalAgentJwt).toBe(true);
        expect(mod.supportsInstructionsBundle).toBe(true);
        expect(mod.instructionsPathKey).toBe("instructionsFilePath");
        expect(mod.requiresMaterializedRuntimeSkills).toBe(true);
        expect(mod.sessionManagement?.supportsSessionResume).toBe(true);
        expect(mod.sessionManagement?.nativeContextManagement).toBe("confirmed");
        expect(mod.getRuntimeCommandSpec?.({})).toEqual({
            command: "agy",
            detectCommand: "agy",
            installCommand: null,
        });
        const schema = await mod.getConfigSchema?.();
        expect(schema).toEqual(getAgyConfigSchema());
        const keys = new Set(schema?.fields.map((f) => f.key));
        expect(keys.has("sandbox")).toBe(true);
        expect(keys.has("printTimeout")).toBe(true);
        expect(keys.has("disableSlashCommands")).toBe(true);
        expect(keys.has("dangerouslySkipPermissions")).toBe(true);
        // Built-in local AgentConfigForm fields should not be duplicated in schema
        expect(keys.has("cwd")).toBe(false);
        expect(keys.has("command")).toBe(false);
        expect(keys.has("model")).toBe(false);
    });
});
//# sourceMappingURL=plugin-contract.test.js.map
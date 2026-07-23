import fs from "fs";
import { execSync } from "child_process";

export async function runClaude(prompt) {

    fs.writeFileSync("claude-input.md", prompt);

    const output = execSync(
        "claude --print < claude-input.md",
        {
            encoding: "utf8",
            maxBuffer: 20 * 1024 * 1024
        }
    );

    return output;
}
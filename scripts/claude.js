import { spawn } from "child_process";

export async function reviewWithClaude(prompt) {
    return new Promise((resolve, reject) => {

        console.log("🤖 Running Claude Code with subscription authentication...");

        if (!process.env.CLAUDE_CODE_OAUTH_TOKEN) {
            return reject(
                new Error("CLAUDE_CODE_OAUTH_TOKEN is not available")
            );
        }

        const args = [
            "-p",
            prompt,
            "--output-format",
            "text",
            "--model",
            process.env.CLAUDE_MODEL || "sonnet",
            "--no-session-persistence",
            "--max-turns",
            "3",
        ];

        console.log(
            `🤖 Running: claude -p --output-format text --model ${
                process.env.CLAUDE_MODEL || "sonnet"
            } --no-session-persistence --max-turns 3`
        );

        const child = spawn("claude", args, {
            env: {
                ...process.env,
                CLAUDE_CODE_OAUTH_TOKEN:
                    process.env.CLAUDE_CODE_OAUTH_TOKEN,
            },
            cwd: process.env.TARGET_REPO || process.cwd(),
            shell: false,
        });

        let stdout = "";
        let stderr = "";

        child.stdout.on("data", (data) => {
            stdout += data.toString();
        });

        child.stderr.on("data", (data) => {
            stderr += data.toString();
        });

        child.on("error", (error) => {
            reject(error);
        });

        child.on("close", (code) => {

            if (code !== 0) {
                console.error(`❌ Claude Code exited with code: ${code}`);
                console.error(`STDOUT: ${stdout}`);
                console.error(`STDERR: ${stderr}`);

                reject(
                    new Error(
                        `Claude Code exited with code ${code}. ` +
                        `STDERR: ${stderr || "(empty)"}`
                    )
                );

                return;
            }

            console.log("✅ Claude Code review completed.");

            resolve(stdout.trim());
        });
    });
}

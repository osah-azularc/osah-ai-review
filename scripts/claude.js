import { spawn } from "child_process";

function runClaude(prompt) {
    return new Promise((resolve, reject) => {
        const args = [
            "-p",
            "--output-format",
            "text",
            "--model",
            process.env.CLAUDE_MODEL || "sonnet",
            "--no-session-persistence",
            "--bare",
            "--max-turns",
            "3",
        ];

        console.log(`🤖 Running: claude ${args.join(" ")}`);

        const child = spawn("claude", args, {
            cwd: process.env.TARGET_REPO || process.cwd(),
            env: {
                ...process.env,
            },
            stdio: ["pipe", "pipe", "pipe"],
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
            reject(
                new Error(
                    `Failed to start Claude Code: ${error.message}`
                )
            );
        });

        child.on("close", (code) => {
            if (code !== 0) {
                console.error("❌ Claude Code exited with code:", code);

                console.error(
                    "STDOUT:",
                    stdout || "(empty)"
                );

                console.error(
                    "STDERR:",
                    stderr || "(empty)"
                );

                reject(
                    new Error(
                        `Claude Code exited with code ${code}. ` +
                        `STDERR: ${stderr || "(empty)"}`
                    )
                );

                return;
            }

            if (!stdout.trim()) {
                reject(
                    new Error(
                        "Claude Code completed successfully but returned empty output."
                    )
                );

                return;
            }

            resolve(stdout.trim());
        });

        // Send the complete review prompt through stdin
        child.stdin.write(prompt);
        child.stdin.end();
    });
}

export async function reviewWithClaude(prompt) {
    try {
        console.log(
            "🤖 Running Claude Code with subscription authentication..."
        );

        const result = await runClaude(prompt);

        console.log("✅ Claude Code returned a review.");

        return result;
    } catch (error) {
        console.error(
            "❌ Claude Code review failed:",
            error.message
        );

        throw error;
    }
}

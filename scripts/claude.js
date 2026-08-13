import { spawn } from "child_process";

/**
 * Runs Claude Code using the Claude subscription OAuth token.
 *
 * The review prompt is passed through stdin.
 */
export function reviewWithClaude(prompt) {
    return new Promise((resolve, reject) => {

        console.log("🤖 Starting Claude Code...");

        const args = [
            "-p",
            "--output-format",
            "text",
            "--model",
            "sonnet",
            "--no-session-persistence",
            "--bare",
            "--max-turns",
            "20"
        ];

        console.log(`Running: claude ${args.join(" ")}`);

        const claude = spawn("claude", args, {
            env: {
                ...process.env,
            },
            stdio: ["pipe", "pipe", "pipe"],
        });

        let stdout = "";
        let stderr = "";

        claude.stdout.on("data", (data) => {
            stdout += data.toString();
        });

        claude.stderr.on("data", (data) => {
            stderr += data.toString();
        });

        claude.on("error", (error) => {
            reject(
                new Error(
                    `Failed to start Claude Code: ${error.message}`
                )
            );
        });

        claude.on("close", (code) => {

            if (code !== 0) {

                console.error("❌ Claude Code exited with code:", code);

                if (stdout) {
                    console.error("STDOUT:", stdout);
                }

                if (stderr) {
                    console.error("STDERR:", stderr);
                }

                reject(
                    new Error(
                        `Claude Code exited with code ${code}. ` +
                        `STDOUT: ${stdout} STDERR: ${stderr}`
                    )
                );

                return;
            }

            console.log("✅ Claude Code completed.");

            resolve(stdout.trim());
        });

        // IMPORTANT:
        // Send the review prompt to Claude through stdin.
        claude.stdin.write(prompt);
        claude.stdin.end();
    });
}

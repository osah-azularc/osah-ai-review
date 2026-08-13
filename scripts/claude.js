import { execFile } from "child_process";

function runClaude(prompt) {
    return new Promise((resolve, reject) => {
        const child = execFile(
            "claude",
            [
                "-p",
                "--output-format",
                "text",
                "--model",
                process.env.CLAUDE_MODEL || "sonnet",
                "--max-turns",
                "1",
            ],
            {
                maxBuffer: 20 * 1024 * 1024,
                cwd: process.env.TARGET_REPO || process.cwd(),
            },
            (error, stdout, stderr) => {
                if (error) {
                    console.error("Claude Code failed:");

                    if (stderr) {
                        console.error(stderr);
                    }

                    reject(error);
                    return;
                }

                resolve(stdout.trim());
            }
        );

        child.stdin.write(prompt);
        child.stdin.end();
    });
}

export async function reviewWithClaude(prompt) {
    try {
        console.log("🤖 Running Claude Code with subscription authentication...");

        const result = await runClaude(prompt);

        if (!result) {
            throw new Error("Claude returned an empty response.");
        }

        return result;
    } catch (error) {
        console.error("Claude Code review failed:", error.message);
        throw error;
    }
}

import { spawn } from "child_process";

export async function reviewWithClaude(prompt) {
    return new Promise((resolve, reject) => {

        console.log("🤖 Starting Claude Code...");

        const args = [
            "-p",
            "--output-format",
            "text",
            "--model",
            "sonnet",
            "--no-session-persistence",
            "--max-turns",
            "20"
        ];

        console.log(`Running: claude ${args.join(" ")}`);

        const child = spawn("claude", args, {
            env: {
                ...process.env,
                CLAUDE_CODE_OAUTH_TOKEN:
                    process.env.CLAUDE_CODE_OAUTH_TOKEN
            },
            stdio: ["pipe", "pipe", "pipe"]
        });

        let stdout = "";
        let stderr = "";

        child.stdout.on("data", (data) => {
            stdout += data.toString();
        });

        child.stderr.on("data", (data) => {
            stderr += data.toString();
        });

        child.on("close", (code) => {

            if (code !== 0) {
                console.error(`❌ Claude Code exited with code ${code}`);
                console.error("STDOUT:", stdout);
                console.error("STDERR:", stderr);

                return reject(
                    new Error(
                        `Claude Code exited with code ${code}. ${stdout || stderr}`
                    )
                );
            }

            console.log("✅ Claude Code completed.");

            resolve(stdout);
        });

        child.stdin.write(prompt);
        child.stdin.end();
    });
}

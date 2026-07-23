import { execSync } from "child_process";

/**
 * Executes a shell command and returns its output.
 * @param {string} command
 * @returns {string}
 */
function execute(command) {
  try {
    return execSync(command, {
      encoding: "utf8",
      stdio: ["pipe", "pipe", "pipe"],
    }).trim();
  } catch (err) {
    console.warn(`Command failed: ${command}`);
    return "";
  }
}

/**
 * Returns changed file names.
 */
export function getChangedFiles(baseBranch = "origin/dev") {
  console.log("📄 Collecting changed files...");

  const output = execute(
    `git diff --name-only ${baseBranch}...HEAD`
  );

  return output
    .split("\n")
    .filter(Boolean);
}

/**
 * Returns complete git diff.
 */
export function getGitDiff(baseBranch = "origin/dev") {
  console.log("📄 Collecting git diff...");

  return execute(
    `git diff ${baseBranch}...HEAD`
  );
}
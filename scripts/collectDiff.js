import { execSync } from "child_process";

/**
 * Executes a shell command inside the target repository.
 *
 * @param {string} command
 * @param {string} repoPath
 * @returns {string}
 */
function execute(command, repoPath) {
    try {
        return execSync(command, {
            cwd: repoPath,
            encoding: "utf8",
            stdio: ["pipe", "pipe", "pipe"],
        }).trim();
    } catch (err) {
        console.warn(`⚠ Command failed: ${command}`);
        console.warn(err.message);
        return "";
    }
}

/**
 * Ensure the latest dev branch is available.
 */
function fetchBaseBranch(repoPath, baseBranch) {
    try {
        console.log(`🔄 Fetching ${baseBranch}...`);

        const branch = baseBranch.replace("origin/", "");

        execSync(
            `git fetch origin ${branch}`,
            {
                cwd: repoPath,
                stdio: "inherit",
            }
        );
    } catch (err) {
        console.warn(`⚠ Unable to fetch ${baseBranch}`);
    }
}

/**
 * Returns list of changed files.
 *
 * @param {string} repoPath
 * @param {string} baseBranch
 */
export function getChangedFiles(
    repoPath,
    baseBranch = "origin/dev"
) {
    console.log("📄 Collecting Changed Files...");

    fetchBaseBranch(repoPath, baseBranch);

    const output = execute(
        `git diff --name-only ${baseBranch}...HEAD`,
        repoPath
    );

    return output
        .split("\n")
        .map(file => file.trim())
        .filter(Boolean);
}

/**
 * Returns full git diff.
 *
 * @param {string} repoPath
 * @param {string} baseBranch
 */
export function getGitDiff(
    repoPath,
    baseBranch = "origin/dev"
) {
    console.log("📄 Collecting Git Diff...");

    fetchBaseBranch(repoPath, baseBranch);

    return execute(
        `git diff ${baseBranch}...HEAD`,
        repoPath
    );
}

export function getReviewContext(repoPath) {
const reviewContext = {

    repository,

    owner,

    repo,

    author,

    branch,

    baseBranch,

    prNumber,

    changedFiles,

    gitDiff,

    commitMessages,

    insertions,

    deletions,

    totalFiles,

    npmAudit,

    eslint,

    duplicateCode,

    largeFiles,

    hardcodedSql,

    consoleLogs,

    disabledEslint

};
   return reviewContext;
}

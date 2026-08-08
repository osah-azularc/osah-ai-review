import { execSync } from "child_process";
import fs from "fs";
import path from "path";

/**
 * Execute a shell command inside the target repository.
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
      maxBuffer: 20 * 1024 * 1024,
    }).trim();
  } catch (err) {
    const stdout = err.stdout?.toString()?.trim() || "";
    const stderr = err.stderr?.toString()?.trim() || "";

    console.warn(`⚠ Command failed: ${command}`);

    if (stderr) {
      console.warn(stderr);
    }

    return stdout;
  }
}

/**
 * Execute a command and return stdout even when the command
 * exits with a non-zero status.
 *
 * Useful for npm audit and eslint because these commands
 * intentionally return non-zero when issues are found.
 *
 * @param {string} command
 * @param {string[]} args
 * @param {string} repoPath
 * @returns {string}
 */
function executeCommand(command, args, repoPath) {
  try {
    return execSync([command, ...args].join(" "), {
      cwd: repoPath,
      encoding: "utf8",
      stdio: ["pipe", "pipe", "pipe"],
      maxBuffer: 20 * 1024 * 1024,
    }).trim();
  } catch (err) {
    const stdout = err.stdout?.toString()?.trim() || "";
    const stderr = err.stderr?.toString()?.trim() || "";

    if (stdout) {
      return stdout;
    }

    if (stderr) {
      return stderr;
    }

    return "";
  }
}

/**
 * Validate a git branch/ref before using it in a shell command.
 *
 * @param {string} branch
 * @returns {string}
 */
function sanitizeGitRef(branch) {
  if (!branch) {
    return "dev";
  }

  const cleaned = branch.replace(/^origin\//, "").trim();

  if (!/^[a-zA-Z0-9._/-]+$/.test(cleaned)) {
    throw new Error(`Invalid git branch name: ${branch}`);
  }

  return cleaned;
}

/**
 * Ensure the latest base branch is available.
 *
 * @param {string} repoPath
 * @param {string} baseBranch
 */
function fetchBaseBranch(repoPath, baseBranch) {
  try {
    const branch = sanitizeGitRef(baseBranch);

    console.log(`🔄 Fetching origin/${branch}...`);

    execSync(`git fetch origin ${branch}`, {
      cwd: repoPath,
      stdio: "inherit",
    });
  } catch (err) {
    console.warn(`⚠ Unable to fetch base branch: ${baseBranch}`);
    console.warn(err.message);
  }
}

/**
 * Get repository information from GitHub Actions
 * or local git configuration.
 *
 * @param {string} repoPath
 * @returns {object}
 */
function getRepositoryInfo(repoPath) {
  let repository =
    process.env.GITHUB_REPOSITORY ||
    process.env.REPOSITORY ||
    "";

  let owner = "";
  let repo = "";

  if (repository.includes("/")) {
    [owner, repo] = repository.split("/");
  }

  // Fallback to git remote if GitHub Actions variable is unavailable.
  if (!owner || !repo) {
    const remoteUrl = execute(
      "git remote get-url origin",
      repoPath
    );

    const match = remoteUrl.match(
      /github\.com[:/]([^/]+)\/([^/.]+)(?:\.git)?$/
    );

    if (match) {
      owner = match[1];
      repo = match[2];
      repository = `${owner}/${repo}`;
    }
  }

  if (!repository) {
    throw new Error(
      "Repository information is not available. " +
        "GITHUB_REPOSITORY is not defined."
    );
  }

  return {
    repository,
    owner,
    repo,
  };
}

/**
 * Get PR information from GitHub Actions environment
 * and event payload.
 *
 * @param {string} repoPath
 * @returns {object}
 */
function getPullRequestInfo(repoPath) {
  let prNumber =
    process.env.PR_NUMBER ||
    process.env.GITHUB_EVENT_NUMBER ||
    "";

  let author =
    process.env.PR_AUTHOR ||
    process.env.GITHUB_ACTOR ||
    "";

  let branch =
    process.env.PR_HEAD ||
    process.env.GITHUB_HEAD_REF ||
    "";

  let baseBranch =
    process.env.PR_BASE ||
    process.env.GITHUB_BASE_REF ||
    "dev";

  // GitHub Actions event payload gives more accurate PR data.
  const eventPath = process.env.GITHUB_EVENT_PATH;

  if (eventPath && fs.existsSync(eventPath)) {
    try {
      const event = JSON.parse(
        fs.readFileSync(eventPath, "utf8")
      );

      if (event.pull_request) {
        prNumber =
          event.pull_request.number ||
          prNumber;

        author =
          event.pull_request.user?.login ||
          author;

        branch =
          event.pull_request.head?.ref ||
          branch;

        baseBranch =
          event.pull_request.base?.ref ||
          baseBranch;
      }
    } catch (err) {
      console.warn(
        "⚠ Unable to read GitHub event payload:",
        err.message
      );
    }
  }

  // Local fallback.
  if (!branch) {
    branch = execute(
      "git branch --show-current",
      repoPath
    );
  }

  if (!baseBranch) {
    baseBranch = "dev";
  }

  return {
    prNumber: String(prNumber || ""),
    author,
    branch,
    baseBranch: sanitizeGitRef(baseBranch),
  };
}

/**
 * Returns list of changed files.
 *
 * @param {string} repoPath
 * @param {string} baseBranch
 * @returns {string[]}
 */
export function getChangedFiles(
  repoPath,
  baseBranch = "origin/dev"
) {
  console.log("📄 Collecting Changed Files...");

  fetchBaseBranch(repoPath, baseBranch);

  const branch = sanitizeGitRef(baseBranch);

  const output = execute(
    `git diff --name-only origin/${branch}...HEAD`,
    repoPath
  );

  return output
    .split("\n")
    .map((file) => file.trim())
    .filter(Boolean);
}

/**
 * Returns full git diff.
 *
 * @param {string} repoPath
 * @param {string} baseBranch
 * @returns {string}
 */
export function getGitDiff(
  repoPath,
  baseBranch = "origin/dev"
) {
  console.log("📄 Collecting Git Diff...");

  fetchBaseBranch(repoPath, baseBranch);

  const branch = sanitizeGitRef(baseBranch);

  return execute(
    `git diff --no-ext-diff origin/${branch}...HEAD`,
    repoPath
  );
}

/**
 * Returns commit messages for the PR.
 *
 * @param {string} repoPath
 * @param {string} baseBranch
 * @returns {string[]}
 */
function getCommitMessages(
  repoPath,
  baseBranch = "origin/dev"
) {
  const branch = sanitizeGitRef(baseBranch);

  const output = execute(
    `git log --format=%s origin/${branch}...HEAD`,
    repoPath
  );

  return output
    .split("\n")
    .map((message) => message.trim())
    .filter(Boolean);
}

/**
 * Get git statistics.
 *
 * @param {string} repoPath
 * @param {string} baseBranch
 * @returns {object}
 */
function getGitStats(
  repoPath,
  baseBranch = "origin/dev"
) {
  const branch = sanitizeGitRef(baseBranch);

  const output = execute(
    `git diff --shortstat origin/${branch}...HEAD`,
    repoPath
  );

  const insertionsMatch = output.match(
    /(\d+)\s+insertion/
  );

  const deletionsMatch = output.match(
    /(\d+)\s+deletion/
  );

  const filesMatch = output.match(
    /(\d+)\s+file/
  );

  return {
    insertions: Number(insertionsMatch?.[1] || 0),
    deletions: Number(deletionsMatch?.[1] || 0),
    totalFiles: Number(filesMatch?.[1] || 0),
  };
}

/**
 * Run npm audit.
 *
 * @param {string} repoPath
 * @returns {object}
 */
function runNpmAudit(repoPath) {
  console.log("🔐 Running npm audit...");

  try {
    const output = executeCommand(
      "npm",
      ["audit", "--json"],
      repoPath
    );

    if (!output) {
      return {
        status: "Unable to execute",
        critical: 0,
        high: 0,
        moderate: 0,
        low: 0,
        report: "",
      };
    }

    try {
      const audit = JSON.parse(output);

      const vulnerabilities =
        audit.metadata?.vulnerabilities || {};

      return {
        status: "Completed",
        critical: vulnerabilities.critical || 0,
        high: vulnerabilities.high || 0,
        moderate: vulnerabilities.moderate || 0,
        low: vulnerabilities.low || 0,
        report: JSON.stringify(
          vulnerabilities,
          null,
          2
        ),
      };
    } catch {
      return {
        status: "Completed with non-JSON output",
        critical: 0,
        high: 0,
        moderate: 0,
        low: 0,
        report: output,
      };
    }
  } catch (err) {
    return {
      status: "Failed",
      critical: 0,
      high: 0,
      moderate: 0,
      low: 0,
      report: err.message,
    };
  }
}

/**
 * Run ESLint against changed JavaScript/TypeScript files.
 *
 * @param {string} repoPath
 * @param {string[]} changedFiles
 * @returns {object}
 */
function runEslint(repoPath, changedFiles) {
  console.log("🧹 Running ESLint...");

  const eslintFiles = changedFiles.filter((file) =>
    /\.(js|jsx|mjs|cjs|ts|tsx)$/.test(file)
  );

  if (!eslintFiles.length) {
    return {
      status: "Skipped",
      report: "No JavaScript/TypeScript files changed.",
    };
  }

  const existingFiles = eslintFiles.filter((file) =>
    fs.existsSync(path.join(repoPath, file))
  );

  if (!existingFiles.length) {
    return {
      status: "Skipped",
      report: "No existing JavaScript/TypeScript files found.",
    };
  }

  try {
    const output = executeCommand(
      "npx",
      ["eslint", ...existingFiles],
      repoPath
    );

    return {
      status: "Completed",
      report: output || "No ESLint issues found.",
    };
  } catch (err) {
    return {
      status: "Failed",
      report: err.message,
    };
  }
}

/**
 * Check duplicate code using PMD CPD.
 *
 * Required command:
 * pmd cpd --minimum-tokens 200
 * --dir .
 * --language ecmascript
 * --format text
 *
 * @param {string} repoPath
 * @returns {object}
 */
function checkDuplicateCode(repoPath) {
  console.log("🔁 Checking duplicate code...");

  const reportPath = path.join(
    repoPath,
    "cpd-report.txt"
  );

  try {
    execSync(
      "pmd cpd --minimum-tokens 200 --dir . --language ecmascript --format text > cpd-report.txt",
      {
        cwd: repoPath,
        encoding: "utf8",
        stdio: "pipe",
        maxBuffer: 20 * 1024 * 1024,
      }
    );
  } catch (err) {
    // CPD returns non-zero when duplicates are found.
    // The report may still have been generated.
  }

  if (!fs.existsSync(reportPath)) {
    return {
      status: "Unavailable",
      report:
        "CPD report was not generated. " +
        "Verify that PMD is installed on the runner.",
    };
  }

  const report = fs.readFileSync(
    reportPath,
    "utf8"
  );

  return {
    status: "Completed",
    report:
      report.trim() ||
      "No duplicate code detected.",
  };
}

/**
 * Find files larger than 300 lines.
 *
 * @param {string} repoPath
 * @returns {Array}
 */
function findLargeFiles(repoPath) {
  console.log("📏 Checking files larger than 300 lines...");

  const ignoredDirectories = new Set([
    ".git",
    "node_modules",
    "dist",
    "build",
    "coverage",
    ".next",
    ".vite",
  ]);

  const results = [];

  function walk(currentPath) {
    let entries = [];

    try {
      entries = fs.readdirSync(currentPath, {
        withFileTypes: true,
      });
    } catch {
      return;
    }

    for (const entry of entries) {
      if (ignoredDirectories.has(entry.name)) {
        continue;
      }

      const fullPath = path.join(
        currentPath,
        entry.name
      );

      if (entry.isDirectory()) {
        walk(fullPath);
        continue;
      }

      if (!entry.isFile()) {
        continue;
      }

      if (
        !/\.(js|jsx|ts|tsx|mjs|cjs)$/.test(
          entry.name
        )
      ) {
        continue;
      }

      try {
        const content = fs.readFileSync(
          fullPath,
          "utf8"
        );

        const lineCount =
          content.split(/\r?\n/).length;

        if (lineCount > 300) {
          results.push({
            file: path.relative(
              repoPath,
              fullPath
            ),
            lines: lineCount,
          });
        }
      } catch {
        // Ignore files that cannot be read.
      }
    }
  }

  walk(repoPath);

  return results.sort(
    (a, b) => b.lines - a.lines
  );
}

/**
 * Check for hardcoded SQL in changed source files.
 *
 * Critical:
 * SELECT
 * INSERT
 * UPDATE
 * DELETE
 * JOIN
 * WHERE
 * GROUP BY
 * ORDER BY
 * sequelize.query()
 * raw SQL
 * literal SQL
 *
 * @param {string} repoPath
 * @param {string[]} changedFiles
 * @returns {Array}
 */
function checkHardcodedSql(
  repoPath,
  changedFiles
) {
  console.log("🚨 Checking for hardcoded SQL...");

  const sqlPatterns = [
    {
      name: "SELECT statement",
      pattern: /\bSELECT\s+[\s\S]*?\bFROM\b/gi,
    },
    {
      name: "INSERT statement",
      pattern: /\bINSERT\s+INTO\b/gi,
    },
    {
      name: "UPDATE statement",
      pattern: /\bUPDATE\s+[\w"`.[\]]+\s+SET\b/gi,
    },
    {
      name: "DELETE statement",
      pattern: /\bDELETE\s+FROM\b/gi,
    },
    {
      name: "JOIN clause",
      pattern: /\b(?:INNER|LEFT|RIGHT|FULL|CROSS)?\s*JOIN\b/gi,
    },
    {
      name: "WHERE clause",
      pattern: /\bWHERE\s+[\w"`.[\]]+\s*(?:=|>|<|LIKE|IN)\b/gi,
    },
    {
      name: "GROUP BY clause",
      pattern: /\bGROUP\s+BY\b/gi,
    },
    {
      name: "ORDER BY clause",
      pattern: /\bORDER\s+BY\b/gi,
    },
    {
      name: "sequelize.query()",
      pattern: /\bsequelize\.query\s*\(/gi,
    },
    {
      name: "Sequelize literal()",
      pattern: /\b(?:sequelize|Sequelize)\.literal\s*\(/gi,
    },
  ];

  const results = [];

  const sourceFiles = changedFiles.filter(
    (file) =>
      /\.(js|jsx|ts|tsx|mjs|cjs)$/.test(file)
  );

  for (const file of sourceFiles) {
    const fullPath = path.join(
      repoPath,
      file
    );

    if (!fs.existsSync(fullPath)) {
      continue;
    }

    let content = "";

    try {
      content = fs.readFileSync(
        fullPath,
        "utf8"
      );
    } catch {
      continue;
    }

    const lines = content.split(/\r?\n/);

    lines.forEach((line, index) => {
      for (const sqlPattern of sqlPatterns) {
        if (sqlPattern.pattern.test(line)) {
          results.push({
            file,
            line: index + 1,
            type: sqlPattern.name,
            code: line.trim(),
            severity: "CRITICAL",
          });

          // Reset regex state for global regex patterns.
          sqlPattern.pattern.lastIndex = 0;
        }
      }
    });
  }

  return results;
}

/**
 * Check for console logging in changed files.
 *
 * @param {string} repoPath
 * @param {string[]} changedFiles
 * @returns {Array}
 */
function checkConsoleLogs(
  repoPath,
  changedFiles
) {
  console.log("🔇 Checking console logging...");

  const results = [];

  const sourceFiles = changedFiles.filter(
    (file) =>
      /\.(js|jsx|ts|tsx|mjs|cjs)$/.test(file)
  );

  for (const file of sourceFiles) {
    const fullPath = path.join(
      repoPath,
      file
    );

    if (!fs.existsSync(fullPath)) {
      continue;
    }

    let content = "";

    try {
      content = fs.readFileSync(
        fullPath,
        "utf8"
      );
    } catch {
      continue;
    }

    const lines = content.split(/\r?\n/);

    lines.forEach((line, index) => {
      if (
        /\bconsole\.(log|error|warn|info|debug|trace)\s*\(/.test(
          line
        )
      ) {
        results.push({
          file,
          line: index + 1,
          code: line.trim(),
          recommendation:
            "Use the approved logging library " +
            "(Winston/Pino) instead of console logging.",
        });
      }
    });
  }

  return results;
}

/**
 * Check for eslint-disable comments.
 *
 * @param {string} repoPath
 * @param {string[]} changedFiles
 * @returns {Array}
 */
function checkDisabledEslint(
  repoPath,
  changedFiles
) {
  console.log("🚫 Checking eslint-disable...");

  const results = [];

  const sourceFiles = changedFiles.filter(
    (file) =>
      /\.(js|jsx|ts|tsx|mjs|cjs)$/.test(file)
  );

  for (const file of sourceFiles) {
    const fullPath = path.join(
      repoPath,
      file
    );

    if (!fs.existsSync(fullPath)) {
      continue;
    }

    let content = "";

    try {
      content = fs.readFileSync(
        fullPath,
        "utf8"
      );
    } catch {
      continue;
    }

    const lines = content.split(/\r?\n/);

    lines.forEach((line, index) => {
      if (
        /eslint-disable(?:-next-line|-line)?/.test(
          line
        )
      ) {
        results.push({
          file,
          line: index + 1,
          code: line.trim(),
          severity: "HIGH",
          recommendation:
            "Remove eslint-disable and fix the underlying lint issue.",
        });
      }
    });
  }

  return results;
}

/**
 * Get the final review context.
 *
 * @param {string} repoPath
 * @returns {object}
 */
export function getReviewContext(repoPath) {
  console.log("");
  console.log("📦 Building PR Review Context...");
  console.log("");

  const repositoryInfo =
    getRepositoryInfo(repoPath);

  const pullRequestInfo =
    getPullRequestInfo(repoPath);

  const {
    repository,
    owner,
    repo,
  } = repositoryInfo;

  const {
    prNumber,
    author,
    branch,
    baseBranch,
  } = pullRequestInfo;

  console.log(`Repository: ${repository}`);
  console.log(`PR: ${prNumber || "N/A"}`);
  console.log(`Author: ${author || "N/A"}`);
  console.log(`Branch: ${branch || "N/A"}`);
  console.log(`Base Branch: ${baseBranch}`);

  const changedFiles = getChangedFiles(
    repoPath,
    baseBranch
  );

  const gitDiff = getGitDiff(
    repoPath,
    baseBranch
  );

  const commitMessages =
    getCommitMessages(
      repoPath,
      baseBranch
    );

  const stats = getGitStats(
    repoPath,
    baseBranch
  );

  const npmAudit =
    runNpmAudit(repoPath);

  const eslint =
    runEslint(
      repoPath,
      changedFiles
    );

  const duplicateCode =
    checkDuplicateCode(
      repoPath
    );

  const largeFiles =
    findLargeFiles(repoPath);

  const hardcodedSql =
    checkHardcodedSql(
      repoPath,
      changedFiles
    );

  const consoleLogs =
    checkConsoleLogs(
      repoPath,
      changedFiles
    );

  const disabledEslint =
    checkDisabledEslint(
      repoPath,
      changedFiles
    );

  console.log("");
  console.log("✅ Review context collected.");
  console.log("");

  return {
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

    insertions: stats.insertions,
    deletions: stats.deletions,
    totalFiles:
      stats.totalFiles ||
      changedFiles.length,

    npmAudit,
    eslint,

    duplicateCode,

    largeFiles,

    hardcodedSql,

    consoleLogs,

    disabledEslint,
  };
}

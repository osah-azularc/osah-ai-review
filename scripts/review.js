import fs from "fs";
import path from "path";

import { getChangedFiles, getGitDiff } from "./collectDiff.js";
import { postReview } from "./postComment.js";
import { runClaude } from "./claude.js";

/**
 * Reads a prompt file.
 */
function loadPrompt(fileName) {
  const filePath = path.join(
    process.cwd(),
    ".github",
    "prompts",
    fileName
  );

  if (!fs.existsSync(filePath)) {
    throw new Error(`Prompt file not found: ${fileName}`);
  }

  return fs.readFileSync(filePath, "utf8");
}

async function main() {
  console.log("======================================");
  console.log("🚀 OSAH AI Review Started");
  console.log("======================================");

  //---------------------------------------------------
  // Load Prompt Files
  //---------------------------------------------------

  console.log("\n📄 Loading Prompt Files...");

  const reviewPrompt = loadPrompt("review.md");
  const checklist = loadPrompt("checklist.md");
  const security = loadPrompt("security.md");
  const output = loadPrompt("output.md");

  console.log("✅ Prompt files loaded.");

  //---------------------------------------------------
  // Collect Git Information
  //---------------------------------------------------

  const changedFiles = getChangedFiles();

  const gitDiff = getGitDiff();

  console.log(`✅ Changed Files : ${changedFiles.length}`);

  //---------------------------------------------------
  // Build Final Prompt
  //---------------------------------------------------

  const finalPrompt = `
# REVIEW PROMPT

${reviewPrompt}

-------------------------------------------------------

# CHECKLIST

${checklist}

-------------------------------------------------------

# SECURITY

${security}

-------------------------------------------------------

# EXPECTED OUTPUT

${output}

-------------------------------------------------------

# CHANGED FILES

${changedFiles.join("\n")}

-------------------------------------------------------

# GIT DIFF

${gitDiff}
`;

  //---------------------------------------------------
  // Save Prompt (Debugging)
  //---------------------------------------------------

  fs.writeFileSync("claude-input.md", finalPrompt);

  console.log("✅ claude-input.md generated.");

  //---------------------------------------------------
  // TODO : Claude API Call
  //---------------------------------------------------

  /*
      Later we'll replace this with

      const markdownReview =
            await reviewWithClaude(finalPrompt);
  */

 const markdownReview = await runClaude(finalPrompt);

  await postReview(markdownReview);

  //---------------------------------------------------
  // Post Review
  //---------------------------------------------------

  /*
      In GitHub Actions these values
      come from GitHub Context.
  */

const event = JSON.parse(
    fs.readFileSync(process.env.GITHUB_EVENT_PATH, "utf8")
);

const owner = event.repository.owner.login;

const repo = event.repository.name;

const pullNumber = event.pull_request.number;
  const githubToken = process.env.GITHUB_TOKEN;
//Sconst anthropicKey = process.env.ANTHROPIC_API_KEY;
  if (
    owner &&
    repo &&
    pullNumber &&
    githubToken
  ) {
    await postReview({
      githubToken,
      owner,
      repo,
      pullNumber,
      body: markdownReview,
    });
  } else {
    console.log(
      "\n⚠ GitHub environment not found."
    );
    console.log(
      "Skipping PR Comment."
    );
  }

  console.log("\n======================================");
  console.log("🎉 Review Complete");
  console.log("======================================");
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});


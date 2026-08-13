import fs from "fs";
import path from "path";

import { getReviewContext } from "./collectDiff.js";
import { postReview } from "./postComment.js";
import { reviewWithClaude } from "./claude.js";

const TARGET_REPO = process.env.TARGET_REPO || "../target";

/**
 * Reads a prompt file.
 */
function loadPrompt(fileName) {
    const filePath = path.join(
        process.cwd(),
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
// Git Information
//---------------------------------------------------

console.log("\n📂 Collecting Git Information...");

const reviewContext = getReviewContext(TARGET_REPO);

console.log(`✅ Changed Files : ${reviewContext.changedFiles.length}`);
console.log(`✅ Branch : ${reviewContext.branch}`);
console.log(`✅ Author : ${reviewContext.author}`);
console.log(`✅ Commits : ${reviewContext.commitMessages.length}`);
   
    //---------------------------------------------------
    // Build Prompt
    //---------------------------------------------------

    const finalPrompt = `

# REVIEW PROMPT

${reviewPrompt}

----------------------------------------------------

# CHECKLIST

${checklist}

----------------------------------------------------

# SECURITY

${security}

----------------------------------------------------

# EXPECTED OUTPUT

${output}

----------------------------------------------------
# REPOSITORY INFORMATION

Repository: ${reviewContext.repository}

Author: ${reviewContext.author}

Branch: ${reviewContext.branch}

Base Branch: ${reviewContext.baseBranch}

----------------------------------------------------

# COMMIT MESSAGES

${reviewContext.commitMessages.join("\n")}

----------------------------------------------------

# CHANGED FILES

${reviewContext.changedFiles.join("\n")}

----------------------------------------------------

# SUMMARY

Files Changed : ${reviewContext.totalFiles}

Lines Added : ${reviewContext.insertions}

Lines Deleted : ${reviewContext.deletions}

----------------------------------------------------

# GIT DIFF

${reviewContext.gitDiff}

`;

    //---------------------------------------------------
    // Save Prompt
    //---------------------------------------------------

    fs.writeFileSync(
        path.join(process.cwd(), "claude-input.md"),
        finalPrompt
    );

    console.log("✅ claude-input.md generated.");

    //---------------------------------------------------
    // Claude
    //---------------------------------------------------

    console.log("\n🤖 Sending Prompt to Claude...");

    const markdownReview = await reviewWithClaude(finalPrompt);

    console.log("✅ Claude Review Complete.");

    fs.writeFileSync(
        path.join(process.cwd(), "review-output.md"),
        markdownReview
    );

    //---------------------------------------------------
    // GitHub Context
    //---------------------------------------------------

    const githubToken = process.env.GITHUB_TOKEN;

    if (!process.env.GITHUB_EVENT_PATH) {
        console.log("Running locally.");
        console.log("Review saved to review-output.md");
        return;
    }

    const event = JSON.parse(
        fs.readFileSync(process.env.GITHUB_EVENT_PATH, "utf8")
    );

    const owner = event.repository.owner.login;
    const repo = event.repository.name;
    const pullNumber = event.pull_request.number;

    //---------------------------------------------------
    // Post Comment
    //---------------------------------------------------

    console.log("💬 Posting review to GitHub...");

    await postReview({
        githubToken,
        owner,
        repo,
        pullNumber,
        body: markdownReview,
    });

    console.log("✅ Review posted.");

    console.log("\n======================================");
    console.log("🎉 Review Complete");
    console.log("======================================");

}

main().catch((err) => {
    console.error(err);
    process.exit(1);
});

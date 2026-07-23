import { Octokit } from "@octokit/rest";

/**
 * Posts a review comment to GitHub PR.
 */
export async function postReview({
  githubToken,
  owner,
  repo,
  pullNumber,
  body,
}) {

  const octokit = new Octokit({
    auth: githubToken,
  });

  await octokit.issues.createComment({

    owner,

    repo,

    issue_number: pullNumber,

    body,

  });

  console.log("✅ Review posted successfully.");
}
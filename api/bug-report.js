// POST /api/bug-report
// Receives { title, description, compressedState (base64 gzipped JSON) }
// Decompresses, creates a GitHub Issue with the save JSON embedded, returns { issueUrl, saveJson }

const { promisify } = require("util");
const { gunzip }    = require("zlib");
const gunzipAsync   = promisify(gunzip);

const { cors, err, send } = require("./_helpers");

const GITHUB_API  = "https://api.github.com";
const REPO        = "digable/ic_zombies";
const MAX_BODY_BYTES = 60 * 1024; // 60 KB compressed payload limit

module.exports = async function handler(req, res) {
  cors(res);
  if (req.method === "OPTIONS") return res.status(204).end();
  if (req.method !== "POST") return err(res, 405, "Method not allowed");

  const token = process.env.GITHUB_TOKEN;
  if (!token) return err(res, 500, "GITHUB_TOKEN not configured");

  const { title, description, compressedState, environment } = req.body || {};
  if (!title?.trim()) return err(res, 400, "title is required");
  if (!compressedState) return err(res, 400, "compressedState is required");

  // Size guard before decompressing
  if (Buffer.byteLength(compressedState, "base64") > MAX_BODY_BYTES) {
    return err(res, 413, "Payload too large");
  }

  let saveJson;
  try {
    const compressed = Buffer.from(compressedState, "base64");
    const decompressed = await gunzipAsync(compressed);
    saveJson = decompressed.toString("utf8");
    JSON.parse(saveJson); // validate it's real JSON
  } catch (e) {
    return err(res, 400, "Invalid compressed state");
  }

  // Pull last 20 log lines out of the save for the issue body
  let logLines = [];
  try {
    const parsed = JSON.parse(saveJson);
    logLines = (parsed.logs || []).slice(-20).map((entry) =>
      typeof entry === "string" ? entry : (entry?.text ?? String(entry))
    );
  } catch { /* ignore */ }

  const descriptionSection = description?.trim()
    ? `## Description\n${description.trim()}\n\n`
    : "";

  const logSection = logLines.length > 0
    ? `## Game Log (last 20 entries)\n\`\`\`\n${logLines.join("\n")}\n\`\`\`\n\n`
    : "";

  const envSection = environment
    ? `## Environment\n${environment}\n\n`
    : "";

  const issueBody = `${descriptionSection}${logSection}${envSection}## Save File\n<details>\n<summary>Click to expand — copy all text and save as a .json file, then import via Save/Load → Import</summary>\n\n\`\`\`json\n${saveJson}\n\`\`\`\n\n</details>`;

  // Create the GitHub issue
  const ghRes = await fetch(`${GITHUB_API}/repos/${REPO}/issues`, {
    method: "POST",
    headers: {
      "Authorization": `Bearer ${token}`,
      "Accept": "application/vnd.github+json",
      "Content-Type": "application/json",
      "X-GitHub-Api-Version": "2022-11-28"
    },
    body: JSON.stringify({
      title: title.trim(),
      body: issueBody,
      labels: ["bug"]
    })
  });

  if (!ghRes.ok) {
    const ghErr = await ghRes.json().catch(() => ({}));
    console.error("GitHub issue creation failed:", ghErr);
    return err(res, 502, `GitHub API error: ${ghErr.message || ghRes.status}`);
  }

  const issue = await ghRes.json();
  return send(res, 200, { issueUrl: issue.html_url, saveJson });
};

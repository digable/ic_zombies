// POST /api/bug-report
// Receives { title, description, compressedState (base64 gzipped JSON) }
// Decompresses, creates a GitHub Issue with the save JSON embedded, returns { issueUrl, saveJson }

const { promisify } = require("util");
const { gunzip }    = require("zlib");
const gunzipAsync   = promisify(gunzip);

const { checkRateLimit } = require("./_rateLimit");
const { cors, getIp, err, send } = require("./_helpers");

const GITHUB_API  = "https://api.github.com";
const REPO        = "digable/ic_zombies";
const MAX_BODY_BYTES = 60 * 1024;          // 60 KB compressed payload limit
// Largest real save (every collection, 6 players) is ~126 KB of JSON; 1 MB leaves headroom
// while stopping a gzip bomb from expanding to tens of MB in memory.
const MAX_DECOMPRESSED_BYTES = 1024 * 1024;
const GITHUB_MAX_BODY_CHARS  = 65536;      // GitHub rejects issue bodies longer than this
const BUG_REPORTS_PER_HOUR   = 5;          // per IP — each report creates a public issue
const MAX_TITLE_CHARS        = 200;
const MAX_DESCRIPTION_CHARS  = 5000;
const MAX_ENVIRONMENT_CHARS  = 500;

module.exports = async function handler(req, res) {
  cors(res);
  if (req.method === "OPTIONS") return res.status(204).end();
  if (req.method !== "POST") return err(res, 405, "Method not allowed");

  const token = process.env.GITHUB_TOKEN;
  if (!token) return err(res, 500, "GITHUB_TOKEN not configured");

  try {
    await checkRateLimit(getIp(req), "bug_report", BUG_REPORTS_PER_HOUR, 3600);
  } catch (e) {
    if (e.status === 429) return err(res, 429, "Too many bug reports — try again later", { retryAfter: e.retryAfter });
    throw e;
  }

  const { title, description, compressedState, environment } = req.body || {};
  if (typeof title !== "string" || !title.trim()) return err(res, 400, "title is required");
  if (typeof compressedState !== "string" || !compressedState) return err(res, 400, "compressedState is required");

  // Size guard before decompressing
  if (Buffer.byteLength(compressedState, "base64") > MAX_BODY_BYTES) {
    return err(res, 413, "Payload too large");
  }

  let saveJson;
  let parsed;
  try {
    const compressed = Buffer.from(compressedState, "base64");
    const decompressed = await gunzipAsync(compressed, { maxOutputLength: MAX_DECOMPRESSED_BYTES });
    saveJson = decompressed.toString("utf8");
    parsed = JSON.parse(saveJson); // validate it's real JSON
  } catch (e) {
    if (e.code === "ERR_BUFFER_TOO_LARGE") return err(res, 413, "Save file too large");
    return err(res, 400, "Invalid compressed state");
  }

  // Pull last 20 log lines out of the save for the issue body
  const logLines = (Array.isArray(parsed?.logs) ? parsed.logs : []).slice(-20).map((entry) =>
    typeof entry === "string" ? entry : (entry?.text ?? String(entry))
  );

  const descText = typeof description === "string" ? description.trim().slice(0, MAX_DESCRIPTION_CHARS) : "";
  const envText  = typeof environment === "string" ? environment.slice(0, MAX_ENVIRONMENT_CHARS) : "";

  const descriptionSection = descText ? `## Description\n${descText}\n\n` : "";
  const logSection = logLines.length > 0
    ? `## Game Log (last 20 entries)\n\`\`\`\n${logLines.join("\n")}\n\`\`\`\n\n`
    : "";
  const envSection = envText ? `## Environment\n${envText}\n\n` : "";
  const header = `${descriptionSection}${logSection}${envSection}`;

  const jsonSaveSection =
    `## Save File\n<details>\n<summary>Click to expand — copy all text and save as a .json file, then import via Save/Load → Import</summary>\n\n` +
    `\`\`\`json\n${saveJson}\n\`\`\`\n\n</details>`;

  // Big games (many collections) produce saves larger than GitHub allows in an issue body.
  // Fall back to the compressed form, which is ~10x smaller, with instructions to restore it.
  const compressedSaveSection =
    `## Save File (compressed)\nThis save was too large to embed as JSON. ` +
    `Copy the text below into \`save.b64\`, then restore it with:\n\n` +
    `\`\`\`\nnode -e "process.stdout.write(require('zlib').gunzipSync(Buffer.from(require('fs').readFileSync('save.b64','utf8'),'base64')))" > save.json\n\`\`\`\n\n` +
    `<details>\n<summary>Click to expand</summary>\n\n\`\`\`\n${compressedState}\n\`\`\`\n\n</details>`;

  let issueBody = header + jsonSaveSection;
  if (issueBody.length > GITHUB_MAX_BODY_CHARS) issueBody = header + compressedSaveSection;
  if (issueBody.length > GITHUB_MAX_BODY_CHARS) {
    issueBody = header + "## Save File\nToo large to attach, even compressed. Ask the reporter for the downloaded save.";
  }

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
      title: title.trim().slice(0, MAX_TITLE_CHARS),
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

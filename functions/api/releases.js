const GITHUB_REPO = "dydaozhu/Flavor-HuHoBot-Discord-Bridge";
const MODRINTH_PROJECT = "flavor-huhobot-discord-bridge";
const SITE = "https://huhobot.mcfwq.top";
const USER_AGENT = "FlavorHuHoBotSite/1.0 (+https://huhobot.mcfwq.top)";
const CACHE_SECONDS = 600;

export async function onRequestGet(context) {
  const cache = caches.default;
  const cacheKey = new Request(new URL("/api/releases", context.request.url).toString(), {
    method: "GET",
  });

  try {
    const cached = await cache.match(cacheKey);
    if (cached) return cached;
  } catch {
    // Cache API unavailable; continue without cache.
  }

  const [github, modrinth] = await Promise.all([
    loadGitHub(context.env),
    loadModrinth(),
  ]);

  const versions = mergeVersions(github.releases, modrinth.releases);
  const latest = versions[0] || null;
  const githubLatest = github.releases[0] || null;
  const modrinthLatest = modrinth.releases[0] || null;

  const payload = {
    latest,
    githubLatest,
    modrinthLatest,
    versions,
    status: {
      github: github.ok ? "ok" : "error",
      modrinth: modrinth.ok ? "ok" : "unavailable",
      githubMessage: github.error || "",
      modrinthMessage: modrinth.error || "",
    },
    fetchedAt: new Date().toISOString(),
    site: SITE,
  };

  const response = new Response(JSON.stringify(payload), {
    status: 200,
    headers: {
      "content-type": "application/json; charset=utf-8",
      "cache-control": `public, max-age=${CACHE_SECONDS}, s-maxage=${CACHE_SECONDS}`,
      "access-control-allow-origin": "*",
    },
  });

  try {
    context.waitUntil(cache.put(cacheKey, response.clone()));
  } catch {
    // Non-fatal.
  }
  return response;
}

async function loadGitHub(env) {
  const headers = {
    "Accept": "application/vnd.github+json",
    "User-Agent": USER_AGENT,
    "X-GitHub-Api-Version": "2022-11-28",
  };
  if (env && env.GITHUB_TOKEN) {
    headers.Authorization = `Bearer ${env.GITHUB_TOKEN}`;
  }

  try {
    const releases = await fetchJson(
      `https://api.github.com/repos/${GITHUB_REPO}/releases?per_page=30`,
      headers,
    );
    if (!Array.isArray(releases)) throw new Error("GitHub releases 格式不正确");

    const result = [];
    for (const release of releases) {
      if (release.draft || release.prerelease) continue;
      const assets = Array.isArray(release.assets) ? release.assets : [];
      const asset = assets.find((item) => {
        const name = String(item.name || "").toLowerCase();
        return name.endsWith(".jar") && !name.includes("sources") && !name.includes("javadoc");
      });
      if (!asset) continue;
      const version = normalizeVersion(release.name || release.tag_name || "");
      if (!version) continue;
      result.push({
        version,
        source: "github",
        publishedAt: release.published_at || release.created_at || "",
        page: release.html_url,
        download: asset.browser_download_url,
        filename: asset.name,
        size: asset.size || 0,
        sha256: extractSha256(asset.digest),
      });
    }
    return { ok: true, releases: sortVersions(result), error: "" };
  } catch (error) {
    return { ok: false, releases: [], error: String(error.message || error) };
  }
}

async function loadModrinth() {
  try {
    const versions = await fetchJson(
      `https://api.modrinth.com/v2/project/${MODRINTH_PROJECT}/version`,
      {
        "Accept": "application/json",
        "User-Agent": USER_AGENT,
      },
    );
    if (!Array.isArray(versions)) throw new Error("Modrinth versions 格式不正确");

    const result = [];
    for (const item of versions) {
      if (item.version_type && item.version_type !== "release") continue;
      const files = Array.isArray(item.files) ? item.files : [];
      const file = files.find((entry) => entry.primary && /\.jar$/i.test(entry.filename || ""))
        || files.find((entry) => /\.jar$/i.test(entry.filename || ""));
      if (!file) continue;
      const version = normalizeVersion(item.version_number || item.name || "");
      if (!version) continue;
      result.push({
        version,
        source: "modrinth",
        publishedAt: item.date_published || "",
        page: `https://modrinth.com/plugin/${MODRINTH_PROJECT}/version/${encodeURIComponent(item.version_number || version)}`,
        download: file.url,
        filename: file.filename,
        size: file.size || 0,
        sha256: file.hashes && file.hashes.sha256 ? file.hashes.sha256 : "",
      });
    }
    return { ok: true, releases: sortVersions(result), error: "" };
  } catch (error) {
    return {
      ok: false,
      releases: [],
      error: "Modrinth 暂未公开版本（项目可能仍在审核中）",
    };
  }
}

function mergeVersions(githubReleases, modrinthReleases) {
  const map = new Map();
  for (const item of githubReleases) {
    const current = map.get(item.version) || { version: item.version };
    current.github = item;
    map.set(item.version, current);
  }
  for (const item of modrinthReleases) {
    const current = map.get(item.version) || { version: item.version };
    current.modrinth = item;
    map.set(item.version, current);
  }
  return Array.from(map.values()).sort((a, b) => compareVersions(b.version, a.version));
}

function normalizeVersion(value) {
  return String(value || "")
    .trim()
    .replace(/^v/i, "")
    .split(/\s+/)[0]
    .replace(/[^0-9A-Za-z.+_-]/g, "");
}

function extractSha256(digest) {
  if (!digest) return "";
  const text = String(digest);
  return text.startsWith("sha256:") ? text.slice(7) : text;
}

function sortVersions(items) {
  return items.sort((a, b) => compareVersions(b.version, a.version));
}

function compareVersions(a, b) {
  const parse = (value) => {
    const [core, pre] = String(value).split("-", 2);
    const nums = core.split(".").map((part) => {
      const match = part.match(/^\d+/);
      return match ? Number(match[0]) : 0;
    });
    return { nums, pre: pre || "" };
  };
  const left = parse(a);
  const right = parse(b);
  const length = Math.max(left.nums.length, right.nums.length);
  for (let i = 0; i < length; i++) {
    const x = left.nums[i] || 0;
    const y = right.nums[i] || 0;
    if (x !== y) return x - y;
  }
  if (left.pre === right.pre) return 0;
  if (!left.pre) return 1;
  if (!right.pre) return -1;
  return left.pre.localeCompare(right.pre);
}

async function fetchJson(url, headers) {
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), 8000);
  try {
    const response = await fetch(url, {
      headers,
      signal: controller.signal,
      cf: { cacheTtl: CACHE_SECONDS, cacheEverything: true },
    });
    if (!response.ok) {
      throw new Error(`HTTP ${response.status}`);
    }
    return await response.json();
  } finally {
    clearTimeout(timeout);
  }
}

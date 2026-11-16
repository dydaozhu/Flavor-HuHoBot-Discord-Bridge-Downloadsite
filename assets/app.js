const API_URL = "/api/releases";
const REPO_URL = "https://github.com/dydaozhu/Flavor-HuHoBot-Discord-Bridge";
const MODRINTH_URL = "https://modrinth.com/plugin/flavor-huhobot-discord-bridge";

async function fetchReleases() {
  const response = await fetch(API_URL, { headers: { Accept: "application/json" } });
  if (!response.ok) throw new Error(`HTTP ${response.status}`);
  return await response.json();
}

function safeUrl(value, hosts) {
  try {
    const url = new URL(value);
    if (url.protocol !== "https:") return "";
    return hosts.some((host) => url.hostname === host || url.hostname.endsWith(`.${host}`)) ? url.href : "";
  } catch {
    return "";
  }
}

function downloadUrl(platform, item) {
  if (!item) return "";
  const hosts = platform === "github"
    ? ["github.com"]
    : ["cdn.modrinth.com", "modrinth.com"];
  return safeUrl(item.download || "", hosts);
}

function pageUrl(platform, item) {
  if (!item) return "";
  const hosts = platform === "github" ? ["github.com"] : ["modrinth.com"];
  return safeUrl(item.page || "", hosts);
}

function formatDate(value) {
  if (!value) return "未知时间";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "未知时间";
  return new Intl.DateTimeFormat("zh-CN", {
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).format(date);
}

function formatSize(bytes) {
  if (!bytes || bytes < 0) return "";
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(0)} KB`;
  return `${(bytes / 1024 / 1024).toFixed(1)} MB`;
}

function text(tag, className, value) {
  const node = document.createElement(tag);
  if (className) node.className = className;
  node.textContent = value;
  return node;
}

function button(label, href, className) {
  if (!href) return null;
  const link = document.createElement("a");
  link.className = `button small ${className || "ghost"}`;
  link.href = href;
  link.target = "_blank";
  link.rel = "noopener noreferrer";
  link.textContent = label;
  return link;
}

function platformButtons(item, compact) {
  const wrap = document.createElement("div");
  wrap.className = "download-grid";
  const githubHref = downloadUrl("github", item && item.github);
  const modrinthHref = downloadUrl("modrinth", item && item.modrinth);
  const githubButton = button("GitHub 下载", githubHref, "ghost");
  const modrinthButton = button("Modrinth 下载", modrinthHref, "green");
  if (githubButton) wrap.appendChild(githubButton);
  if (modrinthButton) wrap.appendChild(modrinthButton);
  if (!githubButton && !modrinthButton) {
    const fallback = button("查看仓库", REPO_URL, "ghost");
    if (fallback) wrap.appendChild(fallback);
  }
  return wrap;
}

async function initHome() {
  const versionEl = document.getElementById("home-latest-version");
  const bigEl = document.getElementById("home-latest-version-big");
  const metaEl = document.getElementById("home-latest-meta");
  const noteEl = document.getElementById("home-latest-note");
  const buttonsEl = document.getElementById("home-latest-buttons");
  const sourceEl = document.getElementById("home-latest-source");
  if (!versionEl || !bigEl || !metaEl || !buttonsEl) return;

  try {
    const data = await fetchReleases();
    const latest = data.latest || data.githubLatest || data.modrinthLatest;
    if (!latest) throw new Error("没有可用版本");

    versionEl.textContent = `v${latest.version}`;
    bigEl.textContent = latest.version;
    metaEl.textContent = [
      latest.github ? "GitHub" : "",
      latest.modrinth ? "Modrinth" : "",
    ].filter(Boolean).join(" + ") + ` · ${formatDate(latest.publishedAt)}`;

    if (sourceEl) {
      sourceEl.textContent = [
        latest.github ? "GitHub" : "",
        latest.modrinth ? "Modrinth" : "",
      ].filter(Boolean).join(" + ");
    }

    buttonsEl.replaceChildren();
    const buttons = platformButtons(latest, true);
    while (buttons.firstChild) buttonsEl.appendChild(buttons.firstChild);

    const modrinth = data.modrinthLatest;
    if (noteEl && modrinth && modrinth.version !== latest.version) {
      noteEl.textContent = `Modrinth 当前公开版本为 ${modrinth.version}，与 GitHub 最新版本不同。`;
    } else if (noteEl && data.status && data.status.modrinth !== "ok") {
      noteEl.textContent = "Modrinth 暂未公开版本，可能仍在审核中。";
    }
  } catch (error) {
    versionEl.textContent = "无法获取版本";
    bigEl.textContent = "—";
    metaEl.textContent = "版本接口暂时不可用，请直接前往 GitHub 或 Modrinth 下载。";
    if (sourceEl) sourceEl.textContent = "API unavailable";
    buttonsEl.replaceChildren();
    const github = button("GitHub Releases", `${REPO_URL}/releases`, "ghost");
    const modrinth = button("Modrinth", MODRINTH_URL, "green");
    if (github) buttonsEl.appendChild(github);
    if (modrinth) buttonsEl.appendChild(modrinth);
  }
}

document.addEventListener("DOMContentLoaded", initHome);

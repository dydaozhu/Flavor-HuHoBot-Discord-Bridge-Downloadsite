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

function makeButton(label, href, className) {
  if (!href) return null;
  const link = document.createElement("a");
  link.className = `button small ${className || "ghost"}`;
  link.href = href;
  link.target = "_blank";
  link.rel = "noopener noreferrer";
  link.textContent = label;
  return link;
}

function renderPlatformButtons(container, version) {
  container.replaceChildren();
  const github = makeButton("GitHub 下载", downloadUrl("github", version.github), "ghost");
  const modrinth = makeButton("Modrinth 下载", downloadUrl("modrinth", version.modrinth), "green");
  if (github) container.appendChild(github);
  if (modrinth) container.appendChild(modrinth);
  if (!github && !modrinth) {
    const fallback = makeButton("查看 GitHub Releases", `${REPO_URL}/releases`, "ghost");
    if (fallback) container.appendChild(fallback);
  }
}

function addNotice(container, message, className) {
  if (!message) return;
  const node = document.createElement("div");
  node.className = `notice ${className || ""}`.trim();
  node.textContent = message;
  container.appendChild(node);
}

function renderStatus(data) {
  const container = document.getElementById("download-status");
  if (!container) return;
  container.replaceChildren();

  if (data.status && data.status.github !== "ok") {
    addNotice(container, "GitHub Releases 暂时无法读取，页面可能缺少最新 GitHub 版本。", "error");
  }
  if (data.status && data.status.modrinth !== "ok") {
    addNotice(
      container,
      "Modrinth 暂时没有公开版本。如果项目仍在审核中，这是正常现象；审核通过后会自动出现在版本列表中。",
      "info",
    );
  }
}

function renderLatest(data) {
  const versionEl = document.getElementById("latest-version");
  const metaEl = document.getElementById("latest-meta");
  const noteEl = document.getElementById("latest-note");
  const buttonsEl = document.getElementById("latest-buttons");
  if (!versionEl || !metaEl || !buttonsEl) return;

  const latest = data.latest || data.githubLatest || data.modrinthLatest;
  if (!latest) {
    versionEl.textContent = "暂无公开版本";
    metaEl.textContent = "请前往 GitHub Releases 或 Modrinth 查看。";
    renderPlatformButtons(buttonsEl, {});
    return;
  }

  versionEl.textContent = latest.version;
  metaEl.textContent = [
    latest.github ? "GitHub" : "",
    latest.modrinth ? "Modrinth" : "",
  ].filter(Boolean).join(" + ") + ` · 发布于 ${formatDate(latest.publishedAt)}`;

  renderPlatformButtons(buttonsEl, latest);

  if (!noteEl) return;
  noteEl.textContent = "";
  if (latest.github && !latest.modrinth) {
    const modrinth = data.modrinthLatest;
    noteEl.textContent = modrinth
      ? `该版本只有 GitHub 发布。Modrinth 当前可用版本：${modrinth.version}。`
      : "该版本只有 GitHub 发布，Modrinth 暂无公开版本。";
  } else if (!latest.github && latest.modrinth) {
    noteEl.textContent = "该版本只有 Modrinth 发布，GitHub 暂无对应版本。";
  }
}

function platformLinks(item) {
  const wrap = document.createElement("div");
  wrap.className = "release-source";
  const parts = [];
  if (item.github) {
    const link = document.createElement("a");
    link.href = pageUrl("github", item.github);
    link.target = "_blank";
    link.rel = "noopener noreferrer";
    link.textContent = "GitHub Release";
    parts.push(link);
  }
  if (item.modrinth) {
    const link = document.createElement("a");
    link.href = pageUrl("modrinth", item.modrinth);
    link.target = "_blank";
    link.rel = "noopener noreferrer";
    link.textContent = "Modrinth Version";
    parts.push(link);
  }
  parts.forEach((part, index) => {
    if (index > 0) wrap.appendChild(document.createTextNode(" · "));
    wrap.appendChild(part);
  });
  return wrap;
}

function renderVersions(data) {
  const list = document.getElementById("release-list");
  const count = document.getElementById("release-count");
  if (!list) return;

  const versions = Array.isArray(data.versions) ? data.versions : [];
  if (count) count.textContent = `${versions.length} 个版本`;
  list.replaceChildren();

  if (versions.length === 0) {
    const empty = document.createElement("div");
    empty.className = "panel loading";
    empty.textContent = "暂时没有可展示的版本。";
    list.appendChild(empty);
    return;
  }

  for (const item of versions) {
    const row = document.createElement("article");
    row.className = "release-row";

    const info = document.createElement("div");
    const version = document.createElement("div");
    version.className = "release-version";
    version.textContent = item.version;
    const date = document.createElement("div");
    date.className = "release-date";
    date.textContent = formatDate(item.publishedAt);
    info.append(version, date);

    const details = document.createElement("div");
    const source = platformLinks(item);
    details.appendChild(source);
    const size = formatSize(
      (item.github && item.github.size) || (item.modrinth && item.modrinth.size) || 0,
    );
    if (size) {
      const sizeNode = document.createElement("div");
      sizeNode.className = "release-source";
      sizeNode.textContent = size;
      details.appendChild(sizeNode);
    }

    const files = document.createElement("div");
    files.className = "release-files";
    const github = makeButton("GitHub 下载", downloadUrl("github", item.github), "ghost");
    const modrinth = makeButton("Modrinth 下载", downloadUrl("modrinth", item.modrinth), "green");
    if (github) files.appendChild(github);
    if (modrinth) files.appendChild(modrinth);
    if (!github && !modrinth) {
      const fallback = makeButton("查看 GitHub", `${REPO_URL}/releases`, "ghost");
      if (fallback) files.appendChild(fallback);
    }

    row.append(info, details, files);
    list.appendChild(row);
  }
}

function renderModrinthState(data) {
  const el = document.getElementById("modrinth-current");
  if (!el) return;
  if (data.modrinthLatest) {
    el.className = "notice info";
    el.textContent = `Modrinth 当前公开版本：${data.modrinthLatest.version}（${formatDate(data.modrinthLatest.publishedAt)}）`;
  } else {
    el.className = "notice info";
    el.textContent = "Modrinth 暂未公开版本，可能仍在审核中。审核通过后会自动显示。";
  }
}

async function initDownload() {
  try {
    const data = await fetchReleases();
    renderStatus(data);
    renderLatest(data);
    renderVersions(data);
    renderModrinthState(data);
  } catch (error) {
    const status = document.getElementById("download-status");
    if (status) {
      addNotice(status, "版本接口暂时不可用，请直接前往 GitHub 或 Modrinth。", "error");
    }
    const latest = document.getElementById("latest-version");
    const meta = document.getElementById("latest-meta");
    if (latest) latest.textContent = "无法获取版本";
    if (meta) meta.textContent = error.message || "API error";
    renderVersions({ versions: [] });
  }
}

document.addEventListener("DOMContentLoaded", initDownload);

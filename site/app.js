const CONFIG = window.PROJECT_CONFIG;
const API_BASE = location.hostname.endsWith("pages.dev") ? location.origin : "";

const state = {
  user: JSON.parse(localStorage.getItem(`${CONFIG.repo}:user`) || "null"),
  current: "dashboard",
  rows: [],
  editing: null,
};

const $ = (selector) => document.querySelector(selector);

init();

async function init() {
  document.title = CONFIG.title;
  renderPublic();
  renderLoginOptions();
  renderNav();
  bindEvents();
  await autoLoginFromQuery();
  if (state.user) await showApp();
}

function renderPublic() {
  $("#modulePills").innerHTML = CONFIG.modules.map((item) => `<span>${escapeHtml(item.name)}</span>`).join("");
}

function renderLoginOptions() {
  const role = $("#role");
  role.innerHTML = CONFIG.accounts.map((item) => `<option value="${item.role}">${escapeHtml(item.label)}</option>`).join("");
  $("#quickLogins").innerHTML = CONFIG.accounts.map((item) => `<button type="button" data-login="${encodeURIComponent(item.role)}">${escapeHtml(item.label)}</button>`).join("");
  fillAccount(CONFIG.accounts[0]);
}

function renderNav() {
  const nav = $("#moduleNav");
  nav.innerHTML = "";
  nav.appendChild(navButton("dashboard", "工作台", "总览"));
  CONFIG.modules.forEach((item) => nav.appendChild(navButton(item.key, item.name, "业务模块")));
}

function navButton(key, label, meta) {
  const button = document.createElement("button");
  button.type = "button";
  button.dataset.module = key;
  button.innerHTML = `<span>${escapeHtml(label)}</span><small>${escapeHtml(meta)}</small>`;
  button.addEventListener("click", () => switchModule(key));
  return button;
}

function bindEvents() {
  $("#role").addEventListener("change", () => {
    const account = CONFIG.accounts.find((item) => item.role === $("#role").value) || CONFIG.accounts[0];
    fillAccount(account);
  });

  $("#quickLogins").addEventListener("click", (event) => {
    const button = event.target.closest("[data-login]");
    if (!button) return;
    const account = CONFIG.accounts.find((item) => item.role === decodeURIComponent(button.dataset.login));
    fillAccount(account);
  });

  $("#loginForm").addEventListener("submit", async (event) => {
    event.preventDefault();
    $("#loginMessage").textContent = "";
    try {
      const payload = {
        role: $("#role").value,
        username: $("#username").value.trim(),
        password: $("#password").value.trim(),
      };
      const response = await api("login", payload);
      if (!response.status) {
        $("#loginMessage").textContent = response.message || "登录失败";
        return;
      }
      state.user = response.data;
      localStorage.setItem(`${CONFIG.repo}:user`, JSON.stringify(state.user));
      await showApp();
    } catch (error) {
      $("#loginMessage").textContent = error.message;
    }
  });

  $("#logoutButton").addEventListener("click", () => {
    localStorage.removeItem(`${CONFIG.repo}:user`);
    state.user = null;
    $("#appView").hidden = true;
    $("#publicView").hidden = false;
  });

  $("#refreshButton").addEventListener("click", () => loadCurrent());
  $("#addButton").addEventListener("click", () => openEditor());
  $("#searchInput").addEventListener("input", renderTable);
  $("#closeDialogButton").addEventListener("click", () => $("#editDialog").close());
  $("#cancelEditButton").addEventListener("click", () => $("#editDialog").close());
  $("#editForm").addEventListener("submit", async (event) => {
    event.preventDefault();
    await saveEditor();
  });
}

function fillAccount(account) {
  if (!account) return;
  $("#role").value = account.role;
  $("#username").value = account.username;
  $("#password").value = account.password;
}

async function autoLoginFromQuery() {
  const params = new URLSearchParams(location.search);
  const role = params.get("auto");
  if (!role || state.user) return;
  const account = CONFIG.accounts.find((item) => item.role === role) || CONFIG.accounts[0];
  fillAccount(account);
  const response = await api("login", account);
  if (response.status) {
    state.user = response.data;
    localStorage.setItem(`${CONFIG.repo}:user`, JSON.stringify(state.user));
  }
}

async function showApp() {
  $("#publicView").hidden = true;
  $("#appView").hidden = false;
  $("#roleText").textContent = `${state.user.display_name || state.user.username} / ${state.user.label || state.user.role}`;
  const view = new URLSearchParams(location.search).get("view");
  await switchModule(view === "module" ? CONFIG.modules[0].key : "dashboard");
}

async function switchModule(key) {
  state.current = key;
  $("#searchInput").value = "";
  document.querySelectorAll("#moduleNav button").forEach((button) => {
    button.classList.toggle("active", button.dataset.module === key);
  });
  await loadCurrent();
}

async function loadCurrent() {
  $("#addButton").hidden = state.current === "dashboard";
  $("#searchInput").hidden = state.current === "dashboard";
  if (state.current === "dashboard") {
    $("#pageTitle").textContent = "工作台";
    $("#dashboard").hidden = false;
    $("#modulePanel").hidden = true;
    await renderDashboard();
    return;
  }

  const mod = getModule(state.current);
  $("#pageTitle").textContent = mod.name;
  $("#moduleTitle").textContent = mod.name;
  $("#moduleSummary").textContent = mod.summary;
  $("#dashboard").hidden = true;
  $("#modulePanel").hidden = false;
  const response = await api("items/list", { module_key: state.current });
  if (!response.status) throw new Error(response.message || "列表加载失败");
  state.rows = response.data || [];
  renderTable();
}

async function renderDashboard() {
  const response = await api("summary");
  if (!response.status) throw new Error(response.message || "统计加载失败");
  const data = response.data;
  const moduleStats = CONFIG.modules.map((item) => {
    const count = data.modules?.[item.key] || 0;
    return `<div class="stat-card"><strong>${count}</strong><span>${escapeHtml(item.name)}</span></div>`;
  }).join("");
  const latest = (data.latest || []).slice(0, 6).map((item) => `
    <div class="flow-item">
      <strong>${escapeHtml(item.title)}</strong>
      <span>${escapeHtml(item.subtitle || item.status || item.module_key)}</span>
    </div>
  `).join("");
  $("#dashboard").innerHTML = `
    <section class="stats">
      <div class="stat-card"><strong>${data.totalItems || 0}</strong><span>业务记录</span></div>
      <div class="stat-card"><strong>${data.totalAccounts || 0}</strong><span>演示账号</span></div>
      <div class="stat-card"><strong>${CONFIG.modules.length}</strong><span>功能模块</span></div>
      <div class="stat-card"><strong>${escapeHtml(CONFIG.schema.replace("ot_", ""))}</strong><span>独立 Schema</span></div>
      ${moduleStats}
    </section>
    <section class="flow-card">
      <h2>最近业务数据</h2>
      <p>这些数据来自 Supabase 的项目独立 schema，可用于演示真实 API 请求、统计读取和业务记录维护。</p>
      <div class="flow-grid">${latest || `<div class="flow-item"><strong>暂无数据</strong><span>请新增一条演示记录</span></div>`}</div>
    </section>
  `;
}

function renderTable() {
  const term = $("#searchInput").value.trim().toLowerCase();
  const rows = state.rows.filter((row) => JSON.stringify(row).toLowerCase().includes(term));
  $("#recordCount").textContent = `${rows.length} 条记录`;
  $("#tableHead").innerHTML = `
    <tr>
      <th>标题</th>
      <th>说明</th>
      <th>状态</th>
      <th>负责人</th>
      <th>数值</th>
      <th>更新时间</th>
      <th>操作</th>
    </tr>
  `;
  $("#tableBody").innerHTML = rows.map((row) => `
    <tr>
      <td>${escapeHtml(row.title)}</td>
      <td>${escapeHtml(row.subtitle || row.description || "-")}</td>
      <td>${escapeHtml(row.status || "-")}</td>
      <td>${escapeHtml(row.owner || "-")}</td>
      <td>${escapeHtml(row.amount ?? "-")}</td>
      <td>${escapeHtml(formatDate(row.updated_at || row.created_at))}</td>
      <td class="actions">
        <button type="button" data-edit="${row.id}">编辑</button>
        <button type="button" data-delete="${row.id}">删除</button>
      </td>
    </tr>
  `).join("");

  document.querySelectorAll("[data-edit]").forEach((button) => {
    button.addEventListener("click", () => {
      const row = rows.find((item) => String(item.id) === String(button.dataset.edit));
      openEditor(row);
    });
  });

  document.querySelectorAll("[data-delete]").forEach((button) => {
    button.addEventListener("click", () => deleteRow(button.dataset.delete));
  });
}

function openEditor(row = null) {
  state.editing = row;
  const mod = getModule(state.current);
  $("#dialogTitle").textContent = row ? `编辑${mod.name}` : `新增${mod.name}`;
  $("#formFields").innerHTML = `
    ${field("title", "标题", "text", row?.title || "")}
    ${field("subtitle", "简要说明", "text", row?.subtitle || "")}
    ${field("status", "状态", "select", row?.status || "进行中", ["进行中", "待处理", "已完成", "已归档"])}
    ${field("owner", "负责人", "text", row?.owner || state.user.display_name || "")}
    ${field("amount", "数值", "number", row?.amount ?? 1)}
    ${field("description", "详细描述", "textarea", row?.description || "")}
  `;
  $("#editDialog").showModal();
}

function field(name, label, type, value, options = []) {
  if (type === "textarea") {
    return `<label class="full">${label}<textarea name="${name}">${escapeHtml(value)}</textarea></label>`;
  }
  if (type === "select") {
    return `<label>${label}<select name="${name}">${options.map((option) => `<option value="${option}" ${option === value ? "selected" : ""}>${option}</option>`).join("")}</select></label>`;
  }
  return `<label>${label}<input name="${name}" type="${type}" value="${escapeHtml(value)}" /></label>`;
}

async function saveEditor() {
  const form = Object.fromEntries(new FormData($("#editForm")).entries());
  const payload = {
    ...form,
    module_key: state.current,
    amount: Number(form.amount || 0),
  };
  const path = state.editing ? "items/update" : "items/add";
  if (state.editing) payload.id = state.editing.id;
  const response = await api(path, payload);
  if (!response.status) throw new Error(response.message || "保存失败");
  $("#editDialog").close();
  await loadCurrent();
}

async function deleteRow(id) {
  const response = await api("items/delete", { id });
  if (!response.status) throw new Error(response.message || "删除失败");
  await loadCurrent();
}

async function api(path, body = null) {
  const response = await fetch(`${API_BASE}/api/${path}`, {
    method: body ? "POST" : "GET",
    headers: body ? { "Content-Type": "application/json" } : {},
    body: body ? JSON.stringify(body) : undefined,
  });
  const payload = await response.json();
  if (!response.ok) throw new Error(payload.message || `请求失败: ${response.status}`);
  return payload;
}

function getModule(key) {
  return CONFIG.modules.find((item) => item.key === key);
}

function formatDate(value) {
  if (!value) return "-";
  return String(value).replace("T", " ").slice(0, 16);
}

function escapeHtml(value) {
  return String(value ?? "")
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#039;");
}

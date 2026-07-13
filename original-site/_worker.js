const API_ROOTS = new Set([
  "login",
  "menu",
  "home",
  "staff",
  "department",
  "dept",
  "attendance",
  "staff-leave",
  "city",
  "insurance",
  "salary",
  "salary-deduct",
  "overtime",
  "leave",
  "role",
  "docs",
]);

export default {
  async fetch(request, env) {
    try {
      const url = new URL(request.url);
      if (request.method === "OPTIONS") return new Response(null, { headers: corsHeaders(request, env) });
      if (url.pathname === "/health") {
        return json(request, env, ok({
          service: `${schema(env)}-api`,
          schema: schema(env),
          frontend: "original-vue-elementui-hrm-dist",
          time: new Date().toISOString(),
        }));
      }

      const parts = url.pathname.replace(/^\/+/, "").split("/").filter(Boolean);
      if (!parts.length || !API_ROOTS.has(parts[0])) return serveAssetOrSpa(request, env);
      if (request.method === "GET" && (request.headers.get("Accept") || "").includes("text/html")) {
        return serveAssetOrSpa(request, env);
      }

      const session = parts[0] === "login" ? null : await requireSession(request, env);
      if (parts.includes("export")) return exportModule(request, env, session, parts[0]);
      if (parts.includes("import")) return importModule(request, env, session, parts[0]);
      if (parts[0] === "docs" && parts[1] === "upload") return uploadFile(request, env, session);
      if (parts[0] === "docs" && parts[1] === "download") return downloadFile(request, env, session, decodeURIComponent(parts.slice(2).join("/")));
      const params = await requestParams(request, url);
      return json(request, env, await handleApi(parts, params, request, env, session));
    } catch (error) {
      return json(request, env, fail(error.message || "服务异常", error.apiCode), error.httpStatus || 500);
    }
  },
};

async function serveAssetOrSpa(request, env) {
  if (!env.ASSETS) return new Response("Not found", { status: 404 });
  const response = await env.ASSETS.fetch(request);
  if (response.status !== 404) return response;

  const accept = request.headers.get("Accept") || "";
  if (!accept.includes("text/html")) return response;

  const url = new URL(request.url);
  url.pathname = "/index.html";
  url.search = "";
  return env.ASSETS.fetch(new Request(url, request));
}

async function handleApi(parts, params, request, env, session) {
  const [root, action = "", id = ""] = parts;

  if (root === "login") return login(params, env);
  if (root === "menu") return menu(action, id, params, request.method, env, session);
  if (root === "home") return home(action, env);
  if (root === "staff") return staff(action, id, parts.slice(3), params, request.method, env, session);
  if (root === "department" || root === "dept") return department(action, id, params, request.method, env, session);
  if (root === "attendance") return attendance(action, id, params, request.method, env, session);
  if (root === "staff-leave") return staffLeave(action, id, params, request.method, env, session);
  if (root === "city") return moduleApi("hrm_city", action, id, params, request.method, env, session, cityRows());
  if (root === "insurance") return insurance(action, id, params, request.method, env, session);
  if (root === "salary") return salary(action, id, params, request.method, env, session);
  if (root === "role") return role(action, id, params, request.method, env, session);
  if (root === "leave") return leave(action, id, params);
  if (root === "docs") return moduleApi("hrm_docs", action, id, params, request.method, env, session, docsRows());

  return fail("业务模块不存在", 404);
}

async function login(params, env) {
  const code = String(params.code || params.username || "").trim();
  const password = String(params.password || "").trim();
  const rows = await requestSupabase(env, "accounts", "GET", { username: `eq.${code}`, limit: "1" });
  if (!rows.length || !(await verifyPassword(password, rows[0]))) return fail("账号或密码错误", 401);
  const account = rows[0];
  const staff = { ...staffRecord(null, code), accountId: Number(account.id), role: account.role, canWrite: ["admin", "staff"].includes(account.role) };
  const token = await createToken({ id: account.id, staffId: staff.id, username: account.username, role: account.role }, env);
  return ok({ token, data: staff });
}

async function requireSession(request, env) {
  const token = request.headers.get("token") || request.headers.get("Authorization")?.replace(/^Bearer\s+/i, "");
  const session = await verifyToken(token, env);
  if (!session) throw apiError("登录状态已失效，请重新登录", 401, 800);
  return session;
}

async function menu(action, id, params, method, env, session) {
  if (action === "staff") return ok({ data: await menusForSession(env, session) });
  if (action === "all") return ok({ data: flattenMenus(menuTree()) });
  return moduleApi("hrm_menu", action, id, params, method, env, session, flattenMenus(menuTree()));
}

async function home(action, env) {
  if (action === "staff") return ok({ data: [9, 12, 8, 6] });
  if (action === "count") {
    const rows = await loadModule(env, "hrm_staff", staffRows());
    return ok({ data: { totalNum: rows.length, normalNum: rows.filter((row) => row.status !== false && row.status !== "异常").length, lateNum: 2, leaveEarlyNum: 1, absenteeismNum: 1 } });
  }
  if (action === "city") return ok({ data: await loadModule(env, "hrm_city", cityRows()) });
  if (action === "department") {
    const rows = await loadModule(env, "hrm_department", departments());
    return ok({ data: rows.map((item) => ({ name: item.name, value: Number(item.staffNum || 0) })) });
  }
  if (action === "attendance") return ok({ data: attendanceDays() });
  return ok({ data: null });
}

async function staff(action, id, tail, params, method, env, session) {
  if (action === "check") {
    const targetId = tail[0] || session.staffId;
    if (String(targetId) !== String(session.staffId) && session.role !== "admin") throw apiError("无权校验其他账号密码", 403, 900);
    const account = await accountForStaff(env, targetId);
    return ok({ data: Boolean(account && await verifyPassword(decodeURIComponent(id || ""), account)) });
  }
  if (action === "role") {
    if (method === "GET") return ok({ data: (await requestSupabase(env, "staff_roles", "GET", { staff_id: `eq.${id}`, order: "role_id.asc" })).map(toStaffRole) });
    requireWriteRole(session);
    await requestSupabase(env, "staff_roles", "DELETE", { staff_id: `eq.${id}` });
    for (const roleId of normalizeIds(params)) await requestSupabase(env, "staff_roles", "POST", {}, { staff_id: Number(id), role_id: Number(roleId) });
    return ok({ data: (await requestSupabase(env, "staff_roles", "GET", { staff_id: `eq.${id}` })).map(toStaffRole) });
  }
  if (action === "pwd") {
    const targetId = params.id || session.staffId;
    if (String(targetId) !== String(session.staffId) && session.role !== "admin") throw apiError("无权修改其他账号密码", 403, 900);
    if (!params.password || String(params.password).length < 6) return fail("新密码至少 6 位", 400);
    const account = await accountForStaff(env, targetId);
    if (!account) return fail("账号不存在", 404);
    const salt = randomSalt();
    const passwordHash = await hashPassword(String(params.password), salt);
    await requestSupabase(env, "accounts", "PATCH", { id: `eq.${account.id}` }, { password_hash: passwordHash, password_salt: salt });
    return ok({ data: true });
  }
  if (action === "info" && id) {
    const rows = await loadModule(env, "hrm_staff", staffRows());
    return ok({ data: rows.find((row) => String(row.id) === String(id)) || null });
  }
  return moduleApi("hrm_staff", action, id, params, method, env, session, staffRows(), true);
}

async function department(action, id, params, method, env, session) {
  const rows = await loadModule(env, "hrm_department", departments());
  if (action === "all") return ok({ data: rows.map((row) => ({ ...row, children: row.children || [] })) });
  return moduleApi("hrm_department", action, id, params, method, env, session, departments());
}

async function attendance(action, id, params, method, env, session) {
  if (action === "staff") return ok({ data: attendanceDays() });
  if (action === "all") return ok({ data: scopeRows(await loadModule(env, "hrm_attendance", attendanceRows()), session) });
  return moduleApi("hrm_attendance", action, id, params, method, env, session, attendanceRows(), true);
}

async function staffLeave(action, id, params, method, env, session) {
  const rows = await loadModule(env, "hrm_leave", leaveRows().map((row) => row.staffLeave));
  if (action === "all") return ok({ data: scopeRows(rows, session) });
  if (action === "staff" && id) {
    const row = rows.find((item) => String(item.staffId || item.id) === String(id) && item.status === "待审核");
    return ok({ data: row || null });
  }
  if (action === "staff") return page(scopeRows(rows, session).map(toLeaveView), params);
  if (method === "GET") return page(scopeRows(rows, session).map(toLeaveView), params);
  const result = await mutateModule("hrm_leave", action, id, params, method, env, session);
  if (result.data) result.data = toLeaveView(result.data);
  return result;
}

async function insurance(action, id, params, method, env, session) {
  if (action === "staff") {
    const rows = await loadModule(env, "hrm_insurance", insuranceRows());
    return ok({ data: rows.find((row) => String(row.staffId) === String(id || params.id)) || rows[0] });
  }
  return moduleApi("hrm_insurance", action, id, params, method, env, session, insuranceRows(), true);
}

async function salary(action, id, params, method, env, session) {
  return moduleApi("hrm_salary", action, id, params, method, env, session, salaryRows(), true);
}

async function role(action, id, params, method, env, session) {
  if (action === "all") return ok({ data: await loadModule(env, "hrm_role", roleRows()) });
  if (action === "menu") {
    if (method === "GET") return ok({ data: (await requestSupabase(env, "role_menus", "GET", { role_id: `eq.${id}`, order: "menu_id.asc" })).map(toRoleMenu) });
    requireWriteRole(session);
    await requestSupabase(env, "role_menus", "DELETE", { role_id: `eq.${id}` });
    for (const menuId of normalizeIds(params)) await requestSupabase(env, "role_menus", "POST", {}, { role_id: Number(id), menu_id: Number(menuId) });
    return ok({ data: (await requestSupabase(env, "role_menus", "GET", { role_id: `eq.${id}` })).map(toRoleMenu) });
  }
  return moduleApi("hrm_role", action, id, params, method, env, session, roleRows());
}

function leave(action, id, params) {
  const types = [
    { id: 1, deptId: Number(id || params.deptId || 1), typeNum: "年假", days: 5, status: 1 },
    { id: 2, deptId: Number(id || params.deptId || 1), typeNum: "事假", days: 3, status: 1 },
    { id: 3, deptId: Number(id || params.deptId || 1), typeNum: "病假", days: 10, status: 1 },
  ];
  if (action === "all" || action === "dept") return ok({ data: types });
  if (action === "set") return ok({ data: params });
  return ok({ data: types[0] });
}

async function moduleApi(moduleKey, action, id, params, method, env, session, seeds, personal = false) {
  const recordId = id || (/^\d+$/.test(action) ? action : "");
  const isListRequest = method === "GET" || action === "page";
  if (isListRequest && action !== "batch") {
    const rows = personal ? scopeRows(await loadModule(env, moduleKey, seeds), session) : await loadModule(env, moduleKey, seeds);
    if (recordId && action !== "page") return ok({ data: rows.find((row) => String(row.id) === String(recordId)) || null });
    return page(filterRows(rows, params), params);
  }
  return mutateModule(moduleKey, action, recordId, params, method, env, session);
}

async function mutateModule(moduleKey, action, id, params, method, env, session) {
  requireWriteRole(session);
  const ids = action === "batch" ? String(id || "").split(",").filter(Boolean) : [id || params.id].filter(Boolean);
  if (method === "DELETE") {
    for (const itemId of ids) await requestSupabase(env, "items", "DELETE", { id: `eq.${itemId}`, module_key: `eq.${moduleKey}` });
    return ok({ data: null });
  }
  const record = sanitizeRecord(params);
  if (method === "PUT" || method === "PATCH") {
    if (!record.id) return fail("缺少记录编号", 400);
    const rows = await requestSupabase(env, "items", "PATCH", { id: `eq.${record.id}`, module_key: `eq.${moduleKey}` }, itemPayload(moduleKey, record));
    return ok({ data: decodeItem(rows[0]) });
  }
  const rows = await requestSupabase(env, "items", "POST", {}, itemPayload(moduleKey, record));
  return ok({ data: decodeItem(rows[0]) });
}

async function loadModule(env, moduleKey, seeds) {
  let rows = await requestSupabase(env, "items", "GET", { module_key: `eq.${moduleKey}`, order: "id.asc" });
  if (!rows.length) {
    for (const seed of seeds) await requestSupabase(env, "items", "POST", {}, itemPayload(moduleKey, seed));
    rows = await requestSupabase(env, "items", "GET", { module_key: `eq.${moduleKey}`, order: "id.asc" });
  }
  return rows.map(decodeItem).filter(Boolean);
}

function itemPayload(moduleKey, record) {
  const extra = { ...record };
  delete extra.id;
  return {
    module_key: moduleKey,
    title: String(record.name || record.title || record.code || moduleKey),
    subtitle: String(record.deptName || record.typeNum || ""),
    status: String(record.status ?? "正常"),
    owner: String(record.owner || record.name || ""),
    amount: Number(record.amount || record.totalSalary || record.total || 0),
    description: String(record.remark || record.description || ""),
    extra,
    updated_at: new Date().toISOString(),
  };
}

function decodeItem(row) {
  if (!row) return null;
  const extra = typeof row.extra === "string" ? JSON.parse(row.extra || "{}") : (row.extra || {});
  return { ...extra, id: Number(row.id) };
}

function sanitizeRecord(params) {
  const record = { ...params };
  delete record.current;
  delete record.size;
  delete record.page;
  delete record.pageNum;
  delete record.pageSize;
  return record;
}

function filterRows(rows, params) {
  const ignored = new Set(["current", "size", "page", "pageNum", "pageSize", "limit"]);
  return rows.filter((row) => Object.entries(params || {}).every(([key, value]) => {
    if (ignored.has(key) || value === "" || value == null) return true;
    return String(row[key] ?? "").toLowerCase().includes(String(value).toLowerCase());
  }));
}

function toLeaveView(staffLeave) {
  return {
    id: staffLeave.id,
    staffLeave,
    unaudited: "待审核",
    approve: "已通过",
    reject: "已驳回",
    cancel: "已撤销",
    tagType: staffLeave.status === "待审核" ? "warning" : staffLeave.status === "已通过" ? "success" : "danger",
  };
}

function docsRows() {
  return [
    { name: "生产实习项目说明.pdf", originalName: "第四组生产实习项目说明.pdf", type: "PDF", size: 248, uploader: "系统管理员", createTime: now(), remark: "公开演示文档" },
  ];
}

function requireWriteRole(session) {
  if (!session || !["admin", "staff"].includes(session.role)) throw apiError("当前账号只有查看权限", 403, 900);
}

function normalizeIds(value) {
  if (Array.isArray(value)) return value;
  if (Array.isArray(value?.ids)) return value.ids;
  return Object.values(value || {}).filter((item) => typeof item === "number" || /^\d+$/.test(String(item)));
}

function toStaffRole(row) { return { staffId: Number(row.staff_id), roleId: Number(row.role_id) }; }
function toRoleMenu(row) { return { roleId: Number(row.role_id), menuId: Number(row.menu_id) }; }

function scopeRows(rows, session) {
  if (!session || session.role !== "user") return rows;
  return rows.filter((row) => String(row.staffId || row.id) === String(session.staffId) || row.code === session.username);
}

async function accountForStaff(env, staffId) {
  const staff = staffRecord(Number(staffId));
  if (!staff) return null;
  const rows = await requestSupabase(env, "accounts", "GET", { username: `eq.${staff.code}`, limit: "1" });
  return rows[0] || null;
}

async function menusForSession(env, session) {
  if (session.role === "admin") return menuTree();
  const relations = await requestSupabase(env, "staff_roles", "GET", { staff_id: `eq.${session.staffId}` });
  const allowed = new Set();
  for (const relation of relations) {
    const menus = await requestSupabase(env, "role_menus", "GET", { role_id: `eq.${relation.role_id}` });
    menus.forEach((item) => allowed.add(Number(item.menu_id)));
  }
  return menuTree().filter((item) => allowed.has(item.id) || item.children.some((child) => allowed.has(child.id))).map((item) => ({
    ...item,
    children: item.children.filter((child) => allowed.has(child.id)),
  }));
}

function randomSalt() {
  return base64UrlBytes(crypto.getRandomValues(new Uint8Array(16)));
}

async function hashPassword(password, salt) {
  const material = await crypto.subtle.importKey("raw", new TextEncoder().encode(password), "PBKDF2", false, ["deriveBits"]);
  const bits = await crypto.subtle.deriveBits({ name: "PBKDF2", hash: "SHA-256", salt: new TextEncoder().encode(salt), iterations: 100000 }, material, 256);
  return base64UrlBytes(new Uint8Array(bits));
}

async function verifyPassword(password, account) {
  if (account.password_hash && account.password_salt) return (await hashPassword(password, account.password_salt)) === account.password_hash;
  return Boolean(account.password && account.password === password);
}

function moduleDefinition(root) {
  const definitions = {
    staff: ["hrm_staff", staffRows()], department: ["hrm_department", departments()], dept: ["hrm_department", departments()],
    attendance: ["hrm_attendance", attendanceRows()], "staff-leave": ["hrm_leave", leaveRows().map((row) => row.staffLeave)],
    city: ["hrm_city", cityRows()], insurance: ["hrm_insurance", insuranceRows()], salary: ["hrm_salary", salaryRows()],
    role: ["hrm_role", roleRows()], docs: ["hrm_docs", docsRows()], menu: ["hrm_menu", flattenMenus(menuTree())],
  };
  return definitions[root];
}

async function exportModule(request, env, session, root) {
  const definition = moduleDefinition(root);
  if (!definition) throw apiError("该模块不支持导出", 400, 400);
  let rows = await loadModule(env, definition[0], definition[1]);
  rows = scopeRows(rows, session);
  const columns = [...new Set(rows.flatMap((row) => Object.keys(row).filter((key) => typeof row[key] !== "object")))];
  const csv = "\uFEFF" + [columns, ...rows.map((row) => columns.map((key) => row[key] ?? ""))].map((line) => line.map(csvCell).join(",")).join("\r\n");
  return new Response(csv, { headers: { "Content-Type": "text/csv; charset=utf-8", "Content-Disposition": `attachment; filename="${root}-${Date.now()}.csv"`, ...corsHeaders(request, env) } });
}

async function importModule(request, env, session, root) {
  requireWriteRole(session);
  const definition = moduleDefinition(root);
  if (!definition) throw apiError("该模块不支持导入", 400, 400);
  const form = await request.formData();
  const file = form.get("file");
  if (!file || file.size > 2 * 1024 * 1024) throw apiError("请选择不超过 2MB 的 CSV 文件", 400, 400);
  const records = parseCsv(await file.text());
  for (const record of records) await requestSupabase(env, "items", "POST", {}, itemPayload(definition[0], record));
  return json(request, env, ok({ data: { imported: records.length } }));
}

async function uploadFile(request, env, session) {
  requireWriteRole(session);
  const form = await request.formData();
  const file = form.get("file");
  const allowed = new Set(["image/png", "image/jpeg", "application/pdf", "text/plain", "text/csv"]);
  if (!file || file.size > 2 * 1024 * 1024 || !allowed.has(file.type)) throw apiError("仅支持 2MB 内的 PNG/JPG/PDF/TXT/CSV", 400, 400);
  const name = `${Date.now()}-${String(file.name).replace(/[^\w.\-\u4e00-\u9fa5]/g, "_")}`;
  const bytes = new Uint8Array(await file.arrayBuffer());
  const saved = await requestSupabase(env, "files", "POST", {}, { name, original_name: file.name, content_type: file.type, size: file.size, content_base64: bytesToBase64(bytes), uploader: session.username });
  await requestSupabase(env, "items", "POST", {}, itemPayload("hrm_docs", { name, originalName: file.name, type: file.type, size: file.size, uploader: session.username, createTime: now(), fileId: saved[0]?.id }));
  return json(request, env, ok({ data: { name, url: `/docs/download/${encodeURIComponent(name)}` } }));
}

async function downloadFile(request, env, session, name) {
  const rows = await requestSupabase(env, "files", "GET", { name: `eq.${name}`, limit: "1" });
  if (!rows.length) throw apiError("文件不存在", 404, 404);
  const file = rows[0];
  return new Response(base64ToBytes(file.content_base64), { headers: { "Content-Type": file.content_type, "Content-Disposition": `attachment; filename*=UTF-8''${encodeURIComponent(file.original_name)}`, ...corsHeaders(request, env) } });
}

function csvCell(value) { const text = String(value); return /[",\r\n]/.test(text) ? `"${text.replace(/"/g, '""')}"` : text; }
function parseCsv(text) {
  const lines = text.replace(/^\uFEFF/, "").split(/\r?\n/).filter(Boolean).map(parseCsvLine);
  if (lines.length < 2) return [];
  return lines.slice(1).map((line) => Object.fromEntries(lines[0].map((key, index) => [key, line[index] ?? ""])));
}
function parseCsvLine(line) { const result=[]; let value=""; let quoted=false; for(let index=0;index<line.length;index++){const char=line[index];if(char==='"'&&quoted&&line[index+1]==='"'){value+='"';index++;}else if(char==='"'){quoted=!quoted;}else if(char===','&&!quoted){result.push(value);value="";}else value+=char;}result.push(value);return result; }
function bytesToBase64(bytes) { let binary=""; for(const byte of bytes) binary+=String.fromCharCode(byte); return btoa(binary); }
function base64ToBytes(value) { const binary=atob(value); return Uint8Array.from(binary, (char) => char.charCodeAt(0)); }

async function createToken(payload, env) {
  const body = base64Url(JSON.stringify({ ...payload, exp: Date.now() + 8 * 60 * 60 * 1000 }));
  const signature = await sign(body, env);
  return `${body}.${signature}`;
}

async function verifyToken(token, env) {
  if (!token || !token.includes(".")) return null;
  const [body, signature] = token.split(".");
  if ((await sign(body, env)) !== signature) return null;
  try {
    const payload = JSON.parse(decodeBase64Url(body));
    return payload.exp > Date.now() ? payload : null;
  } catch {
    return null;
  }
}

async function sign(value, env) {
  const secret = cleanEnv(env.AUTH_SECRET);
  if (!secret) throw new Error("Worker 缺少独立 AUTH_SECRET");
  const key = await crypto.subtle.importKey("raw", new TextEncoder().encode(secret), { name: "HMAC", hash: "SHA-256" }, false, ["sign"]);
  const signature = await crypto.subtle.sign("HMAC", key, new TextEncoder().encode(value));
  return base64UrlBytes(new Uint8Array(signature));
}

function base64Url(value) {
  return base64UrlBytes(new TextEncoder().encode(value));
}

function base64UrlBytes(bytes) {
  let binary = "";
  for (const byte of bytes) binary += String.fromCharCode(byte);
  return btoa(binary).replace(/=/g, "").replace(/\+/g, "-").replace(/\//g, "_");
}

function decodeBase64Url(value) {
  const normalized = value.replace(/-/g, "+").replace(/_/g, "/");
  const binary = atob(normalized + "=".repeat((4 - normalized.length % 4) % 4));
  return new TextDecoder().decode(Uint8Array.from(binary, (char) => char.charCodeAt(0)));
}

function apiError(message, status, code) {
  const error = new Error(message);
  error.httpStatus = status;
  error.apiCode = code;
  return error;
}

function menuTree() {
  return [
    { id: 1, code: "system", name: "系统管理", icon: "setting", path: "/system", children: [
      { id: 11, code: "staff", name: "员工管理", icon: "user", path: "/system/staff", children: [] },
      { id: 12, code: "department", name: "部门管理", icon: "office-building", path: "/system/department", children: [] },
      { id: 13, code: "docs", name: "文档管理", icon: "document", path: "/system/docs", children: [] },
    ] },
    { id: 2, code: "attendance", name: "考勤管理", icon: "date", path: "/attendance", children: [
      { id: 21, code: "performance", name: "考勤统计", icon: "s-data", path: "/attendance/performance", children: [] },
      { id: 22, code: "leave", name: "请假审批", icon: "tickets", path: "/attendance/leave", children: [] },
    ] },
    { id: 3, code: "money", name: "薪资社保", icon: "money", path: "/money", children: [
      { id: 31, code: "city", name: "城市社保", icon: "location", path: "/money/city", children: [] },
      { id: 32, code: "insurance", name: "社保管理", icon: "umbrella", path: "/money/insurance", children: [] },
      { id: 33, code: "salary", name: "薪资管理", icon: "coin", path: "/money/salary", children: [] },
    ] },
    { id: 4, code: "permission", name: "权限管理", icon: "lock", path: "/permission", children: [
      { id: 41, code: "role", name: "角色管理", icon: "s-custom", path: "/permission/role", children: [] },
      { id: 42, code: "menu", name: "菜单管理", icon: "menu", path: "/permission/menu", children: [] },
    ] },
  ];
}

function flattenMenus(list) {
  return list.flatMap((item) => [item, ...flattenMenus(item.children || [])]);
}

function staffRecord(id = 1, code = "admin") {
  const rows = staffRows();
  return rows.find((item) => item.id === id || item.code === code) || rows[0];
}

function staffRows() {
  return [
    { id: 1, code: "admin", name: "系统管理员", gender: "男", phone: "13800000001", birthday: "1990-01-01", address: "上海", deptId: 1, deptName: "总经办", status: "正常", avatar: "" },
    { id: 2, code: "hr01", name: "HR专员", gender: "女", phone: "13800000002", birthday: "1993-06-12", address: "杭州", deptId: 2, deptName: "人力资源部", status: "正常", avatar: "" },
    { id: 3, code: "employee01", name: "普通员工", gender: "男", phone: "13800000003", birthday: "1996-09-20", address: "南京", deptId: 3, deptName: "研发部", status: "正常", avatar: "" },
  ];
}

function departments() {
  return [
    { id: 1, name: "总经办", code: "CEO", leader: "系统管理员", phone: "021-80000001", staffNum: 4, salaryMultiple: 1.5, children: [] },
    { id: 2, name: "人力资源部", code: "HR", leader: "HR专员", phone: "021-80000002", staffNum: 8, salaryMultiple: 1.2, children: [] },
    { id: 3, name: "研发部", code: "RD", leader: "普通员工", phone: "021-80000003", staffNum: 18, salaryMultiple: 1.4, children: [] },
    { id: 4, name: "市场部", code: "MKT", leader: "市场主管", phone: "021-80000004", staffNum: 6, salaryMultiple: 1.1, children: [] },
  ];
}

function cityRows() {
  return [
    { id: 1, name: "上海", comPensionRate: 0.16, comMedicalRate: 0.095, comUnemploymentRate: 0.005, comMaternityRate: 0.01 },
    { id: 2, name: "杭州", comPensionRate: 0.15, comMedicalRate: 0.09, comUnemploymentRate: 0.005, comMaternityRate: 0.008 },
    { id: 3, name: "南京", comPensionRate: 0.16, comMedicalRate: 0.085, comUnemploymentRate: 0.004, comMaternityRate: 0.009 },
  ];
}

function attendanceDays() {
  const labels = ["正常", "正常", "迟到", "正常", "请假", "正常", "早退"];
  return Array.from({ length: 31 }, (_, index) => ({
    attendanceDate: `2026-07-${String(index + 1).padStart(2, "0")}`,
    message: labels[index % labels.length],
    tagType: labels[index % labels.length] === "正常" ? "success" : "warning",
  }));
}

function attendanceRows() {
  return staffRows().map((staff, index) => ({
    staffId: staff.id,
    code: staff.code,
    name: staff.name,
    deptName: staff.deptName,
    attendanceList: attendanceDays(),
    lateNum: index,
    absenteeismNum: 0,
  }));
}

function leaveRows() {
  return staffRows().map((staff, index) => ({
    id: index + 1,
    staffLeave: {
      id: index + 1,
      code: staff.code,
      name: staff.name,
      deptName: staff.deptName,
      phone: staff.phone,
      createTime: now(),
      typeNum: "年假",
      startDate: "2026-07-15",
      days: 2,
      status: index === 0 ? "待审核" : "已通过",
      remark: "作品集演示请假记录",
    },
    unaudited: "待审核",
    approve: "已通过",
    reject: "已驳回",
    cancel: "已撤销",
    tagType: index === 0 ? "warning" : "success",
  }));
}

function insuranceRows() {
  return staffRows().map((staff) => ({
    id: staff.id,
    staffId: staff.id,
    code: staff.code,
    name: staff.name,
    deptName: staff.deptName,
    cityName: staff.address,
    pension: 1200,
    medical: 600,
    unemployment: 80,
    maternity: 60,
    total: 1940,
  }));
}

function salaryRows() {
  return staffRows().map((staff) => ({
    id: staff.id,
    staffId: staff.id,
    code: staff.code,
    name: staff.name,
    deptName: staff.deptName,
    baseSalary: 9000,
    performance: 1600,
    insurance: 1940,
    totalSalary: 8660,
    salaryMonth: "2026-07",
  }));
}

function roleRows() {
  return [
    { id: 1, name: "系统管理员", code: "admin", remark: "拥有全部演示权限" },
    { id: 2, name: "人事专员", code: "hr", remark: "管理人员与考勤薪资" },
    { id: 3, name: "普通员工", code: "employee", remark: "查看个人信息" },
  ];
}

function page(rows, params = {}) {
  const current = Math.max(Number(params.current || params.pageNum || params.page || 1), 1);
  const size = Math.max(Number(params.size || params.pageSize || params.limit || 10), 1);
  const start = (current - 1) * size;
  const list = rows.slice(start, start + size);
  return ok({ data: { list, records: list, total: rows.length, current, size } });
}

async function requestParams(request, url) {
  const query = Object.fromEntries(url.searchParams.entries());
  if (request.method === "GET" || request.method === "HEAD") return query;
  const text = await request.text();
  if (!text) return query;
  try {
    return { ...query, ...JSON.parse(text) };
  } catch {
    return { ...query, ...Object.fromEntries(new URLSearchParams(text).entries()) };
  }
}

function ok(extra = {}) {
  return { code: 200, message: "success", ...extra };
}

function fail(message, code = 500) {
  return { code, message, data: null };
}

function json(request, env, payload, status = 200) {
  if (payload instanceof Response) return payload;
  return new Response(JSON.stringify(payload), {
    status,
    headers: { "Content-Type": "application/json; charset=utf-8", ...corsHeaders(request, env) },
  });
}

function corsHeaders(request, env) {
  const origin = request.headers.get("Origin") || "";
  const allowed = String(env.CORS_ALLOWED_ORIGINS || "").split(",").map((item) => item.trim()).filter(Boolean);
  const allowOrigin = allowed.includes(origin) ? origin : allowed[0] || origin || "*";
  return {
    "Access-Control-Allow-Origin": allowOrigin,
    "Access-Control-Allow-Credentials": "true",
    "Access-Control-Allow-Methods": "GET,POST,PUT,DELETE,OPTIONS",
    "Access-Control-Allow-Headers": "Content-Type,Authorization,token,Token",
    "Access-Control-Max-Age": "86400",
  };
}

async function requestSupabase(env, table, method, query = {}, payload = {}) {
  const base = cleanEnv(env.SUPABASE_URL);
  const key = cleanEnv(env.SUPABASE_SERVICE_ROLE_KEY);
  if (!base || !key) throw new Error("Worker 缺少 Supabase 环境变量");
  const response = await fetch(`${base.replace(/\/$/, "")}/rest/v1/rpc/${schema(env)}_demo_rest`, {
    method: "POST",
    headers: { apikey: key, Authorization: `Bearer ${key}`, "Content-Type": "application/json" },
    body: JSON.stringify({ p_table_name: table, p_method: method, p_query: query, p_payload: payload }),
  });
  if (!response.ok) throw new Error(`Supabase 请求失败: ${response.status} ${await response.text()}`);
  const data = await response.json();
  return Array.isArray(data) ? data : [];
}

function cleanEnv(value) {
  return String(value || "").replace(/^\uFEFF/, "").trim();
}

function schema(env) {
  return String(env.SUPABASE_SCHEMA || "hrm_qiyerenyuan").trim();
}

function now() {
  return new Date().toISOString().slice(0, 19).replace("T", " ");
}

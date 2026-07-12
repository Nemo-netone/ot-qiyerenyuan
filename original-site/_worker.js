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

      const params = await requestParams(request, url);
      return json(request, env, await handleApi(parts, params, request));
    } catch (error) {
      return json(request, env, fail(error.message || "服务异常"), 500);
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

async function handleApi(parts, params, request) {
  const [root, action = "", id = ""] = parts;

  if (root === "login") return login(params);
  if (root === "menu") return menu(action);
  if (root === "home") return home(action);
  if (root === "docs") return docs(action);
  if (root === "staff") return staff(action, id, params, request.method);
  if (root === "department" || root === "dept") return department(action, id, params, request.method);
  if (root === "attendance") return attendance(action, id, params, request.method);
  if (root === "staff-leave") return staffLeave(action, id, params, request.method);
  if (root === "city") return city(action, id, params, request.method);
  if (root === "insurance") return insurance(action, id, params, request.method);
  if (root === "salary") return salary(action, id, params, request.method);
  if (root === "role") return role(action, id, params, request.method);

  return generic(root, action, id, params, request.method);
}

function login(params) {
  const code = String(params.code || params.username || "").trim();
  const password = String(params.password || "").trim();
  const valid = [
    ["admin", "123456"],
    ["employee01", "123456"],
    ["hr01", "123456"],
  ].some(([user, pass]) => user === code && pass === password);
  if (!valid) return fail("账号或密码错误");
  const staff = staffRecord(code === "admin" ? 1 : code === "hr01" ? 2 : 3, code);
  return ok({ token: `demo-hrm-${staff.id}-${Date.now()}`, data: staff });
}

function menu(action) {
  if (action === "staff") return ok({ data: menuTree() });
  if (action === "all") return ok({ data: flattenMenus(menuTree()) });
  return page(flattenMenus(menuTree()));
}

function home(action) {
  if (action === "staff") return ok({ data: [9, 12, 8, 6] });
  if (action === "count") {
    return ok({ data: { totalNum: 36, normalNum: 32, lateNum: 2, leaveEarlyNum: 1, absenteeismNum: 1 } });
  }
  if (action === "city") return ok({ data: cityRows() });
  if (action === "department") return ok({ data: departments().map((item) => ({ name: item.name, value: item.staffNum })) });
  if (action === "attendance") return ok({ data: attendanceDays() });
  return ok({ data: null });
}

function staff(action, id, params, method) {
  if (action === "info" || (!action && id)) return ok({ data: staffRecord(Number(id || 1)) });
  if (action === "check") return ok({ data: true });
  if (action === "role") return ok({ data: [1, 2] });
  if (action === "page") return page(staffRows(), params);
  if (method !== "GET") return ok({ data: { ...params, id: params.id || Date.now() } });
  return page(staffRows(), params);
}

function department(action, id, params, method) {
  if (action === "all") return ok({ data: departments() });
  if (action === "page") return page(departments(), params);
  if (method !== "GET") return ok({ data: { ...params, id: params.id || Date.now() } });
  return page(departments(), params);
}

function attendance(action, id, params, method) {
  if (action === "staff") return ok({ data: attendanceDays() });
  if (action === "all") return ok({ data: attendanceRows() });
  if (action === "page") return page(attendanceRows(), params);
  if (method !== "GET") return ok({ data: { ...params, id: params.id || Date.now() } });
  return page(attendanceRows(), params);
}

function staffLeave(action, id, params, method) {
  if (action === "staff") return ok({ data: leaveRows() });
  if (action === "page") return page(leaveRows(), params);
  if (method !== "GET") return ok({ data: { ...params, id: params.id || Date.now() } });
  return page(leaveRows(), params);
}

function city(action, id, params, method) {
  if (action === "all") return ok({ data: cityRows() });
  if (action === "page") return page(cityRows(), params);
  if (method !== "GET") return ok({ data: { ...params, id: params.id || Date.now() } });
  return page(cityRows(), params);
}

function insurance(action, id, params, method) {
  if (action === "staff") return ok({ data: insuranceRows()[0] });
  if (action === "page") return page(insuranceRows(), params);
  if (method !== "GET") return ok({ data: { ...params, id: params.id || Date.now() } });
  return page(insuranceRows(), params);
}

function salary(action, id, params, method) {
  if (action === "page") return page(salaryRows(), params);
  if (method !== "GET") return ok({ data: { ...params, id: params.id || Date.now() } });
  return page(salaryRows(), params);
}

function role(action, id, params, method) {
  if (action === "all") return ok({ data: roleRows() });
  if (action === "page") return page(roleRows(), params);
  if (method !== "GET") return ok({ data: { ...params, id: params.id || Date.now() } });
  return page(roleRows(), params);
}

function docs(action) {
  if (action === "upload") return ok({ data: { name: "demo-avatar.png" } });
  if (action === "download") return new Response("", { status: 404 });
  return page([{ id: 1, name: "员工手册.pdf", staffName: "HR专员", createTime: now(), remark: "演示文档" }]);
}

function generic(root, action, id, params, method) {
  if (action === "all") return ok({ data: [] });
  if (method !== "GET") return ok({ data: { ...params, id: params.id || Date.now() } });
  return page([]);
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

function fail(message) {
  return { code: 500, message, data: null };
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

function schema(env) {
  return String(env.SUPABASE_SCHEMA || "hrm_qiyerenyuan").trim();
}

function now() {
  return new Date().toISOString().slice(0, 19).replace("T", " ");
}

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

      if (request.method === "GET" && parts[0] === "staff" && parts[1] === "avatar" && parts[2]) return await publicAvatar(request, env, decodeURIComponent(parts.slice(2).join("/")));
      const session = parts[0] === "login" ? null : await requireSession(request, env);
      if (parts.includes("export")) return await exportModule(request, env, session, parts[0]);
      if (parts.includes("import")) return await importModule(request, env, session, parts[0]);
      if (parts[0] === "docs" && parts[1] === "upload") return await uploadFile(request, env, session);
      if (parts[0] === "docs" && parts[1] === "download") return await downloadFile(request, env, session, decodeURIComponent(parts.slice(2).join("/")));
      if (parts[0] === "staff" && parts[1] === "avatar") return await uploadAvatar(request, env, session);
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
  if (root === "home") return home(action, env, session);
  if (root === "staff") return staff(action, id, parts.slice(3), params, request.method, env, session);
  if (root === "department" || root === "dept") return department(action, id, params, request.method, env, session);
  if (root === "attendance") return attendance(action, id, parts.slice(3), params, request.method, env, session);
  if (root === "staff-leave") return staffLeave(action, id, params, request.method, env, session);
  if (root === "city") return city(action, id, params, request.method, env, session);
  if (root === "insurance") return insurance(action, id, params, request.method, env, session);
  if (root === "salary") return salary(action, id, params, request.method, env, session);
  if (root === "salary-deduct") return policyApi("hrm_salary_deduct", salaryDeductRows(), action, id, parts.slice(3), params, request.method, env, session);
  if (root === "overtime") return policyApi("hrm_overtime", overtimeRows(), action, id, parts.slice(3), params, request.method, env, session);
  if (root === "role") return role(action, id, params, request.method, env, session);
  if (root === "leave") return policyApi("hrm_leave_policy", leavePolicyRows(), action, id, parts.slice(3), params, request.method, env, session);
  if (root === "docs") return docs(action, id, params, request.method, env, session);

  return fail("业务模块不存在", 404);
}

async function login(params, env) {
  const code = String(params.code || params.username || "").trim();
  const password = String(params.password || "").trim();
  const rows = await requestSupabase(env, "accounts", "GET", { username: `eq.${code}`, limit: "1" });
  if (!rows.length || !(await verifyPassword(password, rows[0]))) return fail("账号或密码错误", 401);
  const account = rows[0];
  const staffList = await loadModule(env, "hrm_staff", staffRows());
  const staffData = staffList.find((item) => item.code === code);
  if (!staffData) return fail("登录账号未关联员工档案", 403);
  const staff = { ...staffData, accountId: Number(account.id), role: account.role, canWrite: ["admin", "staff"].includes(account.role) };
  const relations = await requestSupabase(env, "staff_roles", "GET", { staff_id: `eq.${staff.id}` });
  if (!relations.length) await requestSupabase(env, "staff_roles", "POST", {}, { staff_id: Number(staff.id), role_id: roleIdForAccount(account.role) });
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
  if (action === "all") return ok({ data: flattenMenus(await currentMenuTree(env)) });
  return moduleApi("hrm_menu", action, id, params, method, env, session, flattenMenus(menuTree()));
}

async function home(action, env, session) {
  const staff = await loadModule(env, "hrm_staff", staffRows());
  const scopedStaff = scopeRows(staff, session);
  const attendance = scopeRows(await loadModule(env, "hrm_attendance", attendanceRows()), session);
  if (action === "staff") {
    const departmentRecords = await loadModule(env, "hrm_department", departments());
    return ok({ data: departmentRecords.map((dept) => staff.filter((item) => Number(item.deptId) === Number(dept.id)).length) });
  }
  if (action === "count") {
    const states = attendance.flatMap((row) => row.attendanceList || []);
    return ok({ data: { totalNum: scopedStaff.length, normalNum: scopedStaff.filter((row) => row.status !== false && row.status !== "异常").length, lateNum: states.filter((item) => item.message === "迟到").length, leaveEarlyNum: states.filter((item) => item.message === "早退").length, absenteeismNum: states.filter((item) => item.message === "旷工").length } });
  }
  if (action === "city") return ok({ data: await loadModule(env, "hrm_city", cityRows()) });
  if (action === "department") {
    const rows = await loadModule(env, "hrm_department", departments());
    return ok({ data: rows.map((item) => ({ name: item.name, value: Number(item.staffNum || 0) })) });
  }
  if (action === "attendance") return ok({ data: attendance[0]?.attendanceList || [] });
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
    const roleIds = normalizeIds(params).map(Number);
    for (const roleId of roleIds) await requestSupabase(env, "staff_roles", "POST", {}, { staff_id: Number(id), role_id: roleId });
    const account = await accountForStaff(env, id);
    if (account) await requestSupabase(env, "accounts", "PATCH", { id: `eq.${account.id}` }, { role: roleIds.includes(1) ? "admin" : roleIds.includes(2) ? "staff" : "user" });
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
  if (!action && method === "POST") return createStaff(params, env, session);
  if (!action && (method === "PUT" || method === "PATCH")) return updateStaff(params, env, session);
  if ((method === "DELETE") && (action === "batch" || /^\d+$/.test(action))) return deleteStaff(action, id, env, session);
  return moduleApi("hrm_staff", action, id, params, method, env, session, staffRows(), true);
}

async function department(action, id, params, method, env, session) {
  const rows = await loadModule(env, "hrm_department", departments());
  if (action === "all") return ok({ data: departmentTree(rows) });
  if (method === "DELETE") return deleteDepartments(action, id, rows, env, session);
  if (method === "POST" || method === "PUT" || method === "PATCH") {
    const validation = validateDepartment(params, rows);
    if (validation) return validation;
  }
  return moduleApi("hrm_department", action, id, params, method, env, session, departments());
}

async function city(action, id, params, method, env, session) {
  if (action === "all") return ok({ data: await loadModule(env, "hrm_city", cityRows()) });
  const rows = await loadModule(env, "hrm_city", cityRows());
  if (method === "DELETE") return deleteCities(action, id, rows, env, session);
  if (method === "POST" || method === "PUT" || method === "PATCH") {
    const validation = validateCity(params, rows);
    if (validation) return validation;
  }
  return moduleApi("hrm_city", action, id, params, method, env, session, cityRows());
}

async function attendance(action, id, tail, params, method, env, session) {
  if (action === "staff" && id && tail[0]) return ok({ data: await attendanceDetail(env, id, tail[0], session) });
  if (action === "staff") return ok({ data: attendanceDays() });
  if (action === "set") return setAttendance(params, env, session);
  if (action === "all") return ok({ data: attendanceStatusRows() });
  if (method === "GET") {
    const query = { ...params };
    delete query.month;
    const staffRowsData = scopeRows(await loadModule(env, "hrm_staff", staffRows()), session);
    const records = await loadModule(env, "hrm_attendance", attendanceRows());
    const joined = staffRowsData.map((staff) => {
      const record = records.find((item) => String(item.staffId) === String(staff.id) || item.code === staff.code);
      return { ...staff, ...(record || {}), id: record?.id || staff.id, staffId: staff.id, code: staff.code, name: staff.name, deptName: staff.deptName, phone: staff.phone, attendanceList: record?.attendanceList || attendanceDays() };
    });
    const rows = filterRows(joined, query);
    const result = page(rows, params);
    result.data.dayNum = daysInMonth(params.month);
    result.data.month = normalizeMonth(params.month);
    return result;
  }
  return moduleApi("hrm_attendance", action, id, params, method, env, session, attendanceRows(), true);
}

async function staffLeave(action, id, params, method, env, session) {
  const rows = await loadModule(env, "hrm_leave", leaveRows().map((row) => row.staffLeave));
  if (action === "all") return ok({ data: scopeRows(rows, session) });
  if (action === "staff" && id) {
    if (session.role === "user" && String(id) !== String(session.staffId)) throw apiError("只能查看本人的请假申请", 403, 900);
    const row = rows.find((item) => String(item.staffId) === String(id) && item.status === "待审核");
    return ok({ data: row || null });
  }
  if (action === "staff") return page(scopeRows(rows, session).map(toLeaveView), params);
  if (method === "GET") return page(scopeRows(rows, session).map(toLeaveView), params);
  if (method === "POST") return createLeave(params, rows, env, session);
  if (method === "PUT" || method === "PATCH") return updateLeave(params, rows, env, session);
  if (method === "DELETE") return deleteLeave(action, id, rows, env, session);
  return fail("不支持的请假操作", 400);
}

async function createLeave(params, rows, env, session) {
  const staffId = Number(params.staffId || session.staffId);
  if (session.role === "user" && String(staffId) !== String(session.staffId)) throw apiError("只能提交本人的请假申请", 403, 900);
  const staffRowsData = await loadModule(env, "hrm_staff", staffRows());
  const staff = staffRowsData.find((item) => String(item.id) === String(staffId));
  if (!staff) return fail("员工档案不存在", 404);
  if (rows.some((item) => String(item.staffId) === String(staffId) && item.status === "待审核")) return fail("已有待审批的请假申请", 409);
  const startDate = normalizeDate(params.startDate);
  const days = Number(params.days || 0);
  if (!startDate || !Number.isInteger(days) || days < 1) return fail("请填写有效的开始日期和请假天数", 400);
  if (startDate < new Date().toISOString().slice(0, 10)) return fail("不能申请过去日期的请假", 400);
  const endDate = addDays(startDate, days - 1);
  const overlaps = rows.some((item) => String(item.staffId) === String(staffId) && ["待审核", "已通过"].includes(item.status) && dateRangesOverlap(startDate, endDate, normalizeDate(item.startDate), addDays(normalizeDate(item.startDate), Number(item.days || 1) - 1)));
  if (overlaps) return fail("申请日期与已有请假记录重叠", 409);
  const policies = await loadModule(env, "hrm_leave_policy", leavePolicyRows());
  const policy = policies.find((item) => Number(item.deptId) === Number(staff.deptId) && String(item.typeNum) === String(params.typeNum));
  if (!policy || policy.status === 0 || policy.status === "0" || policy.status === false) return fail("该部门未启用此假期类型", 400);
  if (days > Number(policy.days || 0)) return fail(`${policy.typeNum}最多可申请 ${policy.days} 天`, 400);
  const record = { ...params, staffId, code: staff.code, name: staff.name, deptId: staff.deptId, deptName: staff.deptName, phone: staff.phone, startDate, days, status: "待审核", createTime: now() };
  const inserted = await requestSupabase(env, "items", "POST", {}, itemPayload("hrm_leave", record));
  return ok({ data: toLeaveView(decodeItem(inserted[0])) });
}

async function updateLeave(params, rows, env, session) {
  const previous = rows.find((item) => String(item.id) === String(params.id));
  if (!previous) return fail("请假申请不存在", 404);
  const isOwner = String(previous.staffId) === String(session.staffId);
  const nextStatus = String(params.status || previous.status);
  if (session.role === "user") {
    if (!isOwner) throw apiError("只能操作本人的请假申请", 403, 900);
    if (previous.status !== "待审核" || nextStatus !== "已撤销") return fail("待审批申请只能撤销", 400);
  } else if (previous.status !== "待审核" || !["已通过", "已驳回"].includes(nextStatus)) {
    return fail("只能审批待审核的请假申请", 400);
  }
  const record = { ...previous, status: nextStatus, auditTime: now(), auditor: session.username };
  const changed = await requestSupabase(env, "items", "PATCH", { id: `eq.${previous.id}`, module_key: "eq.hrm_leave" }, itemPayload("hrm_leave", record));
  if (nextStatus === "已通过") await applyLeaveToAttendance(record, env, session);
  return ok({ data: toLeaveView(decodeItem(changed[0])) });
}

async function deleteLeave(action, id, rows, env, session) {
  const ids = action === "batch" ? String(id || "").split(",").filter(Boolean) : [action];
  for (const itemId of ids) {
    const record = rows.find((item) => String(item.id) === String(itemId));
    if (!record) continue;
    if (session.role === "user" && String(record.staffId) !== String(session.staffId)) throw apiError("只能删除本人的请假记录", 403, 900);
    if (record.status === "待审核") return fail("待审批申请请先撤销", 400);
    if (session.role === "user" && record.status === "已通过") return fail("已批准的请假记录不能删除", 400);
    await requestSupabase(env, "items", "DELETE", { id: `eq.${record.id}`, module_key: "eq.hrm_leave" });
  }
  return ok({ data: null });
}

async function applyLeaveToAttendance(leave, env, session) {
  const start = new Date(`${normalizeDate(leave.startDate)}T00:00:00Z`);
  for (let offset = 0; offset < Number(leave.days || 0); offset += 1) {
    const date = new Date(start);
    date.setUTCDate(start.getUTCDate() + offset);
    const result = await setAttendance({ staffId: leave.staffId, attendanceDate: date.toISOString().slice(0, 10), status: "请假" }, env, session);
    if (result.code !== 200) throw apiError(result.message, result.code, result.code);
  }
}

function normalizeDate(value) {
  const match = String(value || "").trim().match(/^\d{4}-\d{2}-\d{2}/);
  if (!match || Number.isNaN(Date.parse(`${match[0]}T00:00:00Z`))) return "";
  return match[0];
}

function addDays(value, days) {
  const date = new Date(`${value}T00:00:00Z`);
  date.setUTCDate(date.getUTCDate() + Number(days || 0));
  return date.toISOString().slice(0, 10);
}

function dateRangesOverlap(leftStart, leftEnd, rightStart, rightEnd) {
  return Boolean(rightStart && rightEnd && leftStart <= rightEnd && rightStart <= leftEnd);
}

async function insurance(action, id, params, method, env, session) {
  const staffRowsData = scopeRows(await loadModule(env, "hrm_staff", staffRows()), session);
  const records = await loadModule(env, "hrm_insurance", insuranceRows());
  if (action === "staff") {
    const staff = staffRowsData.find((item) => String(item.id) === String(id || params.id));
    const record = records.find((item) => String(item.staffId) === String(id || params.id) || item.code === staff?.code);
    return ok({ data: record ? { ...staff, ...record, staffId: staff?.id || record.staffId } : null });
  }
  if (action === "set") {
    const cities = await loadModule(env, "hrm_city", cityRows());
    const city = cities.find((item) => String(item.id) === String(params.cityId));
    if (!city) return fail("社保城市不存在", 400);
    const socialBase = Number(params.socialBase || 0);
    const houseBase = Number(params.houseBase || 0);
    const record = {
      ...params,
      cityName: city.name,
      perSocialPay: (Number(city.perPensionRate || 0.08) + Number(city.perMedicalRate || 0.02) + Number(city.perUnemploymentRate || 0.005)) * socialBase,
      comSocialPay: (Number(city.comPensionRate || 0) + Number(city.comMedicalRate || 0) + Number(city.comUnemploymentRate || 0) + Number(city.comMaternityRate || 0) + Number(params.comInjuryRate || 0)) * socialBase,
      perHousePay: Number(params.perHouseRate || 0) * houseBase,
      comHousePay: Number(params.comHouseRate || 0) * houseBase,
    };
    const staff = staffRowsData.find((item) => String(item.id) === String(params.staffId));
    return upsertModuleByFields("hrm_insurance", { ...staff, ...record, staffId: Number(params.staffId) }, ["staffId"], env, session);
  }
  if (action === "page" || (method === "GET" && !/^\d+$/.test(action))) {
    const joined = staffRowsData.map((staff) => {
      const record = records.find((item) => String(item.staffId) === String(staff.id) || item.code === staff.code);
      return { ...staff, ...(record || {}), id: record?.id || staff.id, staffId: staff.id, code: staff.code, name: staff.name, deptName: staff.deptName, phone: staff.phone };
    });
    return page(filterRows(joined, params), params);
  }
  return moduleApi("hrm_insurance", action, id, params, method, env, session, insuranceRows(), true);
}

async function salary(action, id, params, method, env, session) {
  if (action === "set") {
    const insuranceRecords = await loadModule(env, "hrm_insurance", insuranceRows());
    const insurance = insuranceRecords.find((item) => String(item.staffId) === String(params.staffId));
    if (!insurance) return fail("请先为员工设置社保", 400);
    const deductions = ["lateDeduct", "leaveEarlyDeduct", "leaveDeduct", "absenteeismDeduct"].reduce((sum, key) => sum + Number(params[key] || 0), 0);
    const social = Number(insurance.perHousePay || 0) + Number(insurance.perSocialPay || insurance.total || 0);
    const record = { ...params, month: normalizeMonth(params.month), totalSalary: Number(params.baseSalary || 0) + Number(params.subsidy || 0) + Number(params.bonus || 0) - social - deductions };
    return upsertModuleByFields("hrm_salary", record, ["staffId", "month"], env, session);
  }
  if (action === "page" || (method === "GET" && !/^\d+$/.test(action))) {
    const staffRowsData = scopeRows(await loadModule(env, "hrm_staff", staffRows()), session);
    const records = await loadModule(env, "hrm_salary", salaryRows());
    const month = params.month ? normalizeMonth(params.month) : "";
    const joined = staffRowsData.map((staff) => {
      const record = records.find((item) => (String(item.staffId) === String(staff.id) || item.code === staff.code) && (!month || normalizeMonth(item.month || item.salaryMonth) === month));
      return { ...staff, ...(record || {}), id: record?.id || staff.id, staffId: staff.id, code: staff.code, name: staff.name, deptName: staff.deptName, phone: staff.phone, month: record?.month || month || normalizeMonth() };
    });
    const query = { ...params };
    delete query.month;
    return page(filterRows(joined, query), params);
  }
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
  const rows = await loadModule(env, "hrm_role", roleRows());
  if (method === "DELETE") return deleteRoles(action, id, rows, env, session);
  if (method === "POST" || method === "PUT" || method === "PATCH") {
    const validation = validateRole(params, rows);
    if (validation) return validation;
  }
  return moduleApi("hrm_role", action, id, params, method, env, session, roleRows());
}

function validateDepartment(params, rows) {
  const name = String(params.name || "").trim();
  const recordId = String(params.id || "");
  const parentId = Number(params.parentId || 0);
  if (!name) return fail("部门名称不能为空", 400);
  if (rows.some((item) => String(item.id) !== recordId && String(item.name).trim() === name)) return fail("部门名称已存在", 409);
  if (parentId && !rows.some((item) => Number(item.id) === parentId)) return fail("上级部门不存在", 400);
  if (recordId && Number(recordId) === parentId) return fail("部门不能设置为自己的上级部门", 400);
  return null;
}

async function deleteDepartments(action, id, rows, env, session) {
  requireWriteRole(session);
  const ids = action === "batch" ? String(id || "").split(",").filter(Boolean) : [action];
  const selected = new Set(ids.map(String));
  const staff = await loadModule(env, "hrm_staff", staffRows());
  for (const itemId of ids) {
    const department = rows.find((item) => String(item.id) === String(itemId));
    if (!department) continue;
    if (rows.some((item) => String(item.parentId || 0) === String(department.id) && !selected.has(String(item.id)))) return fail(`部门“${department.name}”下仍有子部门，不能删除`, 409);
    if (staff.some((item) => String(item.deptId) === String(department.id))) return fail(`部门“${department.name}”仍有员工，不能删除`, 409);
  }
  for (const itemId of ids) {
    for (const moduleKey of ["hrm_leave_policy", "hrm_salary_deduct", "hrm_overtime"]) {
      const policies = await loadModule(env, moduleKey, []);
      for (const policy of policies.filter((item) => String(item.deptId) === String(itemId))) {
        await requestSupabase(env, "items", "DELETE", { id: `eq.${policy.id}`, module_key: `eq.${moduleKey}` });
      }
    }
    await requestSupabase(env, "items", "DELETE", { id: `eq.${itemId}`, module_key: "eq.hrm_department" });
  }
  return ok({ data: null });
}

function validateCity(params, rows) {
  const name = String(params.name || "").trim();
  const recordId = String(params.id || "");
  if (!name) return fail("城市名称不能为空", 400);
  if (rows.some((item) => String(item.id) !== recordId && String(item.name).trim() === name)) return fail("城市名称已存在", 409);
  const rateFields = Object.keys(params).filter((key) => key.endsWith("Rate"));
  if (rateFields.some((key) => !Number.isFinite(Number(params[key])) || Number(params[key]) < 0 || Number(params[key]) > 1)) return fail("缴费比例必须在 0 到 1 之间", 400);
  return null;
}

async function deleteCities(action, id, rows, env, session) {
  requireWriteRole(session);
  const ids = action === "batch" ? String(id || "").split(",").filter(Boolean) : [action];
  const insurance = await loadModule(env, "hrm_insurance", insuranceRows());
  for (const itemId of ids) {
    const city = rows.find((item) => String(item.id) === String(itemId));
    if (!city) continue;
    if (insurance.some((item) => String(item.cityId) === String(city.id))) return fail(`城市“${city.name}”仍被社保记录使用，不能删除`, 409);
  }
  for (const itemId of ids) await requestSupabase(env, "items", "DELETE", { id: `eq.${itemId}`, module_key: "eq.hrm_city" });
  return ok({ data: null });
}

function validateRole(params, rows) {
  const name = String(params.name || "").trim();
  const code = String(params.code || "").trim();
  const recordId = String(params.id || "");
  if (!name || !code) return fail("角色名称和编号不能为空", 400);
  if (rows.some((item) => String(item.id) !== recordId && String(item.name).trim() === name)) return fail("角色名称已存在", 409);
  if (rows.some((item) => String(item.id) !== recordId && String(item.code).trim() === code)) return fail("角色编号已存在", 409);
  return null;
}

async function deleteRoles(action, id, rows, env, session) {
  requireWriteRole(session);
  const ids = action === "batch" ? String(id || "").split(",").filter(Boolean) : [action];
  for (const itemId of ids) {
    const role = rows.find((item) => String(item.id) === String(itemId));
    if (!role) continue;
    if (["admin", "hr", "employee"].includes(String(role.code))) return fail(`系统内置角色“${role.name}”不能删除`, 409);
    const assignments = await requestSupabase(env, "staff_roles", "GET", { role_id: `eq.${role.id}`, limit: "1" });
    if (assignments.length) return fail(`角色“${role.name}”仍有员工使用，不能删除`, 409);
  }
  for (const itemId of ids) {
    await requestSupabase(env, "role_menus", "DELETE", { role_id: `eq.${itemId}` });
    await requestSupabase(env, "items", "DELETE", { id: `eq.${itemId}`, module_key: "eq.hrm_role" });
  }
  return ok({ data: null });
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

async function createStaff(params, env, session) {
  requireWriteRole(session);
  const code = String(params.code || "").trim();
  const password = String(params.password || "");
  if (!code || !params.name) return fail("工号和姓名不能为空", 400);
  if (password.length < 6) return fail("初始密码至少 6 位", 400);
  const existing = await requestSupabase(env, "accounts", "GET", { username: `eq.${code}`, limit: "1" });
  if (existing.length) return fail("工号已存在", 409);
  const departmentRecords = await loadModule(env, "hrm_department", departments());
  const dept = departmentRecords.find((item) => Number(item.id) === Number(params.deptId));
  const record = { ...params, deptName: dept?.name || params.deptName || "" };
  delete record.password;
  const inserted = await requestSupabase(env, "items", "POST", {}, itemPayload("hrm_staff", record));
  const staff = decodeItem(inserted[0]);
  const salt = randomSalt();
  await requestSupabase(env, "accounts", "POST", {}, { role: "user", username: code, password_hash: await hashPassword(password, salt), password_salt: salt, display_name: String(params.name) });
  await requestSupabase(env, "staff_roles", "POST", {}, { staff_id: Number(staff.id), role_id: 3 });
  return ok({ data: staff });
}

async function updateStaff(params, env, session) {
  const rows = await loadModule(env, "hrm_staff", staffRows());
  const previous = rows.find((item) => String(item.id) === String(params.id));
  if (!previous) return fail("员工不存在", 404);
  const isSelf = String(previous.id) === String(session.staffId);
  if (session.role === "user" && !isSelf) throw apiError("只能修改本人资料", 403, 900);
  if (session.role === "user") params = { ...previous, ...pick(params, ["id", "name", "birthday", "gender", "phone", "address", "remark", "avatar"]), code: previous.code, deptId: previous.deptId, deptName: previous.deptName, status: previous.status };
  const duplicate = rows.find((item) => item.code === params.code && String(item.id) !== String(params.id));
  if (duplicate) return fail("工号已存在", 409);
  const departmentRecords = await loadModule(env, "hrm_department", departments());
  const dept = departmentRecords.find((item) => Number(item.id) === Number(params.deptId));
  const record = { ...params, deptName: dept?.name || params.deptName || previous.deptName };
  delete record.password;
  const changed = await requestSupabase(env, "items", "PATCH", { id: `eq.${record.id}`, module_key: "eq.hrm_staff" }, itemPayload("hrm_staff", record));
  const accounts = await requestSupabase(env, "accounts", "GET", { username: `eq.${previous.code}`, limit: "1" });
  if (accounts.length) await requestSupabase(env, "accounts", "PATCH", { id: `eq.${accounts[0].id}` }, { username: record.code, display_name: record.name });
  return ok({ data: decodeItem(changed[0]) });
}

async function deleteStaff(action, id, env, session) {
  requireWriteRole(session);
  const ids = action === "batch" ? String(id || "").split(",").filter(Boolean) : [action];
  const rows = await loadModule(env, "hrm_staff", staffRows());
  for (const staffId of ids) {
    const staff = rows.find((item) => String(item.id) === String(staffId));
    if (!staff) continue;
    if (staff.code === session.username) throw apiError("不能删除当前登录账号", 400, 400);
    await requestSupabase(env, "accounts", "DELETE", { username: `eq.${staff.code}` });
    await requestSupabase(env, "staff_roles", "DELETE", { staff_id: `eq.${staff.id}` });
    if (staff.avatar) await requestSupabase(env, "files", "DELETE", { name: `eq.${staff.avatar}` });
    for (const moduleKey of ["hrm_attendance", "hrm_insurance", "hrm_salary", "hrm_leave"]) {
      const moduleRows = await loadModule(env, moduleKey, []);
      for (const row of moduleRows.filter((item) => String(item.staffId) === String(staff.id) || item.code === staff.code)) {
        await requestSupabase(env, "items", "DELETE", { id: `eq.${row.id}`, module_key: `eq.${moduleKey}` });
      }
    }
    await requestSupabase(env, "items", "DELETE", { id: `eq.${staff.id}`, module_key: "eq.hrm_staff" });
  }
  return ok({ data: null });
}

async function policyApi(moduleKey, seeds, action, id, tail, params, method, env, session) {
  const rows = await loadModule(env, moduleKey, seeds);
  if (action === "all") return ok({ data: uniquePolicyTypes(rows) });
  if (action === "dept") return ok({ data: rows.filter((item) => Number(item.deptId) === Number(id)) });
  if (action === "set") return upsertModuleByFields(moduleKey, params, ["deptId", "typeNum"], env, session);
  if (method === "GET" && /^\d+$/.test(action)) {
    const typeNum = decodeURIComponent(id || tail[0] || "");
    const row = rows.find((item) => Number(item.deptId) === Number(action) && String(item.typeNum) === typeNum);
    return row ? ok({ data: row }) : fail("配置不存在", 404);
  }
  return fail("不支持的配置操作", 400);
}

async function upsertModuleByFields(moduleKey, params, fields, env, session) {
  requireWriteRole(session);
  const rows = await loadModule(env, moduleKey, []);
  const existing = rows.find((row) => fields.every((field) => String(row[field] ?? "") === String(params[field] ?? "")));
  if (existing) {
    const record = { ...existing, ...params, id: existing.id };
    const changed = await requestSupabase(env, "items", "PATCH", { id: `eq.${existing.id}`, module_key: `eq.${moduleKey}` }, itemPayload(moduleKey, record));
    return ok({ data: decodeItem(changed[0]) });
  }
  const inserted = await requestSupabase(env, "items", "POST", {}, itemPayload(moduleKey, params));
  return ok({ data: decodeItem(inserted[0]) });
}

async function attendanceDetail(env, staffId, date, session) {
  if (session.role === "user" && String(staffId) !== String(session.staffId)) throw apiError("只能查看本人考勤", 403, 900);
  const rows = await loadModule(env, "hrm_attendance", attendanceRows());
  const staff = rows.find((item) => String(item.staffId) === String(staffId));
  const day = staff?.attendanceList?.find((item) => item.attendanceDate === date);
  return day ? { staffId: Number(staffId), attendanceDate: date, status: day.message, message: day.message } : null;
}

async function setAttendance(params, env, session) {
  requireWriteRole(session);
  const rows = await loadModule(env, "hrm_attendance", attendanceRows());
  const staff = (await loadModule(env, "hrm_staff", staffRows())).find((item) => String(item.id) === String(params.staffId));
  const row = rows.find((item) => String(item.staffId) === String(params.staffId) || item.code === staff?.code);
  if (!staff) return fail("员工档案不存在", 404);
  const status = params.status || params.message;
  const attendanceList = [...(row?.attendanceList || attendanceDays())];
  const index = attendanceList.findIndex((item) => item.attendanceDate === params.attendanceDate);
  const value = { attendanceDate: params.attendanceDate, message: status, tagType: attendanceTag(status) };
  if (index >= 0) attendanceList.splice(index, 1, value); else attendanceList.push(value);
  attendanceList.sort((left, right) => left.attendanceDate.localeCompare(right.attendanceDate));
  const record = { ...(row || {}), ...staff, staffId: staff.id, attendanceList };
  const changed = row
    ? await requestSupabase(env, "items", "PATCH", { id: `eq.${row.id}`, module_key: "eq.hrm_attendance" }, itemPayload("hrm_attendance", record))
    : await requestSupabase(env, "items", "POST", {}, itemPayload("hrm_attendance", record));
  return ok({ data: decodeItem(changed[0]) });
}

async function docs(action, id, params, method, env, session) {
  if (method === "DELETE") {
    requireWriteRole(session);
    const ids = action === "batch" ? String(id || "").split(",").filter(Boolean) : [action];
    const rows = await loadModule(env, "hrm_docs", docsRows());
    for (const itemId of ids) {
      const doc = rows.find((item) => String(item.id) === String(itemId));
      if (doc?.name) await requestSupabase(env, "files", "DELETE", { name: `eq.${doc.name}` });
      await requestSupabase(env, "items", "DELETE", { id: `eq.${itemId}`, module_key: "eq.hrm_docs" });
    }
    return ok({ data: null });
  }
  return moduleApi("hrm_docs", action, id, params, method, env, session, docsRows());
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
  return [];
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
  const staff = (await loadModule(env, "hrm_staff", staffRows())).find((item) => String(item.id) === String(staffId));
  if (!staff) return null;
  const rows = await requestSupabase(env, "accounts", "GET", { username: `eq.${staff.code}`, limit: "1" });
  return rows[0] || null;
}

function roleIdForAccount(role) { return role === "admin" ? 1 : role === "staff" ? 2 : 3; }
function attendanceTag(status) { return status === "正常" ? "success" : status === "请假" ? "info" : status === "旷工" ? "danger" : "warning"; }
function attendanceStatusRows() { return ["正常", "迟到", "早退", "请假", "旷工"].map((message, index) => ({ id: index + 1, message, tagType: attendanceTag(message) })); }
function normalizeMonth(value) { const text=String(value || new Date().toISOString().slice(0,7)).replace(/-/g, ""); return text.length >= 6 ? text.slice(0,6) : new Date().toISOString().slice(0,7).replace("-", ""); }
function daysInMonth(value) { const month=normalizeMonth(value); return new Date(Number(month.slice(0,4)), Number(month.slice(4,6)), 0).getDate(); }
function uniquePolicyTypes(rows) { const seen=new Set(); return rows.filter((row) => { const key=String(row.typeNum); if(seen.has(key)) return false; seen.add(key); return true; }).map(({ id, deptId, ...row }) => row); }
function departmentTree(rows) {
  const map = new Map(rows.map((row) => [Number(row.id), { ...row, children: [] }]));
  const roots = [];
  for (const row of map.values()) {
    const parent = map.get(Number(row.parentId));
    if (parent && Number(row.parentId) !== 0) parent.children.push(row); else roots.push(row);
  }
  return roots;
}

async function menusForSession(env, session) {
  const tree = await currentMenuTree(env);
  if (session.role === "admin") return tree;
  const relations = await requestSupabase(env, "staff_roles", "GET", { staff_id: `eq.${session.staffId}` });
  const allowed = new Set();
  for (const relation of relations) {
    const menus = await requestSupabase(env, "role_menus", "GET", { role_id: `eq.${relation.role_id}` });
    menus.forEach((item) => allowed.add(Number(item.menu_id)));
  }
  return tree.filter((item) => allowed.has(item.id) || item.children.some((child) => allowed.has(child.id))).map((item) => ({
    ...item,
    children: item.children.filter((child) => allowed.has(child.id)),
  }));
}

async function currentMenuTree(env) {
  const stored = await loadModule(env, "hrm_menu", flattenMenus(menuTree()));
  const byCode = new Map(stored.map((item) => [item.code, item]));
  const merge = item => {
    const saved = byCode.get(item.code);
    if (saved && (saved.status === 0 || saved.status === "0" || saved.status === false || saved.status === "停用")) return null;
    const merged = { ...item, ...(saved || {}), id: item.id, children: [] };
    merged.children = (item.children || []).map(merge).filter(Boolean);
    return merged;
  };
  return menuTree().map(merge).filter(Boolean);
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
  if (!records.length) throw apiError("CSV 文件没有可导入数据", 400, 400);
  const required = { staff: ["code", "name", "password"], attendance: ["staffId", "attendanceDate", "status"], department: ["name"], dept: ["name"], city: ["name"], insurance: ["staffId"], salary: ["staffId", "month"] }[root] || [];
  records.forEach((record, index) => {
    const missing = required.filter((field) => String(record[field] || "").trim() === "");
    if (missing.length) throw apiError(`第 ${index + 2} 行缺少字段：${missing.join(", ")}`, 400, 400);
  });
  if (root === "staff") {
    for (const record of records) {
      const result = await createStaff(record, env, session);
      if (result.code !== 200) throw apiError(result.message, result.code, result.code);
    }
  } else if (root === "attendance") {
    for (const record of records) {
      const result = await setAttendance(record, env, session);
      if (result.code !== 200) throw apiError(result.message, result.code, result.code);
    }
  } else {
    for (const record of records) await requestSupabase(env, "items", "POST", {}, itemPayload(definition[0], record));
  }
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

async function uploadAvatar(request, env, session) {
  const form = await request.formData();
  const file = form.get("file");
  if (!file || file.size > 2 * 1024 * 1024 || !["image/png", "image/jpeg"].includes(file.type)) throw apiError("头像仅支持 2MB 内的 PNG/JPG", 400, 400);
  const rows = await loadModule(env, "hrm_staff", staffRows());
  const staff = rows.find((item) => String(item.id) === String(session.staffId));
  if (!staff) throw apiError("员工档案不存在", 404, 404);
  const name = `avatar-${staff.id}-${Date.now()}.${file.type === "image/png" ? "png" : "jpg"}`;
  const bytes = new Uint8Array(await file.arrayBuffer());
  await requestSupabase(env, "files", "POST", {}, { name, original_name: file.name, content_type: file.type, size: file.size, content_base64: bytesToBase64(bytes), uploader: session.username });
  if (staff.avatar) await requestSupabase(env, "files", "DELETE", { name: `eq.${staff.avatar}` });
  const record = { ...staff, avatar: name };
  await requestSupabase(env, "items", "PATCH", { id: `eq.${staff.id}`, module_key: "eq.hrm_staff" }, itemPayload("hrm_staff", record));
  return json(request, env, ok({ data: { name } }));
}

async function publicAvatar(request, env, name) {
  if (!/^avatar-[\w.-]+$/.test(name)) return new Response("Not found", { status: 404 });
  const rows = await requestSupabase(env, "files", "GET", { name: `eq.${name}`, limit: "1" });
  if (!rows.length || !String(rows[0].content_type).startsWith("image/")) return new Response("Not found", { status: 404 });
  return new Response(base64ToBytes(rows[0].content_base64), { headers: { "Content-Type": rows[0].content_type, "Cache-Control": "public, max-age=3600", ...corsHeaders(request, env) } });
}

function pick(value, keys) { return Object.fromEntries(keys.filter((key) => Object.prototype.hasOwnProperty.call(value || {}, key)).map((key) => [key, value[key]])); }

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
    { id: 1, name: "上海", perPensionRate: 0.08, perMedicalRate: 0.02, perUnemploymentRate: 0.005, comPensionRate: 0.16, comMedicalRate: 0.095, comUnemploymentRate: 0.005, comMaternityRate: 0.01 },
    { id: 2, name: "杭州", perPensionRate: 0.08, perMedicalRate: 0.02, perUnemploymentRate: 0.005, comPensionRate: 0.15, comMedicalRate: 0.09, comUnemploymentRate: 0.005, comMaternityRate: 0.008 },
    { id: 3, name: "南京", perPensionRate: 0.08, perMedicalRate: 0.02, perUnemploymentRate: 0.004, comPensionRate: 0.16, comMedicalRate: 0.085, comUnemploymentRate: 0.004, comMaternityRate: 0.009 },
  ];
}

function attendanceDays() {
  const labels = ["正常", "正常", "迟到", "正常", "请假", "正常", "早退"];
  const month = new Date().toISOString().slice(0, 7);
  return Array.from({ length: daysInMonth(month) }, (_, index) => ({
    attendanceDate: `${month}-${String(index + 1).padStart(2, "0")}`,
    message: labels[index % labels.length],
    tagType: attendanceTag(labels[index % labels.length]),
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
      remark: "员工请假记录",
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
    { id: 1, name: "系统管理员", code: "admin", remark: "拥有全部系统权限" },
    { id: 2, name: "人事专员", code: "hr", remark: "管理人员与考勤薪资" },
    { id: 3, name: "普通员工", code: "employee", remark: "查看个人信息" },
  ];
}

function leavePolicyRows() {
  return departments().flatMap((dept) => [
    { deptId: dept.id, typeNum: "年假", days: 5, status: 1 },
    { deptId: dept.id, typeNum: "事假", days: 3, status: 1 },
    { deptId: dept.id, typeNum: "病假", days: 10, status: 1 },
  ]);
}

function salaryDeductRows() {
  return departments().flatMap((dept) => [
    { deptId: dept.id, typeNum: "迟到", deduct: 50, status: 1 },
    { deptId: dept.id, typeNum: "早退", deduct: 50, status: 1 },
    { deptId: dept.id, typeNum: "旷工", deduct: 300, status: 1 },
  ]);
}

function overtimeRows() {
  return departments().flatMap((dept) => [
    { deptId: dept.id, typeNum: "工作日加班", code: "工作日加班", countType: 0, timeOffFlag: 0, bonus: 100, salaryMultiple: 1.5, status: 1 },
    { deptId: dept.id, typeNum: "周末加班", code: "周末加班", countType: 0, timeOffFlag: 0, bonus: 200, salaryMultiple: 2, status: 1 },
    { deptId: dept.id, typeNum: "法定节假日", code: "法定节假日", countType: 0, timeOffFlag: 0, bonus: 300, salaryMultiple: 3, status: 1 },
  ]);
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
  const response = await fetch(`${base.replace(/\/$/, "")}/rest/v1/rpc/${schema(env)}_rest`, {
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

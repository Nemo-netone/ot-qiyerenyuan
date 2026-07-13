from playwright.sync_api import sync_playwright
import json
import time

BASE_URL = "https://ot-qiyerenyuan.pages.dev"


def api_json(response):
    return response.json()


def run():
    results = {}
    with sync_playwright() as playwright:
        request = playwright.request.new_context(base_url=BASE_URL)
        unauthorized = request.post("/staff/page", data={"current": 1, "size": 10})
        results["unauthorized"] = unauthorized.status == 401

        login = api_json(request.post("/login", data={"code": "admin", "password": "123456"}))
        token = login["token"]
        headers = {"token": token}
        code = f"e2e-{int(time.time())}"
        created = api_json(request.post("/staff", headers=headers, data={
            "code": code,
            "name": "端到端验收员工",
            "gender": "女",
            "phone": "13900009999",
            "birthday": "1998-01-01",
            "address": "苏州",
            "deptId": 2,
            "deptName": "人力资源部",
            "status": "正常",
        }))["data"]
        listing = api_json(request.post("/staff/page", headers=headers, data={"current": 1, "size": 100}))
        results["create_persisted"] = any(row.get("code") == code for row in listing["data"]["list"])
        created["name"] = "端到端验收员工-已修改"
        updated = api_json(request.put("/staff", headers=headers, data=created))["data"]
        results["update_persisted"] = updated.get("name", "").endswith("已修改")
        request.delete(f"/staff/{created['id']}", headers=headers)
        after = api_json(request.post("/staff/page", headers=headers, data={"current": 1, "size": 100}))
        results["delete_persisted"] = not any(row.get("code") == code for row in after["data"]["list"])

        user = api_json(request.post("/login", data={"code": "employee01", "password": "123456"}))
        denied = request.post("/staff", headers={"token": user["token"]}, data={"code": "denied", "name": "denied"})
        results["role_write_denied"] = denied.status == 403

        browser = playwright.chromium.launch(headless=True)
        page = browser.new_page(viewport={"width": 1440, "height": 1000})
        browser_errors = []
        page.on("pageerror", lambda error: browser_errors.append(str(error)))
        page.goto(BASE_URL, wait_until="networkidle")
        page.locator("input").nth(0).fill("admin")
        page.locator("input").nth(1).fill("123456")
        page.get_by_role("button").last.click()
        page.wait_for_url("**/home")
        page.wait_for_timeout(700)
        groups = [
            ("系统管理", [("员工管理", "/system/staff"), ("部门管理", "/system/department"), ("文档管理", "/system/docs")]),
            ("考勤管理", [("考勤统计", "/attendance/performance"), ("请假审批", "/attendance/leave")]),
            ("薪资社保", [("城市社保", "/money/city"), ("社保管理", "/money/insurance"), ("薪资管理", "/money/salary")]),
            ("权限管理", [("角色管理", "/permission/role"), ("菜单管理", "/permission/menu")]),
        ]
        page_results = {}
        for parent, children in groups:
            sidebar = page.locator(".el-menu")
            first_child = sidebar.get_by_text(children[0][0], exact=True)
            if not first_child.is_visible():
                sidebar.get_by_text(parent, exact=True).click()
                page.wait_for_timeout(120)
            for child, route in children:
                child_link = sidebar.get_by_text(child, exact=True)
                if not child_link.is_visible():
                    sidebar.get_by_text(parent, exact=True).click()
                    page.wait_for_timeout(120)
                child_link.click()
                page.wait_for_timeout(1200)
                body = page.locator("body").inner_text()
                rows = page.locator(".el-table__body-wrapper tbody tr").count()
                page_results[route] = page.url.endswith(route) and len(body) > 140 and rows > 0
        results["page_results"] = page_results
        results["all_pages_render"] = all(page_results.values())
        results["browser_errors"] = browser_errors
        results["demo_notice"] = "作品集演示模式" in page.locator("body").inner_text()

        mobile = browser.new_page(viewport={"width": 390, "height": 844})
        mobile.goto(BASE_URL, wait_until="networkidle")
        mobile.locator("input").nth(0).fill("admin")
        mobile.locator("input").nth(1).fill("123456")
        mobile.get_by_role("button").last.click()
        mobile.wait_for_url("**/home")
        mobile.wait_for_timeout(500)
        results["mobile"] = {
            "aside_collapsed": mobile.locator(".el-aside").bounding_box()["width"] == 64,
            "tags_hidden": not mobile.locator(".tag").is_visible(),
            "no_overflow": mobile.evaluate("document.documentElement.scrollWidth === document.documentElement.clientWidth"),
        }
        browser.close()
        request.dispose()
    return results


if __name__ == "__main__":
    report = run()
    print(json.dumps(report, ensure_ascii=False, indent=2))
    checks = [value for key, value in report.items() if isinstance(value, bool)]
    checks.extend(report["mobile"].values())
    if not all(checks) or report["browser_errors"]:
        raise SystemExit(1)

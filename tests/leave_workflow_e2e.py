import json
from datetime import date, timedelta

from playwright.sync_api import sync_playwright


BASE_URL = "https://ot-qiyerenyuan.pages.dev"


def api_json(response):
    payload = response.json()
    if response.status >= 400 or payload.get("code") != 200:
        raise AssertionError(f"{response.status} {payload}")
    return payload


with sync_playwright() as playwright:
    request = playwright.request.new_context(base_url=BASE_URL)
    admin = api_json(request.post("/login", data={"code": "admin", "password": "123456"}))
    employee = api_json(request.post("/login", data={"code": "employee01", "password": "123456"}))
    admin_headers = {"token": admin["token"]}
    employee_headers = {"token": employee["token"]}
    staff_id = employee["data"]["id"]
    start_date = (date.today() + timedelta(days=10)).isoformat()

    pending = api_json(request.get(f"/staff-leave/staff/{staff_id}", headers=employee_headers))
    assert pending["data"] is None

    created = api_json(request.post("/staff-leave", headers=employee_headers, data={
        "staffId": staff_id,
        "typeNum": "年假",
        "startDate": start_date,
        "days": 2,
        "remark": "请假流程自动化验收",
    }))["data"]["staffLeave"]
    assert created["status"] == "待审核"

    duplicate = request.post("/staff-leave", headers=employee_headers, data={
        "staffId": staff_id,
        "typeNum": "年假",
        "startDate": start_date,
        "days": 1,
    })
    assert duplicate.json()["code"] == 409

    approved = api_json(request.put("/staff-leave", headers=admin_headers, data={"id": created["id"], "status": "已通过"}))["data"]["staffLeave"]
    assert approved["status"] == "已通过"

    second_date = (date.fromisoformat(start_date) + timedelta(days=1)).isoformat()
    for attendance_date in (start_date, second_date):
        attendance = api_json(request.get(f"/attendance/staff/{staff_id}/{attendance_date}", headers=employee_headers))["data"]
        assert attendance["status"] == "请假"

    approved_delete = request.delete(f"/staff-leave/{created['id']}", headers=employee_headers)
    assert approved_delete.json()["code"] == 400
    for attendance_date in (start_date, second_date):
        api_json(request.put("/attendance/set", headers=admin_headers, data={
            "staffId": staff_id,
            "attendanceDate": attendance_date,
            "status": "正常",
        }))
    api_json(request.delete(f"/staff-leave/{created['id']}", headers=admin_headers))

    cancelled = api_json(request.post("/staff-leave", headers=employee_headers, data={
        "staffId": staff_id,
        "typeNum": "事假",
        "startDate": start_date,
        "days": 1,
    }))["data"]["staffLeave"]
    cancelled = api_json(request.put("/staff-leave", headers=employee_headers, data={
        "id": cancelled["id"],
        "status": "已撤销",
    }))["data"]["staffLeave"]
    assert cancelled["status"] == "已撤销"
    api_json(request.delete(f"/staff-leave/{cancelled['id']}", headers=employee_headers))

    rejected = api_json(request.post("/staff-leave", headers=employee_headers, data={
        "staffId": staff_id,
        "typeNum": "病假",
        "startDate": start_date,
        "days": 1,
    }))["data"]["staffLeave"]
    rejected = api_json(request.put("/staff-leave", headers=admin_headers, data={
        "id": rejected["id"],
        "status": "已驳回",
    }))["data"]["staffLeave"]
    assert rejected["status"] == "已驳回"
    api_json(request.delete(f"/staff-leave/{rejected['id']}", headers=employee_headers))

    listing = api_json(request.get("/staff-leave/staff", headers=employee_headers, params={"current": 1, "size": 100}))
    deleted_ids = {created["id"], cancelled["id"], rejected["id"]}
    assert all(row["staffLeave"]["id"] not in deleted_ids for row in listing["data"]["list"])

    print(json.dumps({"leave_workflow": True, "staff_id": staff_id, "dates": [start_date, second_date]}, ensure_ascii=False))
    request.dispose()

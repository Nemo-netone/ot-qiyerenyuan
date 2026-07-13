import json
import time

from playwright.sync_api import sync_playwright


BASE_URL = "https://ot-qiyerenyuan.pages.dev"


def payload(response):
    return response.json()


def success(response):
    data = payload(response)
    assert data["code"] == 200, data
    return data


with sync_playwright() as playwright:
    request = playwright.request.new_context(base_url=BASE_URL)
    login = success(request.post("/login", data={"code": "admin", "password": "123456"}))
    headers = {"token": login["token"]}
    suffix = str(int(time.time()))
    created_staff = []
    created_departments = []
    created_cities = []
    created_roles = []

    try:
        department = success(request.post("/department", headers=headers, data={"name": f"完整性部门-{suffix}", "parentId": 0}))["data"]
        created_departments.append(department["id"])
        duplicate_department = payload(request.post("/department", headers=headers, data={"name": department["name"], "parentId": 0}))
        assert duplicate_department["code"] == 409

        child_department = success(request.post("/department", headers=headers, data={
            "name": f"完整性子部门-{suffix}",
            "parentId": department["id"],
        }))["data"]
        created_departments.append(child_department["id"])
        assert payload(request.delete(f"/department/{department['id']}", headers=headers))["code"] == 409
        success(request.delete(f"/department/{child_department['id']}", headers=headers))
        created_departments.remove(child_department["id"])

        staff = success(request.post("/staff", headers=headers, data={
            "code": f"integrity-{suffix}",
            "password": "Integrity123",
            "name": "完整性测试员工",
            "deptId": department["id"],
            "status": "正常",
        }))["data"]
        created_staff.append(staff["id"])
        assert payload(request.delete(f"/department/{department['id']}", headers=headers))["code"] == 409
        success(request.delete(f"/staff/{staff['id']}", headers=headers))
        created_staff.remove(staff["id"])
        success(request.post("/leave/set", headers=headers, data={
            "deptId": department["id"],
            "typeNum": "年假",
            "days": 7,
            "status": 1,
        }))
        success(request.delete(f"/department/{department['id']}", headers=headers))
        created_departments.remove(department["id"])
        assert payload(request.get(f"/leave/{department['id']}/%E5%B9%B4%E5%81%87", headers=headers))["code"] == 404

        city = success(request.post("/city", headers=headers, data={
            "name": f"完整性城市-{suffix}",
            "perPensionRate": 0.08,
            "perMedicalRate": 0.02,
            "perUnemploymentRate": 0.005,
            "comPensionRate": 0.16,
            "comMedicalRate": 0.09,
            "comUnemploymentRate": 0.005,
            "comMaternityRate": 0.01,
        }))["data"]
        created_cities.append(city["id"])
        assert payload(request.post("/city", headers=headers, data={"name": city["name"]}))["code"] == 409
        assert payload(request.post("/city", headers=headers, data={"name": f"错误比例-{suffix}", "perPensionRate": 1.5}))["code"] == 400

        staff = success(request.post("/staff", headers=headers, data={
            "code": f"insurance-{suffix}",
            "password": "Integrity123",
            "name": "社保引用测试员工",
            "deptId": 20,
            "status": "正常",
        }))["data"]
        created_staff.append(staff["id"])
        success(request.post("/insurance/set", headers=headers, data={
            "staffId": staff["id"],
            "cityId": city["id"],
            "socialBase": 5000,
            "houseBase": 5000,
            "perHouseRate": 0.07,
            "comHouseRate": 0.07,
        }))
        assert payload(request.delete(f"/city/{city['id']}", headers=headers))["code"] == 409
        success(request.delete(f"/staff/{staff['id']}", headers=headers))
        created_staff.remove(staff["id"])
        success(request.delete(f"/city/{city['id']}", headers=headers))
        created_cities.remove(city["id"])

        role = success(request.post("/role", headers=headers, data={"name": f"完整性角色-{suffix}", "code": f"integrity-{suffix}"}))["data"]
        created_roles.append(role["id"])
        assert payload(request.post("/role", headers=headers, data={"name": role["name"], "code": f"other-{suffix}"}))["code"] == 409
        built_in_roles = success(request.get("/role/all", headers=headers))["data"]
        admin_role = next(item for item in built_in_roles if item["code"] == "admin")
        assert payload(request.delete(f"/role/{admin_role['id']}", headers=headers))["code"] == 409
        success(request.post(f"/role/menu/{role['id']}", headers=headers, data=[11]))

        staff = success(request.post("/staff", headers=headers, data={
            "code": f"role-user-{suffix}",
            "password": "Integrity123",
            "name": "角色引用测试员工",
            "deptId": 20,
            "status": "正常",
        }))["data"]
        created_staff.append(staff["id"])
        success(request.post(f"/staff/role/{staff['id']}", headers=headers, data=[role["id"]]))
        assert payload(request.delete(f"/role/{role['id']}", headers=headers))["code"] == 409
        success(request.delete(f"/staff/{staff['id']}", headers=headers))
        created_staff.remove(staff["id"])
        success(request.delete(f"/role/{role['id']}", headers=headers))
        created_roles.remove(role["id"])
        assert success(request.get(f"/role/menu/{role['id']}", headers=headers))["data"] == []

        print(json.dumps({"data_integrity": True, "department": True, "city": True, "role": True}, ensure_ascii=False))
    finally:
        for staff_id in created_staff:
            request.delete(f"/staff/{staff_id}", headers=headers)
        for role_id in created_roles:
            request.delete(f"/role/{role_id}", headers=headers)
        for city_id in created_cities:
            request.delete(f"/city/{city_id}", headers=headers)
        for department_id in created_departments:
            request.delete(f"/department/{department_id}", headers=headers)
        request.dispose()

window.PROJECT_CONFIG = {
  "title": "企业人员与人力资源管理系统",
  "positioning": "覆盖员工、部门、考勤、请假、薪资和权限的人力资源管理演示系统。",
  "schema": "hrm_qiyerenyuan",
  "colors": {
    "primary": "#1d4ed8",
    "secondary": "#0f766e",
    "accent": "#d97706"
  },
  "repo": "ot-qiyerenyuan",
  "demoUrl": "https://ot-qiyerenyuan.pages.dev",
  "githubUrl": "https://github.com/Nemo-netone/ot-qiyerenyuan",
  "accounts": [
    {
      "role": "admin",
      "username": "admin",
      "password": "123456",
      "label": "系统管理员"
    },
    {
      "role": "user",
      "username": "employee01",
      "password": "123456",
      "label": "普通员工"
    },
    {
      "role": "staff",
      "username": "hr01",
      "password": "123456",
      "label": "人事专员"
    }
  ],
  "modules": [
    {
      "key": "employee",
      "name": "员工管理",
      "summary": "员工档案、岗位、入职和在职状态"
    },
    {
      "key": "department",
      "name": "部门管理",
      "summary": "组织部门、负责人和人员编制"
    },
    {
      "key": "attendance",
      "name": "考勤管理",
      "summary": "打卡、迟到、缺勤和考勤统计"
    },
    {
      "key": "leave",
      "name": "请假审批",
      "summary": "请假申请、审批流程和状态跟踪"
    },
    {
      "key": "salary",
      "name": "薪资管理",
      "summary": "工资、社保、绩效和发放记录"
    },
    {
      "key": "permission",
      "name": "权限管理",
      "summary": "角色、菜单和系统访问权限"
    }
  ]
};

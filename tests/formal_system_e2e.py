import requests, io, time, json
base='https://ot-qiyerenyuan.pages.dev'
def login(code,pwd='123456'):
 r=requests.post(base+'/login',json={'code':code,'password':pwd},timeout=30); print('login',code,r.status_code,r.text[:180]); assert r.status_code==200 and r.json()['code']==200; return r.json()
def api(token,method,path,**kwargs):
 r=requests.request(method,base+path,headers={'token':token},timeout=30,**kwargs); print(method,path,r.status_code,r.text[:160] if 'json' in r.headers.get('content-type','') else r.headers.get('content-type')); return r
admin=login('admin'); token=admin['token']
# policies
for root,payload in [('leave',{'deptId':20,'typeNum':'年假','days':8,'status':1}),('salary-deduct',{'deptId':20,'typeNum':'迟到','deduct':88,'status':1}),('overtime',{'deptId':20,'typeNum':'工作日加班','code':'工作日加班','bonus':188,'salaryMultiple':1.5,'countType':0,'timeOffFlag':0,'status':1})]:
 assert api(token,'POST',f'/{root}/set',json=payload).json()['code']==200
 got=api(token,'GET',f'/{root}/20/{requests.utils.quote(payload["typeNum"])}').json(); assert got['code']==200
# create employee account
code='formal-'+str(int(time.time())); pwd='Abc12345'; staff_payload={'code':code,'password':pwd,'name':'正式系统测试员工','gender':'女','phone':'13900001234','birthday':'1998-01-01','address':'上海','deptId':20,'status':'正常'}
created=api(token,'POST','/staff',json=staff_payload).json(); assert created['code']==200,created; staff=created['data']; sid=staff['id']; print('staff',sid)
user=login(code,pwd); assert user['data']['id']==sid
# attendance detail update
att={'staffId':sid,'attendanceDate':'2026-07-13','status':'迟到'}; assert api(token,'PUT','/attendance/set',json=att).json()['code']==200
assert api(token,'GET',f'/attendance/staff/{sid}/2026-07-13').json()['data']['status']=='迟到'
# user self profile
ut=user['token']; updated={**user['data'],'phone':'13900004321'}; assert api(ut,'PUT','/staff',json=updated).json()['code']==200
# avatar
png=b'\x89PNG\r\n\x1a\n'+b'0'*32
up=api(ut,'POST','/staff/avatar',files={'file':('avatar.png',png,'image/png')}).json(); assert up['code']==200; avatar=up['data']['name']; pub=requests.get(base+'/staff/avatar/'+avatar,timeout=30); assert pub.status_code==200 and pub.content==png
# insurance and salary
cities=api(token,'GET','/city/all').json()['data']; assert cities; city_id=cities[0]['id']
ins={'staffId':sid,'cityId':city_id,'socialBase':8000,'houseBase':8000,'comInjuryRate':0.005,'perHouseRate':0.07,'comHouseRate':0.07}; ir=api(token,'POST','/insurance/set',json=ins).json(); print('insurance',ir); assert ir['code']==200
sal={'staffId':sid,'month':'202607','baseSalary':10000,'subsidy':500,'bonus':300,'lateDeduct':88,'leaveEarlyDeduct':0,'leaveDeduct':0,'absenteeismDeduct':0}; sr=api(token,'POST','/salary/set',json=sal).json(); print('salary',sr); assert sr['code']==200 and 'totalSalary' in sr['data']
# file upload/delete and actual file cleanup
fup=api(token,'POST','/docs/upload',files={'file':('formal.txt',b'formal system file','text/plain')}).json(); assert fup['code']==200; name=fup['data']['name']; docs=api(token,'GET','/docs').json()['data']['list']; doc=next(x for x in docs if x['name']==name); assert api(token,'DELETE',f'/docs/{doc["id"]}').json()['code']==200; assert api(token,'GET','/docs/download/'+name).status_code==404
# delete staff and login disabled
assert api(token,'DELETE',f'/staff/{sid}').json()['code']==200
assert requests.post(base+'/login',json={'code':code,'password':pwd},timeout=30).json()['code']!=200
for root,payload in [('leave',{'deptId':20,'typeNum':'年假','days':5,'status':1}),('salary-deduct',{'deptId':20,'typeNum':'迟到','deduct':50,'status':1}),('overtime',{'deptId':20,'typeNum':'工作日加班','code':'工作日加班','bonus':100,'salaryMultiple':1.5,'countType':0,'timeOffFlag':0,'status':1})]:
 api(token,'POST',f'/{root}/set',json=payload)
print('FORMAL_ALL_OK')


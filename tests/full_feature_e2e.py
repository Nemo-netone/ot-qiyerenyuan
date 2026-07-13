import requests, json, io
base='https://ot-qiyerenyuan.pages.dev'
def login(code,pwd='123456'):
 r=requests.post(base+'/login',json={'code':code,'password':pwd},timeout=30); print('login',code,r.status_code,r.json().get('code')); r.raise_for_status(); return r.json()['token'],r.json()['data']
def api(token,method,path,**kwargs):
 r=requests.request(method,base+path,headers={'token':token},timeout=30,**kwargs); print(method,path,r.status_code,r.headers.get('content-type')); return r
admin,ad=login('admin'); staff,sd=login('hr01'); user,ud=login('employee01')
print('roles',ad['role'],sd['role'],ud['role'],ad['canWrite'],ud['canWrite'])
# password change and restore
r=api(admin,'GET','/staff/check/123456/1'); assert r.json()['data'] is True
assert api(admin,'PUT','/staff/pwd',json={'id':1,'password':'654321'}).json()['code']==200
login('admin','654321')
assert api(login('admin','654321')[0],'PUT','/staff/pwd',json={'id':1,'password':'123456'}).json()['code']==200
login('admin')
# relations persistent and restore
old=api(admin,'GET','/staff/role/2').json()['data']; assert api(admin,'POST','/staff/role/2',json=[2,3]).json()['code']==200
assert [x['roleId'] for x in api(admin,'GET','/staff/role/2').json()['data']]==[2,3]
api(admin,'POST','/staff/role/2',json=[x['roleId'] for x in old])
oldm=api(admin,'GET','/role/menu/3').json()['data']; api(admin,'POST','/role/menu/3',json=[11,13,21,22,32,33]); assert [x['menuId'] for x in api(admin,'GET','/role/menu/3').json()['data']]==[11,13,21,22,32,33]; api(admin,'POST','/role/menu/3',json=[x['menuId'] for x in oldm])
# user isolation and write deny
rows=api(user,'POST','/staff/page',json={}).json()['data']['list']; print('user staff rows',[(x.get('id'),x.get('code')) for x in rows]); assert len(rows)==1 and rows[0]['code']=='employee01'
assert api(user,'POST','/staff',json={'name':'denied'}).status_code==403
# csv
exp=api(user,'GET','/salary/export'); assert 'text/csv' in exp.headers['content-type'] and 'employee01' in exp.text
csv='name,code,phone\n临时导入员工,temp-csv,13800009999\n'.encode('utf-8')
imp=api(admin,'POST','/staff/import',files={'file':('staff.csv',csv,'text/csv')}); print('imported',imp.json()); assert imp.json()['data']['imported']==1
lst=api(admin,'POST','/staff/page',json={'code':'temp-csv'}).json()['data']['list']; assert lst; api(admin,'DELETE',f"/staff/{lst[0]['id']}")
# file
up=api(admin,'POST','/docs/upload',files={'file':('demo.txt',b'concrete demo file','text/plain')}); data=up.json()['data']; print('upload',data)
down=api(user,'GET',data['url']); assert down.content==b'concrete demo file'
print('ALL_OK')


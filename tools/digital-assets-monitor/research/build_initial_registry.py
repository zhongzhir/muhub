from pathlib import Path
import csv,json,re,hashlib
from datetime import datetime,timezone
from urllib.parse import urljoin
import requests
from bs4 import BeautifulSoup
root=Path(__file__).resolve().parent; checked=datetime.now(timezone.utc).isoformat(timespec='seconds')
provinces=dict(zip('11 12 13 14 15 21 22 23 31 32 33 34 35 36 37 41 42 43 44 45 46 50 51 52 53 54 61 62 63 64 65'.split(),'北京 天津 河北 山西 内蒙古 辽宁 吉林 黑龙江 上海 江苏 浙江 安徽 福建 江西 山东 河南 湖北 湖南 广东 广西 海南 重庆 四川 贵州 云南 西藏 陕西 甘肃 青海 宁夏 新疆'.split()))
def soup(url):
 r=requests.get(url,timeout=30);r.raise_for_status();r.encoding=r.apparent_encoding;return BeautifulSoup(r.text,'html.parser')
def save(name,data): (root/name).write_text(json.dumps(data,ensure_ascii=False,indent=2)+'\n',encoding='utf-8')
def csvsave(name,rows):
 with (root/name).open('w',encoding='utf-8-sig',newline='') as f:
  w=csv.DictWriter(f,fieldnames=list(rows[0]));w.writeheader();w.writerows(rows)
registry=[]
def add(name,kind,province,evidence,date=None,url=None):
 registry.append(dict(id=hashlib.sha256((kind+name).encode()).hexdigest()[:16],name=name,kind=kind,province=province,discovery_evidence_url=evidence,evidence_date=date,evidence_checked_at=checked,homepage_candidate=url,identity_status='official_directory_candidate',current_identity_verified=False,endpoint_verified=False,collection_enabled=False,last_success_at=None))
police_url='https://gat.ln.gov.cn/gat/gsgawz50/index.shtml'
seen=set()
for a in soup(police_url).select('a[href]'):
 name=a.get_text(' ',strip=True);href=a['href']
 if not re.search(r'公安[厅局]$',name) or name in seen or not href.startswith('http'):continue
 seen.add(name);province=next((v for v in provinces.values() if name.startswith(v)),None)
 add(name,'police',province,police_url,url=href)
area_url='https://www.mca.gov.cn/mzsj/xzqh/2025/202401xzqh.html'
areas=[];seen=set()
for tr in soup(area_url).select('tr'):
 cells=[re.sub(r'\s+','',td.get_text()) for td in tr.select('td')]
 for i,value in enumerate(cells[:-1]):
  if re.fullmatch(r'\d{6}',value) and value[:2] in provinces and value not in seen:
   seen.add(value);level='province' if value.endswith('0000') else ('prefecture' if value.endswith('00') else 'county')
   areas.append(dict(code=value,name=cells[i+1],province=provinces[value[:2]],level=level,baseline_year=2024,evidence_url=area_url,current_2026_verified=False))
assert len(areas)>3000
save('administrative_baseline_2024.json',areas)
property_url='https://wap.sasac.gov.cn/n2588030/n2588944/c16420921/content.html'
property_names='北京产权交易所有限公司|天津产权交易中心|河北产权市场有限公司|山西省产权交易市场有限责任公司|内蒙古产权交易中心有限责任公司|沈阳联合产权交易所有限责任公司|吉林长春产权交易中心（集团）有限公司|黑龙江联合产权交易所有限责任公司|上海联合产权交易所有限公司|江苏省产权交易所有限公司|浙江产权交易所有限公司|安徽省产权交易中心有限责任公司|福建省产权交易中心|江西省产权交易所|山东产权交易中心有限公司|河南中原产权交易有限公司|武汉光谷联合产权交易所有限公司|湖南省联合产权交易所有限公司|广东联合产权交易中心有限公司|北部湾产权交易所集团股份有限公司|海南产权交易所有限公司|重庆联合产权交易所集团股份有限公司|西南联合产权交易所有限责任公司|贵州阳光产权交易所有限公司|云南产权交易所有限公司|西藏产权交易中心有限责任公司|西部产权交易所有限责任公司|甘肃省产权交易所股份有限公司|青海省产权交易市场|宁夏科技资源与产权交易所（有限公司）|新疆产权交易所有限责任公司|青岛产权交易所|宁波产权交易中心有限公司|厦门产权交易中心有限公司|大连产权交易所（有限责任公司）|深圳联合产权交易所股份有限公司'.split('|')
for name,province in zip(property_names,list(provinces.values())+['山东','浙江','福建','辽宁','广东']):add(name,'property_exchange',province,property_url,'2021-01-06')
data_url='https://www.nda.gov.cn/sjj/zhuanti/ztszzh/0902/20240830165252149196874_pc.html'
data_names='北京国际大数据交易所|北方大数据交易中心|上海数据交易所|苏州大数据交易所|华东江苏大数据交易中心|江苏无锡大数据交易有限公司|宿迁市数据交易中心|浙江大数据交易中心|杭州数据交易所|温州数据交易中心|福建大数据交易所|江西省数据交易平台|青岛大数据交易中心|山东数据交易有限公司|郑州数据交易中心|武汉长江大数据交易中心|湖南大数据交易所|广州数据交易所|深圳数据交易所|广西北部湾大数据交易中心|海南数据产品超市|西部数据交易中心|德阳大数据交易所|贵阳大数据交易所'.split('|')
data_provinces=['北京',None,'上海','江苏','江苏','江苏','江苏','浙江','浙江','浙江','福建','江西','山东','山东','河南','湖北','湖南','广东','广东','广西','海南',None,'四川','贵州']
for name,province in zip(data_names,data_provinces):add(name,'data_exchange',province,data_url,'2024-05-26')
add('上海技术交易所','technology_exchange','上海','https://www.most.gov.cn/dfkj/hub/zxdt/202404/t20240418_190340.html','2024-04-18')
add('中国技术交易所有限公司','technology_exchange','北京','https://www.most.gov.cn/xxgk/xinxifenlei/fdzdgknr/qtwj/qtwj2011/201106/t20110613_87481.html','2011-06-13')
save('institution_candidates.json',registry);csvsave('institution_candidates.csv',registry)
jobs=[]
for a in areas:
 jobs.append(dict(task_id='police-'+a['code'],province=a['province'],area_code=a['code'],area_name=a['name'],level=a['level'],kind='police',task_status='pending_discovery',query=f"{a['province']} {a['name']} 公安局 公安分局 政府信息公开 官方网站",evidence_url=a['evidence_url'],note='行政区划覆盖任务，不是已确认公安机构；区划变更及一对多机构关系须核实'))
for code,province in provinces.items():
 for kind,label in [('property_exchange','产权交易所 产权交易中心'),('data_exchange','数据交易所 数据交易中心'),('technology_exchange','技术交易所 技术产权交易 科技成果交易')]:
  jobs.append(dict(task_id=kind+'-'+code,province=province,area_code=code+'0000',area_name=province,level='province',kind=kind,task_status='pending_discovery',query=f'{province} {label} 官方 国资委 数据局 科技厅',evidence_url='',note='逐省扩展发现，包含主要市级交易机构；不能用一家机构代表该省全部覆盖'))
csvsave('national_discovery_tasks.csv',jobs)
matrix=[]
for province in provinces.values():
 for kind in ['police','property_exchange','data_exchange','technology_exchange']:
  rows=[r for r in registry if r['province']==province and r['kind']==kind]
  matrix.append(dict(province=province,kind=kind,candidate_count=len(rows),current_identity_verified=0,endpoint_verified=0,collection_enabled=0,last_success_count=0,status='待补全并验证',denominator_status='公安按区划逐级核实；交易机构分母待普查'))
csvsave('province_coverage.csv',matrix)
from collections import Counter
print(json.dumps({'institutions':len(registry),'by_kind':dict(Counter(r['kind'] for r in registry)),'administrative_baseline':len(areas),'area_levels':dict(Counter(a['level'] for a in areas)),'discovery_tasks':len(jobs),'coverage_cells':len(matrix)},ensure_ascii=False))

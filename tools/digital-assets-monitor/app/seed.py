"""未核实的演示素材：相对日期、示例金额和首页链接，不可当作真实新闻使用。生产禁用。"""
from datetime import datetime, timedelta
from app import database as db
from app.analysis import summarize
from app.scraper.pipeline import make_fingerprint

# (days_ago, title, source_name, category, region, institution, itype, assets, method, amount, cur, importance, url)
SEEDS = [
    (0,  "全国刑事审判工作会议聚焦涉案虚拟货币处置 提出完善司法规则", "最高人民法院", "人民法院", None, "最高人民法院", "人民法院", "虚拟货币", "试点/合作机制建设", None, None, "high", "https://www.court.gov.cn/"),
    (0,  "最高检刊文《建立刑事涉案虚拟货币多重司法处置路径》", "最高人民检察院", "人民检察院", None, "最高人民检察院", "人民检察院", "虚拟货币", "试点/合作机制建设", None, None, "high", "https://www.spp.gov.cn/"),
    (1,  "上海市宝山区法院首次成功处置涉案虚拟货币", "上海法院", "人民法院", "上海", "上海市宝山区人民法院", "人民法院", "虚拟货币", "境外持牌交易所变现", 1.2e7, "人民币", "high", "https://www.hshfy.sh.cn/"),
    (1,  "上海高院：刑事涉财产执行案件中首次成功处置虚拟货币", "上海高院", "人民法院", "上海", "上海市高级人民法院", "人民法院", "虚拟货币", "境外持牌交易所变现", None, None, "high", "https://www.hshfy.sh.cn/"),
    (2,  "北京市公安局法制总队与北京产权交易所签署《涉案虚拟货币处置业务合作框架协议》", "北京市公安局·法青苑", "公安机关", "北京", "北京市公安局法制总队", "公安机关", "虚拟货币", "试点/合作机制建设", None, None, "high", "https://gaj.beijing.gov.cn/"),
    (3,  "经济日报：涉案虚拟货币咋处置 看北京的探索", "经济日报", "媒体", "北京", "北京市公安局顺义分局", "公安机关", "虚拟货币", "境外持牌交易所变现", 7000, "枚", "high", "http://paper.ce.cn/"),
    (3,  "顺义分局7000余枚涉案虚拟货币经香港持牌交易所变现并回流入境", "北京市公安局", "公安机关", "北京", "北京市公安局顺义分局", "公安机关", "虚拟货币", "境外持牌交易所变现", 7000, "枚", "high", "https://gaj.beijing.gov.cn/"),
    (4,  "21世纪经济报道：从无法处置到24小时变现 北京首创涉案虚拟货币处置新模式", "21世纪经济报道", "媒体", "北京", "北京产权交易所", "产权交易所", "虚拟货币", "境外持牌交易所变现", None, None, "high", "https://www.21jingji.com/"),
    (5,  "财新：内地涉案虚拟货币处置拓新渠道 经香港持牌交易所变现", "财新网", "媒体", "北京", "北京产权交易所", "产权交易所", "虚拟货币", "境外持牌交易所变现", None, None, "high", "https://finance.caixin.com/"),
    (6,  "北京产权交易所数字资产海外处置业务及流程公开", "北京产权交易所", "产权交易所", "北京", "北京产权交易所", "产权交易所", "数字资产", "境外持牌交易所变现", None, None, "medium", "https://www.cbex.com.cn/"),
    (6,  "公安部第一研究所支撑涉案虚拟货币技术检测与处置", "公安部第一研究所", "公安机关", None, "公安部第一研究所", "境外处置机构", "虚拟货币", "委托第三方机构处置", 1e10, "人民币", "high", "https://www.mps.gov.cn/"),
    (7,  "苏州设立币达数字资产服务中心 服务公检法罚没虚拟货币变现", "苏州市公安局", "公安机关", "江苏", "苏州币达数字资产服务中心", "境外处置机构", "虚拟货币", "委托第三方机构处置", None, None, "medium", "https://gaj.suzhou.gov.cn/"),
    (7,  "温州：法院执行局+公安网安+专业处置机构协同处置涉案虚拟货币", "温州法院", "人民法院", "浙江", "温州市中级人民法院", "人民法院", "虚拟货币", "委托第三方机构处置", None, None, "medium", "https://wz.zjcourt.cn/"),
    (8,  "温州模式委托公安部第三研究所抽选专业处置公司实施变现", "公安部第三研究所", "公安机关", "浙江", "公安部第三研究所", "境外处置机构", "虚拟货币", "委托第三方机构处置", None, None, "medium", "https://www.mps.gov.cn/"),
    (9,  "贵州省设立涉案财物共管中心 冷钱包物理隔离保管虚拟货币", "贵州省公安厅", "公安机关", "贵州", "贵州省公安厅", "公安机关", "虚拟货币", "涉案管控/扣押", None, None, "medium", "https://gat.guizhou.gov.cn/"),
    (10, "山东省17部门印发罚没物品处置规程 探索虚拟货币商户回收", "山东省财政厅", "财政", "山东", "山东省财政厅", "财政部门", "虚拟货币", "定向回收/协商回收", None, None, "medium", "http://czt.shandong.gov.cn/"),
    (10, "江苏盐城PlusToken案：扣押19万枚比特币 判决依法处置上缴国库", "江苏盐城中院", "人民法院", "江苏", "盐城市中级人民法院", "人民法院", "BTC", "司法拍卖/网络司法拍卖", 190000, "枚", "high", "https://jsyczy.gov.cn/"),
    (11, "湖北荆门涉案虚拟货币案件 流水金额高达4000亿元", "湖北省公安厅", "公安机关", "湖北", "荆门市公安局", "公安机关", "虚拟货币", "涉案管控/扣押", 4e11, "人民币", "high", "https://gat.hubei.gov.cn/"),
    (12, "安徽省开展虚拟货币处置试点工作", "安徽省产权交易中心", "产权交易所", "安徽", "安徽省产权交易中心", "产权交易所", "虚拟货币", "试点/合作机制建设", None, None, "medium", "https://www.ahcqjy.com/"),
    (12, "广西达成虚拟货币处置合作协议", "广西产权交易所", "产权交易所", "广西", "广西联合产权交易所", "产权交易所", "虚拟货币", "试点/合作机制建设", None, None, "medium", "http://www.gxcq.com.cn/"),
    (13, "山西技术产权交易中心推进数字货币处置业务", "山西技术产权交易中心", "产权交易所", "山西", "山西技术产权交易中心", "产权交易所", "数字货币", "试点/合作机制建设", None, None, "medium", "https://www.sxscpre.com/"),
    (13, "华中文化产权交易所开展刑事涉案虚拟币处置项目", "华中文化产权交易所", "产权交易所", "湖北", "华中文化产权交易所", "产权交易所", "虚拟币", "司法拍卖/网络司法拍卖", None, None, "medium", "http://www.hbcpre.com/"),
    (14, "江西省产权交易所发布数字资产处置相关合作", "江西省产权交易所", "产权交易所", "江西", "江西省产权交易所", "产权交易所", "数字资产", "试点/合作机制建设", None, None, "medium", "http://www.jxcq.com.cn/"),
    (14, "最高人民法院『涉案虚拟货币处置问题研究』列为年度司法研究重点课题", "最高人民法院", "人民法院", None, "最高人民法院", "人民法院", "虚拟货币", "试点/合作机制建设", None, None, "high", "https://www.court.gov.cn/"),
    (15, "中哈霍尔果斯国际边境合作中心发证监会试点机构备案登记证", "新疆·霍尔果斯", "产权交易所", "新疆", "中哈霍尔果斯国际边境合作中心", "境外处置机构", "数字资产", "试点/合作机制建设", None, None, "high", "https://www.xj.gov.cn/"),
    (16, "香港金融交易及服务公司联合持牌交易所开展虚拟货币跨境处置", "香港金融交易及服务", "境外处置机构", "香港", "香港金融交易及服务有限公司", "境外处置机构", "虚拟货币", "境外持牌交易所变现", None, None, "medium", "https://www.hkfts.com/"),
    (17, "HashKey/OSL 持牌虚拟资产交易所服务涉案虚拟货币公开变现", "香港证监会", "国际", "香港", "HashKey Exchange", "持牌交易平台", "虚拟货币", "境外持牌交易所变现", None, None, "medium", "https://www.sfc.hk/"),
    (18, "落地合规与反洗钱审查：香港持牌交易所成涉案资产变现通道", "财新", "媒体", "香港", "OSL", "持牌交易平台", "虚拟货币", "境外持牌交易所变现", None, None, "medium", "https://finance.caixin.com/"),
    (20, "美国法警局USMS拍卖缴获加密货币资产", "USMS", "国际", None, "美国司法部法警局", "持牌交易平台", "加密货币", "司法拍卖/网络司法拍卖", 1e8, "美元", "medium", "https://www.usmarshals.gov/"),
    (21, "美国司法部对加密资产发起大规模罚没调查", "DOJ", "国际", None, "美国司法部", "持牌交易平台", "加密货币", "司法拍卖/网络司法拍卖", None, None, "medium", "https://www.justice.gov/news"),
    (22, "美国司法部联合多部门推动加密资产合规处置", "DOJ", "国际", None, "美国司法部", "持牌交易平台", "加密货币", "境外持牌交易所变现", None, None, "medium", "https://www.justice.gov/news"),
    (25, "欧洲多国执法机构联合扣押涉洗钱加密资产", "Europol", "国际", None, "欧洲刑警组织", "持牌交易平台", "加密货币", "境外持牌交易所变现", None, None, "medium", "https://www.europol.europa.eu/"),
    (28, "全球最大交易所与美国司法部达成和解并支付巨额罚金", "海外媒体", "国际", "美国", "币安", "持牌交易平台", "加密货币", "境外持牌交易所变现", 4.3e9, "美元", "high", "https://www.justice.gov/news"),
    (30, "财政部罚没财物管理办法：罚没物品应收公开拍卖并依法处理", "财政部", "财政", None, "财政部", "财政部门", "虚拟货币", "司法拍卖/网络司法拍卖", None, None, "medium", "https://www.mof.gov.cn/"),
    (33, "多地派出所对涉案虚拟货币冷钱包规范保管与封存", "各地公安", "公安机关", None, "公安机关", "公安机关", "虚拟货币", "涉案管控/扣押", None, None, "low", "https://www.mps.gov.cn/"),
    (35, "深圳市华创技术涉虚拟资产技术解决方案及处置方案发布", "深圳华创", "第三方处置公司", "广东", "深圳市华创技术有限公司", "第三方处置公司", "虚拟资产", "委托第三方机构处置", None, None, "low", "https://www.szhc.com/"),
    (36, "四川共工网络科技公司虚拟货币处置服务介绍", "四川共工", "第三方处置公司", "四川", "四川共工网络科技有限公司", "第三方处置公司", "虚拟货币", "委托第三方机构处置", None, None, "low", "https://www.scgg.com/"),
    (38, "浙江蓝腾网络科技涉案虚拟货币处置业务介绍", "浙江蓝腾", "第三方处置公司", "浙江", "浙江蓝腾网络科技有限公司", "第三方处置公司", "虚拟货币", "委托第三方机构处置", None, None, "low", "https://www.zjlt.com/"),
    (40, "陕西银盾数字资产处置业务推广", "陕西银盾", "第三方处置公司", "陕西", "陕西银盾数字资产", "第三方处置公司", "数字资产", "委托第三方机构处置", None, None, "low", "https://www.sxyd.com/"),
    (45, "虚拟货币司法处置的正当性探索与实践——律师观察", "金杜律师事务所", "律所/研究", None, "金杜律师事务所", "律所/研究", "虚拟货币", "委托第三方机构处置", None, None, "medium", "https://www.kwm.com/"),
    (48, "中国公安与司法部门数字资产处置策略研究综述", "研究机构", "政策", None, "研究机构", "律所/研究", "数字资产", "试点/合作机制建设", None, None, "low", "https://www.spp.gov.cn/"),
]


def _date(days_ago):
    return (datetime.now() - timedelta(days=days_ago)).strftime("%Y-%m-%d")


def seed(conn):
    inserted = 0
    for (days_ago, title, source, cat, region, inst, itype, assets, method, amount, cur, importance, url) in SEEDS:
        fp = make_fingerprint(title, url)
        if db.item_exists(conn, fp):
            continue
        d = _date(days_ago)
        text = f"{title} {region or ''} {inst} {method}"
        analysis = summarize.build_analysis(title, text, itype, region, assets, method, amount, cur)
        conn.execute(
            """INSERT INTO items (fingerprint,title,url,source_name,source_category,source_type,
               publish_date,fetch_date,content,summary,analysis,region,institution,institution_type,
               asset_types,disposal_method,amount_value,amount_currency,importance,tags,is_processed,created_at,updated_at)
               VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?)""",
            (fp, title, url, source, cat, "seed", d, d, text, title, analysis,
             region, inst, itype, assets, method, amount, cur, importance,
             ",".join([x for x in [itype, region, assets] if x]) or "虚拟货币", 1, db.now_iso(), db.now_iso()),
        )
        inserted += 1
    return inserted


def run_seed():
    conn = db.connect()
    try:
        conn.execute("BEGIN")
        n = seed(conn)
        conn.commit()
        return n
    finally:
        conn.close()

"""网页定向爬虫：按结构化选择器提取列表项。选择器容错，抓不到返回空列表。"""
import re

from bs4 import BeautifulSoup

from app.scraper.base import fetch, decode, absolute_url, FetchError


def _txt(el):
    if el is None:
        return ""
    t = el.get_text(" ", strip=True)
    return re.sub(r"\s+", " ", t)


def _attr(el, name):
    if el is None:
        return None
    return el.get(name)


def crawl_list(url, rules):
    """
    rules: { item: css, title: css, link: css, date: css(可选), container_list: css(可选) }
    一次抓取时：进入页面 -> 选 container_list(或整页) 内匹配 item 的节点。
    返回 [{title, url, publish_date, summary}]
    """
    resp = fetch(url)
    text = decode(resp.content)
    soup = BeautifulSoup(text, "lxml")

    items_selectors = rules.get("item", "h2 a, h3 a")
    nodes = soup.select(items_selectors)
    out = []
    seen = set()
    for node in nodes:
        # 尝试取链接(可能 node 本身即 <a> 或者在 <a> 内部/外包裹)
        link_el = node if node.name == "a" else node.select_one("a")
        href = _attr(link_el, "href") if link_el else _attr(node, "href")
        if not href:
            continue
        href = absolute_url(url, href)
        if not href or href in seen:
            continue
        seen.add(href)

        title_el = None
        if node.name == "a":
            title_el = node
        else:
            t = _txt(node)
            title_el = node if t else node.find_parent(["li", "div", "article"])

        title = _txt(title_el) or _txt(link_el)
        if not title or len(title) < 6:
            continue
        # 日期：取正则或规则
        pub = None
        if rules.get("date"):
            d = node.select_one(rules["date"])
            if d:
                pub = _txt(d)
        if not pub:
            m = re.search(r"(\d{4})[年./-](\d{1,2})[月./-](\d{1,2})", _txt(node))
            if m:
                pub = f"{m.group(1)}-{int(m.group(2)):02d}-{int(m.group(3)):02d}"
        out.append({"title": title, "url": href, "publish_date": pub, "summary": _txt(node)[:400]})
    if not out:
        raise FetchError("No list entries parsed; check selector or access restrictions")
    return out

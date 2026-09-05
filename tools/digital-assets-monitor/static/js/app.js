(() => {
  const $ = (s) => document.querySelector(s);
  const $$ = (s) => Array.from(document.querySelectorAll(s));
  const TOKEN_KEY = "dzs_token";
  let meta = null;
  let charts = {};
  let itemState = { page: 1, page_size: 10, filters: {} };

  function emptyFilters() {
    return {
      institution_type: "全部", region: "全部", asset_types: "全部",
      disposal_method: "全部", importance: "全部", source_category: "全部",
      q: "", date_from: "", date_to: "", fetch_from: "", fetch_to: "", source_name: "",
    };
  }
  function ymd(d) {
    const z = (n) => String(n).padStart(2, "0");
    return `${d.getFullYear()}-${z(d.getMonth() + 1)}-${z(d.getDate())}`;
  }
  function todayStr() { return ymd(new Date()); }
  function daysAgo(n) { const d = new Date(); d.setDate(d.getDate() - n); return ymd(d); }
  function safeHttpUrl(u) {
    try {
      const x = new URL(u);
      if (x.protocol === "http:" || x.protocol === "https:") return x.href;
    } catch (e) {}
    return "";
  }
  function urlLink(u) {
    const href = safeHttpUrl(u);
    if (!href) return `<span class="url-break">—</span>`;
    return `<a class="url-break" href="${esc(href)}" target="_blank" rel="noopener noreferrer">${esc(href)}</a>`;
  }
  function analysisValueLine(text) {
    if (!text) return "—";
    const line = String(text).split("\n").find((x) => x.startsWith("对实际工作的价值"));
    return line ? line.split("：").slice(1).join("：").replace(/。$/, "") : String(text).split("\n")[0];
  }
  function undisclosed(v) { return v ? esc(v) : "未披露"; }
  function hasAmount(r) { return r && r.amount_value != null && r.amount_evidence; }

  const COLORS = ["#2fe0c8", "#3b82f6", "#8b5cf6", "#f472b6", "#ffb547", "#34d399", "#60a5fa", "#a78bfb"];
  const FONT = "PingFang SC, Microsoft YaHei, sans-serif";

  // ---------- helpers ----------
  async function api(path, opts = {}) {
    const headers = Object.assign({ "Content-Type": "application/json" }, opts.headers || {});
    const tok = localStorage.getItem(TOKEN_KEY);
    if (tok) headers["x-access-token"] = tok;
    const res = await fetch("/api" + path, Object.assign({ headers }, opts));
    if (res.status === 401) { logout(false); throw new Error("未授权"); }
    const data = await res.json().catch(() => ({}));
    if (!res.ok) throw new Error(typeof data.detail === "string" ? data.detail : `请求失败 (${res.status})`);
    return data;
  }
  function toast(msg) {
    const t = $("#toast"); t.textContent = msg; t.classList.add("show");
    setTimeout(() => t.classList.remove("show"), 2600);
  }
  function esc(s) { return (s || "").replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c])); }
  function fmtMoney(v, cur) {
    if (v == null) return "";
    if (cur === "枚") return `${Number(v).toLocaleString()} 枚`;
    return `${Number(v) >= 1e8 ? (Number(v) / 1e8).toFixed(2) + "亿" : Number(v).toLocaleString()} ${cur === "美元" ? "$" : "¥"}`;
  }
  function fmtDate(d) { if (!d) return "—"; return String(d).slice(0, 10); }
  function mkChart(id) {
    const el = document.getElementById(id);
    if (!el) return null;
    if (charts[id]) charts[id].dispose();
    const c = echarts.init(el);
    charts[id] = c;
    return c;
  }
  const baseAxis = {
    axisLine: { lineStyle: { color: "rgba(120,160,220,.25)" } },
    axisLabel: { color: "#8ea0bb", fontFamily: FONT },
    splitLine: { lineStyle: { color: "rgba(120,160,220,.09)" } },
  };

  // ---------- login ----------
  async function login() {
    const code = $("#login-code").value.trim();
    if (!code) { $("#login-err").textContent = "请输入邀请码"; return; }
    const res = await api("/auth", { method: "POST", body: JSON.stringify({ code }) });
    if (res.ok) { localStorage.setItem(TOKEN_KEY, res.token); enterApp(); }
    else $("#login-err").textContent = res.message || "邀请码无效";
  }
  function logout(show = true) {
    localStorage.removeItem(TOKEN_KEY);
    $("#app").classList.remove("show"); $("#login").classList.remove("hidden");
    if (show) toast("已退出");
  }
  async function enterApp() {
    $("#login").classList.add("hidden"); $("#app").classList.add("show");
    await initMeta();
    loadDashboard();
    loadItems();
    loadSources();
    $("#login-code").value = "";
  }

  // ---------- meta & clock ----------
  async function initMeta() {
    meta = await api("/meta");
    buildFilters();
    $("#reportBody").textContent = "";
  }
  function tickClock() {
    const d = new Date();
    $("#clock").textContent = d.toLocaleString("zh-CN", { hour12: false }).replace(/\//g, "-");
  }

  // ---------- nav ----------
  function switchView(name) {
    $$("nav a").forEach((x) => x.classList.toggle("active", x.dataset.view === name));
    $$(".view").forEach((v) => v.classList.toggle("active", v.id === "view-" + name));
    if (name === "dashboard") loadDashboard();
    if (name === "items") loadItems();
    if (name === "sources") loadSources();
  }
  $$("nav a").forEach((a) => a.addEventListener("click", () => switchView(a.dataset.view)));

  // ---------- dashboard ----------
  async function loadDashboard() {
    const [ov, trend, typeDist, assetDist, methodDist, regionDist, heat, srank, hv, report, latest] = await Promise.all([
      api("/overview"), api("/trend?days=30"), api("/distribution?field=institution_type"),
      api("/distribution?field=asset_types"), api("/distribution?field=disposal_method"),
      api("/distribution?field=region"), api("/heatmap?weeks=8"), api("/source_rank?limit=8"),
      api("/high_value?limit=7"), api("/report/latest"), api("/items?page=1&page_size=6"),
    ]);
    renderKpis(ov);
    renderTrend(trend);
    renderDonut(chartType(), typeDist);
    renderBar(chartAsset(), assetDist);
    renderRose(chartMethod(), methodDist);
    renderRegion(chartRegion(), regionDist);
    renderHeat(heat);
    renderSourceRank(srank);
    renderHighValue(hv);
    renderReport(report);
    renderLatest(latest.items || []);
    $("#liveStatus").textContent = ov.sources_ok >= ov.sources_total && ov.sources_total > 0 ? "监测运行中 · 源在线" : "监测运行中 · 部分源离线";
  }
  const chartType = () => mkChart("chartType");
  const chartAsset = () => mkChart("chartAsset");
  const chartMethod = () => mkChart("chartMethod");
  const chartRegion = () => mkChart("chartRegion");

  function renderKpis(ov) {
    const k = [
      { lbl: "累计情报", val: ov.total_items, sub: "全量情报条目", ico: "🗂️", drill: {} },
      { lbl: "今日新增", val: ov.new_today, sub: "今日新增情报", ico: "🔔", drill: { fetch_from: todayStr(), fetch_to: todayStr() } },
      { lbl: "近7日新增", val: ov.new_week, sub: "近一周新增", ico: "📈", drill: { fetch_from: daysAgo(7), fetch_to: todayStr() } },
      { lbl: "高价值信号", val: ov.high_value, sub: "重点/金额类", ico: "⭐", drill: { importance: "high" } },
      { lbl: "覆盖地域", val: ov.regions, sub: "行政区域分布", ico: "📍" },
      { lbl: "处置金额(¥)", val: fmtMoney(ov.amount_rmb, "人民币"), sub: "已识别合计", ico: "💰", mono: 1 },
      { lbl: "监测信息源", val: `${ov.sources_ok}/${ov.sources_total}`, sub: "在线/总数", ico: "📡" },
    ];
    $("#kpis").innerHTML = k.map((o, i) => `
      <div class="kpi${o.drill ? " clickable" : ""}" data-kpi="${i}"><div class="ico">${o.ico}</div>
        <div class="lbl">${o.lbl}</div>
        <div class="val" style="font-size:${o.mono && String(o.val).length > 8 ? 24 : 30}px">${o.val}</div>
        <div class="sub">${o.sub}</div></div>`).join("");
    $("#kpis").querySelectorAll(".kpi.clickable").forEach((el) => {
      el.addEventListener("click", () => goItems(k[Number(el.dataset.kpi)].drill));
    });
  }

  function renderTrend(data) {
    const dates = data.map((d) => d.date);
    const counts = data.map((d) => d.count);
    const c = mkChart("chartTrend");
    c.setOption({
      grid: { left: 40, right: 16, top: 20, bottom: 30 },
      tooltip: { trigger: "axis" },
      xAxis: Object.assign({ type: "category", data: dates, boundaryGap: false }, baseAxis),
      yAxis: Object.assign({ type: "value", minInterval: 1 }, baseAxis),
      series: [{
        name: "新增情报", type: "line", smooth: true, symbol: "circle", symbolSize: 6, data: counts,
        lineStyle: { width: 3, color: new echarts.graphic.LinearGradient(0, 0, 1, 0, [{ offset: 0, color: "#2fe0c8" }, { offset: 1, color: "#3b82f6" }]) },
        itemStyle: { color: "#2fe0c8" }, areaStyle: { color: new echarts.graphic.LinearGradient(0, 0, 0, 1, [{ offset: 0, color: "rgba(47,224,200,.3)" }, { offset: 1, color: "rgba(47,224,200,0)" }]) },
      }],
    });
    bindChartClick(c, (p) => { if (p && p.name) goItems({ date_from: p.name, date_to: p.name }); });
  }

  function renderDonut(c, data) {
    const names = data.map((d) => d.name);
    const sum = data.reduce((s, d) => s + d.value, 0);
    c.setOption({
      color: COLORS, tooltip: { trigger: "item", formatter: "{b}: {c} ({d}%)" },
      legend: { orient: "vertical", right: 6, top: "center", textStyle: { color: "#8ea0bb", fontSize: 11 }, itemWidth: 10, itemHeight: 10 },
      series: [{
        type: "pie", radius: ["44%", "70%"], center: ["38%", "50%"], avoidLabelOverlap: true,
        itemStyle: { borderColor: "#0b1220", borderWidth: 2 },
        label: { show: true, position: "center", formatter: () => `${sum}\n条`, color: "#e6edf7", fontSize: 20, fontWeight: 700, fontFamily: "monospace" },
        emphasis: { label: { show: true } }, data,
      }],
    });
    bindChartClick(c, (p) => { if (p && p.name) goItems({ institution_type: p.name }); });
  }

  function renderBar(c, data) {
    const rows = data.slice(0, 10);
    c.setOption({
      grid: { left: 90, right: 20, top: 16, bottom: 20 },
      tooltip: { trigger: "axis", axisPointer: { type: "shadow" } },
      xAxis: Object.assign({ type: "value", minInterval: 1 }, baseAxis),
      yAxis: Object.assign({ type: "category", data: rows.map((d) => d.name), inverse: true }, baseAxis),
      series: [{
        type: "bar", data: rows.map((d, i) => d.value), barWidth: 14,
        itemStyle: { color: COLORS[i % COLORS.length], borderRadius: [0, 6, 6, 0] },
        label: { show: true, position: "right", color: "#8ea0bb", fontFamily: "monospace", fontSize: 11 },
      }],
    });
    bindChartClick(c, (p) => {
      const name = p && (p.name || (p.dataIndex != null && rows[p.dataIndex] && rows[p.dataIndex].name));
      if (name) goItems({ asset_types: name });
    });
  }
    c.setOption({
      color: COLORS, tooltip: { trigger: "item", formatter: "{b}: {c}" },
      series: [{
        type: "pie", radius: ["18%", "72%"], center: ["50%", "50%"], roseType: "radius",
        itemStyle: { borderColor: "#0b1220", borderWidth: 2 }, label: { color: "#8ea0bb", fontSize: 11 },
        data: data.slice(0, 9),
      }],
    });
    bindChartClick(c, (p) => { if (p && p.name) goItems({ disposal_method: p.name }); });
  }

  function renderRegion(c, data) {
    const rows = data.slice(0, 10);
    c.setOption({
      grid: { left: 46, right: 20, top: 16, bottom: 20 },
      tooltip: { trigger: "axis", axisPointer: { type: "shadow" } },
      xAxis: Object.assign({ type: "category", data: rows.map((d) => d.name), axisLabel: { color: "#8ea0bb", fontSize: 11 } }, { axisLine: { lineStyle: { color: "rgba(120,160,220,.25)" } } }),
      yAxis: Object.assign({ type: "value", minInterval: 1 }, baseAxis),
      series: [{
        type: "bar", data: rows.map((d, i) => ({ value: d.value, itemStyle: { color: new echarts.graphic.LinearGradient(0, 0, 0, 1, [{ offset: 0, color: "#3b82f6" }, { offset: 1, color: "rgba(59,130,246,.2)" }]) } })), barWidth: 16,
        itemStyle: { borderRadius: [6, 6, 0, 0] }, label: { show: true, position: "top", color: "#8ea0bb", fontSize: 11 },
      }],
    });
    bindChartClick(c, (p) => { if (p && p.name) goItems({ region: p.name }); });
  }

  function renderHeat(hc) {
    const weeks = [];
    for (let i = 7; i >= 0; i--) { const d = new Date(); d.setDate(d.getDate() - i * 7); weeks.push(fmtDate(d)); }
    const cats = Array.from(new Set(hc.map((r) => r.source_category)));
    const data = hc.map((r) => [weeks.indexOf(fmtDate(r.d)), cats.indexOf(r.source_category), r.c]).filter((x) => x[0] >= 0 && x[1] >= 0);
    const c = mkChart("chartHeat");
    c.setOption({
      grid: { left: 70, right: 20, top: 20, bottom: 46 },
      tooltip: { position: "top" },
      xAxis: { type: "category", data: weeks, axisLabel: { color: "#8ea0bb", fontSize: 10 }, splitArea: { show: true } },
      yAxis: { type: "category", data: cats, axisLabel: { color: "#8ea0bb", fontSize: 11 }, splitArea: { show: true } },
      visualMap: { min: 0, max: Math.max(1, ...data.map((d) => d[2])), calculable: false, orient: "horizontal", left: "center", bottom: 2, inRange: { color: ["#0f1a2b", "#2fe0c8"] }, textStyle: { color: "#8ea0bb", fontSize: 10 } },
      series: [{ type: "heatmap", data, label: { show: false }, itemStyle: { borderRadius: 4, borderColor: "#0b1220", borderWidth: 1 } }],
    });
  }

  function renderSourceRank(data) {
    const c = mkChart("chartSource");
    const rows = data.slice(0, 8);
    c.setOption({
      grid: { left: 120, right: 24, top: 12, bottom: 12 },
      tooltip: { trigger: "axis", axisPointer: { type: "shadow" } },
      xAxis: Object.assign({ type: "value", minInterval: 1 }, baseAxis),
      yAxis: Object.assign({ type: "category", data: rows.map((d) => d.name), inverse: true }, baseAxis),
      series: [{
        type: "bar", data: rows.map((d, i) => ({ value: d.value, itemStyle: { color: i === 0 ? "#2fe0c8" : "#3b82f6", borderRadius: [0, 6, 6, 0] } })), barWidth: 14,
        label: { show: true, position: "right", color: "#8ea0bb", fontFamily: "monospace", fontSize: 11 },
      }],
    });
    bindChartClick(c, (p) => { if (p && p.name) goItems({ source_name: p.name }); });
  }

  function renderHighValue(rows) {
    const el = $("#highValue");
    if (!rows.length) { el.innerHTML = `<div class="empty">暂无高价值情报</div>`; return; }
    el.innerHTML = rows.map((r, i) => `
      <div class="list-row" data-id="${r.id}">
        <div class="idx">${String(i + 1).padStart(2, "0")}</div>
        <div class="body">
          <div class="title">${esc(r.title)}</div>
          <div class="meta">
            ${hasAmount(r) ? `<span class="amount">${fmtMoney(r.amount_value, r.amount_currency)}</span>` : ""}
            ${r.information_nature ? `<span class="chip acc">${esc(r.information_nature)}</span>` : ""}
            ${r.region ? `<span class="chip">${esc(r.region)}</span>` : ""}
            <span class="tag">${fmtDate(r.publish_date)}</span>
          </div>
        </div>
      </div>`).join("");
    el.querySelectorAll(".list-row").forEach((x) => x.addEventListener("click", () => openDetail(x.dataset.id)));
  }

  function renderLatest(rows) {
    const el = $("#latestIntel");
    if (!el) return;
    if (!rows.length) { el.innerHTML = `<div class="empty">暂无情报</div>`; return; }
    el.innerHTML = rows.map((r) => `
      <div class="list-row" data-id="${r.id}">
        <div class="body">
          <div class="title">${esc(r.title)}</div>
          <div class="meta">
            <span class="tag">${fmtDate(r.publish_date)}</span>
            <span class="chip">${esc(r.source_name || "未披露")}</span>
            <span class="chip acc">${esc(r.information_nature || "未披露")}</span>
            <span>${esc(analysisValueLine(r.analysis))}</span>
          </div>
        </div>
      </div>`).join("");
    el.querySelectorAll(".list-row").forEach((x) => x.addEventListener("click", () => openDetail(x.dataset.id)));
  }

  function bindChartClick(chart, handler) {
    if (!chart) return;
    chart.off("click");
    chart.getDom().classList.add("clickable");
    chart.on("click", handler);
  }

  function goItems(partial) {
    itemState.page = 1;
    itemState.filters = Object.assign(emptyFilters(), partial || {});
    syncFilterForm();
    switchView("items");
  }

  function renderReport(r) {
    $("#reportDate").textContent = r && r.report_date ? r.report_date : "暂无日报";
    $("#reportBody").textContent = r && r.body ? r.body : (r ? "今日无新增情报，按规则不生成报告。" : "尚未产生日报（无新增情报时不报告）。");
  }

  // ---------- items ----------
  function buildFilters() {
    const wrap = $("#itemFilters");
    const opt = (list, cur) => ["全部"].concat(list).map((o) => `<option ${o === cur ? "selected" : ""}>${esc(o)}</option>`).join("");
    wrap.innerHTML = `
      <div class="filter"><label>主体类型</label><select id="fType" class="select">${opt(meta.institution_types)}</select></div>
      <div class="filter"><label>行政区域</label><select id="fRegion" class="select">${opt(meta.regions)}</select></div>
      <div class="filter"><label>资产类型</label><select id="fAsset" class="select">${opt(meta.asset_types)}</select></div>
      <div class="filter"><label>处置方式</label><select id="fMethod" class="select">${opt(meta.disposal_methods)}</select></div>
      <div class="filter"><label>重要度</label><select id="fImp" class="select"><option>全部</option><option>high</option><option>medium</option><option>low</option></select></div>
      <div class="filter"><label>来源类别</label><select id="fCat" class="select">${opt(meta.source_categories)}</select></div>
      <div class="filter"><label>发布从</label><input id="fDateFrom" class="input" type="date"></div>
      <div class="filter"><label>发布至</label><input id="fDateTo" class="input" type="date"></div>
      <div class="filter"><label>关键词</label><input id="fQ" class="input" placeholder="搜索标题/内容" style="min-width:180px"></div>
      <input id="fFetchFrom" type="hidden"><input id="fFetchTo" type="hidden"><input id="fSourceName" type="hidden">
      <button id="fGo" class="btn sm">查询</button>
      <button id="fClear" class="btn sm ghost" type="button">清除筛选</button>
      <div id="activeFilters" class="filter-active"></div>`;
    ["fType", "fRegion", "fAsset", "fMethod", "fImp", "fCat", "fDateFrom", "fDateTo"].forEach((id) => $("#" + id).addEventListener("change", () => { gatherFilters(); loadItems(); }));
    $("#fQ").addEventListener("keydown", (e) => { if (e.key === "Enter") { gatherFilters(); loadItems(); } });
    $("#fGo").addEventListener("click", () => { gatherFilters(); loadItems(); });
    $("#fClear").addEventListener("click", () => goItems({}));
    $("#prevPage").addEventListener("click", () => { if (itemState.page > 1) { itemState.page--; loadItems(); } });
    $("#nextPage").addEventListener("click", () => { itemState.page++; loadItems(); });
    syncFilterForm();
  }
  function gatherFilters() {
    itemState.filters = {
      institution_type: $("#fType") ? $("#fType").value : "全部",
      region: $("#fRegion") ? $("#fRegion").value : "全部",
      asset_types: $("#fAsset") ? $("#fAsset").value : "全部",
      disposal_method: $("#fMethod") ? $("#fMethod").value : "全部",
      importance: $("#fImp") ? $("#fImp").value : "全部",
      source_category: $("#fCat") ? $("#fCat").value : "全部",
      q: $("#fQ") ? $("#fQ").value.trim() : "",
      date_from: $("#fDateFrom") ? $("#fDateFrom").value : "",
      date_to: $("#fDateTo") ? $("#fDateTo").value : "",
      fetch_from: $("#fFetchFrom") ? $("#fFetchFrom").value : "",
      fetch_to: $("#fFetchTo") ? $("#fFetchTo").value : "",
      source_name: $("#fSourceName") ? $("#fSourceName").value : "",
    };
  }
  function syncFilterForm() {
    const f = Object.assign(emptyFilters(), itemState.filters || {});
    itemState.filters = f;
    const set = (id, val) => { const el = $("#" + id); if (el) el.value = val || ""; };
    set("fType", f.institution_type);
    set("fRegion", f.region);
    set("fAsset", f.asset_types);
    set("fMethod", f.disposal_method);
    set("fImp", f.importance);
    set("fCat", f.source_category);
    set("fQ", f.q);
    set("fDateFrom", f.date_from);
    set("fDateTo", f.date_to);
    set("fFetchFrom", f.fetch_from);
    set("fFetchTo", f.fetch_to);
    set("fSourceName", f.source_name);
    renderActiveFilters();
  }
  function renderActiveFilters() {
    const el = $("#activeFilters");
    if (!el) return;
    const f = itemState.filters || {};
    const chips = [];
    const add = (k, v, label) => { if (v && v !== "全部") chips.push(`${label}：${v}`); };
    add("institution_type", f.institution_type, "主体");
    add("region", f.region, "地域");
    add("asset_types", f.asset_types, "资产");
    add("disposal_method", f.disposal_method, "处置");
    add("importance", f.importance, "重要度");
    add("source_category", f.source_category, "来源类别");
    add("source_name", f.source_name, "来源");
    add("q", f.q, "关键词");
    if (f.date_from || f.date_to) chips.push(`发布 ${f.date_from || "…"} ~ ${f.date_to || "…"}`);
    if (f.fetch_from || f.fetch_to) chips.push(`入库 ${f.fetch_from || "…"} ~ ${f.fetch_to || "…"}`);
    el.innerHTML = chips.length ? chips.map((c) => `<span class="chip acc">${esc(c)}</span>`).join("") : "";
  }
  function qs() {
    const p = new URLSearchParams({ page: itemState.page, page_size: itemState.page_size });
    Object.entries(itemState.filters || {}).forEach(([k, v]) => { if (v && v !== "全部") p.set(k, v); });
    return p.toString();
  }
  async function loadItems() {
    if (!meta) return;
    renderActiveFilters();
    const data = await api("/items?" + qs());
    const body = $("#itemsBody");
    if (!data.items.length) { body.innerHTML = `<tr><td colspan="9" class="empty">暂无匹配情报</td></tr>`; }
    else {
      body.innerHTML = data.items.map((r) => `
        <tr data-id="${r.id}" class="rowClick">
          <td><div class="tcell">${esc(r.title)}</div>
            <div class="url-break">${urlLink(r.url)}</div>
            <div class="minipips">${r.tags ? esc(String(r.tags)).split(",").slice(0, 3).map((t) => `<span class="chip">${t}</span>`).join("") : ""}</div></td>
          <td>${undisclosed(r.institution_type)}</td><td>${undisclosed(r.region)}</td><td>${esc(r.asset_types || "未披露")}</td>
          <td>${undisclosed(r.disposal_method)}</td>
          <td>${hasAmount(r) ? `<span class="amount">${fmtMoney(r.amount_value, r.amount_currency)}</span>` : "未披露"}</td>
          <td>${r.importance === "high" ? `<span class="chip hi">高</span>` : r.importance === "medium" ? `<span class="chip">中</span>` : `<span class="chip">低</span>`}</td>
          <td>${esc(r.source_name || "未披露")}</td>
          <td><button class="btn sm danger del">删</button></td>
        </tr>`).join("");
      body.querySelectorAll(".rowClick").forEach((tr) => tr.addEventListener("click", (e) => {
        if (e.target.closest(".del")) return; openDetail(tr.dataset.id);
      }));
      body.querySelectorAll(".del").forEach((b) => b.addEventListener("click", async (e) => {
        e.stopPropagation();
        const id = b.closest("tr").dataset.id;
        if (!confirm("确认删除该条情报？")) return;
        await api("/items/" + id, { method: "DELETE" }); toast("已删除"); loadItems(); loadDashboard();
      }));
    }
    const max = Math.max(1, Math.ceil(data.total / itemState.page_size));
    $("#pageInfo").textContent = `${data.page} / ${max}`;
    $("#prevPage").disabled = data.page <= 1;
    $("#nextPage").disabled = data.page >= max;
  }

  // ---------- drawer ----------
  async function openDetail(id) {
    const r = await api("/items/" + id);
    if (!r) return;
    const row = (l, v) => `<div class="dw-field"><label>${l}</label><div class="value">${v || "未披露"}</div></div>`;
    const amountBlock = hasAmount(r)
      ? row("金额/数量", `${fmtMoney(r.amount_value, r.amount_currency)}<div class="url-break" style="margin-top:6px;color:var(--txt-dim)">证据：${esc(r.amount_evidence)}</div>`)
      : row("金额/数量", "未披露");
    $("#drawer").innerHTML = `
      <div class="dw-head"><h2 class="dw-title">${esc(r.title)}</h2><button class="dw-close" onclick="document.querySelector('#drawer').classList.remove('open');document.querySelector('#overlay').classList.remove('show')">×</button></div>
      <div class="dw-field"><label>处置价值分析</label><div class="dw-analysis">${esc(r.analysis || "未披露")}</div></div>
      ${row("原文链接", `${esc(r.source_name || "未披露")}<div style="margin-top:6px">${urlLink(r.url)}</div>`)}
      ${row("发布时间", fmtDate(r.publish_date))}
      ${row("发布来源", esc(r.source_name || "未披露"))}
      ${amountBlock}
      ${row("信息性质", esc(r.information_nature || "未披露"))}
      ${row("事件主体", `${undisclosed(r.institution)}　<span class="chip">${undisclosed(r.institution_type)}</span>`)}
      ${row("已核实字段", `地域 ${undisclosed(r.region)}　|　资产 ${esc(r.asset_types || "未披露")}　|　处置方式 ${undisclosed(r.disposal_method)}`)}
      ${row("标签", r.tags ? esc(String(r.tags)).split(",").map((t) => `<span class="chip">${t}</span>`).join(" ") : "未披露")}
    `;
    const dw = $("#drawer"); dw.classList.add("open"); $("#overlay").classList.add("show");
  }
  $("#overlay").addEventListener("click", () => { $("#drawer").classList.remove("open"); $("#overlay").classList.remove("show"); });

  // ---------- manual add ----------
  $("#addBtn").addEventListener("click", () => {
    const fields = ["title", "url", "source_name", "source_category", "publish_date", "summary", "region", "institution", "institution_type", "asset_types", "disposal_method", "amount_value", "amount_currency"];
    $("#drawer").innerHTML = `
      <div class="dw-head"><h2 class="dw-title">手工录入情报</h2><button class="dw-close" onclick="document.querySelector('#drawer').classList.remove('open');document.querySelector('#overlay').classList.remove('show')">×</button></div>
      <div id="addForm"></div>
      <button id="saveItem" class="btn" style="width:100%;margin-top:8px">保存</button>`;
    $("#addForm").innerHTML = `<div class="form-grid">` + fields.map((f) => formField(f)).join("") + `</div>`;
    $("#drawer").classList.add("open"); $("#overlay").classList.add("show");
    // 下拉选项
    fillSelect("institution_type", meta.institution_types);
    fillSelect("source_category", ["公安", "法院", "纪委监委", "人民检察院", "财政", "产权交易所", "招投标", "媒体", "行业媒体", "国际", "政策", "其他"]);
    fillSelect("disposal_method", meta.disposal_methods);
    fillSelect("asset_types", meta.asset_types);
    $("#saveItem").addEventListener("click", async () => {
      const payload = {};
      fields.forEach((f) => { payload[f] = $(`#af-${f}`).value; });
      payload.amount_value = parseFloat(payload.amount_value) || null;
      if (!payload.title) { toast("标题必填"); return; }
      const res = await api("/items", { method: "POST", body: JSON.stringify(payload) });
      toast(res.ok ? "已录入" : (res.message || "失败"));
      if (res.ok) { $("#drawer").classList.remove("open"); $("#overlay").classList.remove("show"); loadItems(); loadDashboard(); }
    });
  });
  function formField(f) {
    const labels = { title: "标题 *", url: "链接", source_name: "来源", source_category: "来源类别", publish_date: "日期(YYYY-MM-DD)", summary: "备注", region: "地域", institution: "机构", institution_type: "主体类型", asset_types: "资产类型", disposal_method: "处置方式", amount_value: "金额/数量", amount_currency: "币种(人民币/美元/枚)" };
    if (["source_category", "institution_type", "disposal_method", "asset_types"].includes(f)) return `<div class="dw-field"><label>${labels[f]}</label><select id="af-${f}" class="select" style="width:100%"></select></div>`;
    return `<div class="dw-field"><label>${labels[f]}</label><input id="af-${f}" class="input" ${f === "title" ? "required" : ""}></div>`;
  }
  function fillSelect(field, list) {
    const sel = $(`#af-${field}`); if (!sel) return;
    sel.innerHTML = list.map((o) => `<option>${o}</option>`).join("");
  }

  // ---------- sources / logs ----------
  async function loadSources() {
    const [srcs, logs, coverage] = await Promise.all([api("/sources"), api("/scan/logs?limit=12"), api("/coverage")]);
    $("#srcBody").innerHTML = srcs.map((s) => {
      const st = s.enabled ? (s.last_status || "未运行") : "已暂停：搜索传输不可用";
      const cls = st.includes("成功") ? "tag-ok" : st.includes("失败") ? "tag-fail" : st.includes("运行") ? "tag-run" : "";
      return `<tr><td style="color:var(--txt);font-weight:500">${esc(s.name)}</td><td>${esc(s.category || "—")}</td><td class="tag">${s.source_type}</td><td class="tag">${fmtDate(s.last_scan_at)}</td><td class="${cls}">${esc(st)}</td><td class="tag">${s.item_count || 0}</td></tr>`;
    }).join("");
    $("#scanLogs").innerHTML = logs.length ? logs.map((l) => `
      <div class="list-row">
        <div class="body">
          <div class="title" style="font-family:monospace;font-size:12.5px">${fmtDate(l.run_at)} ${l.status}</div>
          <div class="meta"><span class="tag">计划 ${l.sources_planned}</span><span class="chip acc">成功 ${l.sources_ok}</span>${l.sources_failed ? `<span class="chip hi">失败 ${l.sources_failed}</span>` : ""}<span class="chip">新增 ${l.new_items}</span><span class="chip">累计 ${l.total_items}</span></div>
        </div>
      </div>`).join("") : `<div class="empty">暂无扫描记录</div>`;
    $("#coverageSummary").innerHTML = `
      <strong>全国来源建设进度（候选不等于接通）</strong><br>
      机构候选 ${coverage.institutions.candidates} · 身份已核实 ${coverage.institutions.identity_verified} ·
      频道候选 ${coverage.channels.candidates} · 端点已验证 ${coverage.channels.endpoint_verified} ·
      已接通采集 ${coverage.channels.collection_enabled}<br>
      <span class="tag">${coverage.by_kind.map(x => `${esc(x.kind)} ${x.candidates}/${x.identity_verified || 0}`).join(" · ")}</span><br>
      <span class="tag">省级候选分布：${coverage.province_presence.map(x => `${esc(x.kind)} ${x.provinces_with_candidates}/31`).join(" · ")}</span><br><br>`;
    $("#scopeHint").innerHTML = `
      本驾驶舱聚焦「数字资产/虚拟货币」罚没、司法处置赛道，监控口径包括：<br>
      ① 公安机关（罚没财物处理、涉案虚拟货币查扣与变现）；② 法院执行局（刑事/民事涉案虚拟货币处置、司法拍卖）；③ 纪委监委（收缴资产处置）；④ 检察机关（涉案财物管理）；⑤ 财政部门（罚没财物管理办法、上缴国库）；⑥ 产权/文交所（数字资产公开挂牌处置）；⑦ 招投标网站（数字资产处置招标）；⑧ 新闻报道与行业媒体；⑨ 国际（美/欧/韩等执法罚没虚拟货币）。
      <br><br><span class="tag">合规参考：银发[2021]237号 · 财政部《罚没财物管理办法》· 最高法网络司法拍卖规定 · 最高法指导案例199号</span>`;
  }

  // ---------- scan ----------
  $("#scanBtn").addEventListener("click", async () => {
    $("#scanBtn").textContent = "扫描中…"; $("#scanBtn").disabled = true;
    try {
      await api("/scan", { method: "POST" });
      let state;
      do {
        await new Promise(resolve => setTimeout(resolve, 2000));
        state = await api("/scan/status");
      } while (state.running);
      if (state.error) throw new Error(state.error);
      const res = state.result;
      toast(`扫描完成：成功 ${res.scan.sources_ok} 源，新增 ${res.scan.new_items} 条${res.report ? "，已生成日报" : "（无新增，不生成报告）"}`);
      loadDashboard(); loadItems(); loadSources();
    } catch (e) { toast("扫描失败：" + e.message); }
    $("#scanBtn").textContent = "立即扫描"; $("#scanBtn").disabled = false;
  });
  $("#logoutBtn").addEventListener("click", () => logout(true));
  $("#login-btn").addEventListener("click", login);
  $("#login-code").addEventListener("keydown", (e) => { if (e.key === "Enter") login(); });
  const viewAll = document.getElementById("viewAllItems");
  if (viewAll) viewAll.addEventListener("click", () => goItems({}));

  // ---------- boot ----------
  window.addEventListener("resize", () => {
    Object.values(charts).forEach((c) => { try { c.resize(); } catch (e) {} });
  });
  setInterval(tickClock, 1000); tickClock();
  if (localStorage.getItem(TOKEN_KEY)) enterApp().catch(() => logout(false));
})();

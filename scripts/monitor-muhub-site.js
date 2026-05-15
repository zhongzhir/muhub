#!/usr/bin/env node
/**
 * MUHUB 站点巡查脚本
 * 架构：阿里云 ESA（中国内地边缘接入）→ Vercel 源站
 *
 * 用法：
 *   node scripts/monitor-muhub-site.js          # 单次检测
 *   node scripts/monitor-muhub-site.js --watch  # 持续监控（每 5 分钟）
 *
 * 环境变量（可选，见 docs/ops/muhub-esa-monitoring.md）：
 *   NOTIFY_FEISHU_WEBHOOK   飞书机器人 Webhook URL
 *   NOTIFY_WECOM_WEBHOOK    企业微信机器人 Webhook URL
 *   NOTIFY_TELEGRAM_TOKEN   Telegram Bot Token
 *   NOTIFY_TELEGRAM_CHAT_ID Telegram Chat ID
 *   MONITOR_INTERVAL_MS     检测间隔毫秒数（默认 300000 = 5 分钟）
 *   LOG_FILE                日志文件路径（默认 logs/muhub-monitor.log）
 */

'use strict';

const https = require('https');
const http = require('http');
const dns = require('dns');
const tls = require('tls');
const fs = require('fs');
const path = require('path');
const { promisify } = require('util');
const { exec } = require('child_process');

const resolveCname = promisify(dns.resolveCname);
const resolve4 = promisify(dns.resolve4);

// ─────────────────────────────────────────────
// 配置
// ─────────────────────────────────────────────
const CONFIG = {
  targets: {
    www: 'https://www.muhub.cn',
    root: 'https://muhub.cn',
    vercel: 'https://muhub-murex.vercel.app',
  },
  // ESA CNAME 识别关键字（CNAME 链中含任一即视为指向 ESA）
  esaCnameKeywords: ['esanetwork', 'aliyuncs', 'kunlunca', 'cdnhwc', 'wscdns', 'alicdn'],
  // 证书即将过期告警阈值（天）
  certExpiryWarnDays: 30,
  // 请求超时（ms）
  requestTimeoutMs: 15000,
  // 连续失败次数触发告警
  alertThreshold: 2,
  // 监控间隔（ms）
  intervalMs: parseInt(process.env.MONITOR_INTERVAL_MS || '300000', 10),
  // 日志文件
  logFile: process.env.LOG_FILE || path.join(process.cwd(), 'logs', 'muhub-monitor.log'),
  // 通知（从环境变量读取，绝不硬编码密钥）
  notify: {
    feishuWebhook:  process.env.NOTIFY_FEISHU_WEBHOOK  || '',
    wecomWebhook:   process.env.NOTIFY_WECOM_WEBHOOK   || '',
    telegramToken:  process.env.NOTIFY_TELEGRAM_TOKEN  || '',
    telegramChatId: process.env.NOTIFY_TELEGRAM_CHAT_ID || '',
  },
};

// ─────────────────────────────────────────────
// 连续失败计数器
// ─────────────────────────────────────────────
const failureCount = { www: 0, root: 0, vercel: 0, dns: 0, cert: 0 };

// ─────────────────────────────────────────────
// 工具函数
// ─────────────────────────────────────────────

function nowStr() {
  return new Date().toISOString().replace('T', ' ').replace('Z', ' UTC');
}

const isTTY = process.stdout.isTTY;
const c = {
  reset:  isTTY ? '\x1b[0m'  : '',
  green:  isTTY ? '\x1b[32m' : '',
  red:    isTTY ? '\x1b[31m' : '',
  yellow: isTTY ? '\x1b[33m' : '',
  bold:   isTTY ? '\x1b[1m'  : '',
};

function appendLog(plain) {
  try {
    const dir = path.dirname(CONFIG.logFile);
    if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });
    fs.appendFileSync(CONFIG.logFile, plain + '\n', 'utf8');
  } catch (_) {}
}

function log(tag, msg) {
  const line = `[${nowStr()}] [${tag}] ${msg}`;
  console.log(line);
  appendLog(line.replace(/\x1b\[[0-9;]*m/g, ''));
}

const logInfo  = (m) => log('INFO ', m);
const logOk    = (m) => log(`${c.green}OK   ${c.reset}`, m);
const logWarn  = (m) => log(`${c.yellow}WARN ${c.reset}`, m);
const logError = (m) => log(`${c.red}ERROR${c.reset}`, m);
const logAlert = (m) => log(`${c.bold}${c.red}ALERT${c.reset}`, m);

// ─────────────────────────────────────────────
// HTTP(S) GET（支持重定向跟踪）
// ─────────────────────────────────────────────
function httpGet(url, { followRedirects = true, maxRedirects = 5, timeout = CONFIG.requestTimeoutMs } = {}) {
  return new Promise((resolve, reject) => {
    const t0 = Date.now();
    let hops = 0;

    function doReq(currentUrl, history) {
      const parsed = new URL(currentUrl);
      const mod = parsed.protocol === 'https:' ? https : http;
      const opts = {
        hostname: parsed.hostname,
        port: parsed.port || (parsed.protocol === 'https:' ? 443 : 80),
        path: parsed.pathname + parsed.search,
        method: 'GET',
        timeout,
        headers: { 'User-Agent': 'MUHUB-Monitor/1.0', 'Accept': '*/*' },
        rejectUnauthorized: false,   // 证书单独由 tls 模块检查
      };

      const req = mod.request(opts, (res) => {
        res.resume();
        const elapsed = Date.now() - t0;
        if (
          followRedirects &&
          [301, 302, 303, 307, 308].includes(res.statusCode) &&
          res.headers.location &&
          hops < maxRedirects
        ) {
          hops++;
          history.push({ url: currentUrl, statusCode: res.statusCode, location: res.headers.location });
          const next = new URL(res.headers.location, currentUrl).toString();
          doReq(next, history);
        } else {
          resolve({ url: currentUrl, statusCode: res.statusCode, headers: res.headers, redirectHistory: history, elapsed, finalUrl: currentUrl });
        }
      });
      req.on('timeout', () => { req.destroy(); reject(new Error(`请求超时（>${timeout}ms）: ${currentUrl}`)); });
      req.on('error',   (e) => reject(new Error(`网络错误: ${e.message} [${currentUrl}]`)));
      req.end();
    }

    doReq(url, []);
  });
}

// ─────────────────────────────────────────────
// HTTPS 证书检查
// ─────────────────────────────────────────────
function checkCert(hostname, port = 443) {
  return new Promise((resolve) => {
    const sock = tls.connect({ host: hostname, port, servername: hostname, rejectUnauthorized: false }, () => {
      const cert = sock.getPeerCertificate();
      sock.destroy();
      if (!cert || !cert.valid_to) {
        resolve({ ok: false, error: '无法获取证书信息', daysLeft: null });
        return;
      }
      const expiry = new Date(cert.valid_to);
      const daysLeft = Math.floor((expiry - Date.now()) / 86400000);
      resolve({
        ok: daysLeft > 0,
        expiry: expiry.toISOString().split('T')[0],
        daysLeft,
        issuer: cert.issuer ? (cert.issuer.O || cert.issuer.CN || '') : '',
        subject: cert.subject ? (cert.subject.CN || '') : '',
        error: daysLeft <= 0 ? '证书已过期' : null,
        warn: (daysLeft > 0 && daysLeft <= CONFIG.certExpiryWarnDays)
          ? `证书将在 ${daysLeft} 天后到期` : null,
      });
    });
    sock.on('error', (e) => resolve({ ok: false, error: `TLS 连接失败: ${e.message}`, daysLeft: null }));
    sock.setTimeout(CONFIG.requestTimeoutMs, () => { sock.destroy(); resolve({ ok: false, error: 'TLS 连接超时', daysLeft: null }); });
  });
}

// ─────────────────────────────────────────────
// DNS 检查
// ─────────────────────────────────────────────
async function checkDns() {
  const result = { ok: false, cnames: [], ips: [], pointsToEsa: false, error: null, warn: null };
  try {
    try { result.cnames = await resolveCname('www.muhub.cn'); } catch (_) {}
    try { result.ips = await resolve4('www.muhub.cn'); } catch (e) {
      result.error = `A 记录解析失败: ${e.message}`; return result;
    }
    const cnameStr = result.cnames.join(' ').toLowerCase();
    result.pointsToEsa = CONFIG.esaCnameKeywords.some((kw) => cnameStr.includes(kw));
    if (result.cnames.length > 0 && !result.pointsToEsa) {
      result.warn = `CNAME [${result.cnames.join(' → ')}] 未识别为 ESA 节点，请人工确认`;
    }
    result.ok = result.ips.length > 0;
  } catch (e) { result.error = e.message; }
  return result;
}

// ─────────────────────────────────────────────
// 故障分类
// ─────────────────────────────────────────────
const FaultType = {
  DNS_NOT_ESA:              'DNS_NOT_ESA',
  ESA_REACHABLE_ORIGIN_FAIL:'ESA_REACHABLE_ORIGIN_FAIL',
  VERCEL_UNREACHABLE:       'VERCEL_UNREACHABLE',
  CERT_INVALID:             'CERT_INVALID',
  CERT_EXPIRING:            'CERT_EXPIRING',
  ROOT_REDIRECT_WRONG:      'ROOT_REDIRECT_WRONG',
  NETWORK_TIMEOUT:          'NETWORK_TIMEOUT',
  HTTP_NON_200:             'HTTP_NON_200',
};

function classifyFaults({ wwwResult, rootResult, vercelResult, dnsResult, certResult }) {
  const faults = [];

  // DNS 异常
  if (dnsResult && (!dnsResult.ok || dnsResult.warn)) {
    faults.push({
      type: FaultType.DNS_NOT_ESA,
      desc: dnsResult.error || dnsResult.warn || 'DNS 解析结果未识别为 ESA',
      advice: [
        '登录阿里云 DNS 控制台，确认 www.muhub.cn 的 CNAME 已指向 ESA 分配的接入域名',
        '在「ESA 控制台」>「加速域名」确认 www.muhub.cn 已添加并处于正常状态',
        '等待 DNS TTL 刷新（通常 5–10 分钟），或运行 dig www.muhub.cn 确认',
        '若 CNAME 正确但此告警持续，可能是 ESA 节点域名格式与识别关键字不匹配，请更新脚本 CONFIG.esaCnameKeywords',
      ],
    });
  }

  // 证书过期/无效
  if (certResult && !certResult.ok && certResult.error) {
    faults.push({
      type: FaultType.CERT_INVALID,
      desc: `HTTPS 证书无效: ${certResult.error}`,
      advice: [
        '进入「阿里云 ESA」>「证书管理」，检查 www.muhub.cn 是否已绑定有效证书',
        '若证书已过期，在「数字证书管理服务」重新申请 DV 证书并重新绑定到 ESA',
        '确认 ESA 回源协议为 HTTPS，且 Vercel 源站证书（*.vercel.app）也有效',
      ],
    });
  }

  // 证书即将到期
  if (certResult && certResult.warn) {
    faults.push({
      type: FaultType.CERT_EXPIRING,
      desc: certResult.warn,
      advice: [
        `证书剩余 ${certResult.daysLeft} 天，请尽快在「数字证书管理服务」续期`,
        '建议开启免费 DV 证书（90 天）的自动续期功能',
        '续期后在「ESA」>「加速域名」>「HTTPS 配置」重新关联新证书',
      ],
    });
  }

  // Vercel 源站不可达
  if (vercelResult && (vercelResult.error || (vercelResult.statusCode >= 500))) {
    faults.push({
      type: FaultType.VERCEL_UNREACHABLE,
      desc: vercelResult.error || `Vercel 返回 HTTP ${vercelResult.statusCode}`,
      advice: [
        '访问 https://vercel.com/dashboard 确认 muhub-murex 项目状态',
        '查看「Deployments」最新部署是否成功',
        '查看 Vercel 状态页：https://www.vercelstatus.com',
        '如 Vercel 故障，可在 ESA 临时开启「回源失败缓存」以降低影响',
      ],
    });
  }

  // ESA 可达但 www 异常（且 Vercel 正常）
  if (
    wwwResult && wwwResult.statusCode && wwwResult.statusCode !== 200 &&
    vercelResult && !vercelResult.error && vercelResult.statusCode === 200
  ) {
    faults.push({
      type: FaultType.ESA_REACHABLE_ORIGIN_FAIL,
      desc: `ESA 层面返回 ${wwwResult.statusCode}，但 Vercel 源站正常（200）`,
      advice: [
        '登录 ESA 控制台，检查「回源配置」：源站地址 muhub-murex.vercel.app，协议 HTTPS，端口 443',
        '确认 ESA 回源时 Host Header 设置为 muhub-murex.vercel.app（而非 www.muhub.cn）',
        '使用「ESA 诊断」>「节点网络测试」，测试到 Vercel 的回源链路',
        '查看 ESA 访问日志，确认回源响应码与缓存命中情况',
      ],
    });
  }

  // 根域名跳转异常
  if (rootResult) {
    const firstHop = rootResult.redirectHistory?.[0];
    const goodRedirect = firstHop && [301, 308].includes(firstHop.statusCode)
      && rootResult.finalUrl?.startsWith('https://www.muhub.cn');
    if (rootResult.error || !goodRedirect) {
      faults.push({
        type: FaultType.ROOT_REDIRECT_WRONG,
        desc: rootResult.error
          ? `根域名不可达: ${rootResult.error}`
          : `根域名未正确 301/308 跳转（首跳: ${firstHop?.statusCode ?? rootResult.statusCode}，最终: ${rootResult.finalUrl}）`,
        advice: [
          '在 ESA 控制台为 muhub.cn 配置「重定向规则」：将所有请求 301 重定向到 https://www.muhub.cn$request_uri',
          '确认 ESA 已将 muhub.cn（根域名）添加为加速域名（根域名需单独配置，不能与 www 合并）',
          '检查阿里云 DNS 中 muhub.cn 是否有正确的 CNAME 或 A 记录指向 ESA 节点',
          '备案核查要求：根域名和 www 子域名均须完成 ICP 备案，且均须接入 ESA',
        ],
      });
    }
  }

  // 多端点超时（可能是本地网络问题）
  const timeoutCount = [wwwResult, rootResult, vercelResult]
    .filter((r) => r && r.error && r.error.includes('超时')).length;
  if (timeoutCount >= 2) {
    faults.push({
      type: FaultType.NETWORK_TIMEOUT,
      desc: `${timeoutCount} 个端点检测超时，疑似本地网络问题`,
      advice: [
        '运行 ping 8.8.8.8 确认本地网络连通性',
        '尝试切换至手机热点重新检测，排除本地 ISP 或 DNS 干扰',
        '若为服务器监控，检查出口带宽与防火墙策略',
        '连续多次超时可联系阿里云 ESA 技术支持排查节点问题',
      ],
    });
  }

  // 兜底：仅 www 非 200 但无其他故障
  if (
    faults.length === 0 &&
    wwwResult && !wwwResult.error && wwwResult.statusCode !== 200
  ) {
    faults.push({
      type: FaultType.HTTP_NON_200,
      desc: `www.muhub.cn 返回 HTTP ${wwwResult.statusCode}`,
      advice: [
        '检查 Vercel 项目最新 Deployment 日志，确认构建是否成功',
        '确认 Next.js 应用无运行时异常',
        '检查 ESA 是否有异常缓存规则导致响应被篡改',
      ],
    });
  }

  return faults;
}

// ─────────────────────────────────────────────
// 可安全自动执行的修复操作
// ─────────────────────────────────────────────
function flushLocalDnsCache() {
  return new Promise((resolve) => {
    let cmd = '';
    if (process.platform === 'darwin') {
      cmd = 'dscacheutil -flushcache && killall -HUP mDNSResponder 2>/dev/null';
    } else if (process.platform === 'linux') {
      cmd = 'systemd-resolve --flush-caches 2>/dev/null || resolvectl flush-caches 2>/dev/null || true';
    } else {
      return resolve({ ok: false, msg: '当前平台不支持自动刷新 DNS 缓存' });
    }
    exec(cmd, (err) => resolve(
      err ? { ok: false, msg: `DNS 缓存刷新失败: ${err.message}` }
          : { ok: true,  msg: '本地 DNS 缓存已刷新' }
    ));
  });
}

// ─────────────────────────────────────────────
// 通知发送
// ─────────────────────────────────────────────
function postJson(urlStr, body) {
  return new Promise((resolve) => {
    try {
      const u = new URL(urlStr);
      const data = JSON.stringify(body);
      const req = https.request(
        { hostname: u.hostname, port: 443, path: u.pathname + u.search, method: 'POST',
          headers: { 'Content-Type': 'application/json', 'Content-Length': Buffer.byteLength(data) } },
        (res) => { res.resume(); resolve(true); }
      );
      req.on('error', () => resolve(false));
      req.setTimeout(8000, () => { req.destroy(); resolve(false); });
      req.write(data); req.end();
    } catch (_) { resolve(false); }
  });
}

async function sendAlerts(text) {
  const sent = [];
  if (CONFIG.notify.feishuWebhook) {
    const ok = await postJson(CONFIG.notify.feishuWebhook, { msg_type: 'text', content: { text } });
    if (ok) sent.push('飞书');
  }
  if (CONFIG.notify.wecomWebhook) {
    const ok = await postJson(CONFIG.notify.wecomWebhook, { msgtype: 'text', text: { content: text } });
    if (ok) sent.push('企业微信');
  }
  if (CONFIG.notify.telegramToken && CONFIG.notify.telegramChatId) {
    const ok = await postJson(
      `https://api.telegram.org/bot${CONFIG.notify.telegramToken}/sendMessage`,
      { chat_id: CONFIG.notify.telegramChatId, text, parse_mode: 'Markdown' }
    );
    if (ok) sent.push('Telegram');
  }
  return sent;
}

// ─────────────────────────────────────────────
// 主检测流程
// ─────────────────────────────────────────────
async function runCheck() {
  const SEP = '─'.repeat(62);
  logInfo('═'.repeat(62));
  logInfo('🔍 MUHUB 站点巡查开始');
  logInfo(SEP);

  const results = {};
  let hasError = false;

  // ① www.muhub.cn
  logInfo('① 检测 www.muhub.cn ...');
  try {
    const r = await httpGet(CONFIG.targets.www, { followRedirects: false });
    results.www = r;
    if (r.statusCode === 200) {
      logOk(`  ✅ www.muhub.cn  HTTP ${r.statusCode}  耗时 ${r.elapsed}ms`);
      failureCount.www = 0;
    } else {
      logWarn(`  ⚠️  www.muhub.cn  HTTP ${r.statusCode}  耗时 ${r.elapsed}ms`);
      failureCount.www++; hasError = true;
    }
  } catch (e) {
    results.www = { error: e.message };
    logError(`  ❌ www.muhub.cn  ${e.message}`);
    failureCount.www++; hasError = true;
  }

  // ② muhub.cn 根域名跳转
  logInfo('② 检测 muhub.cn 根域名跳转 ...');
  try {
    const r = await httpGet(CONFIG.targets.root, { followRedirects: true });
    results.root = r;
    const firstHop = r.redirectHistory?.[0];
    const good = firstHop && [301, 308].includes(firstHop.statusCode)
                 && r.finalUrl?.startsWith('https://www.muhub.cn');
    if (good) {
      logOk(`  ✅ muhub.cn → ${firstHop.statusCode} → ${r.finalUrl}  耗时 ${r.elapsed}ms`);
      failureCount.root = 0;
    } else {
      const detail = firstHop ? `首跳 ${firstHop.statusCode} → ${firstHop.location}` : `直接 ${r.statusCode}，无跳转`;
      logWarn(`  ⚠️  根域名跳转异常: ${detail}  耗时 ${r.elapsed}ms`);
      failureCount.root++; hasError = true;
    }
  } catch (e) {
    results.root = { error: e.message };
    logError(`  ❌ muhub.cn  ${e.message}`);
    failureCount.root++; hasError = true;
  }

  // ③ Vercel 源站
  logInfo('③ 检测 Vercel 源站 muhub-murex.vercel.app ...');
  try {
    const r = await httpGet(CONFIG.targets.vercel, { followRedirects: true });
    results.vercel = r;
    if (r.statusCode === 200) {
      logOk(`  ✅ Vercel 源站  HTTP ${r.statusCode}  耗时 ${r.elapsed}ms`);
      failureCount.vercel = 0;
    } else {
      logWarn(`  ⚠️  Vercel 源站  HTTP ${r.statusCode}  耗时 ${r.elapsed}ms`);
      failureCount.vercel++; hasError = true;
    }
  } catch (e) {
    results.vercel = { error: e.message };
    logError(`  ❌ Vercel 源站  ${e.message}`);
    failureCount.vercel++; hasError = true;
  }

  // ④ DNS
  logInfo('④ 检测 DNS 解析 www.muhub.cn ...');
  results.dns = await checkDns();
  if (results.dns.ok && !results.dns.warn) {
    const cStr = results.dns.cnames.length ? `  CNAME: ${results.dns.cnames.join(' → ')}` : '';
    logOk(`  ✅ DNS 正常  IP: [${results.dns.ips.join(', ')}]${cStr}`);
    failureCount.dns = 0;
  } else if (results.dns.ok && results.dns.warn) {
    logWarn(`  ⚠️  ${results.dns.warn}  IP: [${results.dns.ips.join(', ')}]`);
    failureCount.dns++; hasError = true;
  } else {
    logError(`  ❌ DNS 异常: ${results.dns.error || results.dns.warn}`);
    failureCount.dns++; hasError = true;
  }

  // ⑤ HTTPS 证书
  logInfo('⑤ 检测 HTTPS 证书 www.muhub.cn ...');
  results.cert = await checkCert('www.muhub.cn');
  if (results.cert.ok && !results.cert.warn) {
    logOk(`  ✅ 证书有效  到期: ${results.cert.expiry}（剩余 ${results.cert.daysLeft} 天）  签发: ${results.cert.issuer}`);
    failureCount.cert = 0;
  } else if (results.cert.ok && results.cert.warn) {
    logWarn(`  ⚠️  ${results.cert.warn}  到期: ${results.cert.expiry}`);
    failureCount.cert++; hasError = true;
  } else {
    logError(`  ❌ 证书异常: ${results.cert.error}`);
    failureCount.cert++; hasError = true;
  }

  // ─── 故障分类 & 修复建议 ───
  logInfo(SEP);
  const faults = classifyFaults({ wwwResult: results.www, rootResult: results.root, vercelResult: results.vercel, dnsResult: results.dns, certResult: results.cert });

  if (!hasError) {
    logOk('🎉 所有检测项均正常，MUHUB 站点健康');
  } else {
    logError(`发现 ${faults.length} 类故障：`);
    faults.forEach((f, i) => {
      logError(`\n  [故障 ${i + 1}] ${f.type}`);
      logError(`  描述: ${f.desc}`);
      logWarn(`  修复建议:`);
      f.advice.forEach((a, j) => logWarn(`    ${j + 1}. ${a}`));
    });

    // 可安全自动执行：DNS 相关故障时刷新本地缓存
    const hasDnsFault = faults.some((f) =>
      [FaultType.DNS_NOT_ESA, FaultType.NETWORK_TIMEOUT].includes(f.type)
    );
    if (hasDnsFault) {
      logInfo('\n🔧 自动操作：刷新本地 DNS 缓存 ...');
      const r = await flushLocalDnsCache();
      r.ok ? logOk(`  ✅ ${r.msg}`) : logWarn(`  ⚠️  ${r.msg}`);
    }
  }

  // ─── 连续失败告警 ───
  logInfo(SEP);
  const alertItems = Object.entries(failureCount)
    .filter(([, n]) => n >= CONFIG.alertThreshold)
    .map(([k, n]) => `${k}（连续 ${n} 次）`);

  if (alertItems.length > 0) {
    const msg = [
      '🚨 [MUHUB 站点告警]',
      `时间: ${nowStr()}`,
      `连续失败: ${alertItems.join('，')}`,
      `故障类型: ${[...new Set(faults.map((f) => f.type))].join('，')}`,
      '请立即检查: https://www.muhub.cn',
    ].join('\n');

    logAlert(msg);
    const sent = await sendAlerts(msg);
    logInfo(`告警通知已发送至: ${sent.length ? sent.join('、') : '无（已写入日志文件）'}`);
  } else {
    logOk(`连续失败次数未达阈值（${CONFIG.alertThreshold}），无需告警`);
  }

  logInfo(`巡查完成  日志: ${CONFIG.logFile}`);
  logInfo('═'.repeat(62) + '\n');
  return { hasError, faults };
}

// ─────────────────────────────────────────────
// 入口
// ─────────────────────────────────────────────
async function main() {
  if (process.argv.includes('--watch')) {
    logInfo(`启动持续监控模式，间隔 ${CONFIG.intervalMs / 1000}s`);
    await runCheck();
    setInterval(runCheck, CONFIG.intervalMs);
  } else {
    const { hasError } = await runCheck();
    process.exitCode = hasError ? 1 : 0;
  }
}

main().catch((e) => { console.error('巡查脚本异常退出:', e); process.exitCode = 2; });

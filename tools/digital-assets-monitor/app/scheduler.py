"""定时任务：按配置的频率扫描，成功后仅在出现新情报时生成报告。"""
import logging
import threading

_job_lock = threading.Lock()
_state = {"running": False, "result": None, "error": None}
_state_lock = threading.Lock()

from apscheduler.schedulers.background import BackgroundScheduler

from app.config import get_settings
from app import database as db
from app.scraper.pipeline import run_scan
from app.report import generate_daily_report

log = logging.getLogger("scheduler")
_scheduler: BackgroundScheduler = None


def _daily_job():
    log.info("开始每日扫描…")
    try:
        res, report = trigger_now()
        log.info("扫描完成: %s", res)
        if report:
            log.info("有新情报，已生成日报: %s", report["title"])
        else:
            log.info("无新增情报，不生成报告")
    except Exception as e:  # noqa
        log.exception("日常扫描失败: %s", e)


def start():
    global _scheduler
    schedule = get_settings().get("schedule", {})
    if not schedule.get("enabled", True):
        log.info("定时任务已禁用")
        return
    _scheduler = BackgroundScheduler(timezone=schedule.get("timezone", "Asia/Shanghai"))
    hm = schedule.get("daily_scan_time", "08:00").split(":")
    frequency = schedule.get("frequency", "daily")
    trigger_args = {"hour": int(hm[0]), "minute": int(hm[1])}
    if frequency == "weekly":
        trigger_args["day_of_week"] = schedule.get("day_of_week", "fri")
    elif frequency != "daily":
        raise ValueError(f"不支持的扫描频率: {frequency}")
    _scheduler.add_job(_daily_job, "cron", id="scheduled_scan", **trigger_args)
    _scheduler.start()
    if frequency == "weekly":
        log.info(
            "定时任务启动，每周 %s %s 扫描",
            trigger_args["day_of_week"],
            schedule.get("daily_scan_time"),
        )
    else:
        log.info("定时任务启动，每日 %s 扫描", schedule.get("daily_scan_time"))


def stop():
    global _scheduler
    if _scheduler:
        _scheduler.shutdown(wait=False)
        _scheduler = None


def trigger_now():
    """手动触发一次扫描+报告。返回 (scan_result, report)。"""
    if not _job_lock.acquire(blocking=False):
        raise RuntimeError("已有扫描正在运行")
    try:
        res = run_scan()
        report = generate_daily_report() if res["new_items"] else None
        return res, report
    finally:
        _job_lock.release()


def scan_status():
    with _state_lock:
        return dict(_state)


def start_manual():
    from fastapi import HTTPException
    with _state_lock:
        if _state["running"] or _job_lock.locked():
            raise HTTPException(409, "已有扫描正在运行")
        _state.update(running=True, result=None, error=None)
    def worker():
        try:
            res, report = trigger_now()
            with _state_lock:
                _state["result"] = {"scan": res, "report": report}
        except Exception:
            log.exception("Manual scan failed")
            with _state_lock:
                _state["error"] = "扫描失败，请查看运行日志后重试"
        finally:
            with _state_lock:
                _state["running"] = False
    threading.Thread(target=worker, daemon=True).start()
    return {"ok": True, "running": True}

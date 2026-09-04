"""数字资产处置情报驾驶舱 —— FastAPI 入口。"""
import logging
from pathlib import Path

from fastapi import FastAPI
from fastapi.responses import FileResponse
from fastapi.staticfiles import StaticFiles

from app.config import get_settings
from app import database as db, scheduler
from app.api.routes import router

BASE_DIR = Path(__file__).resolve().parent.parent
STATIC_DIR = BASE_DIR / "static"

logging.basicConfig(level=logging.INFO)


def create_app():
    settings = get_settings()
    app = FastAPI(title=settings["app_name"], version=settings["version"])

    from app.security import validate_config
    validate_config()

    app.include_router(router)

    # 初始化数据库 + 种子 + 信息源注册
    db.init_db()
    from app.scraper.pipeline import sync_sources
    sync_sources()
    conn = db.connect()
    try:
        count = conn.execute("SELECT COUNT(*) c FROM items").fetchone()["c"]
        if count == 0 and settings.get("seed_on_first_run", True):
            from app.seed import seed
            conn.execute("BEGIN")
            n = seed(conn)
            conn.commit()
            logging.info("已写入初始种子情报 %s 条", n)
    finally:
        conn.close()

    # 静态资源
    app.mount("/static", StaticFiles(directory=str(STATIC_DIR)), name="static")

    @app.get("/")
    def index():
        return FileResponse(str(STATIC_DIR / "index.html"))

    @app.get("/dashboard")
    def dashboard():
        return FileResponse(str(STATIC_DIR / "index.html"))

    @app.on_event("startup")
    def _start():
        scheduler.start()

    @app.on_event("shutdown")
    def _shutdown():
        scheduler.stop()

    return app


app = create_app()


if __name__ == "__main__":
    import uvicorn
    settings = get_settings()
    uvicorn.run(app, host=settings.get("host", "0.0.0.0"), port=int(settings.get("port", 8000)))

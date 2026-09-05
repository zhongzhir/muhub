import sys
import unittest
from pathlib import Path
from unittest.mock import patch

sys.path.insert(0, str(Path(__file__).resolve().parents[1]))

from app import scheduler


class FakeScheduler:
    def __init__(self, timezone):
        self.timezone = timezone
        self.jobs = []
        self.started = False

    def add_job(self, func, trigger, **kwargs):
        self.jobs.append((func, trigger, kwargs))

    def start(self):
        self.started = True

    def shutdown(self, wait=False):
        self.started = False


class SchedulerConfigTests(unittest.TestCase):
    def tearDown(self):
        scheduler.stop()

    def test_weekly_schedule_uses_configured_weekday_and_time(self):
        settings = {
            "schedule": {
                "enabled": True,
                "frequency": "weekly",
                "day_of_week": "fri",
                "daily_scan_time": "19:00",
                "timezone": "Asia/Shanghai",
            }
        }
        with patch.object(scheduler, "get_settings", return_value=settings), patch.object(
            scheduler, "BackgroundScheduler", FakeScheduler
        ):
            scheduler.start()

        self.assertTrue(scheduler._scheduler.started)
        self.assertEqual(scheduler._scheduler.timezone, "Asia/Shanghai")
        _, trigger, kwargs = scheduler._scheduler.jobs[0]
        self.assertEqual(trigger, "cron")
        self.assertEqual(kwargs["id"], "scheduled_scan")
        self.assertEqual(kwargs["day_of_week"], "fri")
        self.assertEqual(kwargs["hour"], 19)
        self.assertEqual(kwargs["minute"], 0)

    def test_existing_daily_configuration_remains_supported(self):
        settings = {"schedule": {"enabled": True, "daily_scan_time": "08:30"}}
        with patch.object(scheduler, "get_settings", return_value=settings), patch.object(
            scheduler, "BackgroundScheduler", FakeScheduler
        ):
            scheduler.start()

        _, _, kwargs = scheduler._scheduler.jobs[0]
        self.assertNotIn("day_of_week", kwargs)
        self.assertEqual(kwargs["hour"], 8)
        self.assertEqual(kwargs["minute"], 30)


if __name__ == "__main__":
    unittest.main()
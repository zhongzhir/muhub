import sys
import unittest
from pathlib import Path
sys.path.insert(0,str(Path(__file__).resolve().parents[1]))
from app.analysis.publication import publication_evidence

class PublicationTests(unittest.TestCase):
    def test_last_modified_never_replaces_original(self):
        html='<meta name="firstpublishedtime" content="2026-07-12-09:37:43"><meta name="lastmodifiedtime" content="2026-08-11-22:43:09">'
        result=publication_evidence(html,"2026-08-11T00:00:00+08:00")
        self.assertEqual(result["publisher_date"],"2026-07-12")
        self.assertTrue(result["provider_date_conflict"])
    def test_provider_only_stays_unverified(self):
        self.assertIsNone(publication_evidence('<title>文字实录</title>',"2026-08-24T00:00:00+08:00")["publisher_date"])
    def test_conflicting_publisher_fields_require_review(self):
        html='<meta name="firstpublishedtime" content="2026-07-12"><meta property="article:published_time" content="2026-08-11">'
        self.assertEqual(publication_evidence(html)["status"],"conflicting_publisher_dates")
    def test_modified_only_stays_unverified(self):
        html='<meta name="lastmodifiedtime" content="2026-08-11">'
        self.assertIsNone(publication_evidence(html)["publisher_date"])

if __name__=="__main__":unittest.main()

import sys,tempfile,unittest
from pathlib import Path
sys.path.insert(0,str(Path(__file__).resolve().parents[1]))
from app import database as db
from app.registry import sync_registry,coverage_summary
class RegistryTests(unittest.TestCase):
 def test_candidates_and_operational_channels_are_separate(self):
  with tempfile.TemporaryDirectory() as folder:
   old=db.DB_PATH;db.DB_PATH=Path(folder)/"db.sqlite"
   try:
    db.init_db();sync_registry();result=coverage_summary()
    self.assertGreaterEqual(result["institutions"]["candidates"],392)
    self.assertGreaterEqual(result["channels"]["candidates"],3)
    self.assertEqual(result["channels"]["collection_enabled"],4)
    public_resources=next(x for x in result["province_presence"] if x["kind"]=="public_resource_platform")
    self.assertEqual(public_resources["provinces_with_candidates"],31)
    self.assertEqual(public_resources["identity_verified"],1)
    self.assertEqual(result["channels"]["endpoint_verified"],0)
    conn=db.connect();conn.execute("UPDATE institution_channels SET endpoint_verified=1,status='production_scan_ok' WHERE id='configured-police-tianjin'");conn.commit();conn.close()
    sync_registry()
    self.assertEqual(coverage_summary()["channels"]["endpoint_verified"],1)
    self.assertGreater(result["institutions"]["candidates"],result["institutions"]["identity_verified"])
   finally:db.DB_PATH=old
if __name__=="__main__":unittest.main()

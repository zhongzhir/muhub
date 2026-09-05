#!/usr/bin/env bash
# Install a fully extracted release without Git network access.
set -euo pipefail
REV=${1:?Pass the verified 40-character commit SHA}
STAGE=${2:?Pass the extracted release directory}
[[ "$REV" =~ ^[0-9a-f]{40}$ ]] || { echo 'Invalid commit SHA'; exit 1; }
BASE=/opt/digital-assets-monitor
STAMP=$(date +%Y%m%d-%H%M%S)
BACKUP=$BASE/app-before-$STAMP
DBBACKUP=/var/backups/digital-assets-monitor/monitor-$STAMP.db
[[ -d "$STAGE" && ! -L "$STAGE" && "$STAGE" == "$BASE"/release-* ]] || { echo 'Unexpected stage path'; exit 1; }
[[ "$(cat "$STAGE/REVISION")" == "$REV" ]] || { echo 'Revision marker mismatch'; exit 1; }
[[ -d "$BASE/app" && ! -L "$BASE/app" && ! -e "$BACKUP" ]] || { echo 'Unexpected application path'; exit 1; }
for test in test_publication.py test_search_verification.py test_registry.py test_collection_repair.py test_security.py test_pipeline.py smoke_test.py; do
  "$BASE/venv/bin/python" "$STAGE/tests/$test"
done
mkdir -p /var/backups/digital-assets-monitor
chmod 700 /var/backups/digital-assets-monitor
"$BASE/venv/bin/python" - "$DBBACKUP" <<'PYBACKUP'
import sqlite3,sys
source=sqlite3.connect('file:/var/lib/digital-assets-monitor/monitor.db?mode=ro',uri=True)
target=sqlite3.connect(sys.argv[1]);source.backup(target)
target.close();source.close();print('SQLite online backup completed')
PYBACKUP
moved=0
rollback() {
  if [[ "$moved" == 1 ]]; then
    systemctl stop digital-assets-monitor || true
    [[ ! -e "$BASE/app" ]] || mv "$BASE/app" "$BASE/failed-$STAMP"
    mv "$BACKUP" "$BASE/app"
    systemctl start digital-assets-monitor
    echo 'Install failed; previous application restored'
  fi
}
trap rollback ERR
systemctl stop digital-assets-monitor
mv "$BASE/app" "$BACKUP"
moved=1
mv "$STAGE" "$BASE/app"
systemctl start digital-assets-monitor
ready=0
for attempt in $(seq 1 30); do
  if curl --fail --silent --max-time 2 http://127.0.0.1:18080/ -o /dev/null; then ready=1; break; fi
  sleep 1
done
[[ "$ready" == 1 ]]
"$BASE/venv/bin/python" "$BASE/app/scripts/verify_deployment.py"
trap - ERR
echo "Updated revision: $REV"
echo "Previous application: $BACKUP"
echo 'Credentials, production data and Nginx configuration preserved'

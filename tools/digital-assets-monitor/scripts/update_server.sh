#!/usr/bin/env bash
# Update only this standalone service. Data, credentials and Nginx stay in place.
set -euo pipefail
REV=${1:?Pass the verified 40-character commit SHA}
[[ "$REV" =~ ^[0-9a-f]{40}$ ]] || { echo 'Invalid commit SHA'; exit 1; }
BASE=/opt/digital-assets-monitor
REPO=$BASE/repository
STAMP=$(date +%Y%m%d-%H%M%S)
STAGE=$BASE/release-$STAMP
BACKUP=$BASE/app-before-$STAMP
[[ -d "$BASE/app" && ! -L "$BASE/app" ]] || { echo 'Unexpected app path; stop'; exit 1; }
[[ ! -e "$STAGE" && ! -e "$BACKUP" ]] || exit 1
# A previously fetched immutable revision needs no second network request.
if ! git -C "$REPO" cat-file -e "$REV^{commit}" 2>/dev/null; then
  git -C "$REPO" fetch origin "$REV"
fi
git -C "$REPO" cat-file -e "$REV^{commit}"
mkdir "$STAGE"
git -C "$REPO" archive "$REV" tools/digital-assets-monitor | tar -x --strip-components=2 -C "$STAGE"
printf '%s\n' "$REV" > "$STAGE/REVISION"
for test in test_publication.py test_search_verification.py test_registry.py test_collection_repair.py test_security.py test_pipeline.py smoke_test.py; do
  "$BASE/venv/bin/python" "$STAGE/tests/$test"
done
python3 - "$STAMP" <<'PYBACKUP'
import sqlite3,sys,os
folder='/var/backups/digital-assets-monitor'
os.makedirs(folder,mode=0o700,exist_ok=True)
os.chmod(folder,0o700)
source=sqlite3.connect('file:/var/lib/digital-assets-monitor/monitor.db?mode=ro',uri=True)
target=sqlite3.connect(folder+'/monitor-'+sys.argv[1]+'.db')
source.backup(target)
target.close();source.close()
print('SQLite online backup completed')
PYBACKUP
moved=0
rollback() {
  if [[ "$moved" == 1 ]]; then
    systemctl stop digital-assets-monitor || true
    if [[ -e "$BASE/app" ]]; then mv "$BASE/app" "$BASE/failed-$STAMP"; fi
    mv "$BACKUP" "$BASE/app"
    systemctl start digital-assets-monitor
    echo 'Update failed; previous application restored'
  else
    systemctl start digital-assets-monitor || true
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

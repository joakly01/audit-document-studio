#!/usr/bin/env bash
set -euo pipefail
export PATH="$PATH:/usr/sbin:/sbin"
if [[ $# -ne 2 ]]; then
    printf '%s\n' 'Usage: bash deploy/local-deploy.sh API_BUILD_DIR DEMO_BUILD_DIR' >&2
    exit 1
fi
if [[ $EUID -ne 0 ]]; then
    exec sudo -n bash "$0" "$@"
fi
frontend_root=$(cd -- "$(dirname -- "${BASH_SOURCE[0]}")/.." && pwd)
api_build=$(realpath -- "$1")
demo_build=$(realpath -- "$2")
deploy_root=/var/www/audit-document-studio
nginx_config=/etc/nginx/conf.d/audit-document-studio.conf
test -f "$api_build/index.html"
test -f "$demo_build/index.html"
if [[ -n $(find "$api_build" "$demo_build" -type l -print -quit) ]]; then
    printf '%s\n' 'Build output must not contain symlinks.' >&2
    exit 1
fi
mkdir -p "$deploy_root/releases" "$deploy_root/config-backups"
release_dir=$(mktemp -d "$deploy_root/releases/vue-$(date -u +%Y%m%dT%H%M%S)-XXXXXX")
previous_release=$(readlink -f "$deploy_root/current")
config_backup="$deploy_root/config-backups/$(basename -- "$release_dir").conf"
cp -- "$nginx_config" "$config_backup"
python3 - "$api_build" "$demo_build" "$release_dir" "$frontend_root" <<'PY'
from pathlib import Path
import hashlib,json,shutil,subprocess,sys
from datetime import datetime,timezone
api,demo,release,frontend=map(Path,sys.argv[1:])
assert '/assets/' in (api/'index.html').read_text()
assert '/demo/assets/' in (demo/'index.html').read_text()
shutil.copytree(api,release,dirs_exist_ok=True,ignore=shutil.ignore_patterns('*.map'))
shutil.copytree(demo,release/'demo',ignore=shutil.ignore_patterns('*.map'))
digest=hashlib.sha256()
for path in sorted((frontend/'src').rglob('*')):
    if path.is_file():
        digest.update(path.relative_to(frontend).as_posix().encode()+b'\0'+path.read_bytes()+b'\0')
commit=subprocess.check_output(['git','-c',f'safe.directory={frontend.parent}','-C',str(frontend),'rev-parse','HEAD']).decode().strip()
metadata={'builtAt':datetime.now(timezone.utc).isoformat(),'sourceCommit':commit,'sourceDigest':digest.hexdigest(),'sourceModified':bool(subprocess.check_output(['git','-c',f'safe.directory={frontend.parent}','-C',str(frontend),'status','--porcelain','--','.'])),'primaryMode':'api','demoPath':'/demo/'}
(release/'version.json').write_text(json.dumps(metadata,ensure_ascii=False,indent=2)+'\n')
PY
find "$release_dir" -type d -exec chmod 755 {} +
find "$release_dir" -type f -exec chmod 644 {} +
activated=false
rollback() {
    local status=$?
    trap - ERR
    if [[ $activated == true ]]; then
        ln -sfn -- "$previous_release" "$deploy_root/current.rollback"
        mv -Tf -- "$deploy_root/current.rollback" "$deploy_root/current"
    fi
    cp -- "$config_backup" "$nginx_config"
    nginx -t && systemctl reload nginx || true
    printf 'Deployment failed; previous release restored: %s\n' "$previous_release" >&2
    exit "$status"
}
trap rollback ERR
install -m 644 "$frontend_root/deploy/local-nginx.conf" "$nginx_config"
nginx -t
ln -s -- "$release_dir" "$deploy_root/current.next"
mv -Tf -- "$deploy_root/current.next" "$deploy_root/current"
activated=true
systemctl reload nginx
ready=false
for attempt in {1..20}; do
    if curl --noproxy '*' -fsS --max-time 2 http://127.0.0.1/version.json | cmp -s - "$release_dir/version.json"; then
        ready=true
        break
    fi
    sleep 0.25
done
[[ $ready == true ]]
curl --noproxy '*' -fsS http://127.0.0.1/healthz >/dev/null
curl --noproxy '*' -fsS http://127.0.0.1/demo/index.html | grep -q '/demo/assets/'
trap - ERR
printf 'Release: %s\nPrevious: %s\nConfig backup: %s\n' "$release_dir" "$previous_release" "$config_backup"

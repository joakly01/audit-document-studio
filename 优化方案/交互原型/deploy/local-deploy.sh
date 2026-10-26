#!/usr/bin/env bash
set -euo pipefail

export PATH="$PATH:/usr/sbin:/sbin"
app_root=$(cd -- "$(dirname -- "${BASH_SOURCE[0]}")/.." && pwd)
if [[ ${1:-} == --check ]]; then
    command -v python3 >/dev/null
    python3 "$app_root/deploy/verify-package.py"
    for dependency in nginx curl systemctl; do
        command -v "$dependency" >/dev/null || { printf 'Missing prerequisite: %s\n' "$dependency" >&2; exit 1; }
    done
    printf '%s\n' 'Deployment files and prerequisites verified; no system changes made.'
    exit 0
fi
if [[ $# -ne 0 ]]; then
    printf '%s\n' 'Usage: bash deploy/local-deploy.sh [--check]' >&2
    exit 1
fi

if [[ $EUID -ne 0 ]]; then
    exec sudo -n bash "$0" "$@"
fi

app_root=$(cd -- "$(dirname -- "${BASH_SOURCE[0]}")/.." && pwd)
source_dir="$app_root/dist"
deploy_root=/var/www/audit-document-studio
nginx_config=/etc/nginx/conf.d/audit-document-studio.conf

command -v nginx >/dev/null
python3 "$app_root/deploy/verify-package.py"
test -f "$source_dir/index.html"
test -f "$source_dir/extraction-entry.js"
if [[ -n $(find "$source_dir" -type l -print -quit) ]]; then
    printf '%s\n' '部署停止：dist 中含符号链接，请改为独立静态文件。' >&2
    exit 1
fi

source_sha=$(python3 - "$source_dir" <<'PY_HASH'
from pathlib import Path
import hashlib, sys
root = Path(sys.argv[1])
hash_value = hashlib.sha256()
for path in sorted(root.rglob('*')):
    if path.is_file():
        hash_value.update(path.relative_to(root).as_posix().encode())
        hash_value.update(b'\0')
        hash_value.update(path.read_bytes())
        hash_value.update(b'\0')
print(hash_value.hexdigest()[:12])
PY_HASH
)
release_id="$(date -u +%Y%m%dT%H%M%S%NZ)-$source_sha"
release_dir="$deploy_root/releases/$release_id"
install -d -m 755 "$deploy_root/releases" "$release_dir"
cp -R -- "$source_dir/." "$release_dir/"
find "$release_dir" -type d -exec chmod 755 {} +
find "$release_dir" -type f -exec chmod 644 {} +
chown -R root:root "$release_dir"

# Keep prior releases for an immediate rollback; never serve the source tree.
previous_release=$(readlink -f "$deploy_root/current" 2>/dev/null || true)
ln -s -- "$release_dir" "$deploy_root/current.next"
mv -Tf -- "$deploy_root/current.next" "$deploy_root/current"

# This machine was provisioned without a web server; retain the packaged
# welcome-page configuration in sites-available, but disable its default listener.
default_site=/etc/nginx/sites-enabled/default
if [[ -L $default_site ]] && [[ $(readlink -f "$default_site") == /etc/nginx/sites-available/default ]]; then
    unlink "$default_site"
fi
install -m 644 "$app_root/deploy/nginx.conf" "$nginx_config"
if ! nginx -t; then
    if [[ -n $previous_release ]]; then
        ln -s -- "$previous_release" "$deploy_root/current.rollback"
        mv -Tf -- "$deploy_root/current.rollback" "$deploy_root/current"
    fi
    exit 1
fi

systemctl enable --now nginx
systemctl reload nginx
# Reload returns before the replacement workers necessarily accept connections.
ready=false
for attempt in {1..20}; do
    if [[ $(curl --noproxy '*' --silent --max-time 2 http://127.0.0.1/healthz) == ok ]]; then
        ready=true
        break
    fi
    sleep 0.25
done
if [[ $ready != true ]]; then
    printf '%s\n' '站点健康检查未通过，请检查 Nginx 错误日志。' >&2
    exit 1
fi
curl --noproxy '*' --fail --silent --show-error http://127.0.0.1/index.html | \
    python3 -c 'import sys; assert "extraction-entry.js" in sys.stdin.read(), "站点首页内容不匹配"'
printf '部署完成：%s\n本机访问：http://127.0.0.1/#library\n' "$release_dir"

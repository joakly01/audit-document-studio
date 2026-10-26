#!/usr/bin/env python3
"""Verify a portable release without Git, npm, browser drivers or network requests."""
from pathlib import Path, PurePosixPath
from html.parser import HTMLParser
from urllib.parse import unquote, urlsplit
import hashlib
import json
import sys

root = Path(__file__).resolve().parent.parent
errors = []
manifest = root / 'SHA256SUMS'
if manifest.exists():
    entries = manifest.read_text(encoding='utf-8').splitlines()
    for line in entries:
        try:
            expected, name = line.split('  ', 1)
            relative = PurePosixPath(name)
            if relative.is_absolute() or '..' in relative.parts:
                raise ValueError('invalid relative path')
            target = root.joinpath(*relative.parts)
            if target.is_symlink() or not target.is_file():
                raise ValueError('missing file or symbolic link')
            if hashlib.sha256(target.read_bytes()).hexdigest() != expected:
                raise ValueError('checksum mismatch')
        except (ValueError, OSError) as exc:
            errors.append(f'{line}: {exc}')
    print(f'Checked {len(entries)} package checksums.')
else:
    print('Source directory: no release manifest; checking front-end dependencies.')

class Assets(HTMLParser):
    def handle_starttag(self, tag, attrs):
        values = dict(attrs)
        value = values.get('src') if tag == 'script' else values.get('href') if tag == 'link' else None
        if value:
            parts = urlsplit(value)
            if not parts.scheme and not parts.netloc:
                target = root / 'dist' / unquote(parts.path).lstrip('/')
                if not target.is_file():
                    errors.append('Missing page dependency: ' + value)

try:
    Assets().feed((root / 'dist/index.html').read_text(encoding='utf-8'))
    text = (root / 'dist/source-assets.js').read_text(encoding='utf-8')
    catalog, _ = json.JSONDecoder().raw_decode(text.split('Object.freeze(', 1)[1])
    for item in catalog.values():
        target = root / 'dist' / item['path']
        if not target.is_file():
            errors.append('Missing preview file: ' + item['path'])
        elif hashlib.sha256(target.read_bytes()).hexdigest() != item['sha256']:
            errors.append('Preview file checksum mismatch: ' + item['path'])
    for target in (root / 'dist').rglob('*'):
        if target.is_symlink():
            errors.append('Symbolic link in public files: ' + str(target))
except (OSError, ValueError, KeyError, IndexError) as exc:
    errors.append(str(exc))
if errors:
    print('\n'.join(errors), file=sys.stderr)
    raise SystemExit(1)
print('Package files, page dependencies and original-format preview assets verified.')

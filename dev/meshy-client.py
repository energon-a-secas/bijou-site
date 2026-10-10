#!/usr/bin/env python3
"""Resume the documented Meshy trial. Credentials and API responses stay local.

Read-only: balance, status STAGE, download STAGE.
Paid: remesh or rig with --submit (otherwise prints the proposed request).
Generation is recorded separately in generate-intent/created.json.
No automatic POST retries. See docs/MESHY-EVALUATION.md.
"""
import argparse
import datetime
import hashlib
import json
import os
import re
from pathlib import Path
from urllib.error import HTTPError, URLError
from urllib.parse import urlparse
from urllib.request import HTTPRedirectHandler, Request, build_opener, urlopen

ROOT = Path(__file__).resolve().parents[1]
DEFAULT_RUN = Path.home() / '.local/share/bijou/meshy/hime-v1-20261005'
ENDPOINTS = {'generate': 'image-to-3d', 'remesh': 'remesh', 'rig': 'rigging'}


class NoRedirect(HTTPRedirectHandler):
    def redirect_request(self, *args, **kwargs):
        return None


def read_json(path):
    return json.loads(path.read_text())


def write_json(path, value, exclusive=False):
    with path.open('x' if exclusive else 'w') as stream:
        json.dump(value, stream, indent=2)


def api(endpoint, payload=None):
    key = None
    for line in (Path.home() / '.config/bijou/meshy.env').read_text().splitlines():
        name, sep, value = line.strip().partition('=')
        if name == 'MESHY_API_KEY' and sep:
            key = value.strip().strip('\"\'')
    if not key:
        raise ValueError('Missing local MESHY_API_KEY.')
    if not re.fullmatch(r'(balance|image-to-3d|remesh|rigging)(/[a-zA-Z0-9-]+)?', endpoint):
        raise ValueError('Unsupported API route.')
    request = Request('https://api.meshy.ai/openapi/v1/' + endpoint,
                      data=json.dumps(payload).encode() if payload is not None else None,
                      headers={'Authorization': 'Bearer ' + key, 'Content-Type': 'application/json'},
                      method='POST' if payload is not None else 'GET')
    try:
        with build_opener(NoRedirect).open(request, timeout=90) as response:
            return json.load(response)
    except HTTPError as error:
        message = error.read().decode('utf-8', 'replace').replace(key, '[redacted]')[:500]
        raise RuntimeError(f'Meshy HTTP {error.code}: {message}') from None
    except URLError:
        raise RuntimeError('Meshy network error. Check task logs before retrying a submission.') from None


def status(run, stage):
    task_id = read_json(run / f'{stage}-created.json')['result']
    result = api(ENDPOINTS[stage] + '/' + task_id)
    write_json(run / f'{stage}-status.json', result)
    return result


def summary(result):
    return {key: result.get(key) for key in ('id', 'status', 'progress', 'consumed_credits', 'task_error')}


def submit(run, stage, perform=False):
    intent = run / f'{stage}-intent.json'
    if intent.exists():
        raise ValueError('Submission already recorded. Inspect status/account logs; do not retry blindly.')
    source = 'remesh' if stage == 'rig' and (run / 'remesh-created.json').exists() else 'generate'
    previous = status(run, source)
    if previous.get('status') != 'SUCCEEDED':
        raise ValueError('Source task has not succeeded.')
    payload = {'input_task_id': previous['id']}
    if stage == 'remesh':
        payload.update(target_formats=['glb'], topology='triangle', target_polycount=100000)
    else:
        payload['height_meters'] = 1.68
    reserved = 0
    for file in run.glob('*-intent.json'):
        metadata = read_json(file)
        stage_status = run / file.name.replace('-intent', '-status')
        actual = read_json(stage_status).get('consumed_credits') if stage_status.exists() else None
        reserved += max(metadata['estimated_credits'], actual or 0)
    budget = read_json(run / 'generate-intent.json')['trial_budget_credits']
    if reserved + 5 > budget:
        raise ValueError('This request would exceed the recorded trial budget.')
    proposal = {'stage': stage, 'settings': payload, 'estimated_credits': 5,
                'reserved_trial_credits_after': reserved + 5,
                'created_at': datetime.datetime.now(datetime.timezone.utc).isoformat()}
    if not perform:
        return {'dry_run': True, **proposal}
    balance = api('balance').get('balance', 0)
    if balance < 5:
        raise ValueError('Insufficient available credits.')
    write_json(intent, proposal, exclusive=True)
    result = api(ENDPOINTS[stage], payload)
    write_json(run / f'{stage}-created.json', result)
    return {'submitted': True, 'stage': stage, 'task_id': result.get('result'), 'estimated_credits': 5}


def download(run, stage):
    result = status(run, stage)
    if result.get('status') != 'SUCCEEDED':
        raise ValueError('Task has not succeeded; nothing downloaded.')
    urls = {}
    model = result.get('model_urls', {}).get('glb')
    if model:
        urls['model.glb'] = model
    rig = result.get('result', {})
    if rig.get('rigged_character_glb_url'):
        urls['model.glb'] = rig['rigged_character_glb_url']
    walk = rig.get('basic_animations', {}).get('walking_glb_url')
    if walk:
        urls['walking.glb'] = walk
    if result.get('thumbnail_url'):
        urls['preview.png'] = result['thumbnail_url']
    for view in ('front', 'right', 'back', 'left'):
        url = result.get('thumbnail_urls', {}).get(view)
        if url:
            urls[f'preview-{view}.png'] = url
    for index, textures in enumerate(result.get('texture_urls', [])):
        for kind in ('base_color', 'metallic', 'roughness', 'normal', 'emission'):
            if textures.get(kind):
                suffix = Path(urlparse(textures[kind]).path).suffix.lower()
                if suffix not in ('.png', '.jpg', '.jpeg', '.webp'):
                    suffix = '.png'
                urls[f'texture-{index}-{kind}{suffix}'] = textures[kind]
    directory = run / stage
    directory.mkdir(exist_ok=True)
    inventory = []
    for name, url in urls.items():
        if urlparse(url).scheme != 'https':
            raise ValueError('Asset download must use HTTPS.')
        path = directory / name
        if not path.exists():
            partial = path.with_suffix(path.suffix + '.partial')
            # Asset requests deliberately have no API Authorization header.
            with urlopen(url, timeout=90) as response, partial.open('wb') as stream:
                total = 0
                while chunk := response.read(1024 * 1024):
                    total += len(chunk)
                    if total > 512 * 1024 * 1024:
                        raise ValueError('Asset exceeds the 512 MiB download bound.')
                    stream.write(chunk)
            partial.replace(path)
        inventory.append({'file': name, 'bytes': path.stat().st_size,
                          'sha256': hashlib.sha256(path.read_bytes()).hexdigest()})
    write_json(directory / 'inventory.json', inventory)
    return {'directory': str(directory), 'files': inventory}


def main():
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument('command', choices=['balance', 'status', 'download', 'remesh', 'rig'])
    parser.add_argument('stage', nargs='?', choices=ENDPOINTS, default='generate')
    parser.add_argument('--run', type=Path, default=DEFAULT_RUN)
    parser.add_argument('--submit', action='store_true', help='Actually submit a paid remesh/rig job.')
    args = parser.parse_args()
    os.umask(0o077)
    run = args.run.expanduser().resolve()
    if run == ROOT or ROOT in run.parents:
        raise ValueError('Keep private API responses outside the statically served repository.')
    if args.command == 'balance':
        result = api('balance')
    elif args.command == 'status':
        result = summary(status(run, args.stage))
    elif args.command == 'download':
        result = download(run, args.stage)
    else:
        result = submit(run, args.command, args.submit)
    print(json.dumps(result, indent=2))


if __name__ == '__main__':
    try:
        main()
    except (OSError, ValueError, KeyError, RuntimeError) as error:
        raise SystemExit(str(error)) from None

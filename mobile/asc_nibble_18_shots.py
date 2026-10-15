#!/usr/bin/env python3
"""Replace the en-US screenshots on Nibble 1.8 with screenshots/nibble_v18 (photo→calories hero first)."""
import sys, os, glob, time
sys.path.insert(0, os.path.expanduser('~/workspace/landed/.credentials'))
import asc
from PIL import Image

VID = '47370a4f-4d39-4231-a8bd-b41df273e633'  # appStoreVersion 1.8
SHOTS = sorted(glob.glob(os.path.join(os.path.dirname(os.path.abspath(__file__)), 'screenshots/nibble_v18/*.png')))
locs = asc.api('GET', f'/v1/appStoreVersions/{VID}/appStoreVersionLocalizations')['data']
en = next(L for L in locs if L['attributes']['locale'] == 'en-US')

def replace_set(display_type, files):
    sets = asc.api('GET', f"/v1/appStoreVersionLocalizations/{en['id']}/appScreenshotSets?fields[appScreenshotSets]=screenshotDisplayType")['data']
    st = next((s for s in sets if s['attributes']['screenshotDisplayType'] == display_type), None)
    if not st:
        st = asc.api('POST', '/v1/appScreenshotSets', {'data': {'type': 'appScreenshotSets', 'attributes': {'screenshotDisplayType': display_type},
             'relationships': {'appStoreVersionLocalization': {'data': {'type': 'appStoreVersionLocalizations', 'id': en['id']}}}}})['data']
    for o in asc.api('GET', f"/v1/appScreenshotSets/{st['id']}/appScreenshots")['data']:
        asc.api('DELETE', f"/v1/appScreenshots/{o['id']}")
    for f in files:
        r = asc.upload_asset('/v1/appScreenshots', {'data': {'type': 'appScreenshots', 'attributes': {'fileName': os.path.basename(f)},
             'relationships': {'appScreenshotSet': {'data': {'type': 'appScreenshotSets', 'id': st['id']}}}}}, f, 'appScreenshots')
        print(' ', display_type, os.path.basename(f), 'ok' if 'data' in r else r)
    time.sleep(2)

replace_set('APP_IPHONE_67', SHOTS)
tmp = '/private/tmp/claude-501/nibble_65'; os.makedirs(tmp, exist_ok=True); r65 = []
for f in SHOTS:
    out = os.path.join(tmp, os.path.basename(f)); Image.open(f).convert('RGB').resize((1284, 2778), Image.LANCZOS).save(out); r65.append(out)
replace_set('APP_IPHONE_65', r65)

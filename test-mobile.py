"""手机版面测试：竖屏／横屏，用触控划线切燕菜，检查没有横向溢出、燕菜够大、按钮看得到。
用法：先开 `python3 -m http.server 8931`，再跑 `python3 test-mobile.py`。"""
import os, sys
from playwright.sync_api import sync_playwright

URL = os.environ.get('TARGET', 'http://localhost:8931/index.html') + '?code=TEST-1I'
import json
CLASSES = [{'id': 'c1', 'class_name': '1I', 'play_code': 'TEST-1I', 'schools': {'full_name': '测试小学'}, 'students': [{'name': n, 'name_zh': n, 'name_en': None, 'seat_no': i + 1} for i, n in enumerate(['陈小明', '林美美', '黄大伟', '李安琪', '王志强', '张雅婷', '吴家豪', '刘欣怡'])]}]
def mock_supabase(route):
    if '/rest/v1/classes' in route.request.url:
        return route.fulfill(status=200, content_type='application/json', body=json.dumps(CLASSES))
    return route.fulfill(status=200, content_type='application/json', body='[]')
OUT = os.path.join(os.path.dirname(os.path.abspath(__file__)), '.playwright-output') + '/'
os.makedirs(OUT, exist_ok=True)
TO = """([x, y]) => { const s = window.__pecahan.scene; const r = s.cv.getBoundingClientRect();
  return { x: r.left + s.plate.x + x * s.k, y: r.top + s.plate.y + (y - s.thick()) * s.k }; }"""
fails = 0
def check(name, ok, extra=''):
    global fails
    print(('  ✅ ' if ok else '  ❌ ') + name + (f' — {extra}' if extra else ''))
    if not ok: fails += 1

def swipe(ctx, page, a, b):
    pa = page.evaluate(TO, a); pb = page.evaluate(TO, b)
    cdp = ctx.new_cdp_session(page)
    cdp.send('Input.dispatchTouchEvent', {'type': 'touchStart', 'touchPoints': [{'x': pa['x'], 'y': pa['y']}]})
    for i in range(1, 13):
        cdp.send('Input.dispatchTouchEvent', {'type': 'touchMove', 'touchPoints': [{'x': pa['x'] + (pb['x'] - pa['x']) * i / 12, 'y': pa['y'] + (pb['y'] - pa['y']) * i / 12}]})
    cdp.send('Input.dispatchTouchEvent', {'type': 'touchEnd', 'touchPoints': []})
    page.wait_for_timeout(800)

def visible_in_viewport(page, sel):
    return page.evaluate("""(sel) => { const r = document.querySelector(sel).getBoundingClientRect();
      return r.top >= 0 && r.bottom <= innerHeight + 1 && r.left >= 0 && r.right <= innerWidth + 1; }""", sel)

with sync_playwright() as p:
    br = p.chromium.launch()
    for name, vw, vh in [('portrait', 390, 844), ('portrait-small', 360, 740), ('landscape', 844, 390)]:
        print(name, vw, 'x', vh)
        ctx = br.new_context(viewport={'width': vw, 'height': vh}, device_scale_factor=2, is_mobile=True, has_touch=True)
        page = ctx.new_page(); errs = []
        page.route('**/*.supabase.co/**', mock_supabase)
        page.on('pageerror', lambda e: errs.append(str(e)))
        page.goto(URL); page.wait_for_timeout(1200)
        check('首页没有横向溢出', page.evaluate('() => document.documentElement.scrollWidth') <= vw)
        check('首页招牌在画面内（没被切掉）', page.evaluate("() => document.querySelector('.shop-sign').getBoundingClientRect().top >= 0"))
        page.screenshot(path=OUT + f'm-{name}-home.png')

        # 分给朋友：第 3 关（4 位朋友）
        page.tap('[data-mode=share]'); page.wait_for_timeout(900)
        page.evaluate('() => window.__pecahan.G.idx = 0')
        check('游戏页没有横向溢出', page.evaluate('() => document.documentElement.scrollWidth') <= vw)
        k = page.evaluate('() => window.__pecahan.scene.k')
        check('燕菜直径够手指切（≥130px）', k * 2 >= 130, f'{k*2:.0f}px')
        swipe(ctx, page, (0, -1.4), (0, 1.4))
        check('触控划线切开', page.evaluate("() => window.__pecahan.scene.pieces.length") == 2)
        page.evaluate("() => document.querySelector('#btnMain').scrollIntoView({block: 'nearest'})")
        page.tap('#btnMain'); page.wait_for_timeout(1300)
        page.evaluate('() => window.scrollTo(0, 0)'); page.wait_for_timeout(200)
        page.screenshot(path=OUT + f'm-{name}-share.png', full_page=True)
        if name == 'landscape':
            check('横屏：按钮不用滚动就看得到', visible_in_viewport(page, '#btnMain'))
        page.tap('#btnMain'); page.wait_for_timeout(900)   # 第 2 关
        page.tap('#btnHome'); page.wait_for_timeout(400)
        page.evaluate("() => window.__pecahan.startMode('share')"); page.wait_for_timeout(600)
        page.evaluate("() => { const P = window.__pecahan; P.G.idx = 2; }")
        # 直接进第 3 关（4 位朋友）
        page.evaluate("() => { const P = window.__pecahan; document.querySelector('#btnMain'); }")
        page.tap('#btnHome'); page.wait_for_timeout(300)

        # 燕菜铺
        page.tap('[data-mode=shop]'); page.wait_for_timeout(1500)
        check('手机：选店长画面没有横向溢出', page.evaluate('() => document.documentElement.scrollWidth') <= vw)
        page.screenshot(path=OUT + f'm-{name}-pick.png')
        page.tap('#pickGrid .pick-name:nth-child(2)'); page.wait_for_timeout(900)
        swipe(ctx, page, (0, -1.4), (0, 1.4))
        page.evaluate("() => document.querySelector('#btnMain').scrollIntoView({block: 'nearest'})")
        page.tap('#btnMain'); page.wait_for_timeout(700)
        page.evaluate('() => window.scrollTo(0, 0)'); page.wait_for_timeout(200)
        pt = page.evaluate("""() => { const s = window.__pecahan.scene; const r = s.cv.getBoundingClientRect(); const p = s.pieces[0];
          return { x: r.left + s.plate.x + (p.c.x + p.off.x) * s.k, y: r.top + s.plate.y + (p.c.y + p.off.y - s.thick()) * s.k }; }""")
        page.touchscreen.tap(pt['x'], pt['y']); page.wait_for_timeout(300)
        check('触控点选燕菜', page.evaluate("() => window.__pecahan.scene.pieces.filter(p => p.selected).length") == 1)
        page.evaluate("() => document.querySelector('#btnMain').scrollIntoView({block: 'nearest'})")
        page.tap('#btnMain'); page.wait_for_timeout(1100)
        check('送到客人', '送到了' in page.inner_text('#result'))
        page.evaluate('() => window.scrollTo(0, 0)'); page.wait_for_timeout(200)
        page.screenshot(path=OUT + f'm-{name}-shop.png', full_page=True)
        check('没有 JS 报错', not errs, ' | '.join(errs[:2]))
        ctx.close()

    # 4 位朋友的竖屏版面
    ctx = br.new_context(viewport={'width': 390, 'height': 844}, device_scale_factor=2, is_mobile=True, has_touch=True)
    page = ctx.new_page(); page.goto(URL); page.wait_for_timeout(1000)
    page.evaluate("() => window.__pecahan.startMode('share')"); page.wait_for_timeout(700)
    for _ in range(2):
        swipe(ctx, page, (0, -1.4), (0, 1.4)) if False else None
    # 跳到第 3 关：前两关正确切
    for lv in range(2):
        swipe(ctx, page, (-1.4, 0), (1.4, 0))
        page.evaluate("() => document.querySelector('#btnMain').click()"); page.wait_for_timeout(1200)
        page.evaluate("() => document.querySelector('#btnMain').click()"); page.wait_for_timeout(900)
    page.evaluate('() => window.scrollTo(0, 0)')
    swipe(ctx, page, (-1.4, 0), (1.4, 0)); swipe(ctx, page, (0, -1.4), (0, 1.4))
    page.evaluate("() => document.querySelector('#btnMain').click()"); page.wait_for_timeout(1400)
    check('竖屏 4 位朋友分到', '每人得到' in page.inner_text('#result'))
    page.evaluate('() => window.scrollTo(0, 0)'); page.wait_for_timeout(200)
    page.screenshot(path=OUT + 'm-portrait-4friends.png', full_page=True)
    ctx.close()
    br.close()

print('\n' + ('全部通过' if fails == 0 else f'{fails} 项失败'))
sys.exit(1 if fails else 0)

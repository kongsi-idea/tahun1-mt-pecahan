"""燕菜切切乐 端到端测试：三个模式从头走到尾，截图存 .playwright-output/。
用法：先在工具目录开 `python3 -m http.server 8931`，再跑 `python3 test-e2e.py`。
TARGET 环境变量可改成线上网址。"""
import os, sys, json
from playwright.sync_api import sync_playwright

URL = os.environ.get('TARGET', 'http://localhost:8931/index.html') + '?code=TEST-1I'
MOCK_DB = os.environ.get('MOCK_DB', '1') == '1'   # 默认拦截 Supabase，不往真的排行榜写测试资料
CLASSES = [{'id': 'c1', 'class_name': '1I', 'play_code': 'TEST-1I', 'schools': {'full_name': '测试小学'},
            'students': [{'name': n, 'name_zh': n, 'name_en': None, 'seat_no': i + 1} for i, n in enumerate(['陈小明', '林美美', '黄大伟', '李安琪'])]}]
submitted = []
def mock_supabase(route):
    url = route.request.url
    if '/rest/v1/classes' in url:
        return route.fulfill(status=200, content_type='application/json', body=json.dumps(CLASSES))
    if '/rpc/submit_tahun1_mt_pecahan_score' in url:
        body = json.loads(route.request.post_data or '{}'); submitted.append(body)
        return route.fulfill(status=200, content_type='application/json', body=json.dumps([{'best': body['p_stars'], 'best_max': body['p_max_stars'], 'attempts': 1}]))
    if '/rest/v1/tahun1_mt_pecahan_scores' in url:
        rows = [{'name': '林美美', 'class_label': '1I', 'stars': 30, 'max_stars': 30, 'play_code': 'TEST-1I', 'updated_at': '2026-09-29T01:00:00Z'},
                {'name': '陈小明', 'class_label': '1I', 'stars': 28, 'max_stars': 30, 'play_code': 'TEST-1I', 'updated_at': '2026-09-29T02:00:00Z'}]
        return route.fulfill(status=200, content_type='application/json', body=json.dumps(rows))
    return route.continue_()
OUT = os.path.join(os.path.dirname(os.path.abspath(__file__)), '.playwright-output')
os.makedirs(OUT, exist_ok=True)
W, H = int(os.environ.get('VW', 1366)), int(os.environ.get('VH', 768))

fails = 0
def check(name, ok, extra=''):
    global fails
    print(('  ✅ ' if ok else '  ❌ ') + name + (f' — {extra}' if extra else ''))
    if not ok: fails += 1

# 把「原位坐标」的线换成画面坐标（学生看到的顶面比底面高 thick()）
TO_PX = """([x, y]) => { const s = window.__pecahan.scene; const r = s.cv.getBoundingClientRect();
  return { x: r.left + s.plate.x + x * s.k, y: r.top + s.plate.y + (y - s.thick()) * s.k }; }"""

def cut(page, a, b, steps=14):
    pa = page.evaluate(TO_PX, a); pb = page.evaluate(TO_PX, b)
    page.mouse.move(pa['x'], pa['y']); page.mouse.down()
    for i in range(1, steps + 1):
        t = i / steps
        page.mouse.move(pa['x'] + (pb['x'] - pa['x']) * t, pa['y'] + (pb['y'] - pa['y']) * t)
    page.mouse.up(); page.wait_for_timeout(700)

def pieces(page):
    return page.evaluate("() => window.__pecahan.scene.pieces.filter(p => p.where === 'plate').map(p => +p.area.toFixed(4))")

def click_piece(page, i):
    pt = page.evaluate("""(i) => { const s = window.__pecahan.scene; const r = s.cv.getBoundingClientRect();
      const p = s.pieces.filter(q => q.where === 'plate')[i];
      return { x: r.left + s.plate.x + (p.c.x + p.off.x) * s.k, y: r.top + s.plate.y + (p.c.y + p.off.y - s.thick()) * s.k }; }""", i)
    page.mouse.click(pt['x'], pt['y']); page.wait_for_timeout(250)

def shot(page, name):
    page.wait_for_timeout(450)
    page.screenshot(path=os.path.join(OUT, name + '.png'))

with sync_playwright() as p:
    br = p.chromium.launch()
    page = br.new_page(viewport={'width': W, 'height': H})
    errors = []
    page.on('pageerror', lambda e: errors.append(str(e)))
    page.on('console', lambda m: m.type == 'error' and errors.append(m.text))
    if MOCK_DB: page.route('**/*.supabase.co/**', mock_supabase)
    page.goto(URL); page.wait_for_timeout(1500)
    shot(page, '01-home')

    # ── 分给朋友 ──
    print('分给朋友')
    page.click('[data-mode=share]'); page.wait_for_timeout(900)
    shot(page, '02-share-start')
    # 故意切歪：看朋友有没有不高兴
    cut(page, (0.35, -1.3), (0.35, 1.3))
    a = pieces(page); check('切歪一刀得到 2 块', len(a) == 2, str(a))
    page.click('#btnMain'); page.wait_for_timeout(1100)
    txt = page.inner_text('#result')
    check('切歪会说不公平', '不公平' in txt, txt[:30])
    shot(page, '03-share-unfair')
    page.click('#btnMain'); page.wait_for_timeout(700)   # 再切一次
    check('再切一次后回到 1 块', len(pieces(page)) == 1)
    # 切正中（帮手刀开着，故意画偏一点点、斜一点点）
    cut(page, (-1.3, 0.06), (1.3, -0.08))
    a = pieces(page); check('帮手刀对齐后两块一样大', len(a) == 2 and abs(a[0] - a[1]) < 0.01, str(a))
    page.click('#btnMain'); page.wait_for_timeout(1200)
    check('公平 → 显示二分之一', '二分之一' in page.inner_text('#result'))
    shot(page, '04-share-fair')
    stars = page.evaluate('() => window.__pecahan.G.stars')
    check('切歪过一次，只拿 2 星', stars == [2], str(stars))
    # 第 2～5 关：正确切法
    for lv in range(1, 5):
        page.click('#btnMain'); page.wait_for_timeout(900)
        shape = page.evaluate('() => window.__pecahan.scene.shape')
        n = len(page.evaluate(f'() => window.__pecahan.SHARE_LEVELS[{lv}].friends'))
        if n == 2:
            cut(page, (-1.4, 0), (1.4, 0))
        elif shape == 'rect' and lv == 3:
            cut(page, (0, -1), (0, 1)); cut(page, (0.57, -1), (0.57, 1)); cut(page, (-0.57, -1), (-0.57, 1))
        else:
            cut(page, (-1.4, 0), (1.4, 0)); cut(page, (0, -1.4), (0, 1.4))
        a = pieces(page)
        check(f'第 {lv+1} 关切成 {n if n==2 else 4} 块一样大', len(a) == (2 if n == 2 else 4) and max(a) / min(a) < 1.05, str(a))
        if lv == 3: shot(page, '05-share-rect-strips-before')
        page.click('#btnMain'); page.wait_for_timeout(1200)
        check(f'第 {lv+1} 关过关', '每人得到' in page.inner_text('#result'), page.inner_text('#result')[:40])
        if lv == 2: shot(page, '06-share-4friends')
    page.click('#btnMain'); page.wait_for_timeout(900)
    check('结算画面出现', page.is_visible('#endOverlay'))
    shot(page, '07-share-end')
    page.click('#btnEndHome'); page.wait_for_timeout(500)

    # ── 燕菜铺开张 ──
    print('燕菜铺开张')
    page.click('[data-mode=shop]'); page.wait_for_timeout(1500)
    names = [b.inner_text() for b in page.query_selector_all('#pickGrid .pick-name')]
    check('选店长：读到班级名单', len(names) == 4, str(names))
    shot(page, '09-shop-pick')
    page.click('#pickGrid .pick-name:nth-child(1)'); page.wait_for_timeout(900)
    check('选好名字进入燕菜铺', page.evaluate('() => window.__pecahan.Player.name') == '陈小明')
    orders = page.evaluate('() => window.__pecahan.SHOP_ORDERS')
    for i, o in enumerate(orders):
        page.wait_for_timeout(300)
        if i == 0: shot(page, '10-shop-order1')
        if o['type'] == 'cut':
            if o['den'] == 2:
                cut(page, (0, -1.4), (0, 1.4))
            elif o['shape'] == 'rect':
                cut(page, (-1.4, 0), (1.4, 0)); cut(page, (0, -1.2), (0, 1.2))
            else:
                cut(page, (-1.4, -1.4), (1.4, 1.4)); cut(page, (-1.4, 1.4), (1.4, -1.4))
            a = pieces(page)
            check(f'订单{i+1} 切成 {o["den"]} 块一样大', len(a) == o['den'] and max(a) / min(a) < 1.05, str(a))
            page.click('#btnMain'); page.wait_for_timeout(600)
            if i == 4:
                # 先故意拿错数量
                click_piece(page, 0)
                page.click('#btnMain'); page.wait_for_timeout(500)
                check('拿错块数会提醒', '你拿了' in page.inner_text('#result'))
                shot(page, '11-shop-wrong-count')
                click_piece(page, 1); click_piece(page, 2)
                shot(page, '12-shop-picked')
            else:
                for k in range(o['num']): click_piece(page, k)
            page.click('#btnMain'); page.wait_for_timeout(1000)
            check(f'订单{i+1} 送到', '送到了' in page.inner_text('#result'), page.inner_text('#result')[:30])
            if i == 4: shot(page, '13-shop-delivered')
        elif o['type'] == 'recog':
            btns = page.query_selector_all('#choices .choice')
            labels = [b.inner_text() for b in btns]
            want = f"{o['num']}\n{o['den']}"
            if i == 1:
                shot(page, '14-shop-recog')
                # 先答错一次
                wrong = [b for b in btns if not b.inner_text().startswith(want)][0]
                wrong.click(); page.wait_for_timeout(400)
            right = [b for b in page.query_selector_all('#choices .choice') if b.inner_text().startswith(want)]
            check(f'订单{i+1} 有正确选项', len(right) == 1, str(labels))
            right[0].click(); page.wait_for_timeout(700)
            check(f'订单{i+1} 答对', '对了' in page.inner_text('#result'))
        elif o['type'] == 'isit':
            if i == 3: shot(page, '15-shop-isit-q')
            ans = '是' if o['answer'] else '不是'
            page.click(f'#choices .choice:text-is("{ans}")'); page.wait_for_timeout(700)
            check(f'订单{i+1} 是非题', '对了' in page.inner_text('#result'), page.inner_text('#result')[:30])
            if i == 3: shot(page, '16-shop-isit-a')
            if i == 6: shot(page, '17-shop-strips')
        page.click('#btnMain'); page.wait_for_timeout(700)
    check('燕菜铺结算', page.is_visible('#endOverlay'))
    page.wait_for_timeout(800)
    check('成绩交到排行榜（班级、名字、星数）', len(submitted) == 1 and submitted[0]['p_play_code'] == 'TEST-1I' and submitted[0]['p_name'] == '陈小明' and submitted[0]['p_stars'] == 28 and submitted[0]['p_max_stars'] == 30, str(submitted))
    check('结算显示已存进排行榜', '已存进排行榜' in page.inner_text('#endSave'), page.inner_text('#endSave'))
    shot(page, '18-shop-end')
    page.click('#btnEndBoard'); page.wait_for_timeout(800)
    rows = [li.inner_text() for li in page.query_selector_all('#boardList li')]
    check('排行榜列出本班', len(rows) == 2 and '林美美' in rows[0], str(rows))
    check('自己那一行有标出来', page.query_selector('#boardList li.me') is not None)
    shot(page, '19-board')
    page.click('#btnBoardClose')
    stars = page.evaluate('() => window.__pecahan.G.stars')
    check('燕菜铺星数：订单2、订单5 各错一次', stars == [3, 2, 3, 3, 2, 3, 3, 3, 3, 3], str(stars))
    page.click('#btnEndHome'); page.wait_for_timeout(500)

    # ── 自由切 ──
    print('自由切')
    page.click('[data-mode=free]'); page.wait_for_timeout(900)
    page.click('#btnSnap'); page.wait_for_timeout(200)   # 关掉帮手刀
    cut(page, (-1.4, 0.2), (1.4, -0.1))
    check('关掉帮手刀 → 照手切，有大有小', '有大有小' in page.inner_text('#result'), page.inner_text('#result')[:30])
    page.click('#btnSnap')
    page.click('#btnReset'); page.wait_for_timeout(600)
    page.click('.shape-btn[data-shape=square]'); page.wait_for_timeout(500)
    for a_, b_ in [((-1.4, 0), (1.4, 0)), ((0, -1.4), (0, 1.4)), ((-1.3, -1.3), (1.3, 1.3)), ((-1.3, 1.3), (1.3, -1.3))]:
        cut(page, a_, b_)
    a = pieces(page)
    check('正方形切 4 刀 → 8 块一样大', len(a) == 8 and max(a) / min(a) < 1.05, str(a))
    check('显示八分之一', '八分之一' in page.inner_text('#result'))
    shot(page, '20-free-eighths')

    # ── 窄屏 ──
    page.set_viewport_size({'width': 820, 'height': 1180}); page.wait_for_timeout(800)
    shot(page, '21-portrait')
    page.set_viewport_size({'width': W, 'height': H})

    check('没有 JS 报错', not errors, ' | '.join(errors[:3]))
    br.close()

print('\n' + ('全部通过' if fails == 0 else f'{fails} 项失败'))
sys.exit(1 if fails else 0)

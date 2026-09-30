# tahun1-mt-pecahan（燕菜切切乐）专案蓝图

> 一年级数学 DSKP 3.0 分数（3.1 二等份、四等份：1/2、1/4、2/4、3/4；3.2 日常应用题）。
> 工具 https://tahun1-mt-pecahan.vercel.app｜GitHub `kongsi-idea/tahun1-mt-pecahan`｜Vercel `tahun1-mt-pecahan`（kongsi-idea team）
> 现在停在哪 → `handoff.md`。本档只放代码看不出来的决定。

## 来源
灵感来自老师 2026-09-29 分享的 artifact「Melon Jelly Knife」（WebGPU 3D 软体果冻，划线就切）。只借点子与手感，代码全部自写。

## 三个模式
- **分给朋友**（学一学，5 关，不上排行榜）：切歪了**照样分下去**，拿到小块的朋友会说「我的比较小…」。核心教学点是「不一样大就不是几分之一」（反例设计），所以不能在分之前就挡掉不等分。2 位朋友切成 4 块一样大也算对（每人 2/4）。
- **燕菜铺开张**（考一考，10 位客人，唯一上排行榜的模式，满分 30 星）：`cut` 切好再拿／`recog` 看虚线空位说拿走几分之几／`isit` 这块是不是 1/4（含不等分陷阱、长条四等分正例）。
- **自由切**（老师示范）：可关「帮手刀」故意切歪给全班看。

## 关键决定
- **2D 俯视＋厚度，不用 3D**：3D 透视会让近的块看起来比较大，正好破坏「一样大」的判断；也避开学校旧电脑不支援 WebGPU。
- **几何在共用「原位坐标」里做**（单位＝圆半径）：块与块的缝隙、飞到盘子都只是视觉位移，面积判定才精确。等大容差 max/min ≤ 1.12。
- **只切「刀划过」的块**：只划过半边就只切那半边，得到 3 块不等大——刻意保留的反例机会，不要「修」成整条线全切。
- **帮手刀**：角度在 0/45/90/135° ±16°、离整盘中心或任一块重心 0.2 单位内才对齐；偏太多就照手切，反例机会不会被吸附消灭。
- **朗读＝edge-tts 预录人声，不用浏览器 speechSynthesis**：老师 09-29 实测浏览器朗读「不够自然」；macOS 中文声音列表最前面是 Eddy／Grandpa 等搞怪声音会被默认选到。旁白＝晓晓（-8%），男生动物客人＝云夏、女生＝晓伊（`GIRL_ANIMALS`）。**所有句子集中在 app.js 的 `SAY`，改任何一句都要重跑 `python3 gen-voice.py`**，否则那句退回浏览器朗读。句子刻意不含「学生切了几块」这种不可预期的数字，才能全部预录。
- **字体**：学生要读的分数名称用 Noto Sans SC 标准字形。ZCOOL QingKe HuangYou 试过，「之」字形怪，一年级认字不适用。
- **视觉**：风格库 §05 南洋在地首次采用（白天娘惹糕点铺）；风格已登记进 memory 的近期风格清单。角色用 Twemoji，不手拼 SVG 角色（STYLES.md 铁律）。
- **共用「换班级」按钮只在首页显示**：固定在右上角，游戏中会压住声音按钮（`body.in-game` 隐藏）。
- **排行榜**：Supabase（kongsi-idea project `gntnkhkkgonaehapcerr`）表 `tahun1_mt_pecahan_scores`，只能透过 `submit_tahun1_mt_pecahan_score` 写入（同班同名留最好一次；访客每局一笔；不写名字不上榜）。Migration 在 `kongsi-idea/supabase/migration-2026-09-29-tahun1-mt-pecahan-scores.sql`。点子铺用 `?board=1` 深链直接开排行榜。
- **手机版面**：竖屏朋友坐上下、打包盒在下；横放手机（高 < 460）桌子上下略超出画面、四位朋友坐扁（±30°/±150°）。

## 测试
先 `python3 -m http.server 8931`，再跑 `python3 test-e2e.py`（电脑，三模式＋选店长＋排行榜＋?board=1）和 `python3 test-mobile.py`（三种手机尺寸、真触控事件）。
测试默认拦截 Supabase、用假名单 `?code=TEST-1I`，**不会写进真的排行榜**；`TARGET=https://tahun1-mt-pecahan.vercel.app/index.html` 可测正式站。

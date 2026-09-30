# tahun1-mt-pecahan（燕菜切切乐）交接档

> 设计决定与模式说明在 `agents.md`，本档只记现在停在哪。

## ⏯️ 目前做到哪
2026-09-29 v1.0 上线：工具部署到 Vercel、点子铺登记（TOOLS＋5 张正式网址截图＋DSKP 3.1/3.2 索引＋coverage 一行）、Supabase 排行榜 migration 已执行，并补了点子铺 `?board=1` 深链。

## 🚦 目前状态
- 可用：三个模式、预录人声、手机竖屏／横屏、班级名单＋排行榜。正式站跑过 `test-e2e.py`、`test-mobile.py` 全过；真实 Supabase 读取实测 200，排行榜目前为空。
- 工具 commit `65c3dad`（?board=1）；点子铺 commit `f665748`，alias `kongsi-idea.vercel.app` 已指向新部署并 curl 确认。
- 老师 09-29 实测：游戏整体 OK；手机版之后才做，老师还没用真手机玩过。

## ➡️ 下一步
1. 老师对课本分数单元（第 40–42 页）：「二分之一」读法、直式写法、「燕菜」叫法。
2. 学校 Windows 电脑、课室一体机实测划线手感与声音。
3. 改版时照 `teaching-tools/agents.md`「每次上线新版本 Hub 必须同步」五步走。

## ⚠️ 注意事项
- **kongsi-idea 数据库密码 09-29 误显示在对话记录里**（遮罩正则漏了全角冒号），待老师在 Supabase 重设并更新 `kongsi-idea/supabase/.secrets.local.md`。前端 anon key 不受影响。
- 自由切切到 8 块以上时，小屏幕上分数牌会挤（小问题，未修）。
- `vercel link` 会产生 `.env.local`（已 gitignore）。

## 🕐 最后更新
2026-09-30｜Claude Code（Opus 5.5）@ 本机 Mac｜Git：待推

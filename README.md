# Software English

软件英语学习 H5 应用，面向中文开发者，通过手机浏览器访问学习软件开发相关英文词汇。

**在线地址**：https://khc8655.github.io/software-english

## 🎉 v2.0 版本更新

全新奢华精致的界面设计！

- ✨ 完全重新设计的单词卡片
  - 奢华渐变背景和光晕效果
  - 动态顶部边框动画
  - 多层精致阴影，营造悬浮感
  - 超大圆角设计（28px）
  - 震撼的渐变文字展示
  - 流畅的动画效果
- 🎨 统一的配色系统
  - 紫色+蓝色渐变主题
  - 精致的细节打磨
  - 移除悬停效果，专为移动优化
- 📱 图标优化
  - 星标和播放按钮大小完全一致
  - SVG 矢量图标
  - 精致的交互反馈

## 功能特点

- 📖 **翻转卡片学习** — 先看英文回忆中文，点击翻转揭晓答案
- 🔄 **SM-2 间隔复习** — 科学记忆曲线，自动安排复习时间
- ✏️ **拼写练习** — 看中文写英文，主动回忆加深记忆
- 🔊 **真人发音** — 有道词典 API + Web Speech API 降级
- 📚 **200+ 软件英语词汇** — 涵盖配置、日志、错误、命令行、运维、开发、数据库、Git、AI 等 9 大分类
- 🔍 **词库搜索 + 分类筛选** — 快速查找和按分类浏览
- ⭐ **生词本 / ❌ 错题本** — 手动收藏 + 自动记录错词（答对自动移除）
- 📊 **学习统计** — 总学习量、连续打卡、已掌握数、12 周热力图
- 📅 **打卡日历** — 可视化每日学习记录
- 🌙 **深色 / ☀️ 浅色主题** — 平滑切换
- 📱 **PWA 离线支持** — 可添加到手机主屏幕，无网络也能学习
- ⚙️ **每日新词可调** — 支持 5/10/15/20/30 词
- ➕ **自定义单词** — 通过有道词典 API 查询并添加个人词汇

## 项目结构

```
software-english/
├── index.html        # 主页面（内联 CSS）
├── app.js            # 应用逻辑
├── words.json        # 词库数据
├── manifest.json     # PWA 配置
├── sw.js             # Service Worker（离线缓存）
├── translate_examples.py  # 例句翻译脚本（开发用）
├── .github/
│   └── workflows/
│       └── deploy.yml    # GitHub Actions 自动部署
└── README.md
```

## 技术栈

- 纯原生 HTML / CSS / JavaScript，无框架依赖
- localStorage 本地存储学习数据
- 有道词典 API（发音 + 查词）
- GitHub Pages + GitHub Actions 自动部署

## 本地开发

```bash
# 方式一：直接打开
open index.html

# 方式二：本地服务器（推荐，支持 PWA 和 fetch）
python3 -m http.server 8080
# 访问 http://localhost:8080
```

## 更新词库

编辑 `words.json`，格式如下：

```json
{
  "version": "2026-04-05",
  "categories": ["config", "log", "error", "cli", "devops", "dev", "db", "git", "ai"],
  "words": [
    {
      "en": "A/B testing",
      "zh": "A/B测试",
      "phon": "eɪ biː ˈtestɪŋ",
      "category": "devops",
      "example": "A/B test two model versions in production",
      "tags": ["devops", "ai"],
      "example_zh": "A/B 测试生产中的两个模型版本"
    }
  ]
}
```

提交推送后自动部署：

```bash
git add words.json
git commit -m "update words"
git push
```

## 部署

推送到 `main` 分支后，GitHub Actions 自动部署到 GitHub Pages。

## 许可证

MIT

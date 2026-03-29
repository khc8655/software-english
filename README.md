# Software English

软件英语学习 H5 应用，支持手机端访问。

**在线地址**：https://khc8655.github.io/software-english

## 功能特点

- 📚 70+ 软件相关词汇（配置/日志/错误/命令）
- 🔊 真人发音（浏览器 Web Speech API）
- 📝 IPA 音标显示
- 🎨 4 种主题切换（蓝/绿/暗/暖）
- 📊 学习进度追踪
- 🔥 连续学习打卡
- 📜 学习历史记录
- 🎯 词汇测验

## 架构说明

```
english-learning/
├── index.html        # 主页面
├── words.json        # 词库（独立更新）
├── js/
│   ├── app.js        # 主逻辑
│   └── storage.js    # localStorage 管理
├── .github/
│   └── workflows/
│       └── deploy.yml  # 自动部署
└── README.md
```

## 更新词库

只需编辑 `words.json` 文件，格式如下：

```json
{
  "version": "2026-03-29",
  "categories": ["config", "log", "error", "cli"],
  "words": [
    {
      "en": "configure",
      "zh": "配置",
      "phon": "kənˈfɪɡər",
      "category": "config",
      "example": "sudo ./configure --prefix=/usr/local",
      "tags": ["config"]
    }
  ]
}
```

编辑后提交推送即可自动部署：
```bash
git add words.json
git commit -m "Add new words"
git push
```

## 本地开发

直接在浏览器打开 `index.html` 即可预览。

## 部署

本项目使用 GitHub Pages + GitHub Actions 自动部署。

推送到 `main` 分支后会自动部署。

## 许可证

MIT

# 睿甜棋室 · GitHub Pages 简单部署教程

这是一套可以直接发布的静态网页，不需要 npm、Node.js、Python 或服务器。Node/Python 只用于之前的本地预览。文件包已准备好；目前没有上传 GitHub，也没有完成线上部署。

## 1. 准备上传文件

使用 `wolf-sheep-github-pages.zip` 时，先右键选择“全部解压缩”。也可以直接使用项目中的 `github-pages-upload` 文件夹。

**进入文件夹，上传里面的内容，不要上传 ZIP 本身，也不要把外层 `github-pages-upload` 文件夹一起上传。**

上传后的仓库根目录应为：

```text
你的仓库/
├── .nojekyll
├── README.md
├── index.html
├── style.css
├── rules.js
├── game.js
├── ai.js
├── ai-worker.js
└── assets/
    ├── wolf.png
    ├── sheep.png
    └── meadow.png
```

`assets` 文件夹需要完整保留；不要把里面的三张图片散放到根目录。Windows 如果隐藏了 `.nojekyll`，可在文件资源管理器“查看 → 显示 → 隐藏的项目”中开启显示。包内已包含该文件。

## 2. 创建 GitHub 仓库

1. 登录 GitHub，右上角点击 **+ → New repository**。
2. **Repository name** 填 `wolf-sheep`，也可以使用其他英文仓库名。
3. 选择 **Public**。GitHub 免费账户可使用公开仓库的 Pages。
4. 打开 **Add README**，然后点击 **Create repository**。

如果已经有专用于此游戏的仓库，可以跳过创建。建议使用独立仓库，便于更新。

## 3. 上传文件

1. 进入仓库的 **Code** 页面，确认当前分支为 **main**。
2. 点击 **Add file → Upload files**。
3. 在电脑上进入解压后的目录，选中里面的所有文件和 `assets` 文件夹，一起拖进 GitHub 上传区域。拖入 `assets` 整个文件夹可保留图片路径。
4. 检查待上传列表：`index.html` 在根目录，图片路径为 `assets/wolf.png` 等，没有多出来的外层目录。
5. 提交说明可以填 `Publish wolf-sheep game`。选择提交到 `main`，点击 **Commit changes**（有时先显示 **Commit changes…**，再确认）。

如果页面只允许 **Propose changes**，则先创建 Pull Request，合并到 `main` 后再进行下一步。

## 4. 开启 GitHub Pages

进入仓库上方的 **Settings → 左侧 Pages**，在 **Build and deployment** 中设置：

| 选项 | 选择 |
| --- | --- |
| Source | **Deploy from a branch** |
| Branch | **main** |
| Folder | **/(root)** |

点击 **Save**。本教程使用分支发布，无需额外创建工作流文件，也无需选择 Jekyll 主题。

## 5. 等待部署并打开游戏

1. 点击仓库的 **Actions**，查看 **pages build and deployment** 或对应的 Pages 部署任务。
2. 等任务成功后，回到 **Settings → Pages**，点击 **Visit site**。发布可能需要几分钟；官方说明更新可能需要最多约 10 分钟。
3. 仓库名为 `wolf-sheep` 时，普通个人账户的网址通常为 `https://你的用户名.github.io/wolf-sheep/`；以 Pages 页面给出的实际地址为准。
4. 在电脑和手机打开网址，确认图片、走棋、人机和悔棋正常。网站通过 HTTPS 访问，AI 在浏览器本地运算。

**GitHub 仓库网址是代码页面；Pages 的网址才是游戏页面。文件上传成功也不等于已经发布成功，需要等待部署任务成功。**

## 以后怎么更新

修改本地游戏后，在项目目录的 PowerShell 终端运行：

```powershell
./prepare-pages.ps1
```

脚本会重新整理 `github-pages-upload` 和 ZIP，不会上传或部署。若 Windows 阻止脚本运行，可让 Codex 重新准备上传包；不需要为部署安装构建工具。

然后再次 **Add file → Upload files**，上传新包里的全部内容，提交到 `main`。等待新的 Pages 部署任务成功，再刷新游戏页面。通常不需要重新设置 Pages。

## 常见问题

- **404**：检查 `index.html` 是否直接位于仓库根目录，以及 Pages 是否选择了 `main / (root)`。刚发布时先等待部署完成。
- **图片不显示**：检查是否上传了 `assets` 文件夹和三张 PNG，文件名大小写保持一致。
- **还是旧版本**：确认 Actions 中最新部署成功，再按 `Ctrl+F5` 或用新的浏览器标签页打开。
- **找不到 main 分支**：先完成一次文件提交；使用其他分支名时，Pages 也要选择实际存放网页的那个分支。
- **缺少 .nojekyll**：包内已包含空白文件，也可以通过 GitHub 的 **Add file → Create new file** 创建同名文件并提交。

说明按 2026-10-30 的 GitHub 官方文档核对：

- [上传文件](https://docs.github.com/en/repositories/working-with-files/managing-files/adding-a-file-to-a-repository)
- [配置 Pages 发布来源](https://docs.github.com/en/pages/getting-started-with-github-pages/configuring-a-publishing-source-for-your-github-pages-site)
- [创建和访问 Pages 网站](https://docs.github.com/en/pages/getting-started-with-github-pages/creating-a-github-pages-site)

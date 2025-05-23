# 每日冥想 - 轻量级冥想网页应用

这是一个简单、轻量的冥想网页应用，帮助用户通过引导式呼吸动画进行冥想练习。

## 主要特点

- **超轻量**：整个应用仅需几KB，可以通过书签方式保存并快速访问
- **无需安装**：直接在浏览器中使用，无需下载应用或注册账号
- **跨平台**：适用于任何设备 - 手机、平板、电脑均可访问
- **数据隐私**：用户数据仅保存在本地设备，不会上传到服务器
- **自动清理**：60天未更新的数据会自动删除，避免存储不必要的信息

## 技术实现

- **用户标识**：使用URL参数中的UUID来标识用户，允许跨设备同步数据
- **本地存储**：使用localStorage存储用户冥想记录
- **动画引导**：CSS动画实现呼吸引导，帮助用户放松并提高专注度
- **多语言支持**：支持中文、英文、日语和韩语界面

## 如何使用

1. 打开网页（index.html）
2. 选择冥想时长
3. 点击"开始冥想"按钮
4. 跟随屏幕上的呼吸动画进行冥想
5. 完成后可以查看自己的冥想记录和统计数据
6. 将网页保存为书签，方便下次访问

## 文件结构

- `index.html` - 网页主文件
- `styles.css` - 样式表文件
- `script.js` - JavaScript逻辑

## 本地运行

只需使用浏览器打开index.html文件即可开始使用冥想应用。

## 营销策略

- 针对35+年龄段健康意识较强的用户群体
- 强调超轻量（1KB左右书签）与传统App（几十MB）的对比
- 通过健康相关的社区和论坛进行推广
- 使用SEO优化提高搜索引擎曝光度

## 改进计划

- 添加更多冥想指导音频
- 扩展数据可视化功能，展示冥想习惯和进步
- 添加提醒功能
- 优化移动端体验 
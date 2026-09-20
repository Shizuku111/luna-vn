# Luna VN

轻量的本地GalGame管理器。

## 感谢

灵感来源:

- [PotatoVN](https://github.com/GoldenPotato137/PotatoVN) - Galgame 管理工具
- [ReinaManager](https://github.com/huoshen80/ReinaManager) - 一款轻量化的galgame和视觉小说管理工具
- [LunaBox](https://github.com/Saramanda9988/LunaBox) - lightweight,sleek,and feature-rich visual novel management and game statistics tool

数据支持:

- [Bangumi](https://github.com/bangumi) - Bangumi番组计划

## TODO

- [ ] 多数据源聚合
- [ ] 多语言
- [ ] 备份与其他管理器数据导入

## 开发

需要 Node.js、pnpm、Rust，以及 [Tauri 前置条件](https://v2.tauri.app/start/prerequisites/)。

```bash
pnpm install
pnpm tauri dev      # 开发
pnpm tauri build    # 打包
```

## 数据

`%APPDATA%\LunaVN\`（数据库、设置与图片缓存）。游戏封面缓存在 `image-cache\games\`，角色与人物图片分别缓存在 `image-cache\characters\`、`image-cache\persons\`。

## 许可

[MIT](./LICENSE)

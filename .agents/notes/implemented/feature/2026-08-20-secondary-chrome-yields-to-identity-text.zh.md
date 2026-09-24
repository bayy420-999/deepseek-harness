# Agent Note：侧边栏时间格与目标栏标签向标识文字让位

Status: implemented

[English](2026-08-20-secondary-chrome-yields-to-identity-text.md) | 中文

## 问题

还有两个表面让次级骨架挤占了标识文字。侧边栏会话行（`packages/client/ui-workspace`）把相对时间格固定为 `flex: none`，于是列宽吃紧时会话标题——该行的标识——被截断，而时间戳保持完整宽度。目标栏（`packages/client/ui-goal`）同样固定了阶段标签：在手机宽度的输入框卡片上，「进行中/已暂停」标签加操作按钮让目标描述——该栏的标识文字——只剩两三个字符的省略号。[头部面包屑说明](2026-08-20-header-crumbs-keep-the-current-title.md)确立的模式——标识文字优先获得宽度、次级骨架让位——同样适用于这两处。

## 决策

- **侧边栏会话行**（`Rows.module.css`）：`.sessionRow .title` 从 `flex: 1`（零基准）改为 `flex: 1 1 auto`，使标题的自然内容宽度成为其 flex 基准。`.time` 格从 `flex: none` 改为 `flex: 0 6 auto`，加上 `min-width: 0` 与自身的省略号：它以六倍于标题的速度收缩，先截断自己，只有在极端挤压下才会完全消失。悬停换位（时间格 → 操作按钮）不变，行的悬停卡片仍是标题与路径的完整文本表面。
- **目标栏**（`GoalBar.module.css`）：`.dock` 成为匿名 `inline-size` 容器，卡片宽度低于 420px 时 `@container` 隐藏阶段标签。图标与暂停/恢复操作仍传达阶段，完整目标仍可通过栏既有的 `title` 查看。目标描述保留单行省略号——该栏是 Todo/Queue 输入框卡片家族中固定高度的成员——但在截断之前它先获得标签让出的宽度。

没有改动任何标记、文案或 store 数据；两处修复都是纯 CSS。

## 备选方案

**目标描述折成两行，而不是隐藏标签。** 否决：目标栏的 36px 高度是 Todo/Queue 输入框堆栈家族的共享几何；更高的栏会破坏家族的单行扫读，而隐藏标签在真正缺空间的卡片上让出约 80px，宽卡片则保留标签。

**只给侧边栏时间格加省略号（不加收缩优先级）。** 否决：没有 `flex-shrink: 6` 权重时，按比例收缩会更狠地打击标题，因为标题的内容基准远大于时间格。

**侧边栏标题保留 `flex: 1`（零基准）。** 否决：零基准项没有收缩贡献，时间格会先塌缩殆尽而标题纹丝不动——要让「时间先让、标题后让」成立，收缩权重需要标题的真实内容基准。

**用视口媒体查询处理侧边栏。** 否决：侧边栏在桌面与移动端抽屉中都渲染为同样的 280px，视口宽度无法区分紧张情形；flex 权重在任意列宽下都成立，无需媒体查询。

## 后果

行高与悬停卡片契约不变；时间格只在列确实缺空间时截断，标题在任何侧边栏宽度下都能更久地保留文字。目标栏的 dock 现在是一个布局包含上下文（inline-size），对其静态、无门架子元素是安全的。至此完成了由[模型菜单说明](2026-08-20-model-menu-wrap-instead-of-clamp.md)与[头部面包屑说明](2026-08-20-header-crumbs-keep-the-current-title.md)开启的去截断系列。

## 测试

`packages/client/ui-workspace`、`packages/client/ui-goal` 与 `packages/client/ui-sidebar` 套件无需修改即通过（首轮中两个慢设备超时用例在 30s 超时下通过）：变更仅涉及呈现层，目标栏 spec 断言内容存在，纯 CSS 的标签隐藏不破坏该断言。可见 UI 变更的组合式浏览器检查仍为 CI 中的 `DSH_SNAPSHOT=replay pnpm run test:web`；该检查无法在 Android/Termux 开发主机上运行，因为 Playwright 未为该平台提供浏览器构建。

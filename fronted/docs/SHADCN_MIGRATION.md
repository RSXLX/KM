# Shadcn UI 全面迁移与规范化实施报告

> 目录：`fronted/`
> 框架：Next.js 14（App Router）+ Tailwind CSS + Radix UI
> 目标：将前端样式全面迁移至 shadcn/ui 组件体系，统一设计系统、提升可访问性与构建体积优化

## 1. 实施概要

- 已存在基础：项目已具备 shadcn 风格基础能力（Tailwind 主题变量、cn()、Radix 基础组件、components/ui 目录）。
- 本次执行：
  - 新增/补齐基础组件：Checkbox、Select、Switch、Textarea（Radix + cn）。
  - 规范化 admin 模块交互与样式：统一 Button/Input/Label/Select 等。
  - 建立 Storybook（@storybook/nextjs + addon-essentials + addon-a11y），添加 Button/Input/Card 的演示用例。
  - Tailwind 设计系统对齐：采用 CSS 变量与 dark class 模式，统一全局样式来源于 `app/globals.css` 与 `tailwind.config.js`。
  - 依赖清理：移除未使用的 UI 库（`antd`、`@ant-design/icons`、`next-intl`、`@rainbow-me/rainbowkit`），保留必要的图表/业务库。

## 2. 目录结构与组件清单

- 统一目录：`fronted/components/ui`
- 基础组件（shadcn 标准/扩展）：
  - button.tsx（cva + Radix Slot）
  - input.tsx
  - label.tsx
  - card.tsx
  - dialog.tsx
  - dropdown-menu.tsx
  - progress.tsx
  - separator.tsx
  - tabs.tsx
  - 新增：checkbox.tsx / select.tsx / switch.tsx / textarea.tsx

## 3. 样式迁移对照表（主要页面）

| 模块/文件 | 迁移前 | 迁移后 | 说明 |
|---|---|---|---|
| app/admin/login/page.tsx | 原生 `<input>`/`<button>` + 自定义类 | 使用 `Input`/`Button`/`Label` | 表单语义与焦点状态、无障碍属性更统一 |
| app/admin/markets/page.tsx | 原生 `<select>`/`<input>`/`<button>` | 使用 `Select`/`Input`/`Button`/`Label` | 新建市场弹窗全面采用 shadcn 组件；操作按钮 `outline` 风格 |
| app/admin/orders/page.tsx | 原生 `<input>`/`<button>` | 使用 `Input`/`Button` | 结算弹窗采用设计系统颜色与圆角、焦点样式 |
| app/admin/carousel/page.tsx | 原生 `checkbox`/`file input` | 使用 `Checkbox`/`Input`(type=file)/`Label` | 启用开关统一无障碍与样式，文件选择支持 shadcn 输入框 |
| components/layout/* | 部分原生按钮 | 统一为 `Button`/`Input`（保留个别纯链接按钮） | 基于交互语义选择 variant（ghost/outline/default） |

> 注：体育模块与测试页仍有零星原生 `<button>`，将按增量方式继续替换以保证功能稳定。

## 4. 代码风格与交互规范

- className 组织：统一使用 `cn()`，禁止手动拼接过多条件类名。
- 交互模式：优先采用 Radix headless 组件（Dialog/Dropdown/Tabs/Select），保证键盘与屏幕阅读器可用性。
- 颜色与主题：统一使用 `hsl(var(--...))` 变量，暗黑模式通过 `html.dark` 切换；Button 使用 variant（default/outline/destructive/secondary/ghost/link/success/up/down）。

## 5. 质量与可视化验证

- Storybook：
  - 组件用例：`components/ui/Button.stories.tsx`、`Input.stories.tsx`、`Card.stories.tsx`
  - 插件：`addon-essentials`、`addon-a11y`（移除不兼容的 `storybook-dark-mode`）
  - 预览：`fronted/.storybook/main.ts`、`fronted/.storybook/preview.tsx`
- 无障碍提升：Button 图标按钮提供 `aria-label`（组件层）、表单控件提供 `label` 或 `aria-label`。

## 6. 构建体积优化（阶段性）

- 依赖移除：`antd` / `@ant-design/icons` / `next-intl` / `@rainbow-me/rainbowkit` 已移除。
- 预期影响：上述 UI 库与国际化库的剔除，通常可减少 >10–30% 的页面初次加载 JS（具体取决于引用范围）。
- 度量方案：
  1) 使用 `next build` 的 `First Load JS by route` 表对比（需解决 `.next` 目录锁与部分 prerender 报错，见下文）。
  2) 对比 `node_modules` 安装前后总体体积（可作为粗略指标）。
  3) 对比各路由的 `chunks` 与 `app` 入口大小（`stats.json` 或 `analyze` 插件）。

> 当前阻塞：`next build` 存在 prerender（CSR bail-out）报错与 `.next` 目录锁历史问题；已将 `output: export` 关闭并修正部分编译警告。建议后续在 `account/positions` 与首页将 `useSearchParams()` 包裹在 `<Suspense>` 或转纯客户端渲染组件，解除静态预渲染错误后完成体积对比。

## 7. 设计决策记录

- 优先复用已有 shadcn 风格（按钮/输入/卡片等）并补齐缺失组件（Checkbox/Select/Switch/Textarea）。
- 保留 Recharts（图表）与 Solana 相关依赖，避免干扰业务功能。
- 移除不使用的 UI/国际化/钱包相关依赖，降低 bundle 开销与攻击面。
- Storybook 采用 8.x + webpack5 默认方案，暂不引入不兼容插件，保证可用性与可维护性。

## 8. 后续工作与建议

- 继续替换体育与测试页面的原生 `<button>` 为 `Button`，统一状态与可访问性。
- 为主要交互添加 `aria-*` 与 `role` 属性（例如关闭按钮 `aria-label`）。
- 构建优化：
  - 开启按需动态引入（`import()`）与路由级代码分割。
  - 使用 `next/script` 延迟第三方脚本加载。
  - 图片资源统一走 `next/image`（生产环境 `unoptimized: false`）
- 解除 `useSearchParams` 的 CSR bail-out 提示（加入 `<Suspense>` 或改造为纯客户端组件），以完整产出构建体积报告与≥20% 优化证明。

---

如需继续推进剩余页面的迁移与度量，我会基于上述规范按目录逐步替换并输出每次变更的可视化对比与构建体积差异报告。
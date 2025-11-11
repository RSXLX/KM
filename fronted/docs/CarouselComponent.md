# EnhancedCarousel 使用文档

## 概述
`EnhancedCarousel` 是一款可定制的轮播图组件，采用与项目一致的 UI 风格，并放大卡片尺寸以提升视觉冲击。

## 特性
- 卡片宽度为基础尺寸的 150%（可配置 `scale`）
- 卡片内边距 24px（`paddingPx` 可配置）
- 阴影增强：`0 8px 24px rgba(0,0,0,0.12)`（`shadow` 可配置）
- 圆角 12px（`radiusPx` 可配置）
- 响应式尺寸，平滑过渡动画（framer-motion）
- 图片懒加载与相邻项预加载
- 每个卡片支持点击跳转链接
- 并列多卡显示：根据容器宽度自动显示 1/2/3 张卡片（可通过 `maxVisible` 控制上限）

## 类型定义
参见 `fronted/types/carousel.ts`：
- `CarouselItem`：卡片数据结构
- `CarouselConfig`：组件配置项

## 使用示例
```tsx
import { EnhancedCarousel } from '@/components/ui/EnhancedCarousel';
import type { CarouselItem } from '@/types/carousel';

const items: CarouselItem[] = [ /* 从 API 获取 */ ];

<EnhancedCarousel
  items={items}
  config={{ scale: 1.5, paddingPx: 24, radiusPx: 12, shadow: '0 8px 24px rgba(0,0,0,0.12)', autoplayMs: 4000, maxVisible: 3 }}
/>
```

## 数据来源
默认通过 `/api/carousel/items` 获取，详见管理端 API 文档。

## 预览页面
访问 `/test-carousel` 可查看组件效果。
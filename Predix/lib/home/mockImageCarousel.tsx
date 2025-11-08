import React from 'react';
import Image from 'next/image';
import type { ImageItem } from '@/components/custom/ImageCarousel';
// Local static images
import img1 from '@/lib/wallpapaer/bark_tree_moss_1220636_2560x1600.jpg';
import img2 from '@/lib/wallpapaer/lamp_outlet_idea_120422_2560x1440.jpg';
import img3 from '@/lib/wallpapaer/wallhaven-1p398w_1920x1080.png';
import img4 from '@/lib/wallpapaer/wallhaven-4l33el_1920x1080.png';
import img5 from '@/lib/wallpapaer/wallhaven-6d21rw_1920x1080.png';
import img6 from '@/lib/wallpapaer/wallhaven-j3l15w_1920x1080.png';
import img7 from '@/lib/wallpapaer/wallhaven-p9j69e_1920x1080.png';
import img8 from '@/lib/wallpapaer/wallhaven-v9pqym_1920x1080.png';
import img9 from '@/lib/wallpapaer/wallhaven-w8gowp_1920x1080.png';
import img10 from '@/lib/wallpapaer/wallhaven-x6pl9v_1920x1080.png';
import img11 from '@/lib/wallpapaer/wallhaven-yxgmll_1920x1080.png';

// 更丰富的多主题内容：世界杯、NBA、NFL、网球、F1、拳击、棒球、电竞、Golf、奥运、加密专题等
export const promoImageItems: ImageItem[] = [
  {
    id: 'i1',
    title: '专题：赛事预测与排行',
    image: (
      <Image src={img1} alt="promo-1" fill sizes="(max-width: 640px) 88vw, (max-width: 768px) 72vw, (max-width: 1024px) 54vw, (max-width: 1280px) 36vw, (max-width: 1536px) 28vw, 24vw" className="object-cover" />
    ),
    href: '/sports-betting',
    cta: <span className="text-xs text-primary">进入</span>,
  },
  {
    id: 'i2',
    title: '每日精选比赛',
    image: (
      <Image src={img2} alt="promo-2" fill sizes="(max-width: 640px) 88vw, (max-width: 768px) 72vw, (max-width: 1024px) 54vw, (max-width: 1280px) 36vw, (max-width: 1536px) 28vw, 24vw" className="object-cover" />
    ),
    href: '/sports-betting',
    cta: <span className="text-xs text-primary">查看</span>,
  },
  {
    id: 'i3',
    title: '热门盘口',
    image: (
      <Image src={img3} alt="promo-3" fill sizes="(max-width: 640px) 88vw, (max-width: 768px) 72vw, (max-width: 1024px) 54vw, (max-width: 1280px) 36vw, (max-width: 1536px) 28vw, 24vw" className="object-cover" />
    ),
    href: '/sports-betting',
    cta: <span className="text-xs text-primary">参与</span>,
  },
  {
    id: 'i4',
    title: '比分实时更新',
    image: (
      <Image src={img4} alt="promo-4" fill sizes="(max-width: 640px) 88vw, (max-width: 768px) 72vw, (max-width: 1024px) 54vw, (max-width: 1280px) 36vw, (max-width: 1536px) 28vw, 24vw" className="object-cover" />
    ),
    href: '/sports-betting',
    cta: <span className="text-xs text-primary">立即参与</span>,
  },
  {
    id: 'i5',
    title: '车队对抗',
    image: (
      <Image src={img5} alt="promo-5" fill sizes="(max-width: 640px) 88vw, (max-width: 768px) 72vw, (max-width: 1024px) 54vw, (max-width: 1280px) 36vw, (max-width: 1536px) 28vw, 24vw" className="object-cover" />
    ),
    href: '/sports-betting',
    cta: <span className="text-xs text-primary">抢先体验</span>,
  },
  {
    id: 'i6',
    title: '冠军之战',
    image: (
      <Image src={img6} alt="promo-6" fill sizes="(max-width: 640px) 88vw, (max-width: 768px) 72vw, (max-width: 1024px) 54vw, (max-width: 1280px) 36vw, (max-width: 1536px) 28vw, 24vw" className="object-cover" />
    ),
    href: '/sports-betting',
    cta: <span className="text-xs text-primary">投注</span>,
  },
  {
    id: 'i7',
    title: '美职棒精选',
    image: (
      <Image src={img7} alt="promo-7" fill sizes="(max-width: 640px) 88vw, (max-width: 768px) 72vw, (max-width: 1024px) 54vw, (max-width: 1280px) 36vw, (max-width: 1536px) 28vw, 24vw" className="object-cover" />
    ),
    href: '/sports-betting',
    cta: <span className="text-xs text-primary">进入</span>,
  },
  {
    id: 'i8',
    title: '电竞总决赛',
    image: (
      <Image src={img8} alt="promo-8" fill sizes="(max-width: 640px) 88vw, (max-width: 768px) 72vw, (max-width: 1024px) 54vw, (max-width: 1280px) 36vw, (max-width: 1536px) 28vw, 24vw" className="object-cover" />
    ),
    href: '/sports-betting',
    cta: <span className="text-xs text-primary">参与</span>,
  },
  {
    id: 'i9',
    title: '高尔夫大师赛',
    image: (
      <Image src={img9} alt="promo-9" fill sizes="(max-width: 640px) 88vw, (max-width: 768px) 72vw, (max-width: 1024px) 54vw, (max-width: 1280px) 36vw, (max-width: 1536px) 28vw, 24vw" className="object-cover" />
    ),
    href: '/sports-betting',
    cta: <span className="text-xs text-primary">查看</span>,
  },
  {
    id: 'i10',
    title: '奥运赛季合集',
    image: (
      <Image src={img10} alt="promo-10" fill sizes="(max-width: 640px) 88vw, (max-width: 768px) 72vw, (max-width: 1024px) 54vw, (max-width: 1280px) 36vw, (max-width: 1536px) 28vw, 24vw" className="object-cover" />
    ),
    href: '/sports-betting',
    cta: <span className="text-xs text-primary">更多</span>,
  },
  {
    id: 'i11',
    title: '限时活动合集',
    image: (
      <Image src={img11} alt="promo-11" fill sizes="(max-width: 640px) 88vw, (max-width: 768px) 72vw, (max-width: 1024px) 54vw, (max-width: 1280px) 36vw, (max-width: 1536px) 28vw, 24vw" className="object-cover" />
    ),
    href: '/sports-betting',
    cta: <span className="text-xs text-primary">参与</span>,
  },
];

export default promoImageItems;
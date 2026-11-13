import campBackground from '../../../../../content/common/lobby/camp-background-shop-ground.webp';
import campPortrait from '../../../../../content/common/lobby/camp-portrait.webp';
import campShop from '../../../../../content/common/lobby/shop-building-right.webp';

export { campBackground, campPortrait, campShop };

export const campShopPlacement = { x: 1435, y: 880, size: 350, originY: 0.92, topPadding: 46 / 512 };

export function preloadCampAssets(): void {
  for (const href of [campBackground, campPortrait, campShop]) {
    const existing = document.querySelector(`link[rel="preload"][href="${href}"]`);
    if (existing) continue;
    const link = document.createElement('link');
    link.rel = 'preload'; link.as = 'image'; link.href = href;
    document.head.appendChild(link);
  }
}

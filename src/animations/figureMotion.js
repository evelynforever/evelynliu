/* ============================================================
   Figure motion — 人物的「細微滾動變化」全部集中在這支檔案
   ------------------------------------------------------------
   未來要升級時，只需要替換這個函式的內容：
   · 圖片序列（image sequence）：依 progress 切換 frame
   · Three.js：把 scroll progress 對應到模型旋轉 / 相機
   Prologue.jsx 不需要改動。
   ============================================================ */

import gsap from 'gsap'

/**
 * 把人物動畫加進序曲的主時間軸，整段與 scroll scrub 連續綁定。
 *
 * @param {HTMLElement} figureEl  .figure-motion 元素
 * @param {gsap.core.Timeline} tl  序曲主時間軸
 * @param {number} position        在時間軸上的起始位置
 * @param {number} duration        時間軸總長（等於文案切換次數）
 */
export function createFigureMotion(figureEl, tl, position, duration) {
  if (!figureEl) return

  // 所有變化都刻意保持極小：像是人物隨故事慢慢改變姿態，而非動畫特效
  tl.fromTo(
    figureEl,
    {
      xPercent: 6, // 略偏右
      yPercent: 1.5,
      scale: 1,
      rotate: -1.2,
      filter: 'brightness(0.92) contrast(1.02)',
    },
    {
      xPercent: -4, // 隨敘事微微向左游移
      yPercent: -1,
      scale: 1.035,
      rotate: 1.2,
      filter: 'brightness(1.04) contrast(1.06)',
      ease: 'none',
      duration,
    },
    position,
  )
}

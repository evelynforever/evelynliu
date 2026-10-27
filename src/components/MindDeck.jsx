import { useEffect, useRef } from 'react'
import gsap from 'gsap'
import { MIND_PAGE3_WINDOW_T, MIND_STACK_UNITS } from './MindPages'

// ============================================================
// THE MIND · Page 3 — 扇形疊圖（poem1 / ep1 / ep2）
// 三張同尺寸卡片向右階梯式疊放（首圖在前）；Page 3 展示期間
// 滾動滾輪即輪換前後位置（下滾：首圖退到最後；上滾反向），
//  scrub 時間軸不受影響。每張卡整面是可點擊外連。
// ============================================================

// 三個卡位：正前 / 右後一層 / 右後兩層（仿參考圖的右側階梯露出 + 輕微扇形旋轉）
const SLOT_X = [0, 11, 22] // xPercent（自身寬度百分比）
const SLOT_Y = [0, 1.6, 3.2] // yPercent（自身高度百分比）
const SLOT_R = [0, 1.6, 3.2] // 旋轉角度
const SLOT_Z = [3, 2, 1]

export default function MindDeck({ items }) {
  const cardRefs = useRef([])
  // 每張卡片當前所在卡位；初始順序即 items 順序（首張在最前）
  const slotsRef = useRef(items.map((_, i) => i))

  useEffect(() => {
    // 窄屏：靜態扇形疊放，不隨滾動輪換
    if (window.matchMedia('(max-width: 768px)').matches) return undefined

    let acc = 0
    let lastDir = 0
    let lastAt = 0

    // 僅當 MindPages 時間軸處於 Page 3 展示窗口時才輪換，
    // 否則抵達本頁前的滾動會先把疊圖順序打亂
    const isActive = () => {
      const stack = document.querySelector('.mind-stack')
      if (!stack) return false
      const perUnit = stack.offsetHeight / MIND_STACK_UNITS
      const top = stack.getBoundingClientRect().top + window.scrollY
      const t = (window.scrollY - top) / perUnit
      return t >= MIND_PAGE3_WINDOW_T[0] && t <= MIND_PAGE3_WINDOW_T[1]
    }

    const cycle = (dir) => {
      const prev = slotsRef.current
      // 下滾：每張卡向後挪一位（0→2、1→0、2→1）；上滾反向
      const next = prev.map((s) => (s + (dir > 0 ? 2 : 1)) % 3)
      slotsRef.current = next
      next.forEach((slot, i) => {
        const el = cardRefs.current[i]
        if (!el) return
        // 往前挪的卡立即提升層級；退到後面的卡等動畫結束再降層，避免穿幫
        if (slot < prev[i]) el.style.zIndex = String(SLOT_Z[slot])
        else gsap.delayedCall(0.5, () => { el.style.zIndex = String(SLOT_Z[slot]) })
        gsap.to(el, {
          xPercent: SLOT_X[slot],
          yPercent: SLOT_Y[slot],
          rotation: SLOT_R[slot],
          duration: 0.5,
          ease: 'power2.inOut',
          overwrite: 'auto',
        })
      })
    }

    const onWheel = (e) => {
      if (!isActive()) {
        acc = 0
        return
      }
      const dir = e.deltaY > 0 ? 1 : -1
      if (dir !== lastDir) {
        acc = 0
        lastDir = dir
      }
      acc += Math.abs(e.deltaY)
      const now = performance.now()
      // 累積一段滾動量才換一次，且限制最小間隔，避免觸控板一次連跳
      if (acc >= 120 && now - lastAt > 240) {
        acc = 0
        lastAt = now
        cycle(dir)
      }
    }

    window.addEventListener('wheel', onWheel, { passive: true })
    return () => {
      window.removeEventListener('wheel', onWheel)
      gsap.killTweensOf(cardRefs.current)
    }
  }, [])

  return (
    <div className="mind-page__aside mind-page__deck">
      {items.map((item, i) => (
        <div
          key={item.src}
          ref={(el) => {
            cardRefs.current[i] = el
          }}
          className="mind-page__deck-card"
          style={{
            transform: `translate(${SLOT_X[i]}%, ${SLOT_Y[i]}%) rotate(${SLOT_R[i]}deg)`,
            zIndex: SLOT_Z[i],
          }}
        >
          <a href={item.href} target="_blank" rel="noopener noreferrer" aria-label={item.alt}>
            <img src={item.src} alt={item.alt} draggable="false" />
          </a>
        </div>
      ))}
      <span className="mind-page__deck-hint" aria-hidden="true">
        click
      </span>
    </div>
  )
}

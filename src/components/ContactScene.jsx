import { useEffect, useRef, useState } from 'react'

import '../styles/contact-scene.css'

// ============================================================
// CONTACT · 手持合作聯繫卡插畫
// - public/contact.jpg（1672×941）以 object-fit: cover 佈滿整個頁面
// - CONTACT 方框是可點擊熱區，hover 時用同區域裁切圖 contact-box.png
//   輕微放大（1.05），像方框從卡面浮起；底圖本身不動
// - 方框在原圖中的像素位置全部集中在下方 BOX / CROP 常量，
//   之後要調整熱區只改這裡
// ============================================================

const IMG = { w: 1672, h: 941 }
// CONTACT 方框（點擊熱區，原圖像素座標）
const BOX = { x: 734, y: 594, w: 330, h: 142 }
// hover 放大層的裁切範圍（比方框多留一圈卡面，放大時無縫覆蓋）
const CROP = { x: 722, y: 582, w: 356, h: 166 }

const CONTACT_URL = 'https://evelynforever.github.io/'

export default function ContactScene() {
  const stageRef = useRef(null)
  // cover 換算：原圖像素 → stage 內實際顯示位置
  const [map, setMap] = useState(null)

  useEffect(() => {
    const stage = stageRef.current
    if (!stage) return undefined
    const measure = () => {
      const r = stage.getBoundingClientRect()
      if (!r.width || !r.height) return
      // 窄屏改為 contain（整張卡片完整可見），與 CSS 媒體查詢保持一致
      const contain = window.matchMedia('(max-width: 768px)').matches
      const scale = contain
        ? Math.min(r.width / IMG.w, r.height / IMG.h)
        : Math.max(r.width / IMG.w, r.height / IMG.h)
      const next = {
        scale,
        offX: (r.width - IMG.w * scale) / 2,
        offY: (r.height - IMG.h * scale) / 2,
      }
      setMap((prev) => {
        if (
          prev
          && Math.abs(prev.scale - next.scale) < 0.0005
          && Math.abs(prev.offX - next.offX) < 0.5
          && Math.abs(prev.offY - next.offY) < 0.5
        ) {
          return prev
        }
        return next
      })
    }
    measure()
    const ro = new ResizeObserver(measure)
    ro.observe(stage)
    return () => ro.disconnect()
  }, [])

  return (
    <section className="contact-scene" aria-label="Contact">
      <div ref={stageRef} className="contact-scene__stage">
        <img
          className="contact-scene__img"
          src="/contact.jpg"
          alt="A hand holding a card that reads Let's work together, with a contact box for Evelyn Liu"
          draggable="false"
        />
        {map && (
          <a
            className="contact-scene__link"
            href={CONTACT_URL}
            target="_blank"
            rel="noopener noreferrer"
            aria-label="Contact Evelyn Liu"
            style={{
              left: `${map.offX + BOX.x * map.scale}px`,
              top: `${map.offY + BOX.y * map.scale}px`,
              width: `${BOX.w * map.scale}px`,
              height: `${BOX.h * map.scale}px`,
            }}
          >
            <img
              className="contact-scene__zoom"
              src="/contact-box.png"
              alt=""
              aria-hidden="true"
              draggable="false"
              style={{
                left: `${(CROP.x - BOX.x) * map.scale}px`,
                top: `${(CROP.y - BOX.y) * map.scale}px`,
                width: `${CROP.w * map.scale}px`,
                height: `${CROP.h * map.scale}px`,
              }}
            />
          </a>
        )}
      </div>
    </section>
  )
}

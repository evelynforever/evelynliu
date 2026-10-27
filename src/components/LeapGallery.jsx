import { useEffect, useRef } from 'react'
import gsap from 'gsap'
import { ScrollTrigger } from 'gsap/ScrollTrigger'

import '../styles/leap-gallery.css'
import { assetUrl } from '../assetUrl'

gsap.registerPlugin(ScrollTrigger)

// ============================================================
// THE LEAP · 影像畫廊
// 黑底；首圖固定在畫面正中、尺寸永不改變。
// 首圖由中心的一個圓點逐漸顯現為整張照片，完整出現後，
// 14 張照片才從首圖背後依次射出、邊飛邊放大；任意時刻最多兩張在飛。
// ============================================================

// 照片順序即出場順序（請勿調換）；portrait 決定長邊對齊方式
const PHOTOS = [
  { src: '/p1.jpg', portrait: true },
  { src: '/p2.jpg', portrait: true },
  { src: '/p3.jpg', portrait: false },
  { src: '/p4.jpg', portrait: false },
  { src: '/p5.jpg', portrait: true },
  { src: '/p6.jpg', portrait: true },
  { src: '/p8.jpg', portrait: true },
  { src: '/p9.jpg', portrait: false },
  { src: '/leap1.jpg', portrait: true },
  { src: '/leap2.jpg', portrait: true },
  { src: '/leap3.jpg', portrait: false },
  { src: '/leap4.jpg', portrait: true },
  { src: '/leap5.jpg', portrait: true },
  { src: '/leap6.jpg', portrait: false },
]

// 14 張照片的發射方向（度，0 = 右、-90 = 上）：
// 奇數索引飛向左半圓（90°–240°）、偶數索引飛向右半圓（-90°–60°），
// 相鄰兩張必定分居相反側、夾角 ≥ 150°，保證同時在飛的兩張絕不互相遮擋。
const ANGLES = [
  -90,   90,   // up / down
  -65,  115,   // upper-right / lower-left
  -40,  140,   // right-up / left-down
  -15,  165,   // right / left
   10,  190,   // right slightly down / left slightly down
   35,  215,   // lower-right / upper-left
   60,  240,   // lower-right-ish / upper-left-ish
]
const HERO_REVEAL = 0.9 // 首圖由中心圓點逐漸顯現為整張的時長
const HERO_HOLD = 0.05 // 首圖完整出現後、第一張照片射出前的停留（幾乎無空檔）
const DUR = 0.7 // 單張照片由首圖背後飛到畫面外的行程（飛得乾淨俐落）
const STEP = DUR / 3 // 相鄰兩張的出場間隔（= DUR/3 → 平均三張同時在飛，密集爆炸感）
const TAIL = 0.15 // 收尾停留（簡短）
const BIRTH = 0.08 // 起點：仍在首圖背後的位置（佔總行程的比例）
const SCALE_FROM = 0.08 // 起點縮放：從極小開始放大，整個飛行過程長到 2 倍
const SCALE_TO = 2
const PHOTO_START = HERO_REVEAL + HERO_HOLD // 首圖完整出現後，照片才開始發射

export default function LeapGallery() {
  const rootRef = useRef(null)
  const stageRef = useRef(null)
  const heroRef = useRef(null)
  const photoRefs = useRef([])

  useEffect(() => {
    const ctx = gsap.context(() => {
      const photos = photoRefs.current.filter(Boolean)
      // 每張照片沿自己的方向飛到「完全離開畫面」的距離。
      // 採 Math.min（沿用原始邏輯），PAD 加大到 450px 以應對 2 倍放大：
      //   水平飛的照片需要 stageW/2 + 450（確保 2 倍尺寸時整張離開右邊緣）
      //   垂直飛的照片需要 vh/2 + 450（同理）
      // 取 min 讓飛行距離由較窄的方向決定，避免斜向飛的照片過度延長 DUR。
      const exitDistance = (cos, sin) => {
        const stageW = window.innerWidth - navOffset()
        const PAD = 450
        const tx = Math.abs(cos) < 1e-4 ? Infinity : (stageW / 2 + PAD) / Math.abs(cos)
        const ty = Math.abs(sin) < 1e-4 ? Infinity : (window.innerHeight / 2 + PAD) / Math.abs(sin)
        return Math.min(tx, ty)
      }
      const navOffset = () =>
        window.innerWidth <= 768 ? 54 : window.innerWidth <= 1024 ? 72 : 96

      const tl = gsap.timeline({
        defaults: { ease: 'none' },
        scrollTrigger: {
          trigger: rootRef.current,
          start: 'top top',
          end: 'bottom bottom',
          scrub: true, // 與滾動即時連動：停滾即停、可反向倒放
          pin: stageRef.current,
          anticipatePin: 1,
          invalidateOnRefresh: true,
        },
      })

      // 首圖：由中心的一個圓點開始，圓形窗口逐漸擴大、顯現出整張照片。
      // 75% 的圓半徑已足夠覆蓋矩形四角（覆蓋整張照片）。
      if (heroRef.current) {
        tl.fromTo(
          heroRef.current,
          { clipPath: 'circle(0% at 50% 50%)' },
          { clipPath: 'circle(75% at 50% 50%)', duration: HERO_REVEAL },
          0,
        )
      }

      photos.forEach((el, i) => {
        // 方向由 ANGLES 指定；相鄰兩張分處相反側
        const angle = (ANGLES[i % ANGLES.length] * Math.PI) / 180
        const cos = Math.cos(angle)
        const sin = Math.sin(angle)
        const at = PHOTO_START + i * STEP

        gsap.set(el, { xPercent: -50, yPercent: -50 })

        // 由首圖背後探出，一路飛向畫面外
        tl.fromTo(
          el,
          {
            x: () => cos * exitDistance(cos, sin) * BIRTH,
            y: () => sin * exitDistance(cos, sin) * BIRTH,
          },
          {
            x: () => cos * exitDistance(cos, sin),
            y: () => sin * exitDistance(cos, sin),
            duration: DUR,
          },
          at,
        )
        // 整個飛行過程持續放大：從極小長到 2 倍，
        // 與位置 tween 同步（相同 DUR）→ 飛出畫面時正好達到 2 倍。
        tl.fromTo(
          el,
          { scale: SCALE_FROM },
          { scale: SCALE_TO, duration: DUR, ease: 'none' },
          at,
        )
        // 剛離開首圖邊緣時才完全顯現，避免在中心留下可見的小圖
        tl.fromTo(el, { opacity: 0 }, { opacity: 1, duration: 0.1 }, at)
      })

      tl.to({}, { duration: TAIL }, PHOTO_START + (PHOTOS.length - 1) * STEP + DUR)
    }, rootRef)

    const timer = window.setTimeout(() => ScrollTrigger.refresh(), 300)
    window.addEventListener('resize', ScrollTrigger.refresh)

    return () => {
      window.clearTimeout(timer)
      window.removeEventListener('resize', ScrollTrigger.refresh)
      ctx.revert()
    }
  }, [])

  return (
    <section ref={rootRef} className="leap-gallery" aria-label="THE LEAP — photo gallery">
      <div ref={stageRef} className="leap__stage">
        {/* 十四張飛行照片：全部位於首圖之下，從它背後射出 */}
        {PHOTOS.map((photo, i) => (
          <img
            key={photo.src}
            ref={(el) => {
              photoRefs.current[i] = el
            }}
            className={`leap__photo ${photo.portrait ? 'leap__photo--portrait' : 'leap__photo--landscape'}`}
            src={assetUrl(photo.src)}
            alt=""
            loading="lazy"
            draggable="false"
          />
        ))}

        {/* 首圖：永遠置中、尺寸不變；由中心圓點逐漸顯現為整張 */}
        <img
          ref={heroRef}
          className="leap__hero"
          src={assetUrl('/首图.png')}
          alt="Exchange program at Ca' Foscari, Venice"
        />
      </div>
    </section>
  )
}

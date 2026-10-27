import { useEffect, useRef } from 'react'
import gsap from 'gsap'
import { ScrollTrigger } from 'gsap/ScrollTrigger'

import { GROUND_ESSAY } from '../content/groundEssay'
import '../styles/mind-to-ground-transition.css'

gsap.registerPlugin(ScrollTrigger)

// ============================================================
// THE MIND → THE GROUND · 章節過渡
// 「From mind to form」滑出後，鋼筆筆尖立即自底部升起，
// 不以任何文案頁作為間隔；長滾動軌道 + 100vh pinned 舞台。
// ============================================================

// ---------- 鋼筆筆尖（本節一進場即自底部升起） ----------
const PEN_HIDDEN = 105 // 起始：整支在畫面外（自身高度百分比）
const PEN_FINAL = 12 // 完成：底部仍留 12% 在畫面外，底緣平切永不露出
const PEN_RISE = 1.6 // 升起過程佔用的 timeline 長度

// ---------- CIRCLE_GROW_PHASE（鋼筆「完全升起之後」才開始） ----------
// 兩個 tween 並行：
//   ① 筆尖整體 scale = PEN_SCALE_FINAL（以底緣為軸）→ 筆身鋪滿畫面成 #3a3a3a ；
//      同時讓圓孔圓心自然落到 ≈ 0.12vh（畫面頂部附近）。
//   ② 圓孔獨立額外 scale，以圓心為原點 → 最終半徑 = HOLE_TARGET_RW × innerWidth，
//      使圓孔直徑 ≈ 0.95W（參考圖：圓被畫面頂邊裁切、頂邊弦寬 ≈ 94%W）。
const CIRCLE_GROW = 9 // 放大階段佔用的 timeline 長度（愈大圓孔放大愈慢）
const BLACKOUT = 1 // 圓孔收黑階段：圓孔填色由淺灰漸變為筆身色 → 整個畫面純黑

// ---------- ESSAY / GRADUATE PHOTO（圓孔收黑「之後」立刻開始） ----------
// 文案與鋼筆在同一個 pinned 舞台 → 圓孔消失的當下就能看到文字自底端升起，
// 中間不會出現一段空白滾動。
const ESSAY_RISE = 2.6 // 文案自底端滑到正中央佔用的 timeline 長度
const WORDS_SWITCH = 3 // 三個疊影詞停留與輪替的長度（含結尾留白）
const ESSAY_EXIT = 2.4 // 整塊文案繼續上滑、完全離開頁面的長度

// 巨型疊影詞（順序即高亮順序，請勿調換；顯示為大寫）
const WORDS = ['Responsibility', 'Aspiration', 'Courage']

const IMAGE_RISE = 5.4 // 校門照自底端滑過整個畫面：行程＝圖片自身高度（不裁切、完整看過一遍）
const IMAGE_HOLD = 0.6 // 滑完後停留一小段，讓最後一段內容能被看清楚
const PEN_SCALE_FINAL = 8.05 // 筆尖整體最終 scale（反解：使圓心落在 ≈ 0.12vh）
const HOLE_TARGET_RW = 0.473 // 圓孔最終半徑 = 畫面寬 × 此係數（來自參考圖反解）
const HOLE_R0 = 17 // 透氣孔原始半徑（viewBox 使用者單位）
const VIEW_H = 302 // SVG viewBox 高度

// ---------- 照片軌道（Photo Strip） ----------
// DEBUG_GALLERY 僅為開發預覽：暫時在畫面中央顯示未裁切的完整 Photo Strip，
// 驗證排版用，不是最終設計；發佈 / 驗收前改回 false 即恢復圓形窗口。
const DEBUG_GALLERY = false
const PHOTO_HEIGHT = 260 // 每張照片框高度（px）
const PHOTO_ASPECT_RATIO = 4 / 3 // 每張照片框寬高比
const PHOTO_GAP = 24 // 相鄰照片間距（px）

// 照片軌道：四張照片水平排列（順序即敘事順序，請勿調換）。
// foreignObject 內與 DEBUG 預覽共用同一份結構 → 尺寸 / 順序 / 間距永遠一致。
// stripRef 僅由 foreignObject 內那份使用（每幀反向縮放，見下方 ticker）。
function PhotoStrip({ stripRef }) {
  return (
    <div className="photo-strip" ref={stripRef}>
      <div className="photo-frame">
        <img src="/classroom.jpg" alt="" />
      </div>
      <div className="photo-frame">
        <img src="/jiazhanghui.jpg" alt="" />
      </div>
      <div className="photo-frame">
        <img src="/zhanban.jpg" alt="" />
      </div>
      {/* shudong.jpg 是豎圖（3:4），用豎版相框完整顯示，高度與其他照片一致 */}
      <div className="photo-frame photo-frame--portrait">
        <img src="/shudong.jpg" alt="" />
      </div>
    </div>
  )
}

export default function MindToGroundTransition() {
  const rootRef = useRef(null) // 長滾動軌道
  const stageRef = useRef(null) // 被 pin 住的 100vh 舞台
  const penRef = useRef(null) // 鋼筆筆尖（進場即升起，之後整體放大）
  const penHoleRef = useRef(null) // 鋼筆中央透氣孔（獨立額外 scale，圓心不漂移）
  const photoOverlayRef = useRef(null) // 照片覆疊層（clip-path 圓形窗口對齊圓孔）
  const photoStripRef = useRef(null) // 覆疊層內照片軌道（原尺寸渲染，保證清晰）
  const essayRef = useRef(null) // THE GROUND 開篇文案 + 疊影詞（圓孔收黑後自底端上滑）
  const wordRefs = useRef([]) // 三個巨型疊影詞（隨滾動輪流高亮）
  const gradRef = useRef(null) // 校門照（文案離場後自底端升起鋪滿畫面）
  const gradLayerRef = useRef(null) // 校門照所在層（淺灰底僅在照片進場時淡入）

  useEffect(() => {
    // 導覽跳轉監聽的清除函式（在 gsap.context 內註冊，這裡保留下來供 cleanup 呼叫）
    let cleanupGoto = () => {}
    // gsap.context 在 cleanup 時一併 revert timeline 與 ScrollTrigger，
    // 避免 React StrictMode（development）下重複註冊。
    const ctx = gsap.context(() => {
      // 章節指示：隨時間軸進度切換左側導覽的作用中章節
      // （本節一進場＝THE MIND 最後一頁已滑出 → The Ground；校門照開始進場 → The Leap）
      let leapAt = 2
      let activeChapter = ''
      const syncChapter = (progress) => {
        const chapter =
          progress < 0 ? 'The Mind' : progress >= leapAt ? 'The Leap' : 'The Ground'
        if (chapter === activeChapter) return
        activeChapter = chapter
        window.dispatchEvent(new CustomEvent('prologue:chapter', { detail: chapter }))
      }

      const tl = gsap.timeline({
        defaults: { ease: 'none' },
        scrollTrigger: {
          trigger: rootRef.current,
          start: 'top top',
          end: 'bottom bottom',
          scrub: true, // 文字位置與滾動即時連動：停滾即停、可反向倒放
          pin: stageRef.current,
          anticipatePin: 1,
          invalidateOnRefresh: true, // 視窗尺寸改變後重算位移
          onEnter: () => syncChapter(0),
          onUpdate: (self) => {
            if (self.isActive) syncChapter(self.progress)
          },
          // 向上滾出本節（回到 THE MIND）時還原章節
          onLeaveBack: () => syncChapter(-1),
        },
      })

      // 鋼筆筆尖：上一頁（From mind to form）完全淡成純灰後立即自底部升起
      const reducedMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches
      // 窄屏：文案改為單列靜態頁（見 GroundOpening），舞台內不再放長文
      const narrowScreen = window.matchMedia('(max-width: 768px)').matches
      // 桌面：本節以 -107vh 接在上一章「已淡成純灰」之後，
      // 舞台底色先設為透明 → 重疊期間完全不遮住上一頁最後的淡出；
      // pin 開始的那一瞬間補回純灰 #dedddb（此時底層已是同一灰色，切換不可見）
      if (!narrowScreen && !reducedMotion) {
        gsap.set(stageRef.current, { backgroundColor: 'rgba(222, 221, 219, 0)' })
        tl.to(
          stageRef.current,
          { backgroundColor: 'rgba(222, 221, 219, 1)', duration: 0.01 },
          0,
        )
      }
      gsap.set(penRef.current, {
        xPercent: -50,
        yPercent: reducedMotion ? PEN_FINAL : PEN_HIDDEN,
        /* 原點固定在底緣中央：後面放大時平切底邊不會上移，筆尖只向上生長 */
        transformOrigin: '50% 100%',
      })
      if (!reducedMotion) {
        tl.to(penRef.current, { yPercent: PEN_FINAL, duration: PEN_RISE })
      }
      tl.addLabel('penRiseEnd', PEN_RISE)

      // ---------- CIRCLE_GROW_PHASE ----------
      // 兩個並行 tween：筆尖整體放大（鋪滿畫面成筆身黑）+ 圓孔額外放大（達 0.95W）
      const penH = () => penRef.current?.offsetHeight || window.innerHeight * 0.52
      // 圓孔自身的額外 scale（以圓心為原點，圓心不漂移）
      // 圓孔最終半徑 = HOLE_R0 × PEN_SCALE_FINAL × holeExtraScale（使用者單位）
      // 渲染到畫面上的像素半徑 = (penH / VIEW_H) × HOLE_R0 × PEN_SCALE_FINAL × holeExtraScale
      // 令其等於 HOLE_TARGET_RW × innerWidth → 解 holeExtraScale
      const holeExtraScale = () => {
        const penScale = PEN_SCALE_FINAL
        const renderedRadius = (penH() / VIEW_H) * HOLE_R0 * penScale // 筆尖整體放大後，圓孔已有半徑
        const target = HOLE_TARGET_RW * window.innerWidth // 目標像素半徑
        return target / renderedRadius
      }
      if (!reducedMotion) {
        // ① 筆尖整體以底緣為軸向上生長，整支筆放大 PEN_SCALE_FINAL 倍
        tl.to(
          penRef.current,
          { scale: PEN_SCALE_FINAL, duration: CIRCLE_GROW },
          PEN_RISE,
        )
        // ② 圓孔自身額外 scale，以圓心 (100, 234) 為原點，圓心不動
        tl.to(
          penHoleRef.current,
          { scale: holeExtraScale, svgOrigin: '100 234', duration: CIRCLE_GROW },
          PEN_RISE,
        )
      }
      tl.addLabel('circleGrowEnd', PEN_RISE + CIRCLE_GROW)

      // ---------- BLACKOUT：圓孔消失，整個畫面變成與筆身一致的 #3a3a3a ----------
      // 此時照片已全部滑出圓外，只需把圓孔填色收到筆身色；
      // 完成後下一節（THE GROUND）以同色開場 → 無接縫。
      const holeCircle = penHoleRef.current?.querySelector('circle')
      if (!reducedMotion && holeCircle) {
        tl.to(
          holeCircle,
          { fill: '#3a3a3a', duration: BLACKOUT },
          PEN_RISE + CIRCLE_GROW,
        )
      }
      tl.addLabel('blackoutEnd', PEN_RISE + CIRCLE_GROW + BLACKOUT)

      // ---------- ESSAY：圓孔收黑後，文案立刻自畫面底端上滑 ----------
      // 起始位置＝文案上緣剛好落在畫面底端外側（+20px），
      // 因此收黑完成後的下一點滾動就能看到文字進場，沒有空白等待；
      // 之後隨著滾動繼續上滑，直到整塊文案移出頁面頂端。
      // 窄屏文案為單列、高度超過一屏，改由 GroundOpening 靜態呈現。
      const essayEl = essayRef.current
      const gradEl = gradRef.current
      const wordEls = wordRefs.current.filter(Boolean)
      const essayStart = PEN_RISE + CIRCLE_GROW + BLACKOUT
      const essayOffset = () =>
        window.innerHeight / 2 + essayEl.offsetHeight / 2 + 20
      if (essayEl && !narrowScreen) {
        tl.fromTo(
          essayEl,
          { y: essayOffset },
          { y: 0, duration: ESSAY_RISE },
          essayStart,
        )

        // 三個疊影詞：進場後的第一個詞先亮（與 CSS 初始值一致），
        // 之後每切換一次只做短促的透明度交替，其餘詞退為殘影。
        if (wordEls.length === WORDS.length) {
          const switches = [
            [0, 1], // RESPONSIBILITY → ASPIRATION
            [1, 2], // ASPIRATION → COURAGE
          ]
          switches.forEach(([from, to], i) => {
            const at = essayStart + ESSAY_RISE + 0.8 + i * 1.1
            tl.to(wordEls[from], { opacity: 0.07, duration: 0.3 }, at)
            tl.to(wordEls[to], { opacity: 0.85, duration: 0.3 }, at)
          })
        }

        // 疊影詞停留期間結束後，整塊文案繼續上滑離場
        tl.to(
          essayEl,
          { y: () => -essayOffset(), duration: ESSAY_EXIT },
          essayStart + ESSAY_RISE + WORDS_SWITCH,
        )
      }
      tl.addLabel('essayEnd', essayStart + ESSAY_RISE + WORDS_SWITCH + ESSAY_EXIT)

      // ---------- 校門照：文案完全滑出頂端後，自畫面底端升起，完整滑過一遍 ----------
      // 圖片以整寬（原比例）呈現、不裁切；終點＝圖片底緣剛好貼齊畫面底緣，
      // 因此滑動過程中上緣到 下緣 的每一段內容都會依序進到畫面裡。
      if (gradEl && !narrowScreen) {
        const imageStart = essayStart + ESSAY_RISE + WORDS_SWITCH + ESSAY_EXIT
        tl.fromTo(
          gradEl,
          { y: () => window.innerHeight },
          { y: () => window.innerHeight - gradEl.offsetHeight, duration: IMAGE_RISE },
          imageStart,
        )
        // 淺灰底只在照片進場的當下淡入（此文案已完全離場），
        // 因此不會遮住 THE GROUND 文案
        const layerEl = gradLayerRef.current
        if (layerEl) {
          tl.fromTo(
            layerEl,
            { backgroundColor: 'rgba(222, 221, 219, 0)' },
            { backgroundColor: '#dedddb', duration: 0.5 },
            imageStart,
          )
        }
        tl.to({}, { duration: IMAGE_HOLD }, imageStart + IMAGE_RISE)
      }
      tl.addLabel(
        'graduateEnd',
        essayStart + ESSAY_RISE + WORDS_SWITCH + ESSAY_EXIT + IMAGE_RISE + IMAGE_HOLD,
      )

      // 用時間軸上的時間點換算成 0–1 進度，供上方 syncChapter 判斷章節
      const st = tl.scrollTrigger
      leapAt = (essayStart + ESSAY_RISE + WORDS_SWITCH + ESSAY_EXIT) / tl.duration()
      // 初始（尚未捲入本節）維持 The Mind
      syncChapter(st && st.isActive ? st.progress : -1)

      // ---------- 左側導覽跳轉：把時間軸上的時間點換算成實際滾動座標 ----------
      // The Ground → 文案頁（置中、可閱讀）；The Leap → 校門照開始進場
      const scrollAt = (time) =>
        st.start + (time / tl.duration()) * (st.end - st.start)
      const onGoto = (e) => {
        if (!st) return
        const targets = {
          'The Ground': essayStart + ESSAY_RISE,
          'The Leap': essayStart + ESSAY_RISE + WORDS_SWITCH + ESSAY_EXIT,
        }
        const time = targets[e.detail]
        if (time == null) return
        // +1px：讓落點確實越過章節門檻，導覽才會同步亮起該章
        window.scrollTo({ top: scrollAt(time) + 1, behavior: 'smooth' })
      }
      window.addEventListener('prologue:goto', onGoto)
      cleanupGoto = () => window.removeEventListener('prologue:goto', onGoto)
    }, rootRef)

    // 字體 / 版面資源載入後重新計算 pin
    const refresh = () => ScrollTrigger.refresh()
    const timer = window.setTimeout(refresh, 300)
    window.addEventListener('load', refresh)

    return () => {
      window.clearTimeout(timer)
      window.removeEventListener('load', refresh)
      cleanupGoto()
      ctx.revert()
    }
  }, [])

  // ---------- 照片層：清晰渲染 + 滑入 + 橫移（獨立監聽，不碰上方任何動畫代碼） ----------
  // 照片不放 SVG foreignObject（極端放大下瀏覽器對 FO 降解析度點陣化 → 模糊）；
  // 改為 stage 上的 HTML 覆疊層，clip-path 圓形每幀對齊 SVG 圓孔的屏幕矩形 → 原生解析度渲染。
  // 節奏（全部跟隨圓孔直徑 d，scrub 可逆）：
  //   d < ≈434（第一張照片對角線）：不顯示，圓孔保持淺灰；
  //   d ≈434→574：照片1從圓右緣滑入中央（前 40% 快速淡入）——滑入而非突然出現；
  //   d 574→MOVE_END：整條 strip 從右往左橫移；MOVE_END = 圓孔最終直徑的 62% 處
  //   → 照片移動比圓孔放大快，最後一張居中後圓孔繼續放大收尾。
  useEffect(() => {
    const overlay = photoOverlayRef.current
    const strip = photoStripRef.current
    const circle = penHoleRef.current?.querySelector('circle')
    const stage = stageRef.current
    if (!overlay || !strip || !circle || !stage) return

    const PHOTO_W = PHOTO_HEIGHT * PHOTO_ASPECT_RATIO // 第一張照片寬（px）
    const FADE_START = Math.hypot(PHOTO_W, PHOTO_HEIGHT) // ≈434px：完整容納第一張的最小圓直徑
    const ENTER_END = FADE_START + 140 // 滑入段結束（≈574px）
    const MOVE_END_FRAC = 0.5 // 橫移在圓孔達「最終直徑」的 50%（相對剩餘區間）處結束
    const finalDiameter = () => 2 * HOLE_TARGET_RW * window.innerWidth // 圓孔最終屏幕直徑

    // 橫移總行程 = 照片1中心 → 最後一張中心（覆疊層為原尺寸，即屏幕 px）
    const frames = strip.children
    const travelMax =
      frames.length > 1
        ? frames[frames.length - 1].offsetLeft +
          frames[frames.length - 1].offsetWidth / 2 -
          (frames[0].offsetLeft + frames[0].offsetWidth / 2)
        : 0

    // cx, cy, r = 圓孔在 stage 座標系內的中心與半徑（px）
    const apply = (cx, cy, r, finalD = finalDiameter()) => {
      const d = 2 * r
      // 淡入：滑入段前 40% 完成
      const fade = (d - FADE_START) / ((ENTER_END - FADE_START) * 0.4)
      strip.style.opacity = Math.min(1, Math.max(0, fade))
      // 水平位移 x：正 = 偏右（滑入），負 = 偏左（橫移）
      let x
      if (d <= FADE_START) {
        x = FADE_START / 2 // 照片1中心貼在圓右緣
      } else if (d < ENTER_END) {
        x = (FADE_START / 2) * (1 - (d - FADE_START) / (ENTER_END - FADE_START))
      } else {
        const moveEnd = ENTER_END + (finalD - ENTER_END) * MOVE_END_FRAC
        // 照片向右滑出後就不再移動，而圓孔仍持續放大 → 退讓距離必須以
        // 「圓孔最終半徑」計算，否則圓孔長大後會再次追上並吞回末張照片。
        const lastHalfW = frames[frames.length - 1].offsetWidth / 2
        const travelTotal = travelMax + finalD / 2 + lastHalfW + 40
        const t = Math.min(1, (d - ENTER_END) / (moveEnd - ENTER_END))
        x = -t * travelTotal
      }
      strip.style.transform = `translate(${cx - PHOTO_W / 2 + x}px, ${cy - PHOTO_HEIGHT / 2}px)`
      overlay.style.clipPath = `circle(${r}px at ${cx}px ${cy}px)`
    }

    const update = () => {
      const cr = circle.getBoundingClientRect()
      const sr = stage.getBoundingClientRect()
      apply(cr.left + cr.width / 2 - sr.left, cr.top + cr.height / 2 - sr.top, cr.width / 2)
    }

    window.addEventListener('scroll', update, { passive: true })
    window.addEventListener('resize', update)
    update()
    // 開發驗證鉤子：無頭 / 背景分頁的 rAF 可能被節流，GSAP 不自動渲染時
    // 可呼叫 __mgtGsapTick() 強制渲染一幀、__mgtPhotoUpdate() 重算照片；
    // __mgtSimulate(圓直徑[, 最終直徑]) 可模擬任意圓徑下的照片狀態（不影響真實滾動邏輯）。
    window.__mgtPhotoUpdate = update
    window.__mgtGsapTick = () => gsap.updateRoot(gsap.globalTimeline.time())
    window.__mgtSimulate = (d, fd) => {
      const cr = circle.getBoundingClientRect()
      const sr = stage.getBoundingClientRect()
      apply(cr.left + cr.width / 2 - sr.left, cr.top + cr.height / 2 - sr.top, d / 2, fd)
    }
    return () => {
      window.removeEventListener('scroll', update)
      window.removeEventListener('resize', update)
      delete window.__mgtPhotoUpdate
      delete window.__mgtGsapTick
      delete window.__mgtSimulate
    }
  }, [])

  return (
    <section
      ref={rootRef}
      className={`mgt${DEBUG_GALLERY ? ' mgt--debug' : ''}`}
      style={{
        '--photo-h': `${PHOTO_HEIGHT}px`,
        '--photo-w': `${(PHOTO_HEIGHT * PHOTO_ASPECT_RATIO).toFixed(2)}px`,
        '--photo-gap': `${PHOTO_GAP}px`,
      }}
      aria-label="Transition — from THE MIND to THE GROUND"
    >
      <div ref={stageRef} className="mgt__stage">
        {/* 鋼筆筆尖：本節一進場即自底部中央升起（造型對照截圖） */}
        <div ref={penRef} className="mgt__pen" aria-hidden="true">
          {/* pen__hole：淺灰圓孔（fill="#dedddb"）。GSAP 對這個 <g> 做額外 scale 讓圓孔擴大；
              照片不再放 foreignObject（極端放大下瀏覽器對 FO 降解析度點陣化 → 模糊），
              改由 stage 上的 HTML 覆疊層 + clip-path 每幀對齊此圓孔 */}
          <svg viewBox="18 0 164 302">
            {/* 筆尖主體：尖峰 → 內凹弧線外擴至肩部（最高點約 52% 高度處）
                → 快速轉向 → 兩側近直線微內收到底緣 */}
            <path
              d="M100 2
                 C 97 30, 80 108, 26 154
                 Q 21 160, 23 170
                 L 35 302
                 L 165 302
                 L 177 170
                 Q 179 160, 174 154
                 C 120 108, 103 30, 100 2 Z"
              fill="#3a3a3a"
            />
            {/* 中縫：細線自筆尖直落透氣孔上緣 */}
            <rect x="98.8" y="8" width="2.4" height="207" rx="1.2" fill="#dedddb" />
            {/* 圓孔群組：淺灰填充圓，GSAP 額外 scale 的目標 */}
            <g ref={penHoleRef}>
              <circle cx="100" cy="234" r="17" fill="#dedddb" />
            </g>
          </svg>
        </div>

        {/* 照片覆疊層：clip-path 圓形窗口每幀對齊上方圓孔；
            strip 以原生尺寸渲染（不經 SVG 放大）→ 照片清晰 */}
        <div ref={photoOverlayRef} className="photo-overlay" aria-hidden="true">
          <PhotoStrip stripRef={photoStripRef} />
        </div>

        {/* DEBUG_GALLERY 開發預覽：畫面中央顯示未裁切的完整 Photo Strip。
            與 foreignObject 內共用 <PhotoStrip /> → 尺寸 / 順序 / 間距完全一致；
            旗標改回 false 後此層整個消失，圓形窗口原樣恢復。 */}
        {DEBUG_GALLERY && (
          <div className="debug-gallery" aria-hidden="true">
            <PhotoStrip />
          </div>
        )}

        {/* THE GROUND · 開篇文案 + 巨型疊影詞：與鋼筆同一 pinned 舞台，
            圓孔收黑後立刻自底端上滑，之後繼續上滑離場 */}
        <div className="mgt__essay-layer">
          <div ref={essayRef} className="mgt__essay-block">
            <div className="mgt__essay">
              {GROUND_ESSAY.map((text, i) => (
                <p key={i}>{text}</p>
              ))}
            </div>

            {/* 三個詞共用同一視覺區域，隨滾動輪流高亮（其餘為殘影） */}
            <div className="mgt__words" aria-hidden="true">
              {WORDS.map((word, i) => (
                <span
                  key={word}
                  ref={(el) => {
                    wordRefs.current[i] = el
                  }}
                  className={`mgt__word mgt__word--${i + 1}`}
                >
                  {word}
                </span>
              ))}
            </div>
          </div>
        </div>

        {/* THE GROUND · 校門照：文案滑出頂端後，自底端升起鋪滿整個畫面 */}
        <div ref={gradLayerRef} className="mgt__image-layer" aria-hidden="true">
          <img
            ref={gradRef}
            className="mgt__image"
            src="/graduate%20school.jpg"
            alt=""
          />
        </div>
      </div>
    </section>
  )
}

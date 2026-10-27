import { useEffect, useRef } from 'react'
import gsap from 'gsap'
import { ScrollTrigger } from 'gsap/ScrollTrigger'

import MindPage1 from './MindPage1'
import MindPage2 from './MindPage2'
import MindPage3 from './MindPage3'
import '../styles/mind-pages.css'

gsap.registerPlugin(ScrollTrigger)

// ============================================================
// THE MIND · 三頁連讀（Page 1–3）
// 桌面：三頁疊放在同一個 pinned 舞台。滾動時舊頁文字與虛線時間軸向上滑出、
// 新頁文字與時間軸自底部升起；新文字進場後，舊頁底圖漸隱成灰色，
// 舊圖退盡後新頁底圖再漸顯。米灰遮罩保持不動。
// 窄屏：三頁回歸普通文件流（各自保留原背景），不做切換動畫。
// ============================================================

// 三頁底圖（順序對應 Page 1 → 3）；opacity 為各自「顯現完成」時的濃度，
// 與 mind-page1.css 中 --mp-photo-opacity / mono 規則一致
const BACKGROUNDS = [
  { src: '/garden.jpg', opacity: 0.6, mono: false },
  { src: '/hubu.jpg', opacity: 0.68, mono: true },
  { src: '/hubu2.JPG', opacity: 0.68, mono: true },
]

const ENTER = 1 // 首頁進場：文字自底部上滑、時間軸漸顯、底圖隨後漸顯
const HOLD = 1 // 每頁完整呈現後的停留
const SLIDE = 1 // 文字上滑全程（舊頁離場與新頁進場同步）
const BG_OUT = 0.5 // 舊底圖漸隱成灰色
const BG_IN = 0.5 // 新底圖漸顯
const BG_OUT_AT = SLIDE * 0.4 // 新文字進場之後，舊底圖才開始漸隱
const TRANS = BG_OUT_AT + BG_OUT + BG_IN // 一次完整切換的長度
const PAGES = 3
// 末頁離場：文字上滑出 + 底圖漸隱成淺灰，交由下一章節接手
const EXIT_AT = ENTER + HOLD * PAGES + TRANS * (PAGES - 1)
const EXIT_LEN = Math.max(SLIDE, BG_OUT_AT + BG_OUT)

// timeline 總長 = 1（進場）+ 1×3（停留）+ 1.4×2（切換）+ 1（離場）= 7.8 單位
const TOTAL = EXIT_AT + EXIT_LEN

// 導覽「The Mind」跳轉目標：Page 1 完整進場（多留 0.05 單位餘量）時，
// 已滾過的行程佔整段 .mind-stack 高度的比例（容器高 = TOTAL+1 個單位，見 CSS）。
// 直接滾到容器頂端會落在 t=0 —— 文字與時間軸仍停在畫面下方，看起來像空白灰頁
export const MIND_PAGE1_SCROLL_RATIO = (ENTER + 0.05) / (TOTAL + 1)

// 供 Page 3 疊圖（MindDeck）使用：容器總高（單位）與 Page 3 可互動的 t 區間
// （第三頁進場開始 → 離場結束）；僅在此窗口內滾輪才輪換疊圖
export const MIND_STACK_UNITS = TOTAL + 1
export const MIND_PAGE3_WINDOW_T = [ENTER + HOLD + 2 * TRANS, TOTAL]

export default function MindPages() {
  const rootRef = useRef(null)
  const stageRef = useRef(null)
  const veilRef = useRef(null)
  const pageRefs = useRef([])

  useEffect(() => {
    // 窄屏：普通文件流，三頁各自顯示原背景，不做切換動畫
    if (window.matchMedia('(max-width: 768px)').matches) return undefined

    const ctx = gsap.context(() => {
      const bgs = gsap.utils.toArray('.mind-stack__bg', stageRef.current)
      const pages = pageRefs.current.filter(Boolean)
      // 每頁參與上滑的元素：文字區塊 + 該頁自己的虛線時間軸（含小火箭節點），
      // 時間軸與文字同步上下滑動，切換時舊軸隨舊頁滑出、新軸隨新頁升起
      const textOf = (page) => [
        ...page.querySelectorAll(
          '.mind-page__year, .mind-page__intro, .mind-page__quote, .mind-page__rail',
        ),
      ]

      // 初始：底圖全隱、三頁文字與時間軸都停在下方一屏之外。
      // 舞台自下方滑入時只會是一整片淺灰，不會看到「滑動的下一頁」或分界線；
      // 所有內容都在 pin 之後原地進場。
      bgs.forEach((bg) => gsap.set(bg, { opacity: 0 }))
      pages.forEach((page) =>
        gsap.set(textOf(page), { y: () => window.innerHeight }),
      )

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

      // 首頁進場：文字與時間軸先上滑，底圖隨後在淺灰上原地漸顯
      tl.fromTo(
        textOf(pages[0]),
        { y: () => window.innerHeight },
        { y: 0, duration: SLIDE },
        0,
      )
      tl.to(
        bgs[0],
        { opacity: BACKGROUNDS[0].opacity, duration: ENTER * 0.85 },
        ENTER * 0.15,
      )
      tl.to({}, { duration: HOLD }, ENTER) // 首頁停留

      for (let i = 0; i < pages.length - 1; i++) {
        const t = ENTER + HOLD + i * (TRANS + HOLD)

        // 文字：舊頁向上滑出、新頁自底部升起，兩者同步隨滾動上滑
        tl.to(textOf(pages[i]), { y: () => -window.innerHeight, duration: SLIDE }, t)
        tl.fromTo(
          textOf(pages[i + 1]),
          { y: () => window.innerHeight },
          { y: 0, duration: SLIDE },
          t,
        )

        // 底圖：新文字進場後，舊圖先漸隱成灰；舊圖退盡後新圖才漸顯
        tl.to(bgs[i], { opacity: 0, duration: BG_OUT }, t + BG_OUT_AT)
        tl.to(
          bgs[i + 1],
          { opacity: BACKGROUNDS[i + 1].opacity, duration: BG_IN },
          t + BG_OUT_AT + BG_OUT,
        )

        tl.to({}, { duration: HOLD }, t + TRANS) // 新頁停留
      }

      // 末頁離場：文字與時間軸上滑出頁面，底圖漸隱成淺灰 → 交由下一章節自同一淺灰接手
      const last = pages.length - 1
      tl.to(textOf(pages[last]), { y: () => -window.innerHeight, duration: SLIDE }, EXIT_AT)
      tl.to(bgs[last], { opacity: 0, duration: BG_OUT }, EXIT_AT + BG_OUT_AT)
      // 米灰遮罩同時退去：末頁離場後舞台回到純 #dedddb（= 下一節鋼筆舞台底色），
      // 兩節交界因此沒有任何色差或分界線
      tl.to(veilRef.current, { opacity: 0, duration: BG_OUT }, EXIT_AT + BG_OUT_AT)
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
    <div
      ref={rootRef}
      className="mind-stack"
      style={{ '--stack-units': TOTAL }}
      aria-label="THE MIND — chapters 1 to 3"
    >
      <div ref={stageRef} className="mind-stack__stage">
        {/* 三張底圖疊放，透明度由滾動控制；上面蓋一層共用的米灰遮罩 */}
        {BACKGROUNDS.map((bg) => (
          <div
            key={bg.src}
            className={'mind-stack__bg' + (bg.mono ? ' mind-stack__bg--mono' : '')}
            style={{ backgroundImage: `url('${bg.src}')` }}
            aria-hidden="true"
          />
        ))}
        <div ref={veilRef} className="mind-stack__veil" aria-hidden="true" />

        {/* 三頁內容疊放；非首頁的文字初始停在畫面下方（CSS 兜底，JS 進一步接管） */}
        {[MindPage1, MindPage2, MindPage3].map((Page, i) => (
          <div
            key={i}
            ref={(el) => {
              pageRefs.current[i] = el
            }}
            className={'mind-stack__page' + (i > 0 ? ' mind-stack__page--rest' : '')}
          >
            <Page />
          </div>
        ))}
      </div>
    </div>
  )
}

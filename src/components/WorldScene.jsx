import { useEffect, useMemo, useRef, useState } from 'react'
import gsap from 'gsap'

import '../styles/world-scene.css'
import { TREE_VIEW, GROW_PATHS, LEAF_SPOTS, LEAF_FADE_DUR, DURATION_SCALE } from './worldGrowth'
import { LEAF_COMPANIES } from './worldLeaves'

// ============================================================
// THE WORLD · tree.jpg 生長動畫（Botanical Growth Time-lapse）
//
// 素材：public/tree.jpg（1672×941，唯一樹枝視覺，保持原始構圖）
// 方案：SVG Mask + GSAP Timeline
// - <image> 靜止不動，可見性完全由遮罩控制
// - 遮罩座標系與圖片像素 1:1（同一 viewBox），縮放不錯位
// - 每條遮罩路徑 pathLength=1，stroke-dashoffset 1→0 沿真實枝幹
//   方向逐漸顯現；主幹多段遞減寬度疊加出由粗到細
// - 側枝在生長前緣經過分叉點後啟動；葉片在枝梢完成後淡入+微縮放
// - 首次進入視口自動播放一次（約 4s），結束後移除遮罩，
//   最終畫面與原圖完全一致；prefers-reduced-motion 直接顯示完整圖
// 路徑/時序/葉片座標全部在同目錄 worldGrowth.js 中調整。
//
// 葉片註釋（本輪新增）：
// - 圖片不動，另建一層透明 HTML 覆蓋層，精確覆蓋圖片實際顯示區域
//   （stage 內以 contain 置中，透過 ResizeObserver 量測 letterbox 留白）
// - 六個熱區以原圖像素座標換算百分比定位，縮放/捲動皆同步
// - 註釋文字為獨立 HTML，不與 SVG 遮罩同層，因此不會被裁切
// - 熱區只在整段生長動畫完成後（grown）才掛載，葉片未顯現時不可觸發
// 註釋內容與位置在同目錄 worldLeaves.js 中調整。
// ============================================================

const { w: VW, h: VH } = TREE_VIEW

export default function WorldScene() {
  const sectionRef = useRef(null)
  const stageRef = useRef(null)
  const svgRef = useRef(null)
  const titleRef = useRef(null)
  // grown=true 時不使用遮罩，直接顯示完整原圖
  const [grown, setGrown] = useState(false)
  // 圖片實際顯示區域（相對 stage 的 px），供註釋層與熱區使用
  const [box, setBox] = useState(null)
  // 當前展開的葉片註釋（同一時刻只允許一個）
  const [active, setActive] = useState(null)

  const spots = useMemo(() => {
    const map = {}
    LEAF_SPOTS.forEach((l) => {
      map[l.id] = l
    })
    return map
  }, [])

  // 進入本章節時點亮左側導覽；向上捲回前一章時交還 The Leap
  useEffect(() => {
    const el = sectionRef.current
    if (!el) return undefined
    let entered = false
    const observer = new IntersectionObserver(
      ([entry]) => {
        if (entry.isIntersecting) {
          entered = true
          window.dispatchEvent(
            new CustomEvent('prologue:chapter', { detail: 'The Practice' }),
          )
        } else if (entered) {
          // 只在「向上滾回上一章」時交還 The Leap；
          // 向下進入 Contact 頁時章節從頂部離開，導覽保持 The World
          if (entry.boundingClientRect.top > 0) {
            window.dispatchEvent(
              new CustomEvent('prologue:chapter', { detail: 'The Leap' }),
            )
          }
        }
      },
      { rootMargin: '-30% 0px -45% 0px', threshold: 0 },
    )
    observer.observe(el)
    return () => observer.disconnect()
  }, [])

  // 生長動畫：每次本章進入視口都從淡稿重新播放一次
  useEffect(() => {
    const svg = svgRef.current
    const section = sectionRef.current
    if (!svg || !section) return undefined

    // 尊重 prefers-reduced-motion：直接展示完整圖片
    if (window.matchMedia('(prefers-reduced-motion: reduce)').matches) {
      setGrown(true)
      return undefined
    }

    const paths = GROW_PATHS.map((p) => svg.querySelector(`[data-grow="${p.id}"]`))
    const leaves = LEAF_SPOTS.map((l) => svg.querySelector(`[data-leaf="${l.id}"]`))

    const tl = gsap.timeline({
      paused: true,
      onComplete: () => setGrown(true),
    })
    // 每段至少 0.25s 漸顯：微段若只有幾幀會「蹦出」造成頓挫感，
    // 拉長後相鄰段互相重疊，生長波前連續絲滑
    const MIN_DUR = 0.25
    GROW_PATHS.forEach((p, i) => {
      tl.to(
        paths[i],
        { strokeDashoffset: 0, duration: Math.max(p.dur, MIN_DUR) * DURATION_SCALE, ease: 'none' },
        p.t0 * DURATION_SCALE,
      )
    })
    LEAF_SPOTS.forEach((l, i) => {
      tl.fromTo(
        leaves[i],
        { opacity: 0, scale: 0.5, svgOrigin: `${l.cx} ${l.cy}` },
        { opacity: 1, scale: 1, duration: LEAF_FADE_DUR * DURATION_SCALE, ease: 'power1.out' },
        l.t0 * DURATION_SCALE,
      )
    })

    // 頁面左上角標題：與第一片葉片同步淡入
    if (titleRef.current) {
      tl.fromTo(
        titleRef.current,
        { opacity: 0, y: 12 },
        { opacity: 1, y: 0, duration: 0.8 * DURATION_SCALE, ease: 'power1.out' },
        LEAF_SPOTS[0].t0 * DURATION_SCALE,
      )
    }

    // 復位：時間軸退回 0（樹枝回到左端未生長），遮罩重新生效
    let pendingReplay = true
    const resetToIdle = () => {
      pendingReplay = true
      tl.pause(0)
      setActive(null)
      setGrown(false)
    }

    // 進入章節：從頭生長（含從上一頁滑入、以及再次回到本章）。
    // 只有「真正離開過本章」或首次進入才重播，避免停在交界處來回滾動時誤觸發
    const playFromStart = () => {
      if (!pendingReplay) return
      pendingReplay = false
      setGrown(false)
      tl.restart()
    }

    // 觸發時機：章節頂部剛從視口底部露頭（越過 90% 線）就開始生長，
    // 與「從上一頁滑動到下一頁」的過渡同步
    const enterIO = new IntersectionObserver(
      ([entry]) => {
        if (entry.isIntersecting) playFromStart()
      },
      { rootMargin: '0px 0px -10% 0px', threshold: 0 },
    )
    // 完全離開視口後才復位，因此站在本章時不會被重置，
    // 下次從上一頁滑回來時會重新播放生長動畫
    const leaveIO = new IntersectionObserver(
      ([entry]) => {
        if (!entry.isIntersecting) resetToIdle()
      },
      { threshold: 0 },
    )
    enterIO.observe(section)
    leaveIO.observe(section)

    return () => {
      enterIO.disconnect()
      leaveIO.disconnect()
      tl.kill()
    }
  }, [])

  // 量測圖片實際顯示區域（SVG preserveAspectRatio=meet 會產生 letterbox 留白）
  useEffect(() => {
    const stage = stageRef.current
    const svg = svgRef.current
    if (!stage || !svg) return undefined
    let frame = 0
    const measure = () => {
      frame = 0
      const sr = stage.getBoundingClientRect()
      const vr = svg.getBoundingClientRect()
      if (!vr.width || !vr.height) return
      const scale = Math.min(vr.width / VW, vr.height / VH)
      const next = {
        left: vr.left - sr.left + (vr.width - VW * scale) / 2,
        top: vr.top - sr.top + (vr.height - VH * scale) / 2,
        width: VW * scale,
        height: VH * scale,
      }
      setBox((prev) => {
        if (
          prev
          && Math.abs(prev.left - next.left) < 0.5
          && Math.abs(prev.top - next.top) < 0.5
          && Math.abs(prev.width - next.width) < 0.5
          && Math.abs(prev.height - next.height) < 0.5
        ) {
          return prev
        }
        return next
      })
    }
    const schedule = () => {
      if (!frame) frame = requestAnimationFrame(measure)
    }
    measure()
    const ro = new ResizeObserver(schedule)
    ro.observe(stage)
    ro.observe(svg)
    return () => {
      ro.disconnect()
      if (frame) cancelAnimationFrame(frame)
    }
  }, [])

  // Escape 關閉註釋並交還焦點
  useEffect(() => {
    if (!active) return undefined
    const onKey = (e) => {
      if (e.key !== 'Escape') return
      setActive(null)
      if (document.activeElement instanceof HTMLElement) document.activeElement.blur()
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [active])

  // 點擊空白處關閉（觸屏）
  const handleStagePointerDown = (e) => {
    if (!e.target.closest('.leaf-spot')) setActive(null)
  }

  const closeIf = (id) => setActive((cur) => (cur === id ? null : cur))

  return (
    <section
      ref={sectionRef}
      className="world-scene"
      aria-label="THE WORLD — growing branch"
    >
      <div
        ref={stageRef}
        className="world-scene__stage"
        onPointerDown={handleStagePointerDown}
      >
        {/* 頁面左上角標題：與第一片葉片同步淡入 */}
        <div
          ref={titleRef}
          className="world-title"
          aria-hidden="true"
        >
          <span className="world-title__line">Branches</span>
          <span className="world-title__line world-title__line--of">of</span>
          <span className="world-title__line">Experience</span>
          <span className="world-title__hint">Hover over a leaf to discover more</span>
        </div>
        <svg
          ref={svgRef}
          className="world-branch__svg"
          viewBox={`0 0 ${VW} ${VH}`}
          xmlns="http://www.w3.org/2000/svg"
          preserveAspectRatio="xMidYMid meet"
          role="img"
          aria-label="a tree branch formed by English text, growing from left to right"
        >
          {/* 遮罩定義常駐 DOM：樹枝每次重新生長都復用同一批路徑，
              只是 grown=true 時 image 不再引用 mask */}
          <defs>
            {/* 遮罩邊緣輕微羽化：生長前緣由硬邊跳動變為柔和漸顯 */}
            <filter id="growSoften" x="-4%" y="-6%" width="108%" height="112%">
              <feGaussianBlur stdDeviation="2" />
            </filter>
            <mask
              id="treeGrowthMask"
              maskUnits="userSpaceOnUse"
              x="0"
              y="0"
              width={VW}
              height={VH}
            >
              <rect width={VW} height={VH} fill="#000" />
              <g filter="url(#growSoften)">
                {GROW_PATHS.map((p) => (
                  <path
                    key={p.id}
                    data-grow={p.id}
                    d={p.d}
                    fill="none"
                    stroke="#fff"
                    strokeWidth={p.w}
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    pathLength="1"
                    strokeDasharray="1"
                    strokeDashoffset="1"
                  />
                ))}
                {LEAF_SPOTS.map((l) => (
                  <circle
                    key={l.id}
                    data-leaf={l.id}
                    cx={l.cx}
                    cy={l.cy}
                    r={l.r}
                    fill="#fff"
                    opacity="0"
                  />
                ))}
              </g>
            </mask>
          </defs>
          <image
            href="/tree.jpg"
            x="0"
            y="0"
            width={VW}
            height={VH}
            mask={grown ? undefined : 'url(#treeGrowthMask)'}
          />
        </svg>

        {/* 註釋層：與圖片實際顯示區域完全重合，座標全部以原圖像素換算 */}
        {box && grown && (
          <div
            className="world-annotations"
            style={{
              left: `${box.left}px`,
              top: `${box.top}px`,
              width: `${box.width}px`,
              height: `${box.height}px`,
            }}
          >
            <svg
              className="annotation-guides"
              viewBox={`0 0 ${VW} ${VH}`}
              preserveAspectRatio="none"
              aria-hidden="true"
            >
              {LEAF_COMPANIES.filter((c) => c.guide).map((c) => (
                <line
                  key={c.id}
                  x1={c.guide.x}
                  y1={c.guide.y1}
                  x2={c.guide.x}
                  y2={c.guide.y2}
                  className={`annotation-guides__line${active === c.id ? ' is-on' : ''}`}
                />
              ))}
            </svg>

            {LEAF_COMPANIES.map((c, i) => {
              const spot = spots[c.id]
              if (!spot) return null
              const hitR = spot.r * 1.45
              const isActive = active === c.id
              return (
                <button
                  key={c.id}
                  type="button"
                  className={`leaf-spot${isActive ? ' is-active' : ''}`}
                  style={{
                    left: `${((spot.cx - hitR) / VW) * 100}%`,
                    top: `${((spot.cy - hitR) / VH) * 100}%`,
                    width: `${((hitR * 2) / VW) * 100}%`,
                    height: `${((hitR * 2) / VH) * 100}%`,
                  }}
                  aria-label={
                    c.future
                      ? 'Future — to be continued'
                      : `${c.name} — ${c.role}`
                  }
                  aria-expanded={isActive}
                  onPointerEnter={() => setActive(c.id)}
                  onPointerLeave={() => closeIf(c.id)}
                  onFocus={() => setActive(c.id)}
                  onBlur={() => closeIf(c.id)}
                  onClick={() => setActive(c.id)}
                >
                  {/* 葉片提亮層：直接使用原圖裁出的葉片像素（透明背景），
                      因此只提亮葉片本身，不會帶出紙面色塊或光暈 */}
                  {c.leafArt && (
                    <span
                      className="leaf-spot__paint"
                      aria-hidden="true"
                      style={{
                        left: `${((c.leafArt.x - (spot.cx - hitR)) / (hitR * 2)) * 100}%`,
                        top: `${((c.leafArt.y - (spot.cy - hitR)) / (hitR * 2)) * 100}%`,
                        width: `${(c.leafArt.w / (hitR * 2)) * 100}%`,
                        height: `${(c.leafArt.h / (hitR * 2)) * 100}%`,
                        backgroundImage: `url(${c.leafArt.src})`,
                        // 六片葉子錯開擺動節奏，避免整片樹同時閃動
                        animationDelay: `${i * 0.9}s`,
                      }}
                    />
                  )}
                </button>
              )
            })}

            {LEAF_COMPANIES.map((c) => {
              const a = c.anchor
              const isActive = active === c.id
              const isRight = a.side === 'right'
              const style = {
                ...(isRight
                  ? { right: `${((VW - a.x) / VW) * 100}%` }
                  : { left: `${(a.x / VW) * 100}%` }),
                ...(a.vertical === 'top'
                  ? { top: `${(a.y / VH) * 100}%` }
                  : { bottom: `${((VH - a.y) / VH) * 100}%` }),
                textAlign: isRight ? 'right' : 'left',
              }
              return (
                <div
                  key={c.id}
                  className={[
                    'annotation',
                    c.future ? 'annotation--future' : '',
                    isRight ? 'is-right' : '',
                    isActive ? 'is-open' : '',
                  ].filter(Boolean).join(' ')}
                  style={style}
                  aria-hidden={!isActive}
                >
                  {c.future ? (
                    <p className="annotation__future">To be continued</p>
                  ) : (
                    <>
                      <h3 className="annotation__name">
                        {c.logo && (
                          <img
                            className="annotation__logo"
                            src={c.logo}
                            alt=""
                            aria-hidden="true"
                          />
                        )}
                        <span>{c.name}</span>
                      </h3>
                      <p className="annotation__role">{c.role}</p>
                      <p className="annotation__desc">{c.desc}</p>
                    </>
                  )}
                </div>
              )
            })}
          </div>
        )}
      </div>
    </section>
  )
}

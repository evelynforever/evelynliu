import { useEffect, useRef } from 'react'
import gsap from 'gsap'
import { ScrollTrigger } from 'gsap/ScrollTrigger'

import SideNav from './SideNav'
import { PROLOGUE_LINES } from '../content/prologue'
import '../styles/prologue.css'

gsap.registerPlugin(ScrollTrigger)

/* ============================================================
   PAINT BUILD-UP — GLAZE SWEEPS（寬幅罩染掃掠）
   三層同一張原圖完全重合：
     LAYER 1  PALE BASE   淡稿鋪底（常駐）
     LAYER 2  PIGMENT MID 第二遍 pigment，由一道極寬的罩染從左上往右下掃過
     LAYER 3  FINAL       原始插畫，由另一道反方向罩染掃過
   過渡帶佔畫面 85% → 任何時刻都是連續漸變，絕無洞 / 硬邊 / spotlight
   禁止 canvas mask / stamps / 局部色塊
   ============================================================ */

const DEBUG = true

/* 每句文案佔用的 timeline 長度 */
const STEP = 1.2
const travelDistance = () => window.innerHeight * 0.62

const SRC = '/evelyn-cover.png'

/* 人物必須在此 timeline 時間點 100% 完成。
   最後一句 fully visible ≈ t 3.60（master 0.75），此值提前約 0.15s */
const PORTRAIT_COMPLETE_TIME = 3.45

/* 兩道罩染掃掠：角度、起止 progress（MID 先掃完，FINAL 接力） */
const SWEEP_MID = { angle: 115, start: 0.02, end: 0.72 }
const SWEEP_FINAL = { angle: 65, start: 0.3, end: 1.0 }
/* 淡稿初始模糊半徑（px）— 五官糊成體塊，只剩輪廓，像未對焦的草稿 */
const BLUR_MAX = 12
/* 對焦完成進度：此之前淡稿逐漸清晰 */
const FOCUS_AT = 0.65
/* 過渡帶寬度（佔 gradient line 百分比）— 極寬 → 罩染感而非開洞 */
const FEATHER = 85

/* 章節交棒：最後一句淡出時，整頁漸隱為淺灰（timeline 單位） */
const GRAY_FADE = 1

function clamp01(v) {
  return v < 0 ? 0 : v > 1 ? 1 : v
}

function smooth(t) {
  return t * t * (3 - 2 * t)
}

/* progress → mask-image：一道寬幅罩染沿 angle 方向掃過整張圖 */
function sweepMask(p, { angle, start, end }) {
  const eased = smooth(clamp01((p - start) / (end - start)))
  const front = -FEATHER + eased * (100 + 2 * FEATHER)
  const blackStop = Math.max(0, front - FEATHER)
  const clearStop = Math.min(100, front)
  return `linear-gradient(${angle}deg, #000 ${blackStop}%, transparent ${clearStop}%)`
}

export default function Prologue() {
  const rootRef = useRef(null)
  const stageRef = useRef(null)
  const hintRef = useRef(null)
  const lineRefs = useRef([])
  const paleRef = useRef(null)
  const midRef = useRef(null)
  const finalRef = useRef(null)
  const grayRef = useRef(null)
  const debugRef = useRef(null)

  useEffect(() => {
    const reducedMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches
    const COMPLETE_TIME = PORTRAIT_COMPLETE_TIME

    let masterProgress = 0
    let portraitProgress = 0

    function setMask(el, image) {
      if (!el) return
      el.style.opacity = '1'
      el.style.webkitMaskImage = image
      el.style.maskImage = image
    }

    function updateDebug(blur, midT, finT) {
      if (!debugRef.current) return
      const n = PROLOGUE_LINES.length
      const sentence = Math.min(
        n,
        Math.max(1, Math.round((portraitProgress * COMPLETE_TIME) / STEP) + 1)
      )
      debugRef.current.textContent =
        `MASTER: ${masterProgress.toFixed(2)}  SENTENCE: ${sentence}  ` +
        `PORTRAIT: ${portraitProgress.toFixed(2)}\n` +
        `BLUR: ${blur.toFixed(1)}px  MID: ${(midT * 100).toFixed(0)}%  FINAL: ${(finT * 100).toFixed(0)}%`
    }

    function apply(p) {
      const pp = reducedMotion ? 1 : clamp01(p)
      portraitProgress = pp
      /* 淡稿對焦：模糊草稿 → 清晰底稿（FOCUS_AT 前完成） */
      const blur = (1 - smooth(clamp01(pp / FOCUS_AT))) * BLUR_MAX
      if (paleRef.current) {
        paleRef.current.style.filter = `blur(${blur.toFixed(2)}px) saturate(0.22) contrast(0.92) brightness(1.08)`
      }
      const midT = clamp01((pp - SWEEP_MID.start) / (SWEEP_MID.end - SWEEP_MID.start))
      const finT = clamp01((pp - SWEEP_FINAL.start) / (SWEEP_FINAL.end - SWEEP_FINAL.start))
      setMask(midRef.current, sweepMask(pp, SWEEP_MID))
      setMask(finalRef.current, sweepMask(pp, SWEEP_FINAL))
      updateDebug(blur, midT, finT)
    }

    window.__setPortraitProgress = (v) => {
      apply(clamp01(v))
    }

    apply(reducedMotion ? 1 : 0)

    /* ---- 文案滾動動畫（原邏輯不變）+ 人物進度掛在同一個 trigger ---- */
    const ctx2 = gsap.context(() => {
      const lines = lineRefs.current.filter(Boolean)
      const texts = lines.map((line) => line.querySelector('.line__text'))

      texts.forEach((text, i) => {
        gsap.set(text, {
          xPercent: -50,
          yPercent: -50,
          y: i === 0 ? 0 : travelDistance(),
          opacity: i === 0 ? 1 : 0,
        })
      })

      const tl = gsap.timeline({
        defaults: { ease: 'none' },
        scrollTrigger: {
          trigger: rootRef.current,
          start: 'top top',
          end: 'bottom bottom',
          scrub: 0.8,
          pin: stageRef.current,
          anticipatePin: 1,
          invalidateOnRefresh: true,
          /* 人物進度依 timeline 當前時間，而非整個 wrapper 的 raw scroll */
          onUpdate: () => {
            masterProgress = tl.scrollTrigger.progress
            apply(tl.time() / COMPLETE_TIME)
          },
        },
      })

      lines.forEach((_, i) => {
        const centerTime = i * STEP
        if (i === 0) {
          tl.fromTo(texts[0], { y: 0 }, { y: () => -travelDistance(), duration: STEP }, 0)
          tl.to(texts[0], { opacity: 0, duration: 0.35 }, 0.55)
        } else {
          tl.fromTo(texts[i], { y: () => travelDistance() }, { y: 0, duration: STEP }, centerTime - STEP)
          tl.to(texts[i], { opacity: 1, duration: 0.3 }, centerTime - 0.35)
          tl.fromTo(texts[i], { y: 0 }, { y: () => -travelDistance(), duration: STEP, immediateRender: false }, centerTime)
          tl.to(texts[i], { opacity: 0, duration: 0.35 }, centerTime + 0.55)
        }
      })

      if (hintRef.current) {
        tl.to(hintRef.current, { opacity: 0, duration: 0.18 }, 0)
      }

      /* 章節交棒：最後一句開始淡出時，人像整頁漸隱成淺灰，
         之後由 THE MIND 首頁（同一淺灰底）漸顯接手 */
      if (grayRef.current) {
        const lastSentenceFade = (lines.length - 1) * STEP + 0.55
        tl.to(
          grayRef.current,
          { opacity: 1, duration: GRAY_FADE, ease: 'none' },
          lastSentenceFade,
        )
      }

      /* 句子 label + 人物完成 label */
      lines.forEach((_, i) => tl.addLabel(`sentence${i + 1}Hold`, i * STEP))
      tl.addLabel('portraitComplete', COMPLETE_TIME)
    }, rootRef)

    return () => {
      delete window.__setPortraitProgress
      ctx2.revert()
    }
  }, [])

  return (
    <>
      <SideNav />

      <main>
        <section ref={rootRef} className="prologue">
          <div ref={stageRef} className="prologue__stage">
            <p className="prologue__eyebrow">PROLOGUE</p>

            {/* 背景延展層 */}
            <div className="portrait__bg-extension" aria-hidden="true" />

            {/* 人物：三層同圖完全重合，兩道寬幅罩染先後掃過 → 被畫出來 */}
            <div className="portrait" aria-hidden="true">
              {/* LAYER 1 — PALE BASE：低飽和模糊草稿，鋪底常駐，隨滾動對焦 */}
              <img ref={paleRef} className="portrait__pale" src={SRC} alt="" />
              {/* LAYER 2 — PIGMENT MID：第二遍 pigment，第一道罩染 */}
              <img ref={midRef} className="portrait__mid" src={SRC} alt="" />
              {/* LAYER 3 — FINAL PAINTING：原始插畫，第二道罩染 */}
              <img ref={finalRef} className="portrait__final" src={SRC} alt="" />
            </div>

            <div className="lines-stage">
              {PROLOGUE_LINES.map((line, i) => (
                <p
                  className="line"
                  key={line}
                  ref={(el) => {
                    lineRefs.current[i] = el
                  }}
                >
                  <span className="line__text">{line}</span>
                </p>
              ))}
            </div>

            <div ref={hintRef} className="scroll-hint" aria-hidden="true">
              <span className="scroll-hint__label">SCROLL</span>
              <span className="scroll-hint__rule" />
            </div>

            {/* 章節交棒遮罩：滾動至結尾時整頁漸隱為淺灰（與 THE MIND 首頁同色） */}
            <div ref={grayRef} className="prologue__gray-flush" aria-hidden="true" />

            {DEBUG && (
              <div
                ref={debugRef}
                style={{
                  position: 'fixed',
                  right: 12,
                  bottom: 12,
                  zIndex: 200,
                  font: '10px/1.4 ui-monospace, monospace',
                  color: '#161412',
                  background: 'rgba(242,240,235,0.7)',
                  padding: '2px 6px',
                  borderRadius: 3,
                  pointerEvents: 'none',
                  whiteSpace: 'pre',
                }}
              >
                MASTER: 0.00  SENTENCE: 1  PORTRAIT: 0.00
              </div>
            )}
          </div>
        </section>
      </main>

      <div className="grain" aria-hidden="true" />
    </>
  )
}

import { useEffect, useRef } from 'react'
import gsap from 'gsap'
import { ScrollTrigger } from 'gsap/ScrollTrigger'

import Prologue from './components/Prologue'
import MindPages from './components/MindPages'
import MindToGroundTransition from './components/MindToGroundTransition'
import GroundOpening from './components/GroundOpening'
import LeapGallery from './components/LeapGallery'
import WorldScene from './components/WorldScene'
import ContactScene from './components/ContactScene'

gsap.registerPlugin(ScrollTrigger)

export default function App() {
  // THE WORLD → CONTACT：sticky 舞台 + 交叉淡入淡出
  const wcRef = useRef(null)

  useEffect(() => {
    const wrap = wcRef.current
    if (!wrap) return undefined
    const world = wrap.querySelector('.world-scene')
    const contact = wrap.querySelector('.contact-scene')
    if (!world || !contact) return undefined

    const tl = gsap.timeline({
      defaults: { ease: 'none' },
      scrollTrigger: {
        trigger: wrap,
        start: 'top top',
        end: 'bottom bottom',
        scrub: true,
      },
    })
    // 節奏：停留看樹（0–0.34）→ 樹頁淡出只剩紙色（0.34–0.60）
    // → 短暫紙面留白（0.60–0.64）→ 聯繫卡如畫出般顯現（0.64–1）
    tl.to(world, { autoAlpha: 0, duration: 0.26 }, 0.34)
      .fromTo(contact, { autoAlpha: 0 }, { autoAlpha: 1, duration: 0.36 }, 0.64)

    return () => {
      tl.scrollTrigger?.kill()
      tl.kill()
    }
  }, [])

  return (
    <>
      <Prologue />
      {/* THE MIND · 三頁連讀：文字隨滾動上滑切換，底圖漸隱成灰後漸顯下一張 */}
      <MindPages />
      {/* 章節過渡：THE MIND → THE GROUND
         （from mind to form 滑出後，鋼筆直接自底部升起，中間無文案頁；
          圓孔放大 → 收黑 → 文案自底端上滑） */}
      <MindToGroundTransition />
      {/* THE GROUND · 開篇：鋼筆收黑後，兩列文案自畫面底端上滑 */}
      <GroundOpening />
      {/* THE LEAP · 影像畫廊：首圖置中，九張照片自其背後射出 */}
      <LeapGallery />
      {/* THE WORLD → CONTACT：滾動先讓樹頁淡成紙色，再讓聯繫卡淡入 */}
      <div ref={wcRef} className="world-contact">
        <div className="world-contact__stage">
          <WorldScene />
          <ContactScene />
        </div>
      </div>
    </>
  )
}

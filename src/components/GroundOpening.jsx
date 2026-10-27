import { GROUND_ESSAY } from '../content/groundEssay'
import '../styles/ground-opening.css'

// ============================================================
// THE GROUND · 開篇（窄屏專用）
// 桌面：文案與校門照都在鋼筆的 pinned 舞台內完成（.mgt__essay / .mgt__image），
//       此節由 CSS 隱藏。
// 窄屏：兩列會過窄、且長文高度超過一屏，改為單列靜態長頁；
//       文案之後接同一張校門照，維持與桌面一致的閱讀順序。
// ============================================================

export default function GroundOpening() {
  return (
    <section className="ground-opening" aria-label="THE GROUND — opening">
      <div className="ground-opening__text">
        {GROUND_ESSAY.map((text, i) => (
          <p key={i}>{text}</p>
        ))}
      </div>
      {/* 巨型疊影詞：窄屏為靜態版（桌面由 GSAP 隨滾動輪替高亮） */}
      <div className="ground-opening__words" aria-hidden="true">
        <span className="ground-opening__word is-on">Responsibility</span>
        <span className="ground-opening__word">Aspiration</span>
        <span className="ground-opening__word">Courage</span>
      </div>
      <div className="ground-opening__photo">
        <img src="/graduate%20school.jpg" alt="" />
      </div>
    </section>
  )
}

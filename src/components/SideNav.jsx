import { useEffect, useState } from 'react'
import { MIND_PAGE1_SCROLL_RATIO } from './MindPages'
import '../styles/sidenav.css'

// 左側固定章節導覽（框限式），每個章節可點擊跳至該板塊的第一頁
const CHAPTERS = ['The Mind', 'The Ground', 'The Leap', 'The Practice']

// 每個板塊的第一頁：The Mind 滾到 Page 1 完整進場的位置
// （容器頂端是進場起點，畫面全空，需再向下滾 MIND_PAGE1_SCROLL_RATIO 段）；
// The Ground / The Leap 都在同一個 pinned 舞台內，交由過渡元件換算實際滾動座標。
const scrollToChapter = (chapter) => {
  if (chapter === 'The Mind') {
    // 窄屏三頁是普通文件流，直接滾到 Page 1 頂端即可
    const narrow = window.matchMedia('(max-width: 768px)').matches
    const el = document.querySelector(narrow ? '.mind-page--1' : '.mind-stack')
    if (el) {
      window.scrollTo({
        top:
          window.scrollY +
          el.getBoundingClientRect().top +
          (narrow ? 0 : el.offsetHeight * MIND_PAGE1_SCROLL_RATIO),
        behavior: 'smooth',
      })
    }
    return
  }
  if (chapter === 'The Practice') {
    const el = document.querySelector('.world-scene')
    if (el) {
      window.scrollTo({
        top: window.scrollY + el.getBoundingClientRect().top,
        behavior: 'smooth',
      })
    }
    return
  }
  window.dispatchEvent(new CustomEvent('prologue:goto', { detail: chapter }))
}

// 作用中章節由滾動進度決定：MindToGroundTransition 會在進入過渡節（The Ground）
// 與校門照進場（The Leap）時派送 prologue:chapter。
export default function SideNav({ activeIndex = 0 }) {
  const [active, setActive] = useState(activeIndex)

  useEffect(() => {
    const onChapter = (e) => {
      const i = CHAPTERS.indexOf(e.detail)
      if (i >= 0) setActive(i)
    }
    window.addEventListener('prologue:chapter', onChapter)
    return () => window.removeEventListener('prologue:chapter', onChapter)
  }, [])

  return (
    <nav className="side-nav" aria-label="Chapters">
      <ol className="side-nav__list">
        {CHAPTERS.map((name, i) => (
          <li className="side-nav__item" key={name}>
            <button
              type="button"
              className={`side-nav__cell${i === active ? ' is-active' : ''}`}
              onClick={() => scrollToChapter(name)}
              aria-current={i === active ? 'page' : undefined}
            >
              <span className="side-nav__label">{name}</span>
            </button>
          </li>
        ))}
      </ol>
    </nav>
  )
}

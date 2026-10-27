import MindStoryPage from './MindStoryPage'

// THE MIND · Page 3 — “From Mind to Form”
// 沿用 Page 1/2 模板；黑白 archive 背景，右側為三張扇形疊圖（滾動輪換、各自外連）。
// 本頁未提供年份，故僅保留 timeline 與當前節點、不顯示大字年份。
// 疊圖順序 = 初始卡位：poem1 在最前，向後依次為 ep1、ep2。
const DECK = [
  {
    src: '/poem1.jpg',
    href: 'https://docs.qq.com/doc/DR3JYYnRnTVpFRVNq',
    alt: 'A poem — sample of written work',
  },
  {
    src: '/ep1.jpg',
    href: 'https://www.tiktok.com/@hirequest2026/video/7670136537492819218',
    alt: 'Video work — episode 1',
  },
  {
    src: '/ep2.jpg',
    href: 'https://www.tiktok.com/@hirequest2026/video/7671264674645658888',
    alt: 'Video work — episode 2',
  },
]

export default function MindPage3() {
  return (
    <MindStoryPage
      mono
      pageClass="mind-page--3"
      title="From Mind to Form"
      description="I learned to channel my raw imagination into tangible creations."
      quoteLines={[
        'Eventually, my imagination demanded expression.',
        'What started as subtle thoughts evolved into',
        'structured essays, evocative poems, wild concepts,',
        'and witty videos. I learned to harness these',
        'internal sparks and channel them into whatever',
        'medium suited them best.',
      ]}
      photoSrc="/hubu2.JPG"
      deck={DECK}
      ariaLabel="THE MIND — Chapter 3, From Mind to Form"
    />
  )
}

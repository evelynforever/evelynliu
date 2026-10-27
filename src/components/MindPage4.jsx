import '../styles/mind-page1.css'
import '../styles/mind-page4.css'

// ============================================================
// THE MIND · Page 4 — 長江背景 × 兩部直式影像作品封面
// 點擊封面外連至小紅書；兩張封面一高一低錯落放置，
// hover 時輕微跳動並顯示箭頭，暗示可點擊。
// ============================================================

// 右上外連箭頭圖示（與全站手繪 inline SVG 風格一致）
function ArrowUpRight() {
  return (
    <svg
      className="work__arrow"
      viewBox="0 0 24 24"
      fill="none"
      xmlns="http://www.w3.org/2000/svg"
      aria-hidden="true"
    >
      <path
        d="M7 17 17 7M9.5 7H17v7.5"
        stroke="currentColor"
        strokeWidth="1.6"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  )
}

// 標題旁的小型膠卷圖示
function FilmIcon() {
  return (
    <svg
      className="mp4-head__icon"
      viewBox="0 0 24 24"
      fill="none"
      xmlns="http://www.w3.org/2000/svg"
      aria-hidden="true"
    >
      <rect
        x="3.5"
        y="5.5"
        width="17"
        height="13"
        rx="1.5"
        stroke="currentColor"
        strokeWidth="1.4"
      />
      <path d="M3.5 9.5h17M3.5 14.5h17M8 5.5v13M16 5.5v13" stroke="currentColor" strokeWidth="1.4" />
    </svg>
  )
}

const WORKS = [
  {
    key: 'a',
    index: '01',
    img: '/ep30804-cover.jpg',
    label: 'EP 30804',
    href: 'https://www.xiaohongshu.com/explore/6a71c828000000003300ebde?xsec_token=AB9J3_VnxzwYh5Xt96sZR759efgaAUNxD06NZBYzYfIxA=&xsec_source=pc_search',
    alt: '影片作品 EP 30804 封面（小紅書）',
  },
  {
    key: 'b',
    index: '02',
    img: '/ep50806-cover.jpg',
    label: 'EP 50806',
    href: 'https://www.xiaohongshu.com/explore/6ad22018000000001303d82d?xsec_token=ABylmD2sy6ENToSGt-HwE2u02zmUOZeEVlw12Re8DsS-o=&xsec_source=pc_user',
    alt: '影片作品 EP 50806 封面（小紅書）',
  },
]

export default function MindPage4() {
  return (
    <section
      className="mind-page mind-page--mono mind-page--4"
      aria-label="THE MIND — Chapter 4, Moving Images"
    >
      {/* 黑白長江背景 + 米灰遮罩（濾鏡 / 濃度沿用 --mono 規則） */}
      <div
        className="mind-page__photo"
        style={{ backgroundImage: "url('/changjiang.jpg')" }}
        aria-hidden="true"
      />
      <div className="mind-page__veil" aria-hidden="true" />

      {/* 垂直 dotted timeline + 火箭節點，維持章節視覺連續性 */}
      <div className="mind-page__rail" aria-hidden="true">
        <span className="mind-page__node">
          <svg viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
            <path
              d="M12 1.8c3.1 2.7 4.3 6.1 4.3 9.4l-1.45 2h-5.7L7.7 11.2C7.7 7.9 8.9 4.5 12 1.8z"
              fill="#1c1b19"
            />
            <circle cx="12" cy="8.9" r="1.55" fill="#d9d9d7" />
            <path d="M7.9 11.6 4.9 14.3l.95 3.4 3.05-1.25-1-4.85z" fill="#1c1b19" />
            <path
              d="M16.1 11.6l3 2.7-.95 3.4-3.05-1.25 1-4.85z"
              fill="#1c1b19"
            />
            <path d="M10.25 14.2h3.5L12 19.4l-1.75-5.2z" fill="#1c1b19" />
          </svg>
        </span>
      </div>

      {/* 右上小標：細線 + 膠卷圖示 + 標題，點綴版面 */}
      <header className="mp4-head">
        <FilmIcon />
        <span className="mp4-head__title">Moving Images</span>
        <span className="mp4-head__rule" aria-hidden="true" />
      </header>

      {/* 兩張作品封面：錯落構成，點擊新標籤頁打開小紅書 */}
      <div className="mind-page__works">
        {WORKS.map((work) => (
          <a
            key={work.key}
            className={`work work--${work.key}`}
            href={work.href}
            target="_blank"
            rel="noopener noreferrer"
          >
            <img className="work__img" src={work.img} alt={work.alt} loading="lazy" />
            <span className="work__meta">
              <span className="work__index" aria-hidden="true">
                {work.index}
              </span>
              <span className="work__rule" aria-hidden="true" />
              <span className="work__label">{work.label}</span>
              <ArrowUpRight />
            </span>
          </a>
        ))}
      </div>
    </section>
  )
}

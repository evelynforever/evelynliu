import MindDeck from './MindDeck'
import { assetUrl } from '../assetUrl'
import '../styles/mind-page1.css'

// ============================================================
// THE MIND 通用內頁模板（editorial 固定編排）
// 左側年份 + 垂直 dotted timeline，左上標題與短描述，右下大段 serif。
// Page 1 / Page 2 共用同一個元件與同一套 CSS，僅透過 props 區分內容；
// mono=true 時背景套用完全黑白的 archive 影像調性（modifier class）。
// ============================================================

export default function MindStoryPage({
  year,
  title,
  description,
  quoteLines,
  photoSrc,
  mono = false,
  pageClass = '',
  ariaLabel,
  asideImage = null,
  asideAlt = '',
  asideHref = null,
  deck = null,
}) {
  return (
    <section
      className={`mind-page${mono ? ' mind-page--mono' : ''}${
        pageClass ? ` ${pageClass}` : ''
      }`}
      aria-label={ariaLabel ?? `THE MIND — ${year}`}
    >
      {/* 鋪滿背景 + 淺灰米灰遮罩（濃淡在 CSS 變數調整） */}
      <div
        className="mind-page__photo"
        style={{ backgroundImage: `url('${assetUrl(photoSrc)}')` }}
        aria-hidden="true"
      />
      <div className="mind-page__veil" aria-hidden="true" />

      {/* 垂直 dotted timeline（小圓點串，非實線）+ 當前節點 marker */}
      <div className="mind-page__rail" aria-hidden="true">
        <span className="mind-page__node">
          <svg viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
            {/* 極簡黑色火箭 marker，與全站手繪 inline SVG 圖示風格一致 */}
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

      {/* 完整數字縱向呈現（writing-mode 旋轉整組數字，非逐字豎排）；
          未提供年份的頁面不渲染，timeline 與節點仍保留 */}
      {year && (
        <span className="mind-page__year" aria-hidden="true">
          {year}
        </span>
      )}

      {/* 左上：標題 + 短描述 */}
      <header className="mind-page__intro">
        <h2 className="mind-page__title">{title}</h2>
        <p className="mind-page__desc">{description}</p>
      </header>

      {/* 右下：第二視覺重點，直接浮在背景上，無框無卡無引號。
          deck 存在時渲染扇形疊圖（滾動輪換 + 各自外連）；
          否則 asideImage 存在時在文字左側放一張原圖（僅控制大小，不做任何影像處理）；
          asideHref 存在時整張圖包成 <a>，新標籤頁打開，hover 輕微上浮 */}
      <blockquote
        className={`mind-page__quote${
          asideImage || deck ? ' mind-page__quote--with-image' : ''
        }`}
      >
        {deck ? (
          <MindDeck items={deck} />
        ) : (
          asideImage &&
          (asideHref ? (
            <a
              className="mind-page__aside-link"
              href={asideHref}
              target="_blank"
              rel="noopener noreferrer"
            >
              <img
                className="mind-page__aside mind-page__aside--linked"
                src={assetUrl(asideImage)}
                alt={asideAlt}
              />
            </a>
          ) : (
            <img
              className="mind-page__aside"
              src={assetUrl(asideImage)}
              alt={asideAlt}
            />
          ))
        )}
        <p>
          {quoteLines.map((line, i) => (
            <span key={i}>
              {i > 0 && <br />}
              {line}
            </span>
          ))}
        </p>
      </blockquote>
    </section>
  )
}

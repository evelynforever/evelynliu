import { useState } from 'react'

/**
 * 人物主視覺。
 * - 正式圖片路徑：/public/evelyn.png → 瀏覽器網址 /evelyn.png
 * - 圖片尚未放入時，自動改用內嵌 SVG 佔位，頁面不會壞、不會報錯
 * - 動畫作用在外層 .figure-motion（由 Prologue 透過 motionRef 控制）
 */
export default function Figure({ motionRef }) {
  const [imgFailed, setImgFailed] = useState(false)

  return (
    <div className="figure-anchor">
      <div className="figure-motion" ref={motionRef}>
        {imgFailed ? (
          <div className="figure-fallback" aria-hidden="true">
            <svg viewBox="0 0 400 600" fill="none" xmlns="http://www.w3.org/2000/svg">
              {/* 細框 */}
              <rect x="1" y="1" width="398" height="598" stroke="currentColor" strokeOpacity="0.25" />
              {/* 人像剪影佔位 */}
              <circle cx="200" cy="215" r="86" stroke="currentColor" strokeOpacity="0.55" strokeWidth="1.4" />
              <path
                d="M76 522 C76 424 132 372 200 372 C268 372 324 424 324 522"
                stroke="currentColor"
                strokeOpacity="0.55"
                strokeWidth="1.4"
                strokeLinecap="round"
              />
              <line x1="140" y1="200" x2="260" y2="200" stroke="currentColor" strokeOpacity="0.12" strokeWidth="1" />
              <line x1="140" y1="230" x2="260" y2="230" stroke="currentColor" strokeOpacity="0.12" strokeWidth="1" />
            </svg>
            <span className="figure-fallback__label">EVELYN</span>
          </div>
        ) : (
          <img
            className="figure-img"
            src="/evelyn.png"
            alt=""
            draggable={false}
            onError={() => setImgFailed(true)}
          />
        )}
      </div>
    </div>
  )
}

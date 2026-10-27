import { useEffect, useRef, useState } from 'react'
import * as THREE from 'three'
import gsap from 'gsap'
import { ScrollTrigger } from 'gsap/ScrollTrigger'
import '../styles/particle-portrait.css'
import { assetUrl } from '../assetUrl'

gsap.registerPlugin(ScrollTrigger)

/* ============================================================
   ParticlePortrait — 靜態粒子肖像（2.5D point cloud）
   ------------------------------------------------------------
   作法：
   1. 載入去背人物照 /evelyn-cutout.png
   2. 隱藏 canvas 讀取像素，只取 alpha 超過門檻的像素
   3. 每個像素 → 一個粒子，顏色直接取原圖 RGB
   4. THREE.Points + 單一 BufferGeometry
   5. 自訂 shader：gl_PointCoord 畫柔邊圓點（非方塊、不發光）
   6. 透視相機 + 2.5D 分層深度：旋轉時近大遠小；手臂（膠囊遮罩）最前、
      臉部橢圓曲面次之、身體為基礎層、頭髮在後；luminance 僅做表面細節，
      另有固定深度散佈與輕微深度明暗避免紙片感。
   7. 粒子持續輕微呼吸漂移；滑鼠在人物區域內做局部柔和排斥。
   旋轉角由頁面滾動進度驅動（ScrollTrigger），不滾動則人物靜止。
   ============================================================ */

const IMAGE_URL = assetUrl('/evelyn-cutout.png')

// -------- 可調整參數（全部集中在這裡） --------
const ALPHA_THRESHOLD = 32 // alpha 高於此值才生成粒子（0–255）
const SAMPLING_STEP = 5
const MAX_PARTICLES = 60000 // 粒子數量上限；超過時自動加大 step
const PARTICLE_SIZE = 1.22 // 基礎尺寸：base tier ≈ 4.5 CSS px
const SIZE_VARIATION = 0.25
const POSITION_JITTER = 0.5
const EDGE_BREAKUP = [0.12, 0.45]
const COLOR_LEVELS = 24
const COLOR_CONTRAST = 1.12
const MAX_DPR = 2

function gradeColor(c, levels = COLOR_LEVELS) {
  let v = (c - 0.5) * COLOR_CONTRAST + 0.5
  v = Math.pow(Math.min(1, Math.max(0, v)), 0.97)
  return Math.round(v * (levels - 1)) / (levels - 1)
}

// ============================================================
// 三層結構：Ghost Portrait + Selective Particles + Floating Dust
// ============================================================

// -------- LAYER 1: Ghost Portrait --------
const GHOST_OPACITY = 0.10 // 灰階底層透明度（0.08–0.12）
const GHOST_BLUR_PX = 0.8 // 輕微模糊
const GHOST_CONTRAST = 0.78 // 低對比

// -------- LAYER 2: Selective Particles --------
// 結構區域（圖片歸一化座標，依 1361×766 標定）
const EYES_REGION = [
  { x: 0.492, y: 0.458, rx: 0.026, ry: 0.016 },
  { x: 0.552, y: 0.458, rx: 0.026, ry: 0.016 },
]
const BROWS_REGION = [
  { x: 0.492, y: 0.436, rx: 0.030, ry: 0.010 },
  { x: 0.552, y: 0.436, rx: 0.030, ry: 0.010 },
]
const LIPS_REGION = { x: 0.524, y: 0.532, rx: 0.036, ry: 0.018 }
const WATCH_REGION = { x: 0.645, y: 0.282, rx: 0.030, ry: 0.026 }
const FINGERS_REGION = { x: 0.725, y: 0.305, rx: 0.060, ry: 0.050 }
const HAIR_CORE_REGION = { x: 0.515, y: 0.33, rx: 0.12, ry: 0.16 }
const HAIRLINE_REGION = { x: 0.515, y: 0.225, rx: 0.14, ry: 0.045 }
const JAWLINE_REGION = { x: 0.522, y: 0.575, rx: 0.10, ry: 0.05 }
const SHOULDER_REGION = { x: 0.37, y: 0.66, rx: 0.12, ry: 0.06 }

// 選擇性密度：特徵區高、皮膚/衣服中等（整體覆蓋率 35–50%）
const DENS_FEATURE = 0.95 // eyes / brows / lips / watch / fingers
const DENS_HAIR = 0.80 // hair core / hairline
const DENS_JAW = 0.65 // jawline
const DENS_FACE_SKIN = 0.45 // 臉頰 / 額頭 / 脖子
const DENS_ARM_SKIN = 0.50 // 手臂皮膚
const DENS_BODY = 0.42 // 衣服大面積
const DENS_EDGE = 0.0 // 剪影外緣不保留粒子

// 有限色板
const PALETTE = {
  dark: [0.16, 0.14, 0.13], // 深棕黑 / charcoal
  mid: [0.42, 0.38, 0.34], // 暖灰 / taupe
  midLight: [0.64, 0.59, 0.53], // 淺暖灰
  skin: [0.84, 0.73, 0.62], // 低飽和米膚色
  blue: [0.26, 0.36, 0.56], // 手錶 muted blue
  red: [0.56, 0.33, 0.33], // 嘴唇 muted red
}
const SAT_REDUCTION = 0.40 // 整體降飽和 40%
const BG_GRAY = [0.8, 0.78, 0.75]

// 粒徑三層：70% 4–5px、20% 2.5–3.5px、10% 5.5–6.5px
const SIZE_TIERS = [
  { p: 0.7, mult: 1.0 }, // 4.5px
  { p: 0.2, mult: 0.67 }, // 3px
  { p: 0.1, mult: 1.33 }, // 6px
]
const EYE_SIZE_MULT = 0.8 // 眼睛附近粒子稍小

// 漂移層級
const CORE_DRIFT = 0.10 // 眼睛/嘴/手錶/手指
const EDGE_DRIFT = 0.35 // 頭髮/手臂/衣服外緣

// 文字區域：僅輕微密度下降 25%
const TEXT_EXCLUDE = { x: 0.04, y: 0.5, rx: 0.07, ry: 0.22, strength: 0.25 }

// -------- LAYER 3: Floating Dust --------
const FLOATING_DUST_COUNT = 120
const DUST_OPACITY_MIN = 0.12
const DUST_OPACITY_MAX = 0.35
const DUST_DRIFT = 0.8

// -------- 2.5D 分層深度 --------
// 所有結構深度都以「depth unit」表示（-1 ~ 1），最後統一乘 DEPTH_STRENGTH × scale。
// 分層（由前到後）：手臂圓柱最前 > 臉（光滑半橢球）> 身體(0) > 頭髮。
const DEPTH_STRENGTH = 120 // 深度總幅度縮小（ghost portrait 提供主要體積）
const BODY_DEPTH = 0
const FACE_DEPTH = 0.42
const ARM_DEPTH = 0.7
const ARM_TUBE = 0.22
const HAIR_DEPTH = -0.5
const BODY_BACK_DEPTH = 0.55
const BACK_SAMPLE_RATE = 0 // 停用背面粒子：ghost portrait 提供體積
const BACK_COLOR_DIM = 0.78
const BACK_ALPHA = 0.82
const SURFACE_DEPTH = 0.04
const DEPTH_SCATTER = 0.1
const DEPTH_SHADING = 0.14
const CAMERA_FOV = 34

// -------- 粒子動態：呼吸漂移 + 滑鼠排斥 --------
const DRIFT_AMPLITUDE = 0.006
const DRIFT_SPEED = 1.9
const REPULSION_RADIUS = 0.018 // 排斥半徑約臉寬 8%（臉寬 0.224）
const REPULSION_STRENGTH = 0.020
const RETURN_SPEED = 6
const LEAVE_SPEED = 14

// 臉部去五官化
const FACE_FLATTEN = 0.55
const FACE_COLOR_LEVELS = 12
const FACE_BLUR_PX = 14
const SKIN_BLUR_PX = 7

// 手臂切口補強（停用：ghost portrait 提供體積）
const ARM_CAP_FILL = false
const ARM_CAP_PARTICLES = 0

// 結構區域，全部使用「圖片歸一化座標」（依 /public/evelyn-cutout.png 1361×766 實測標定）
const FACE_REGION = { x: 0.522, y: 0.48, rx: 0.112, ry: 0.21 } // 臉橢圓
const HAIR_REGION = { x: 0.515, y: 0.4, rx: 0.205, ry: 0.34 } // 頭頂/頭側頭髮大橢圓
const TORSO_Y = 0.67 // 高於此 y 視為肩/身區
// 手臂由兩段膠囊組成（上臂自左下角斜上 → 手肘 → 前臂/手橫過額頭），手肘處刻意重疊
const ARM_SEGMENTS = [
  { x1: 0.3, y1: 0.21, x2: 0.69, y2: 0.29, r: 0.09 }, // 前臂＋手（最前）
  { x1: 0.0, y1: 0.95, x2: 0.32, y2: 0.26, r: 0.1 }, // 上臂（末端在照片左下角被切）
]

// 旋轉完全由頁面滾動驅動：PROLOGUE 長滾動區頂部 = 0°（正面），底部 = 最大角度。
// 不滾動時人物保持不動（粒子呼吸漂移仍持續）；往回滑會反向轉回。
const SCROLL_ROTATION_MAX_DEG = 42 // 滾完序曲段落後的總轉角
const SCROLL_ROTATION_EASE = 8 // rAF 中跟隨滾動目標角的指數平滑速率（1/s）

const smoothstep = (edge0, edge1, x) => {
  const t = Math.min(1, Math.max(0, (x - edge0) / (edge1 - edge0)))
  return t * t * (3 - 2 * t)
}

/** 橢圓遮罩：回傳 0（外）→ 1（中心）的平滑值 */
function ellipseMask(u, v, r) {
  const dx = (u - r.x) / r.rx
  const dy = (v - r.y) / r.ry
  const d2 = dx * dx + dy * dy
  return d2 < 1 ? Math.sqrt(1 - d2) : 0
}

/** 點到線段的距離與軸向參數 t（歸一化座標，用於膠囊 / 圓柱建模） */
function segmentProbe(px, py, seg) {
  const dx = seg.x2 - seg.x1
  const dy = seg.y2 - seg.y1
  const len2 = dx * dx + dy * dy
  let t = len2 > 0 ? ((px - seg.x1) * dx + (py - seg.y1) * dy) / len2 : 0
  t = Math.min(1, Math.max(0, t))
  const qx = seg.x1 + t * dx
  const qy = seg.y1 + t * dy
  return { d: Math.hypot(px - qx, py - qy), t }
}

/**
 * 手臂探測：回傳最近膠囊段的
 *  m  柔和遮罩（0 外緣 → 1 內部）
 *  p  相對圓柱半徑的正規化距離（0 軸心 → 1 邊緣）
 *  t  軸向參數（0 = 被照片切掉的上臂端）
 */
function armProbe(u, v) {
  let best = { m: 0, p: 1, t: 1 }
  for (const seg of ARM_SEGMENTS) {
    const { d, t } = segmentProbe(u, v, seg)
    // 邊緣收緊（0.7r 內全值、1.08r 外歸零）：手臂剪影明確，不與頭髮漸變相連
    const m = 1 - smoothstep(seg.r * 0.7, seg.r * 1.08, d)
    if (m > best.m) best = { m, p: Math.min(1, d / seg.r), t }
  }
  return best
}

/** 載入圖片 */
function loadImage(url) {
  return new Promise((resolve, reject) => {
    const img = new Image()
    img.crossOrigin = 'anonymous'
    img.onload = () => resolve(img)
    img.onerror = reject
    img.src = url
  })
}

/**
 * 讀取圖片像素並取樣。
 * 第一趟：求人物的 alpha 質心、包圍盒，以及頭部（頂端區域）中心。
 * 第二趟：生成粒子，並依「中心/臉部前凸、邊緣退後」的連續深度場指派 z。
 * 回傳 position（three 世界座標，含 z）、顏色、alpha，以及最終使用的 step。
 */
function sampleImage(img, hostWidthCss) {
  const W = img.naturalWidth
  const H = img.naturalHeight

  const off = document.createElement('canvas')
  off.width = W
  off.height = H
  const ctx = off.getContext('2d', { willReadFrequently: true })
  ctx.drawImage(img, 0, 0)
  const { data } = ctx.getImageData(0, 0, W, H)

  // 模糊取色畫布：重度（抹除臉部五官）、輕度（手臂皮膚柔化）
  const makeBlur = (px) => {
    const c = document.createElement('canvas')
    c.width = W
    c.height = H
    const bctx = c.getContext('2d', { willReadFrequently: true })
    bctx.filter = `blur(${px}px)`
    bctx.drawImage(img, 0, 0)
    return bctx.getImageData(0, 0, W, H).data
  }
  const faceBlur = makeBlur(FACE_BLUR_PX)
  const skinBlur = makeBlur(SKIN_BLUR_PX)

  // 依容器寬度把圖片像素換算成 CSS px 世界單位（orthographic 相機 1 單位 = 1px）
  const scale = hostWidthCss / W

  // ---------- 第一趟：人物空間統計（與取樣 step 無關，只算一次） ----------
  let sumX = 0
  let sumY = 0
  let weight = 0
  let minX = W
  let minY = H
  let maxX = 0
  let maxY = 0
  for (let y = 0; y < H; y += 2) {
    for (let x = 0; x < W; x += 2) {
      const a = data[(y * W + x) * 4 + 3]
      if (a <= ALPHA_THRESHOLD) continue
      const wgt = a / 255
      sumX += x * wgt
      sumY += y * wgt
      weight += wgt
      if (x < minX) minX = x
      if (x > maxX) maxX = x
      if (y < minY) minY = y
      if (y > maxY) maxY = y
    }
  }
  const cx = sumX / weight // 軀幹 alpha 質心
  const cy = sumY / weight
  const rx = Math.max(1, (maxX - minX) / 2) // 包圍盒半寬 / 半高（邊緣後退正規化用）
  const ry = Math.max(1, (maxY - minY) / 2)

  // 平均膚色：在臉橢圓內取「亮度適中、非頭髮」的模糊像素，徹底去五官的基底色
  let skinR = 0
  let skinG = 0
  let skinB = 0
  let skinN = 0
  const fx0 = Math.max(0, Math.floor((FACE_REGION.x - FACE_REGION.rx) * W))
  const fx1 = Math.min(W, Math.ceil((FACE_REGION.x + FACE_REGION.rx) * W))
  const fy0 = Math.max(0, Math.floor((FACE_REGION.y - FACE_REGION.ry) * H))
  const fy1 = Math.min(H, Math.ceil((FACE_REGION.y + FACE_REGION.ry) * H))
  for (let yy = fy0; yy < fy1; yy += 3) {
    for (let xx = fx0; xx < fx1; xx += 3) {
      const ei = (yy * W + xx) * 4
      if (faceBlur[ei + 3] < 200) continue
      const l =
        (0.299 * faceBlur[ei] + 0.587 * faceBlur[ei + 1] + 0.114 * faceBlur[ei + 2]) / 255
      if (l < 0.45 || l > 0.92) continue // 排除頭髮/牙齒/強光
      const fdx = (xx / W - FACE_REGION.x) / FACE_REGION.rx
      const fdy = (yy / H - FACE_REGION.y) / FACE_REGION.ry
      if (fdx * fdx + fdy * fdy > 0.85) continue
      skinR += faceBlur[ei]
      skinG += faceBlur[ei + 1]
      skinB += faceBlur[ei + 2]
      skinN += 1
    }
  }
  const skin = skinN
    ? [skinR / skinN / 255, skinG / skinN / 255, skinB / skinN / 255]
    : [0.8, 0.66, 0.58]

  let step = SAMPLING_STEP
  let packed

  // 超過上限就逐步加大取樣步長
  while (step <= 12) {
    // 正面粒子
    const positions = []
    const colors = []
    const alphas = []
    const sizes = []
    const driftScales = [] // 每粒子漂移強度倍率（臉小、外緣大），初始化固定
    const repMuls = [] // 每粒子排斥強度倍率（核心弱、外緣強）
    // 背面體積粒子（最後會併到正面「之前」繪製：depthTest 關閉時依緩衝順序，
    // 正面壓住背面；側面時兩者 xy 錯開，形成可見的厚度）
    const backPositions = []
    const backColors = []
    const backAlphas = []
    const backSizes = []
    const backDriftScales = []
    const backRepMuls = []
    // 除錯用：各結構層的平均 depth unit（驗證前後次序）
    const layerSum = { arm: 0, face: 0, hair: 0, body: 0 }
    const layerCount = { arm: 0, face: 0, hair: 0, body: 0 }
    // 上臂被照片直切區（左下角）內的現有粒子，稍後複製到圓柱背面
    const cutBand = []
    const upperArm = ARM_SEGMENTS[1]

    for (let y = 0; y < H; y += step) {
      for (let x = 0; x < W; x += step) {
        const i = (y * W + x) * 4
        const a = data[i + 3]
        if (a <= ALPHA_THRESHOLD) continue

        const aN = a / 255
        // 邊緣鬆散化：剪影最外圈（alpha 弱）依機率脫落；alpha 越實保留率越高
        const keep = smoothstep(EDGE_BREAKUP[0], EDGE_BREAKUP[1], aN)
        if (Math.random() > keep) continue

        // 極小的固定網格抖動，打破棋盤規則感（不傷及五官與輪廓）
        const jx = (Math.random() - 0.5) * step * POSITION_JITTER
        const jy = (Math.random() - 0.5) * step * POSITION_JITTER
        let sx = x + jx
        let sy = y + jy

        // ---------- 2.5D 分層深度場（圖片歸一化座標） ----------
        const u = sx / W
        const v = sy / H
        const lum = (0.299 * data[i] + 0.587 * data[i + 1] + 0.114 * data[i + 2]) / 255

        // ① 臉：橢圓內光滑半橢球（z=sqrt(1-r²)），邊緣切線平滑歸零，無怪異凸包
        const fdx = (u - FACE_REGION.x) / FACE_REGION.rx
        const fdy = (v - FACE_REGION.y) / FACE_REGION.ry
        const fr2 = fdx * fdx + fdy * fdy
        const faceMask = fr2 < 1 ? Math.sqrt(1 - fr2) : 0

        // ② 頭髮：頭部大橢圓內、臉核心以外的暗部；另外涵蓋垂落兩側的長髮
        const hdx = (u - HAIR_REGION.x) / HAIR_REGION.rx
        const hdy = (v - HAIR_REGION.y) / HAIR_REGION.ry
        const hairEllipse = Math.exp(-(hdx * hdx * 0.9 + hdy * hdy * 1.15))
        const darkness = 1 - smoothstep(0.3, 0.52, lum) // 深棕髮 / 陰影
        const sideHair =
          v > 0.6 && (u < 0.45 || u > 0.6) ? darkness * smoothstep(0.6, 0.72, v) : 0
        // 髮量集中在「臉以外」：臉核心越強，髮權重越低
        const hairMask = Math.max(
          hairEllipse * (1 - faceMask) * (0.55 + 0.45 * darkness),
          sideHair,
        )

        // ③ 手臂：兩段膠囊。照片粒子構成圓柱「前半」——
        //    軸心最前（ARM_DEPTH+ARM_TUBE），剪影邊緣平滑收回 ARM_DEPTH
        const arm = armProbe(u, v)
        const armZ =
          ARM_DEPTH + ARM_TUBE * Math.sqrt(Math.max(0, 1 - arm.p * arm.p))

        // 手臂剪影內剔除頭髮權重：舉起的前臂與頭髮之間留出明確前後界線
        const hairMaskClean = hairMask * (1 - arm.m)

        // ---------- 視覺錨點 + 選擇性密度 ----------
        const eyesM = Math.max(ellipseMask(u, v, EYES_REGION[0]), ellipseMask(u, v, EYES_REGION[1]))
        const browsM = Math.max(ellipseMask(u, v, BROWS_REGION[0]), ellipseMask(u, v, BROWS_REGION[1]))
        const lipsM = ellipseMask(u, v, LIPS_REGION)
        const watchM = ellipseMask(u, v, WATCH_REGION)
        const fingersM = ellipseMask(u, v, FINGERS_REGION)
        const hairCoreM = ellipseMask(u, v, HAIR_CORE_REGION)
        const hairlineM = ellipseMask(u, v, HAIRLINE_REGION)
        const jawlineM = ellipseMask(u, v, JAWLINE_REGION)
        const shoulderM = ellipseMask(u, v, SHOULDER_REGION)
        const armCoreM = arm.m

        // 特徵強度（用於密度、顏色、漂移）
        const featureM = Math.max(eyesM, browsM, lipsM * 0.9, watchM * 0.9, fingersM * 0.8)
        const hairM = Math.max(hairCoreM, hairlineM)
        let anchorStr = Math.max(featureM, hairM * 0.7, jawlineM * 0.6, armCoreM * 0.5)

        // 外緣因子
        const edgeAlpha = 1 - smoothstep(0.65, 0.98, aN)
        const bboxR0 = Math.hypot((sx - cx) / rx, (sy - cy) / ry)
        const edgeBbox = smoothstep(0.85, 1.02, bboxR0)
        let edgeFactor = Math.max(edgeAlpha, edgeBbox)
        edgeFactor = Math.min(1, edgeFactor)
        const interior = 1 - edgeFactor

        // 選擇性密度：只重點保留特徵區，皮膚/衣服大幅降低
        let baseDensity
        if (featureM > 0.08) {
          baseDensity = DENS_FEATURE
        } else if (hairM > 0.25) {
          baseDensity = DENS_HAIR
        } else if (jawlineM > 0.2) {
          baseDensity = DENS_JAW
        } else if (faceMask > 0.12) {
          baseDensity = DENS_FACE_SKIN
        } else if (arm.m > 0.3) {
          baseDensity = DENS_ARM_SKIN
        } else {
          baseDensity = DENS_BODY
        }
        const density = baseDensity * interior + DENS_EDGE * edgeFactor

        // 文字區域：僅輕微密度下降
        const tdx = (u - TEXT_EXCLUDE.x) / TEXT_EXCLUDE.rx
        const tdy = (v - TEXT_EXCLUDE.y) / TEXT_EXCLUDE.ry
        const textT = Math.min(1, tdx * tdx + tdy * tdy)
        const textFactor = 1 - TEXT_EXCLUDE.strength * (1 - smoothstep(0.1, 1.0, textT))
        const finalDensity = density * textFactor
        if (Math.random() > finalDensity) continue

        // 邊緣消散：極小外移（edge 密度已為 0，僅內部邊緣粒子微微散開）
        const ddx = sx - cx
        const ddy = sy - cy
        const dlen = Math.hypot(ddx, ddy) || 1
        const dissolve = edgeFactor * 0.01 * rx
        const scatter = edgeFactor * step * 0.4
        sx += (ddx / dlen) * dissolve + (Math.random() - 0.5) * scatter
        sy += (ddy / dlen) * dissolve + (Math.random() - 0.5) * scatter

        // ④ 身體：基礎層；剪影外緣極輕微後退，避免側視像紙片邊緣
        const nbx = (sx - cx) / rx
        const nby = (sy - cy) / ry
        const bodyEdgeBack = 0.1 * smoothstep(0.75, 1.2, Math.sqrt(nbx * nbx + nby * nby))
        const nonArm =
          BODY_DEPTH +
          FACE_DEPTH * faceMask +
          HAIR_DEPTH * hairMaskClean + // HAIR_DEPTH 本身為負值 → 向後
          -bodyEdgeBack +
          (lum - 0.5) * 2 * SURFACE_DEPTH

        // 手臂膠囊邊緣做線性混合，膠囊核心完全由圓柱曲面主導
        let depthUnit = nonArm * (1 - arm.m) + armZ * arm.m

        // 記錄被照片直切的上臂粒子（左下角切口帶）
        if (ARM_CAP_FILL) {
          const up = segmentProbe(u, v, upperArm)
          if (v > 0.72 && u < 0.34 && up.t < 0.32 && up.d < upperArm.r * 1.3) {
            cutBand.push({
              sx,
              sy,
              p: Math.min(1, up.d / upperArm.r),
            })
          }
        }

        // ⑤ 固定深度散佈：各區域幅度不同，初始化後永遠固定（非每幀隨機）
        let scatterAmp
        let layer
        if (arm.m > 0.4) {
          scatterAmp = 0.5
          layer = 'arm'
        } else if (faceMask > 0.35) {
          scatterAmp = 0.6
          layer = 'face'
        } else if (hairMaskClean > 0.25) {
          scatterAmp = 1.5
          layer = 'hair'
        } else if (v > TORSO_Y) {
          scatterAmp = 1.3
          layer = 'body'
        } else {
          scatterAmp = 1.0
          layer = 'body'
        }
        depthUnit += (Math.random() * 2 - 1) * DEPTH_SCATTER * scatterAmp
        layerSum[layer] += depthUnit
        layerCount[layer] += 1

        depthUnit = Math.min(1, Math.max(-1, depthUnit))
        const z = depthUnit * DEPTH_STRENGTH * scale // 正值朝向鏡頭

        positions.push((sx - W / 2) * scale, -(sy - H / 2) * scale, z)

        // ---------- 顏色：臉部徹底去五官，手臂皮膚柔化 ----------
        const src = arm.m > 0.4 ? skinBlur : faceMask > 0.05 ? faceBlur : data
        let cr = src[i] / 255
        let cg = src[i + 1] / 255
        let cb = src[i + 2] / 255
        if (faceMask > 0.05) {
          // 壓向平均膚色：臉越靠中心抹得越乾淨，眼/鼻/嘴完全消失
          const f = FACE_FLATTEN * faceMask
          cr = cr * (1 - f) + skin[0] * f
          cg = cg * (1 - f) + skin[1] * f
          cb = cb * (1 - f) + skin[2] * f
        }
        // 極輕深度明暗：越靠前越亮、越靠後越暗（固定烘焙，非貼圖光照）
        const shade = 1 + depthUnit * DEPTH_SHADING
        const levels = faceMask > 0.25 ? FACE_COLOR_LEVELS : COLOR_LEVELS
        cr *= shade; cg *= shade; cb *= shade

        // ---------- 色彩：映射到有限色板 + 整體降飽和 40% ----------
        const gLum = 0.299 * cr + 0.587 * cg + 0.114 * cb
        // 依區域選擇色板目標色
        let target
        if (watchM > 0.15) {
          target = PALETTE.blue
        } else if (lipsM > 0.15) {
          target = PALETTE.red
        } else if (eyesM > 0.1 || browsM > 0.1 || hairM > 0.25) {
          target = PALETTE.dark
        } else if (jawlineM > 0.2) {
          target = PALETTE.mid
        } else if (faceMask > 0.12 || arm.m > 0.3) {
          target = PALETTE.skin
        } else if (gLum > 0.6) {
          target = PALETTE.midLight
        } else if (gLum > 0.35) {
          target = PALETTE.mid
        } else {
          target = PALETTE.dark
        }
        // 色板混合量：accent 區較高、其餘約 SAT_REDUCTION
        let mixAmt
        if (watchM > 0.15 || lipsM > 0.15) mixAmt = 0.65
        else if (eyesM > 0.1 || browsM > 0.1 || hairM > 0.25) mixAmt = 0.7
        else if (faceMask > 0.12 || arm.m > 0.3) mixAmt = 0.55
        else mixAmt = SAT_REDUCTION
        // 先將原色降飽和（混合自身灰度），再靠向色板
        const gray = [gLum, gLum, gLum]
        const desatAmt = SAT_REDUCTION * 0.6
        cr = cr * (1 - desatAmt) + gray[0] * desatAmt
        cg = cg * (1 - desatAmt) + gray[1] * desatAmt
        cb = cb * (1 - desatAmt) + gray[2] * desatAmt
        cr = cr * (1 - mixAmt) + target[0] * mixAmt
        cg = cg * (1 - mixAmt) + target[1] * mixAmt
        cb = cb * (1 - mixAmt) + target[2] * mixAmt
        // 外緣進一步靠向背景灰
        const edgeGray = (1 - interior) * 0.4
        cr = cr * (1 - edgeGray) + BG_GRAY[0] * edgeGray
        cg = cg * (1 - edgeGray) + BG_GRAY[1] * edgeGray
        cb = cb * (1 - edgeGray) + BG_GRAY[2] * edgeGray
        colors.push(gradeColor(cr, levels), gradeColor(cg, levels), gradeColor(cb, levels))

        // 透明度
        const alphaMul = 0.4 + 0.6 * interior
        alphas.push((a / 255) * alphaMul)
        // 粒徑三層：眼睛附近稍小
        const roll = Math.random()
        let tierMult = 1.0
        let acc = 0
        for (const t of SIZE_TIERS) {
          acc += t.p
          if (roll < acc) { tierMult = t.mult; break }
        }
        const eyeShrink = eyesM > 0.1 || browsM > 0.1 ? EYE_SIZE_MULT : 1.0
        const edgeShrink = 0.8 + 0.2 * interior
        sizes.push(tierMult * eyeShrink * edgeShrink)
        // 漂移：核心特徵穩定、外緣較大
        let driftScale
        if (featureM > 0.1) driftScale = CORE_DRIFT
        else if (anchorStr > 0.1) driftScale = (CORE_DRIFT + EDGE_DRIFT) * 0.5
        else driftScale = EDGE_DRIFT
        driftScale = driftScale * interior + EDGE_DRIFT * edgeFactor
        driftScales.push(driftScale)
        // 排斥強度：核心弱、外緣強
        const repMul = (anchorStr > 0.1 ? 0.5 : 0.8) * interior + 1.0 * edgeFactor
        repMuls.push(repMul)

        // ---------- 背面體積粒子：與正面同 xy，補在 z 負側（手臂則補在圓管後半） ----------
        if (Math.random() < BACK_SAMPLE_RATE) {
          let backUnit = null
          let backLayer = 'body'
          if (arm.m > 0.35) {
            // 補成完整圓管：背面半圓在軸深 ARM_DEPTH 之後（軸心 −TUBE、邊緣收齊）
            backUnit = ARM_DEPTH - ARM_TUBE * Math.sqrt(Math.max(0, 1 - arm.p * arm.p))
            backLayer = 'arm'
          } else if (faceMask > 0.2) {
            // 後腦殼：正面半橢球的鏡像
            backUnit = -FACE_DEPTH * faceMask * 0.95 - 0.06
            backLayer = 'face'
          } else {
            // 軀幹鏡片擠出：剪影內部厚、邊緣平滑收薄
            const rim = Math.sqrt(nbx * nbx + nby * nby)
            const backInterior = 1 - smoothstep(0.55, 1.15, rim)
            if (backInterior > 0.06) {
              backUnit = -BODY_BACK_DEPTH * backInterior
              backLayer = hairMaskClean > 0.25 ? 'hair' : 'body'
            }
          }
          if (backUnit !== null) {
            backUnit += (Math.random() * 2 - 1) * DEPTH_SCATTER * scatterAmp
            backUnit = Math.min(1, Math.max(-1, backUnit))
            backPositions.push(
              (sx - W / 2) * scale,
              -(sy - H / 2) * scale,
              backUnit * DEPTH_STRENGTH * scale,
            )
            const backShade = (1 + backUnit * DEPTH_SHADING) * BACK_COLOR_DIM
            backColors.push(
              gradeColor(cr * backShade, levels),
              gradeColor(cg * backShade, levels),
              gradeColor(cb * backShade, levels),
            )
            backAlphas.push((a / 255) * BACK_ALPHA * alphaMul)
            backSizes.push(tierMult * edgeShrink * 0.95)
            backDriftScales.push(driftScale * 1.1)
            backRepMuls.push(repMul)
            layerSum[backLayer] += backUnit
            layerCount[backLayer] += 1
          }
        }
      }
    }

    // ---------- 手臂切口補強：背面層 + 圓角封端（同一個點雲） ----------
    if (ARM_CAP_FILL && cutBand.length) {
      const pushFill = (pxN, pyN, depthUnit0, shadeMul = 1) => {
        let du = depthUnit0 + (Math.random() * 2 - 1) * DEPTH_SCATTER * 0.5
        du = Math.min(1, Math.max(-1, du))
        const pxx = pxN * W
        const pyy = pyN * H
        backPositions.push(
          (pxx - W / 2) * scale,
          -(pyy - H / 2) * scale,
          du * DEPTH_STRENGTH * scale,
        )
        const shade = (1 + du * DEPTH_SHADING) * shadeMul
        backColors.push(
          gradeColor(skin[0] * shade),
          gradeColor(skin[1] * shade),
          gradeColor(skin[2] * shade),
        )
        backAlphas.push(0.85)
        backSizes.push(1 + (Math.random() * 2 - 1) * SIZE_VARIATION * 0.5)
        backDriftScales.push(0.3) // 手臂補強粒子中等漂移
        backRepMuls.push(0.8)
        layerSum.arm += du
        layerCount.arm += 1
      }

      // (A) 把切口帶現有粒子複製到圓柱「後半」，旋轉時直管不再是開口
      const backBudget = Math.floor(ARM_CAP_PARTICLES * 0.58)
      for (let k = cutBand.length - 1; k > 0; k--) {
        const j = Math.floor(Math.random() * (k + 1))
        ;[cutBand[k], cutBand[j]] = [cutBand[j], cutBand[k]]
      }
      let backN = 0
      for (const c of cutBand) {
        if (backN >= backBudget) break
        const backZ = ARM_DEPTH - ARM_TUBE * Math.sqrt(Math.max(0, 1 - c.p * c.p))
        pushFill(
          c.sx / W + (Math.random() - 0.5) * 0.004,
          c.sy / H + (Math.random() - 0.5) * 0.004,
          backZ,
          0.92,
        )
        backN += 1
      }

      // (B) 照片外的「半球封端」：球心在上臂切點外側，只生成側面＋背面半球
      const axX = upperArm.x2 - upperArm.x1
      const axY = upperArm.y2 - upperArm.y1
      const axLen = Math.hypot(axX, axY)
      const dirX = axX / axLen // 朝手肘
      const dirY = axY / axLen
      const perpX = -dirY // 照片平面內垂直手臂
      const perpY = dirX
      const domeN = ARM_CAP_PARTICLES - backN
      for (let k = 0; k < domeN; k++) {
        // 偏向切口面（ψ 小處）：側壁密集以補滿旋轉視角，框外遠端稀疏不漂浮
        const psi = Math.pow(Math.random(), 1.6) * Math.PI * 0.5
        // 只取側面＋背面（正面已被照片粒子覆蓋），左右兩側都要
        const theta = Math.PI * (0.42 + Math.random() * 1.16)
        const sinP = Math.sin(psi)
        const qx =
          upperArm.x1 +
          upperArm.r * (Math.cos(psi) - 1) * dirX +
          upperArm.r * sinP * Math.sin(theta) * perpX
        const qy =
          upperArm.y1 +
          upperArm.r * (Math.cos(psi) - 1) * dirY +
          upperArm.r * sinP * Math.sin(theta) * perpY
        const du = ARM_DEPTH - ARM_TUBE * sinP * Math.cos(theta)
        // 越靠背面越暗一點，呈現圓柱體積
        pushFill(qx, qy, du, 0.94)
      }
    }

    // ---------- LAYER 3: Floating Dust ----------
    // 從頭頂、指尖、頭髮外緣、手腕、肩緣產生少量脫離粒子
    const dustSources = [
      { cx: HAIRLINE_REGION.x, cy: HAIRLINE_REGION.y - 0.02, rx: HAIRLINE_REGION.rx, ry: 0.03, count: 30 },
      { cx: FINGERS_REGION.x + 0.04, cy: FINGERS_REGION.y, rx: 0.04, ry: 0.05, count: 25 },
      { cx: HAIR_CORE_REGION.x - HAIR_CORE_REGION.rx * 0.8, cy: HAIR_CORE_REGION.y, rx: 0.03, ry: 0.12, count: 22 },
      { cx: HAIR_CORE_REGION.x + HAIR_CORE_REGION.rx * 0.8, cy: HAIR_CORE_REGION.y, rx: 0.03, ry: 0.12, count: 22 },
      { cx: WATCH_REGION.x, cy: WATCH_REGION.y, rx: 0.04, ry: 0.04, count: 13 },
      { cx: SHOULDER_REGION.x, cy: SHOULDER_REGION.y, rx: 0.06, ry: 0.04, count: 8 },
    ]
    for (const src of dustSources) {
      for (let k = 0; k < src.count; k++) {
        // 在來源區域內隨機位置，略微外移脫離人物
        const ang = Math.random() * Math.PI * 2
        const rad = Math.sqrt(Math.random())
        const du = src.cx + Math.cos(ang) * rad * src.rx
        const dv = src.cy + Math.sin(ang) * rad * src.ry
        const px = du * W
        const py = dv * H
        // 朝向外側輕微偏移
        const outAng = Math.atan2(dv - 0.5, du - 0.5)
        const outDist = (0.01 + Math.random() * 0.03) * W
        const fpx = px + Math.cos(outAng) * outDist
        const fpy = py + Math.sin(outAng) * outDist
        positions.push((fpx - W / 2) * scale, -(fpy - H / 2) * scale, 0)
        // 低飽和、接近背景灰的顏色
        const lumT = 0.5 + Math.random() * 0.3
        const dc = BG_GRAY[0] * lumT
        colors.push(gradeColor(dc), gradeColor(dc * 0.98), gradeColor(dc * 0.95))
        alphas.push(DUST_OPACITY_MIN + Math.random() * (DUST_OPACITY_MAX - DUST_OPACITY_MIN))
        sizes.push(0.5 + Math.random() * 0.4)
        driftScales.push(DUST_DRIFT)
        repMuls.push(1.0)
      }
    }

    // 繪製順序：背面（含切口封端）先畫 → 正面後畫蓋住，正面視角不重影；
    // 旋轉到側面時兩殼 xy 錯開，呈現有厚度的完整體積
    const allPositions = backPositions.concat(positions)
    const allColors = backColors.concat(colors)
    const allAlphas = backAlphas.concat(alphas)
    const allSizes = backSizes.concat(sizes)
    const allDriftScales = backDriftScales.concat(driftScales)
    const allRepMuls = backRepMuls.concat(repMuls)

    packed = {
      W,
      H,
      step,
      scale,
      hostWidth: hostWidthCss,
      backCount: backAlphas.length,
      position: new Float32Array(allPositions),
      color: new Float32Array(allColors),
      alpha: new Float32Array(allAlphas),
      size: new Float32Array(allSizes),
      driftScales: new Float32Array(allDriftScales),
      repMuls: new Float32Array(allRepMuls),
      count: allAlphas.length,
      layers: Object.fromEntries(
        Object.keys(layerSum).map((k) => [
          k,
          layerCount[k] ? layerSum[k] / layerCount[k] : 0,
        ]),
      ),
    }
    if (packed.count <= MAX_PARTICLES) break
    step += 1
  }

  // 深度範圍（CSS px），供 dataset 除錯檢查
  let zMin = Infinity
  let zMax = -Infinity
  const posArr = packed.position
  for (let k = 2; k < posArr.length; k += 3) {
    if (posArr[k] < zMin) zMin = posArr[k]
    if (posArr[k] > zMax) zMax = posArr[k]
  }
  packed.zMin = zMin
  packed.zMax = zMax

  // 每粒子固定的漂移參數（只生成一次，絕不在動畫中重新隨機）：
  // x = 相位（0..2π）、y = 速度倍率（0.55..1.45）、z = 幅度倍率（乘區域漂移強度）
  const drift = new Float32Array(packed.count * 3)
  for (let k = 0; k < packed.count; k++) {
    drift[k * 3] = Math.random() * Math.PI * 2
    drift[k * 3 + 1] = 0.55 + Math.random() * 0.9
    // 幅度倍率：基礎隨機 × 區域漂移強度（臉 0.5、外緣 1.4）
    drift[k * 3 + 2] = (0.5 + Math.random() * 0.75) * packed.driftScales[k]
  }
  packed.drift = drift

  return packed
}

const VERT = /* glsl */ `
  attribute vec3 aColor;
  attribute float aAlpha;
  attribute float aSize;
  attribute vec3 aDrift; // x:相位 y:速度倍率 z:幅度倍率（每粒子固定）
  attribute float aRepMul; // 每粒子排斥強度倍率（核心弱、外緣強）
  uniform float uSize;
  uniform float uPersp; // 透視相機距離（CSS px），用於近大遠小的點徑衰減
  uniform float uTime; // 秒
  uniform vec2 uMouse; // 排斥中心（points 局部座標，已含旋轉換算）
  uniform float uMouseActive; // 0..1，CPU 端指數平滑後的滑鼠強度
  uniform float uRepRadius; // 排斥半徑（局部座標）
  uniform float uRepStrength; // 中心最大推開距離（局部座標）
  uniform float uDriftAmp; // 漂移幅度（局部座標）
  uniform float uDriftSpeed; // 漂移基礎角速度（rad/s）
  varying vec3 vColor;
  varying float vAlpha;

  void main() {
    vColor = aColor;
    vAlpha = aAlpha;
    vec3 pos = position;

    // ① 呼吸漂移：三軸用不同頻率/相位的 sin，固定參數 → 平順、可逆、不亂飛
    float w = uTime * uDriftSpeed * aDrift.y + aDrift.x;
    float amp = uDriftAmp * aDrift.z;
    pos.x += sin(w) * amp;
    pos.y += sin(w * 0.83 + aDrift.x * 1.7 + 2.1) * amp;
    pos.z += sin(w * 0.61 + aDrift.x * 0.9 + 4.0) * amp * 0.6;

    // ② 滑鼠排斥：cos 衰減（中心最強、邊緣切線平滑歸零），只在局部平面推開
    vec2 diff = pos.xy - uMouse;
    float d = length(diff);
    float t = clamp(d / uRepRadius, 0.0, 1.0);
    float fall = cos(t * 1.5707963); // 1（中心）→ 0（半徑邊緣）
    vec2 dir = d > 0.0001 ? diff / d : vec2(0.0);
    pos.xy += dir * fall * uRepStrength * uMouseActive * aRepMul;

    vec4 mvPosition = modelViewMatrix * vec4(pos, 1.0);
    gl_Position = projectionMatrix * mvPosition;
    // z=0 平面處 uPersp / -mvPosition.z = 1，正面大小與正交版本一致；
    // 靠前粒子變大、靠後粒子變小，形成真實透視體積
    gl_PointSize = uSize * aSize * (uPersp / max(1.0, -mvPosition.z));
  }
`

// 圓形、邊界清楚、不發光：只在最外緣留窄反鋸齒，不與鄰點糊成色塊
const FRAG = /* glsl */ `
  precision mediump float;
  varying vec3 vColor;
  varying float vAlpha;

  void main() {
    float dist = distance(gl_PointCoord, vec2(0.5));
    if (dist > 0.5) discard;
    float edge = smoothstep(0.5, 0.4, dist);
    gl_FragColor = vec4(vColor, edge * vAlpha);
  }
`

export default function ParticlePortrait() {
  const hostRef = useRef(null)
  const [status, setStatus] = useState({ state: 'loading', count: 0 })

  useEffect(() => {
    const host = hostRef.current
    let disposed = false
    let renderer = null
    let scene = null
    let camera = null
    let points = null
    let geometry = null
    let material = null
    let ghostTexture = null
    let ghostGeo = null
    let ghostMat = null
    let resizeObserver = null
    let sampled = null
    let rafId = null
    let rotationStart = 0
    let scrollTrigger = null
    const cleanupFns = []

    const disposeAll = () => {
      if (rafId !== null) {
        cancelAnimationFrame(rafId)
        rafId = null
      }
      while (cleanupFns.length) {
        try {
          cleanupFns.pop()()
        } catch {
          /* 卸載期間忽略監聽器移除異常 */
        }
      }
      resizeObserver?.disconnect()
      if (points) {
        scene?.remove(points)
        points = null
      }
      geometry?.dispose()
      material?.dispose()
      ghostTexture?.dispose()
      ghostGeo?.dispose()
      ghostMat?.dispose()
      if (renderer) {
        renderer.dispose()
        if (renderer.domElement.parentElement === host) {
          host.removeChild(renderer.domElement)
        }
      }
      geometry = null
      material = null
      ghostTexture = null
      ghostGeo = null
      ghostMat = null
      renderer = null
    }

    const applySize = () => {
      if (!renderer || !camera || !sampled || !points || !material) return
      const w = host.clientWidth
      const h = host.clientHeight
      if (w === 0 || h === 0) return

      const dpr = Math.min(window.devicePixelRatio || 1, MAX_DPR)
      renderer.setPixelRatio(dpr)
      renderer.setSize(w, h, false)

      // 透視相機：讓 z=0 平面的可見高度剛好等於容器高，正面構圖與舊正交版一致
      camera.aspect = w / h
      const dist = h / 2 / Math.tan((CAMERA_FOV * Math.PI) / 360)
      camera.position.set(0, 0, dist)
      camera.updateProjectionMatrix()

      // 粒子間距（CSS px）× 倍率，再乘 dpr 換算成裝置像素
      const spacing = sampled.scale * sampled.step
      // 容器寬度改變時（如媒體查詢切換），整體點雲（含 z 深度）與點尺寸等比縮放
      const scaleFactor = w / sampled.hostWidth
      points.scale.set(scaleFactor, scaleFactor, scaleFactor)
      material.uniforms.uSize.value = spacing * PARTICLE_SIZE * scaleFactor * dpr
      material.uniforms.uPersp.value = dist

      renderer.render(scene, camera)
    }

    const init = async () => {
      const img = await loadImage(IMAGE_URL)
      if (disposed) return

      // 容器比例與原圖一致 → 不變形
      host.style.aspectRatio = `${img.naturalWidth} / ${img.naturalHeight}`
      sampled = sampleImage(img, host.clientWidth)

      renderer = new THREE.WebGLRenderer({
        alpha: true,
        antialias: true,
        powerPreference: 'high-performance',
      })
      renderer.setClearColor(0x000000, 0) // 背景透明，露出網頁底色
      renderer.domElement.className = 'particle-canvas'
      host.appendChild(renderer.domElement)

      scene = new THREE.Scene()
      camera = new THREE.PerspectiveCamera(CAMERA_FOV, 1, 1, 20000)
      camera.position.set(0, 0, 1000)

      geometry = new THREE.BufferGeometry()
      geometry.setAttribute('position', new THREE.BufferAttribute(sampled.position, 3))
      geometry.setAttribute('aColor', new THREE.BufferAttribute(sampled.color, 3))
      geometry.setAttribute('aAlpha', new THREE.BufferAttribute(sampled.alpha, 1))
      geometry.setAttribute('aSize', new THREE.BufferAttribute(sampled.size, 1))
      geometry.setAttribute('aDrift', new THREE.BufferAttribute(sampled.drift, 3))
      geometry.setAttribute('aRepMul', new THREE.BufferAttribute(sampled.repMuls, 1))
      geometry.boundingSphere = new THREE.Sphere(new THREE.Vector3(), 100000)

      material = new THREE.ShaderMaterial({
        vertexShader: VERT,
        fragmentShader: FRAG,
        uniforms: {
          uSize: { value: 4 },
          uPersp: { value: 1000 },
          uTime: { value: 0 },
          uMouse: { value: new THREE.Vector2(0, 0) },
          uMouseActive: { value: 0 },
          // 長度類參數換算成「取樣時局部座標」，再由 points.scale 隨人物一起縮放
          uRepRadius: { value: REPULSION_RADIUS * sampled.hostWidth },
          uRepStrength: { value: REPULSION_STRENGTH * sampled.hostWidth },
          uDriftAmp: { value: DRIFT_AMPLITUDE * sampled.hostWidth },
          uDriftSpeed: { value: DRIFT_SPEED },
        },
        transparent: true,
        depthTest: false,
        depthWrite: false,
      })

      points = new THREE.Points(geometry, material)
      points.renderOrder = 1 // 粒子在 ghost portrait 之上
      scene.add(points)

      // ---------- LAYER 1: Ghost Portrait（灰階底層） ----------
      const ghostCanvas = document.createElement('canvas')
      ghostCanvas.width = img.naturalWidth
      ghostCanvas.height = img.naturalHeight
      const gctx = ghostCanvas.getContext('2d')
      gctx.filter = `grayscale(100%) contrast(${GHOST_CONTRAST}) blur(${GHOST_BLUR_PX}px)`
      gctx.drawImage(img, 0, 0)
      ghostTexture = new THREE.CanvasTexture(ghostCanvas)
      ghostTexture.minFilter = THREE.LinearFilter
      ghostTexture.magFilter = THREE.LinearFilter
      ghostGeo = new THREE.PlaneGeometry(
        img.naturalWidth * sampled.scale,
        img.naturalHeight * sampled.scale,
      )
      ghostMat = new THREE.MeshBasicMaterial({
        map: ghostTexture,
        transparent: true,
        opacity: GHOST_OPACITY,
        depthTest: false,
        depthWrite: false,
      })
      const ghostMesh = new THREE.Mesh(ghostGeo, ghostMat)
      ghostMesh.position.z = -DEPTH_STRENGTH * sampled.scale - 20 // 粒子後方
      ghostMesh.renderOrder = 0 // 先畫
      points.add(ghostMesh) // 隨人物一起旋轉

      applySize()

      resizeObserver = new ResizeObserver(applySize)
      resizeObserver.observe(host)

      // ---------- 滾動驅動旋轉：與 Prologue 文案相同的滾動區間（top top → bottom bottom） ----------
      const maxScrollRad = THREE.MathUtils.degToRad(SCROLL_ROTATION_MAX_DEG)
      let targetRot = 0
      const triggerEl = host.closest('.prologue') ?? host
      scrollTrigger = ScrollTrigger.create({
        trigger: triggerEl,
        start: 'top top',
        end: 'bottom bottom',
        onUpdate: (self) => {
          targetRot = self.progress * maxScrollRad
        },
      })
      // 以目前滾動位置初始化（重新掛載 / StrictMode 時不會從 0° 跳一下）
      targetRot = scrollTrigger.progress * maxScrollRad
      points.rotation.y = targetRot
      cleanupFns.push(() => {
        scrollTrigger?.kill()
        scrollTrigger = null
      })

      // ---------- 滑鼠排斥：把螢幕滑鼠換算成「旋轉後 points 的局部 z=0 平面」座標 ----------
      const raycaster = new THREE.Raycaster()
      const ndc = new THREE.Vector2()
      const invMatrix = new THREE.Matrix4()
      const localOrigin = new THREE.Vector3()
      const localDir = new THREE.Vector3()
      const localRay = new THREE.Ray()
      const planeZ = new THREE.Plane(new THREE.Vector3(0, 0, 1), 0)
      const hit = new THREE.Vector3()
      const targetMouse = new THREE.Vector2(0, 0)
      let targetActive = 0
      let lastNow = performance.now()

      const onPointerMove = (e) => {
        if (e.pointerType && e.pointerType !== 'mouse') return // 觸控滑動保留給頁面滾動
        const rect = renderer.domElement.getBoundingClientRect()
        // 事件掛在 window：文案層（z-index 更高）蓋住人物時仍能交互；
        // 只認 canvas 矩形內的座標，移出人物區域等同離開
        const inside =
          e.clientX >= rect.left &&
          e.clientX <= rect.right &&
          e.clientY >= rect.top &&
          e.clientY <= rect.bottom
        if (!inside) {
          targetActive = 0
          return
        }
        ndc.x = ((e.clientX - rect.left) / rect.width) * 2 - 1
        ndc.y = -((e.clientY - rect.top) / rect.height) * 2 + 1
        raycaster.setFromCamera(ndc, camera)
        // 經 points 世界矩陣反轉：人物旋轉/縮放後，交互點仍貼在正確的局部表面
        points.updateMatrixWorld()
        invMatrix.copy(points.matrixWorld).invert()
        localOrigin.copy(raycaster.ray.origin).applyMatrix4(invMatrix)
        localDir.copy(raycaster.ray.direction).transformDirection(invMatrix)
        localRay.set(localOrigin, localDir)
        if (localRay.intersectPlane(planeZ, hit)) {
          targetMouse.set(hit.x, hit.y)
          targetActive = 1
        }
      }
      const onPointerLeave = () => {
        targetActive = 0
      }
      // 掛在 window 而非 canvas：上層文案軌道會攔截事件，canvas 自身收不到 pointermove
      window.addEventListener('pointermove', onPointerMove, { passive: true })
      document.addEventListener('mouseleave', onPointerLeave, { passive: true })
      window.addEventListener('blur', onPointerLeave, { passive: true })
      cleanupFns.push(() => {
        window.removeEventListener('pointermove', onPointerMove)
        document.removeEventListener('mouseleave', onPointerLeave)
        window.removeEventListener('blur', onPointerLeave)
      })

      // 常駐動畫迴圈：呼吸時間、滑鼠平滑回歸、旋轉角跟隨滾動目標值
      rotationStart = performance.now()
      const tick = (now) => {
        if (disposed || !points || !renderer) return
        const dt = Math.min(0.05, Math.max(0, (now - lastNow) / 1000))
        lastNow = now

        material.uniforms.uTime.value = (now - rotationStart) / 1000
        // 快速讓開、稍慢回歸：滑鼠靠近用 LEAVE_SPEED，離開回歸用 RETURN_SPEED
        const u = material.uniforms
        const approaching = targetActive > u.uMouseActive.value
        const speed = approaching ? LEAVE_SPEED : RETURN_SPEED
        const k = 1 - Math.exp(-speed * dt)
        u.uMouseActive.value += (targetActive - u.uMouseActive.value) * k
        u.uMouse.value.lerp(targetMouse, k)

        // 旋轉只跟隨滾動目標角（指數平滑）；不滾動時 targetRot 不變 → 人物靜止
        const rk = 1 - Math.exp(-SCROLL_ROTATION_EASE * dt)
        points.rotation.y += (targetRot - points.rotation.y) * rk

        renderer.render(scene, camera)
        rafId = requestAnimationFrame(tick)
      }
      rafId = requestAnimationFrame(tick)

      // 供外部（除錯/自動化檢查）確認取樣與渲染已完成
      host.dataset.state = 'ready'
      host.dataset.particles = String(sampled.count)
      host.dataset.build = `s${SAMPLING_STEP}p${PARTICLE_SIZE}`
      host.dataset.depth = `${sampled.zMin.toFixed(1)}..${sampled.zMax.toFixed(1)}`
      host.dataset.layers =
        `arm${sampled.layers.arm.toFixed(2)} ` +
        `face${sampled.layers.face.toFixed(2)} ` +
        `body${sampled.layers.body.toFixed(2)} ` +
        `hair${sampled.layers.hair.toFixed(2)}`
      if (!disposed) setStatus({ state: 'ready', count: sampled.count })
    }

    init().catch(() => {
      if (!disposed) {
        host.dataset.state = 'error'
        setStatus({ state: 'error', count: 0 })
      }
    })

    return () => {
      disposed = true
      disposeAll()
    }
  }, [])

  return (
    <div
      ref={hostRef}
      className={`figure-anchor particle-portrait${status.state === 'error' ? ' is-error' : ''}`}
      role="img"
      aria-label="Particle portrait of Evelyn"
    />
  )
}

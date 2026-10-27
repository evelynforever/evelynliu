// public/ 內資源的部署前綴。
// GitHub Pages 專案頁部署在子路徑（/evelynliu.github.io/），
// 以絕對路徑寫死的圖片需補上 base，否則會 404。
export const assetUrl = (path) =>
  `${import.meta.env.BASE_URL}${String(path).replace(/^\/+/, '')}`

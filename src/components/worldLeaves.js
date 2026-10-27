// ============================================================
// THE WORLD · 六片葉子的註釋內容與定位
//
// 座標一律使用 tree.jpg 的原圖像素（1672×941），由元件換算成百分比，
// 因此與圖片顯示尺寸、視窗縮放完全同步，不會錯位。
//
// 葉片編號 = 依水平位置由左至右：
//   01 leaf-1 (685,229) → CNU Poetry Research Center
//   02 leaf-2 (831,321) → CTI
//   03 leaf-3 (906,709) → ByteDance
//   04 leaf-4 (971,589) → Vocay
//   05 leaf-5 (1339,759) → PolyBuzz
//   06 leaf-6 (1403,237) → Future
//
// anchor：註釋文字的定位錨點（原圖像素）
//   side: 'left'  → 以 x 為左邊界，文字向右展開
//         'right' → 以 x 為右邊界，文字向左展開（靠近右緣的葉片）
//   vertical: 'top'    → 以 y 為上邊界
//             'bottom' → 以 y 為下邊界（靠近底緣，向上生長，避免溢出）
// 位置皆取自原圖留白（墨跡密度實測 ≈0），互不重疊、不壓枝幹、不遮其他葉片。
// 修改這些數值即可調整註釋位置。
// ============================================================

export const LEAF_COMPANIES = [
  {
    id: 'leaf-1',
    name: 'CNU Poetry Research Center',
    role: 'Content Editor & WeChat Operator',
    desc: 'Edited, proofread, designed, and published WeChat articles, overseeing both content and visual presentation.',
    logo: null,
    leafArt: { src: '/leaf-1.png', x: 659, y: 204, w: 57, h: 51 },
    anchor: { side: 'left', x: 500, vertical: 'top', y: 20 },
  },
  {
    id: 'leaf-2',
    name: 'CTI',
    role: 'Exam Operations Assistant',
    desc: 'Coordinated six Chinese teacher certification exams and researched global examination platforms.',
    logo: null,
    leafArt: { src: '/leaf-2.png', x: 809, y: 295, w: 43, h: 55 },
    anchor: { side: 'left', x: 885, vertical: 'top', y: 200 },
  },
  {
    id: 'leaf-3',
    name: 'ByteDance',
    role: 'Recruitment Operations Intern',
    desc: 'Recruited talent for international web fiction and short drama teams, using business insights and data analysis to improve candidate matching.',
    // 專案內的 bytedance.jpg 為白底 JPG，縮到 13px 會變成一塊白色小方塊，
    // 違反「不得出現底色塊」的註釋規範，因此直接省略 logo（不生成替代圖示）。
    logo: null,
    leafArt: { src: '/leaf-3.png', x: 884, y: 685, w: 45, h: 50 },
    anchor: { side: 'left', x: 467, vertical: 'top', y: 628 },
  },
  {
    id: 'leaf-4',
    name: 'Vocay',
    role: 'User Growth & Global Social Media Intern',
    desc: 'Developed global go-to-market content strategies and built AI-powered workflows for end-to-end content production.',
    logo: null,
    leafArt: { src: '/leaf-4.png', x: 946, y: 566, w: 48, h: 51 },
    anchor: { side: 'left', x: 850, vertical: 'top', y: 760 },
    // 葉片離文字較遠，僅此一組加一根極細引導線（原圖像素：x, y1→y2）
    guide: { x: 971, y1: 626, y2: 752 },
  },
  {
    id: 'leaf-5',
    name: 'PolyBuzz',
    role: 'Overseas Content & Social Media Operations Intern',
    desc: 'Planned in-app campaigns, developed AI characters, and managed global creator communities.',
    logo: null,
    leafArt: { src: '/leaf-5.png', x: 1316, y: 745, w: 49, h: 44 },
    anchor: { side: 'right', x: 1618, vertical: 'bottom', y: 930 },
  },
  {
    id: 'leaf-6',
    future: true,
    leafArt: { src: '/leaf-6.png', x: 1380, y: 209, w: 48, h: 52 },
    text: 'To be continued',
    anchor: { side: 'right', x: 1335, vertical: 'top', y: 55 },
  },
]

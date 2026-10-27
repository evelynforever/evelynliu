import MindStoryPage from './MindStoryPage'

// THE MIND · Page 2 — “Reading Across Centuries”（2019）
// 沿用 Page 1 模板；黑白 archive 背景，右下為書籍照片 + 長文案。
export default function MindPage2() {
  return (
    <MindStoryPage
      mono
      pageClass="mind-page--2"
      year="2019"
      title="Reading Across Centuries"
      description="I began university in Wuhan, joining the Department of Chinese Language and Literature."
      quoteLines={[
        'I found myself surrounded by brilliant minds across centuries and space. Their thoughts gathered around me in such abundance that I could scarcely take them in. I was struck by how intimately their minds resonated with my own and how naturally I could think and feel alongside them. Somewhere in that quiet recognition, another world opened.',
      ]}
      photoSrc="/hubu.jpg"
      asideImage="/books.jpg"
      asideAlt="Books from across the centuries"
      ariaLabel="THE MIND — Chapter 2, 2019"
    />
  )
}

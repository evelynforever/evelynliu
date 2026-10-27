import MindStoryPage from './MindStoryPage'

// THE MIND · Page 1 — “The Girl Who Built Worlds”（2001）
export default function MindPage1() {
  return (
    <MindStoryPage
      pageClass="mind-page--1"
      year="2001"
      title="The Girl Who Built Worlds"
      description="My journey began in a flower-filled courtyard, where I spent my childhood inventing games and happily disappearing into them."
      quoteLines={[
        'Before I knew what storytelling was,',
        'I was already making up characters,',
        'scenes, and tiny worlds,',
        'then pulling other people into them.',
      ]}
      photoSrc="/garden.jpg"
      ariaLabel="THE MIND — Chapter 1, 2001"
    />
  )
}

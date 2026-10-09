import { PageHero } from './_page.jsx'
import { Button } from '@/components/ui.jsx'

export default function NotFound() {
  return (
    <>
      <PageHero eyebrow="404" title="Page Not Found">
        That page isn’t part of the Worldwide Tehillim Club.
      </PageHero>
      <div className="mx-auto max-w-6xl px-4 py-10">
        <Button to="/">Back to Home</Button>
      </div>
    </>
  )
}

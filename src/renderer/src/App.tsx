import { Button } from '@/components/ui/button'

function App(): React.JSX.Element {
  return (
    <div className="flex min-h-screen flex-col items-center justify-center gap-6 bg-background">
      <h1 className="text-4xl font-bold text-foreground">Tab Revolver Player</h1>
      <p className="text-muted-foreground">Hello World — scaffold is working</p>
      <Button>Get Started</Button>
    </div>
  )
}

export default App

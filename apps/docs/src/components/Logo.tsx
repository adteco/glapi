import Link from 'next/link'
import { ShieldCheck } from 'lucide-react'

export function Logo(props: React.ComponentPropsWithoutRef<'a'>) {
  return (
    <Link href="/" className="flex items-center gap-2" {...props}>
      <ShieldCheck className="h-8 w-8 text-sky-400" />
      <span className="text-xl font-bold">GLAPI</span>
    </Link>
  )
}

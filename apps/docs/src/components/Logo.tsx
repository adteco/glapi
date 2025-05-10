import Link from 'next/link'
import Image from 'next/image'

export function Logo(props: React.ComponentPropsWithoutRef<'a'>) {
  return (
    <Link href="/" className="flex items-center gap-2" {...props}>
      <Image
        src="/images/kurrent-icon.png"
        alt="Kurrent"
        width={32}
        height={32}
        className="h-8 w-8"
      />
    </Link>
  )
}

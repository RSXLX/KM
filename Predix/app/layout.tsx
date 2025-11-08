import type { Metadata } from 'next'
import '@fontsource/inter/latin-400.css'
import '@fontsource/inter/latin-500.css'
import '@fontsource/inter/latin-600.css'
import '@fontsource/inter/latin-700.css'
import { WalletProvider } from '@/components/providers/WalletProvider'
import { QueryProvider } from '@/components/providers/QueryProvider'
import { RequestProvider } from '@/components/providers/RequestProvider'
import './globals.css'
import '@solana/wallet-adapter-react-ui/styles.css'

export const metadata: Metadata = {
  title: 'K Market',
  description: 'Decentralized prediction markets platform',
}

export default function RootLayout({
  children,
}: {
  children: React.ReactNode
}) {
  return (
    <html lang="en" suppressHydrationWarning className="dark">
      <body suppressHydrationWarning>
        <WalletProvider>
          <QueryProvider>
            <RequestProvider>
              {children}
            </RequestProvider>
          </QueryProvider>
        </WalletProvider>
      </body>
    </html>
  )
}
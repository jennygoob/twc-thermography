import type { Metadata } from 'next'
import './globals.css'

export const metadata: Metadata = {
  title: 'TWC Thermography — THE WELLNESS CO.',
  description: 'Clinical thermography imaging and analysis workstation',
}

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en">
      <body>{children}</body>
    </html>
  )
}

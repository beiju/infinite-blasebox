import React from "react"
import type { Metadata } from "next"

export const metadata: Metadata = {
  title: 'The Infinite Blasebox',
}

export default function RootLayout({
  children,
}: {
  children: React.ReactNode
}) {
  return (
    <html lang="en">
      <body className={`theme-dark`}>{children}</body>
    </html>
  )
}

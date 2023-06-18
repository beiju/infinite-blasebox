import '../app/globals.css'
import '../app/blaseball.css'
import '../app/fonts.css'

import type { AppProps } from 'next/app'

export default function MyApp({ Component, pageProps }: AppProps) {
    return <Component {...pageProps} />
}
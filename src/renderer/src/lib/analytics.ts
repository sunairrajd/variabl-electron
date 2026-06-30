export function trackEvent(eventName: string, params?: Record<string, any>) {
  if (typeof window !== 'undefined' && (window as any).gtag) {
    (window as any).gtag('event', eventName, params)
    console.log(`[Analytics] Tracked event: ${eventName}`, params)
  } else {
    console.warn(`[Analytics] gtag not found, could not track event: ${eventName}`)
  }
}

export function trackPageView(pagePath: string, pageTitle: string) {
  if (typeof window !== 'undefined' && (window as any).gtag) {
    (window as any).gtag('event', 'page_view', {
      page_path: pagePath,
      page_title: pageTitle
    })
    console.log(`[Analytics] Tracked page view: ${pagePath} (${pageTitle})`)
  }
}

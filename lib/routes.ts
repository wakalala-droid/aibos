// The public website. These live in app/(marketing)/ and bring their own
// chrome (MarketingNav / MarketingFooter) and their own skin, so the app's
// shell renders them bare and the theme never hides them while scripts load.
// Every folder in app/(marketing)/ belongs here: /privacy was missing once, so
// the privacy policy opened inside the app's sidebar.
export const MARKETING_ROUTES = ['/', '/pricing', '/trust', '/about', '/privacy', '/terms', '/refunds'];

export const isMarketingRoute = (pathname: string) => MARKETING_ROUTES.includes(pathname);

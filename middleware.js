export const config = {
  matcher: '/',
};

export default function middleware(request) {
  // If this request came from a click within our own site (e.g. the "TR"
  // language-switch link on /en pointing back to "/"), respect the user's
  // explicit choice and skip the language-based redirect below — otherwise
  // an English-browser visitor could never reach the Turkish homepage.
  const referer = request.headers.get('referer');
  if (referer) {
    try {
      if (new URL(referer).hostname === new URL(request.url).hostname) {
        return;
      }
    } catch (e) {
      // malformed referer header; fall through to the language check
    }
  }

  const acceptLanguage = request.headers.get('accept-language') || '';
  const primaryLang = acceptLanguage.split(',')[0]?.trim().toLowerCase();

  if (primaryLang && !primaryLang.startsWith('tr')) {
    return Response.redirect(new URL('/en', request.url), 307);
  }
}

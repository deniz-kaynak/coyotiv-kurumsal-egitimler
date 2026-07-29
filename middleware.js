export const config = {
  matcher: '/',
};

export default function middleware(request) {
  const acceptLanguage = request.headers.get('accept-language') || '';
  const primaryLang = acceptLanguage.split(',')[0]?.trim().toLowerCase();

  if (primaryLang && !primaryLang.startsWith('tr')) {
    return Response.redirect(new URL('/en.html', request.url), 307);
  }
}

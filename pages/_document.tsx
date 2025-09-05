import Document, { Html, Head, Main, NextScript } from 'next/document';

class MyDocument extends Document {
  render() {
    return (
      <Html lang="en">
        <Head>
          {/* Viewport fijo + notch safe-area */}
          <meta
            name="viewport"
            content="width=device-width, initial-scale=1, maximum-scale=1, user-scalable=no, viewport-fit=cover"
          />

          {/* Favicons / PWA */}
          <link rel="icon" href="/favicon.png" sizes="32x32" type="image/png" />
          <link rel="apple-touch-icon" href="/apple-touch-icon.png" />
          <link rel="manifest" href="/site.webmanifest" />
          <meta name="theme-color" content="#1F4CED" />

          {/* iOS web-app */}
          <meta name="apple-mobile-web-app-capable" content="yes" />
          <meta name="apple-mobile-web-app-status-bar-style" content="black-translucent" />
          <meta name="format-detection" content="telephone=no" />

          {/* SEO básico */}
          <meta
            name="description"
            content="Walcord — The Wall: memories, concerts, content and more."
          />

          {/* OG / Twitter */}
          <meta property="og:site_name" content="Walcord" />
          <meta property="og:title" content="Walcord" />
          <meta property="og:description" content="The Wall: memories, concerts, content and more." />
          <meta property="og:type" content="website" />
          <meta property="og:url" content="https://walcord.com/" />
          <meta property="og:image" content="https://walcord.com/logotipo.png" />
          <meta name="twitter:card" content="summary_large_image" />
          <meta name="twitter:title" content="Walcord" />
          <meta name="twitter:description" content="The Wall: memories, concerts, content and more." />
          <meta name="twitter:image" content="https://walcord.com/logotipo.png" />

          {/* JSON-LD */}
          <script
            type="application/ld+json"
            dangerouslySetInnerHTML={{
              __html: JSON.stringify({
                '@context': 'https://schema.org',
                '@type': 'WebSite',
                name: 'Walcord',
                url: 'https://walcord.com/',
              }),
            }}
          />

          {/* ⚡️ ACTIVAR MODO APP ANTES DE QUE PINTE (sin FOUC):
              - UA contiene WalcordApp
              - O query ?app=1
          */}
          <script
            dangerouslySetInnerHTML={{
              __html: `
                (function(){
                  try{
                    var ua = navigator.userAgent||'';
                    var qs = new URLSearchParams(location.search);
                    var isApp = /WalcordApp/i.test(ua) || qs.get('app')==='1';
                    if(isApp){
                      document.documentElement.classList.add('is-app');
                    }
                  }catch(e){}
                })();
              `,
            }}
          />
        </Head>
        <body>
          <Main />
          <NextScript />
        </body>
      </Html>
    );
  }
}

export default MyDocument;

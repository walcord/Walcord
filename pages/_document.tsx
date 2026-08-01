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

          {/* Favicons apuntando directamente a tu logo en Supabase con ?v=2 para matar la caché */}
          <link 
            rel="icon" 
            href="https://mbrdycxpztjtgsiyxikt.supabase.co/storage/v1/object/public/Assets/logo-walcord.png?v=2" 
            type="image/png" 
          />
          <link 
            rel="apple-touch-icon" 
            href="https://mbrdycxpztjtgsiyxikt.supabase.co/storage/v1/object/public/Assets/logo-walcord.png?v=2" 
          />
          
          {/* Manifest comentado porque no existe el archivo local /site.webmanifest */}
          {/* <link rel="manifest" href="/site.webmanifest" /> */}
          
          {/* Color del navegador: Blanco puro para estética minimalista */}
          <meta name="theme-color" content="#ffffff" />

          {/* iOS web-app */}
          <meta name="apple-mobile-web-app-capable" content="yes" />
          <meta name="apple-mobile-web-app-status-bar-style" content="black-translucent" />
          <meta name="format-detection" content="telephone=no" />

          {/* SEO básico */}
          <meta
            name="description"
            content="Walcord — The Wall: memories, concerts, content and more."
          />

          {/* OG / Twitter con tu nuevo logo editorial y ?v=2 */}
          <meta property="og:site_name" content="Walcord" />
          <meta property="og:title" content="Walcord" />
          <meta property="og:description" content="The Wall: memories, concerts, content and more." />
          <meta property="og:type" content="website" />
          <meta property="og:url" content="https://walcord.com/" />
          <meta property="og:image" content="https://mbrdycxpztjtgsiyxikt.supabase.co/storage/v1/object/public/Assets/logo-walcord.png?v=2" />
          
          <meta name="twitter:card" content="summary_large_image" />
          <meta name="twitter:title" content="Walcord" />
          <meta name="twitter:description" content="The Wall: memories, concerts, content and more." />
          <meta name="twitter:image" content="https://mbrdycxpztjtgsiyxikt.supabase.co/storage/v1/object/public/Assets/logo-walcord.png?v=2" />

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

          {/* ⚡️ ACTIVAR MODO APP ANTES DE QUE PINTE (sin FOUC) */}
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
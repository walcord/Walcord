import React, { useCallback, useMemo, useRef, useState } from 'react'
import {
  BackHandler,
  Linking,
  Platform,
  SafeAreaView,
  StatusBar,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from 'react-native'
import { WebView } from 'react-native-webview'
import type { WebViewNavigation } from 'react-native-webview/lib/WebViewTypes'

const BASE_URL = 'https://walcord.com'
const WALCORD_BLUE = '#1F48AF'

function isAuthCallbackUrl(url: string) {
  const s = url.toLowerCase()
  return (
    s.includes('access_token=') ||
    s.includes('refresh_token=') ||
    s.includes('type=recovery') ||
    s.includes('type=magiclink') ||
    s.includes('code=') ||
    s.includes('/auth/v1') ||
    s.includes('supabase')
  )
}

function appUrl(input: string) {
  if (isAuthCallbackUrl(input)) return input

  try {
    const url = new URL(input)
    if (!url.searchParams.has('app')) {
      url.searchParams.set('app', '1')
    }
    return url.toString()
  } catch {
    return input
  }
}

function shouldHideBottomBar(url?: string | null) {
  if (!url) return false

  try {
    const path = new URL(url).pathname.toLowerCase()
    return (
      path === '/' ||
      path === '/welcome' ||
      path === '/login' ||
      path === '/signup' ||
      path === '/onboarding' ||
      path === '/auth/login' ||
      path === '/auth/signup'
    )
  } catch {
    return false
  }
}

const injectedJavaScriptBeforeContentLoaded = `
(function() {
  try {
    var m = document.querySelector('meta[name=viewport]');
    var content = 'width=device-width, initial-scale=1.0, maximum-scale=1.0, user-scalable=no, viewport-fit=cover';
    if (!m) {
      m = document.createElement('meta');
      m.name = 'viewport';
      document.head.appendChild(m);
    }
    m.setAttribute('content', content);
  } catch (e) {}
})();
true;
`

const injectedJavaScript = `
(function() {
  try {
    var s = document.createElement('style');
    s.textContent = \`
      html, body, #root, #__next, main {
        overflow-x: hidden !important;
        width: 100% !important;
        max-width: 100% !important;
        margin: 0 !important;
        padding: 0 !important;
      }
      * {
        box-sizing: border-box !important;
      }
      img, video, canvas, svg, iframe {
        max-width: 100% !important;
        height: auto !important;
      }
      body > * {
        max-width: 100% !important;
      }
      :root {
        -webkit-text-size-adjust: 100% !important;
      }
      html.is-app, html.is-android-app, body {
        font-family: "Times New Roman", Times, serif !important;
      }
    \`;
    document.head.appendChild(s);

    function tune(el) {
      el.setAttribute('autocapitalize', 'none');
      el.setAttribute('autocorrect', 'off');
      el.setAttribute('spellcheck', 'false');
    }

    var emails = document.querySelectorAll('input[type=email], input[name*=email i], input[name*=user i], input[name*=login i]');
    var passes = document.querySelectorAll('input[type=password], input[name*=pass i]');

    emails.forEach(function(el) {
      tune(el);
      el.setAttribute('inputmode', 'email');
      el.setAttribute('autocomplete', 'username');
    });

    passes.forEach(function(el) {
      tune(el);
      el.setAttribute('autocomplete', 'current-password');
    });

    var html = document.documentElement;
    html.classList.add('is-app');
    html.classList.add('is-android-app');

    window.__walcordApp = true;
    window.__walcordAndroidApp = true;
  } catch (e) {}
})();
true;
`

export default function App() {
  const webViewRef = useRef<WebView>(null)
  const [currentUrl, setCurrentUrl] = useState(appUrl(BASE_URL))
  const [canGoBack, setCanGoBack] = useState(false)

  const hideBottomBar = useMemo(() => shouldHideBottomBar(currentUrl), [currentUrl])

  const navigateTo = useCallback((path: string) => {
    const normalized = path.startsWith('/') ? path : `/${path}`
    const nextUrl = appUrl(`${BASE_URL}${normalized}`)
    webViewRef.current?.stopLoading()
    webViewRef.current?.injectJavaScript(`
      (function() {
        window.location.assign(${JSON.stringify(nextUrl)});
      })();
      true;
    `)
  }, [])

  const goBack = useCallback(() => {
    if (canGoBack) {
      webViewRef.current?.goBack()
    } else {
      navigateTo('/wall')
    }
  }, [canGoBack, navigateTo])

  React.useEffect(() => {
    const sub = BackHandler.addEventListener('hardwareBackPress', () => {
      if (canGoBack) {
        webViewRef.current?.goBack()
        return true
      }
      return false
    })
    return () => sub.remove()
  }, [canGoBack])

  const onNavigationStateChange = useCallback((navState: WebViewNavigation) => {
    setCurrentUrl(navState.url)
    setCanGoBack(navState.canGoBack)
  }, [])

  const onShouldStartLoadWithRequest = useCallback((request: any) => {
    const url = request?.url ?? ''

    if (!url) return true

    if (
      url.startsWith('tel:') ||
      url.startsWith('mailto:') ||
      url.startsWith('maps:')
    ) {
      Linking.openURL(url).catch(() => {})
      return false
    }

    return true
  }, [])

  return (
    <SafeAreaView style={styles.safeArea}>
      <StatusBar barStyle="dark-content" backgroundColor={WALCORD_BLUE} />

      {!hideBottomBar && (
        <View pointerEvents="none" style={styles.topBlueBar}>
          <View style={styles.topBlueFill} />
        </View>
      )}

      {!hideBottomBar && (
        <View style={styles.topButtonsWrap}>
          <TouchableOpacity onPress={goBack} style={styles.topButton}>
            <Text style={styles.topButtonText}>←</Text>
          </TouchableOpacity>

          <TouchableOpacity onPress={() => navigateTo('/wall')} style={styles.topButton}>
            <Text style={styles.topButtonText}>Wall</Text>
          </TouchableOpacity>

          <TouchableOpacity onPress={() => navigateTo('/profile')} style={styles.topButton}>
            <Text style={styles.topButtonText}>Profile</Text>
          </TouchableOpacity>
        </View>
      )}

      <WebView
        ref={webViewRef}
        source={{ uri: appUrl(BASE_URL) }}
        style={styles.webview}
        sharedCookiesEnabled
        thirdPartyCookiesEnabled
        javaScriptEnabled
        domStorageEnabled
        setSupportMultipleWindows={false}
        allowsBackForwardNavigationGestures
        originWhitelist={['*']}
        onNavigationStateChange={onNavigationStateChange}
        onShouldStartLoadWithRequest={onShouldStartLoadWithRequest}
        injectedJavaScriptBeforeContentLoaded={injectedJavaScriptBeforeContentLoaded}
        injectedJavaScript={injectedJavaScript}
        applicationNameForUserAgent="WalcordApp Android"
        bounces={false}
        showsHorizontalScrollIndicator={false}
        contentInsetAdjustmentBehavior="never"
      />

      {!hideBottomBar && (
        <View style={styles.bottomOuter}>
          <View style={styles.bottomBar}>
            <BottomButton label="Feed" onPress={() => navigateTo('/feed')} />
            <BottomButton label="Idol" onPress={() => navigateTo('/idol')} />
            <BottomButton label="+" onPress={() => navigateTo('/post/new')} />
            <BottomButton label="Studio" onPress={() => navigateTo('/studio')} />
            <BottomButton label="Profile" onPress={() => navigateTo('/profile')} />
          </View>
        </View>
      )}
    </SafeAreaView>
  )
}

function BottomButton({ label, onPress }: { label: string; onPress: () => void }) {
  return (
    <TouchableOpacity onPress={onPress} style={styles.bottomButton}>
      <Text style={styles.bottomButtonText}>{label}</Text>
    </TouchableOpacity>
  )
}

const styles = StyleSheet.create({
  safeArea: {
    flex: 1,
    backgroundColor: '#ffffff',
  },
  webview: {
    flex: 1,
    backgroundColor: '#ffffff',
  },
  topBlueBar: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    zIndex: 20,
  },
  topBlueFill: {
    height: 32,
    width: '100%',
    backgroundColor: WALCORD_BLUE,
  },
  topButtonsWrap: {
    position: 'absolute',
    top: 8,
    right: 8,
    zIndex: 30,
    flexDirection: 'row',
    gap: 8,
  },
  topButton: {
    height: 32,
    paddingHorizontal: 12,
    borderRadius: 999,
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.40)',
    backgroundColor: 'rgba(0,0,0,0.40)',
    justifyContent: 'center',
    alignItems: 'center',
  },
  topButtonText: {
    color: '#ffffff',
    fontSize: 12,
    fontFamily: Platform.OS === 'android' ? 'serif' : undefined,
  },
  bottomOuter: {
    position: 'absolute',
    left: 0,
    right: 0,
    bottom: 10,
    zIndex: 30,
    alignItems: 'center',
    paddingHorizontal: 12,
  },
  bottomBar: {
    minHeight: 52,
    paddingHorizontal: 18,
    borderRadius: 26,
    borderWidth: 1,
    borderColor: 'rgba(0,0,0,0.10)',
    backgroundColor: 'rgba(255,255,255,0.92)',
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 22,
    paddingVertical: 10,
    shadowColor: '#000000',
    shadowOpacity: 0.12,
    shadowRadius: 10,
    shadowOffset: { width: 0, height: 5 },
    elevation: 6,
  },
  bottomButton: {
    minWidth: 42,
    alignItems: 'center',
    justifyContent: 'center',
  },
  bottomButtonText: {
    color: 'rgba(0,0,0,0.85)',
    fontSize: 14,
    fontFamily: Platform.OS === 'android' ? 'serif' : undefined,
  },
})
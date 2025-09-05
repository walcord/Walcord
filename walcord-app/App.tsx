import { useEffect, useRef, useState } from "react";
import {
  ActivityIndicator,
  BackHandler,
  Linking,
  Platform,
  SafeAreaView,
  StatusBar,
  StyleSheet,
  View,
  TouchableOpacity,
  Text,
} from "react-native";
import { WebView } from "react-native-webview";

const HOME_URL = "https://walcord.com"; // la web queda intacta

export default function App() {
  const webviewRef = useRef<WebView>(null);
  const [canGoBack, setCanGoBack] = useState(false);
  const [loading, setLoading] = useState(true);

  // Volver con botón atrás en Android si hay historial
  useEffect(() => {
    const onBackPress = () => {
      if (canGoBack && webviewRef.current) {
        webviewRef.current.goBack();
        return true;
      }
      return false;
    };
    const sub = BackHandler.addEventListener("hardwareBackPress", onBackPress);
    return () => sub.remove();
  }, [canGoBack]);

  const handleShouldStart = (req: any) => {
    const url = req?.url ?? "";
    if (!url.startsWith("http")) {
      Linking.openURL(url).catch(() => {});
      return false;
    }
    return true;
  };

  const handleOpenWindow = (event: any) => {
    const targetUrl = event?.nativeEvent?.targetUrl;
    if (targetUrl) Linking.openURL(targetUrl).catch(() => {});
  };

  /* Navegación interna SIN tocar la web:
     inyectamos un pequeño script para cambiar de página. */
  const goPath = (path: string) => {
    const js = `
      (function(){
        try {
          if (window?.next?.router?.push) { window.next.router.push("${path}"); }
          else { window.location.href = "${path}"; }
        } catch(e) { window.location.href = "${path}"; }
      })();
      true;
    `;
    webviewRef.current?.injectJavaScript(js);
  };

  return (
    <SafeAreaView style={styles.container}>
      <StatusBar barStyle={Platform.OS === "ios" ? "light-content" : "light-content"} />
      <View style={styles.webviewWrap}>
        <WebView
          ref={webviewRef}
          source={{ uri: HOME_URL }}
          originWhitelist={["*"]}
          javaScriptEnabled
          domStorageEnabled
          allowsInlineMediaPlayback
          setSupportMultipleWindows={true}
          onOpenWindow={handleOpenWindow}
          onShouldStartLoadWithRequest={handleShouldStart}
          onNavigationStateChange={(state) => setCanGoBack(!!state.canGoBack)}
          onLoadStart={() => setLoading(true)}
          onLoadEnd={() => setLoading(false)}
          sharedCookiesEnabled
          thirdPartyCookiesEnabled
          pullToRefreshEnabled={Platform.OS === "android"}
          userAgent={`WalcordApp/1.0 (${Platform.OS})`}
          mixedContentMode="always"
          style={styles.webview}
        />

        {/* Loader */}
        {loading && (
          <View style={styles.loader}>
            <ActivityIndicator size="large" />
          </View>
        )}

        {/* ======= BOTONES ÚTILES SOLO EN LA APP (flotantes) ======= */}
        <View pointerEvents="box-none" style={styles.fabWrap}>
          <TouchableOpacity
            onPress={() => goPath("/wall")}
            activeOpacity={0.8}
            style={[styles.fab, styles.fabPrimary]}
          >
            <Text style={styles.fabText}>Wall</Text>
          </TouchableOpacity>

          <TouchableOpacity
            onPress={() => goPath("/profile")}
            activeOpacity={0.8}
            style={[styles.fab, styles.fabLight]}
          >
            <Text style={[styles.fabText, styles.fabTextDark]}>Profile</Text>
          </TouchableOpacity>
        </View>
        {/* ========================================================= */}
      </View>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: "#1F48AF" },
  webviewWrap: { flex: 1 },
  webview: { backgroundColor: "#ffffff" },

  loader: {
    position: "absolute",
    top: 0, left: 0, right: 0, bottom: 0,
    alignItems: "center",
    justifyContent: "center",
  },

  /* Botones flotantes (arriba-derecha) */
  fabWrap: {
    position: "absolute",
    top: Platform.OS === "ios" ? 10 : 10,
    right: 10,
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
  },
  fab: {
    paddingVertical: 8,
    paddingHorizontal: 14,
    borderRadius: 12,
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.25,
    shadowRadius: 3.84,
    elevation: 4,
  },
  fabPrimary: { backgroundColor: "#1F48AF" },
  fabLight: { backgroundColor: "#ffffff" },
  fabText: { color: "#ffffff", fontWeight: "600" },
  fabTextDark: { color: "#0A1F61" },
});

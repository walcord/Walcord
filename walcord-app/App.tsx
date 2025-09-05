import { useEffect, useRef, useState } from "react";
import { ActivityIndicator, BackHandler, Linking, Platform, SafeAreaView, StatusBar, StyleSheet, View } from "react-native";
import { WebView } from "react-native-webview";

const HOME_URL = "https://walcord.com";

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
    // Permite http(s). Si es mailto/tel u otro esquema, abre fuera.
    const url = req?.url ?? "";
    if (!url.startsWith("http")) {
      Linking.openURL(url).catch(() => {});
      return false;
    }
    return true;
  };

  const handleOpenWindow = (event: any) => {
    // Para targets _blank o ventanas nuevas, abre en navegador del sistema
    const targetUrl = event?.nativeEvent?.targetUrl;
    if (targetUrl) Linking.openURL(targetUrl).catch(() => {});
  };

  return (
    <SafeAreaView style={styles.container}>
      <StatusBar barStyle={Platform.OS === "ios" ? "dark-content" : "light-content"} />
      <View style={styles.webviewWrap}>
        {/* Añadido padding lateral para mejorar la vista en pantallas pequeñas/grandes */}
        <View style={styles.responsiveWrap}>
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
            // Sesiones/cookies para login web dentro del contenedor
            sharedCookiesEnabled
            thirdPartyCookiesEnabled
            // Pull to refresh en Android
            pullToRefreshEnabled={Platform.OS === "android"}
            // User-Agent identificable (útil para métricas)
            userAgent={`WalcordApp/1.0 (${Platform.OS})`}
            // Medios mixtos (por si hay recursos externos)
            mixedContentMode="always"
            style={styles.webview}
          />
        </View>
        {loading && (
          <View style={styles.loader}>
            <ActivityIndicator size="large" />
          </View>
        )}
      </View>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: "#ffffff" },
  webviewWrap: { flex: 1 },
  responsiveWrap: { flex: 1, marginHorizontal: 12 }, // <--- aquí está el margen lateral
  webview: { backgroundColor: "#ffffff" },
  loader: {
    position: "absolute",
    top: 0, left: 0, right: 0, bottom: 0,
    alignItems: "center",
    justifyContent: "center",
  },
});

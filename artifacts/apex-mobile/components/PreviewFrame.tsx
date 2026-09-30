/**
 * Live preview of a built app's HTML. Native uses a WebView; the web build uses
 * a sandboxed iframe (WebView doesn't run on web).
 */
import React from "react";
import { Platform, View, StyleSheet } from "react-native";
import { WebView } from "react-native-webview";

export function PreviewFrame({ html, height = 380 }: { html: string; height?: number }) {
  return (
    <View style={[s.frame, { height }]}>
      {Platform.OS === "web"
        ? React.createElement("iframe", {
            srcDoc: html,
            title: "App preview",
            sandbox: "allow-scripts allow-forms",
            style: { width: "100%", height: "100%", border: 0, background: "#fff" },
          })
        : (
          <WebView
            originWhitelist={["*"]}
            source={{ html }}
            style={{ flex: 1, backgroundColor: "#fff" }}
            javaScriptEnabled
            // Built apps run locally in the preview; links out open nothing here
            setSupportMultipleWindows={false}
          />
        )}
    </View>
  );
}

const s = StyleSheet.create({
  frame: { width: "100%", borderRadius: 18, overflow: "hidden", borderWidth: 1, borderColor: "rgba(255,255,255,0.18)", backgroundColor: "#fff" },
});

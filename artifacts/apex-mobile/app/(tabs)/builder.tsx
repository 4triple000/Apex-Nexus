import React, { useState } from "react";
import {
  View,
  Text,
  ScrollView,
  TextInput,
  TouchableOpacity,
  StyleSheet,
  Platform,
} from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { Feather } from "@expo/vector-icons";
import { LinearGradient } from "expo-linear-gradient";
import { Backdrop } from "@/components/glass/Glass";

const BG = "transparent";
const CARD_BG = "rgba(255,255,255,0.04)";
const BORDER = "rgba(255,255,255,0.09)";
const PURPLE = "#7C3AED";
const PURPLE_LIGHT = "#A78BFA";
const BLUE = "#3B82F6";

const TEMPLATE_TAGS = ["📱 App", "🌐 Web", "🤖 Bot", "🎮 Game"];

const RECENT_PROJECTS = [
  { name: "E-commerce App",  stack: "React, TypeScript", status: "Live",     icon: "zap"    as const, color: "#4ADE80" },
  { name: "AI Chatbot",      stack: "Node.js, Python",   status: "Building", icon: "cpu"    as const, color: "#60A5FA" },
  { name: "Portfolio Site",  stack: "Next.js",           status: "Draft",    icon: "globe"  as const, color: "rgba(255,255,255,0.3)" },
];

type BuildStep = { label: string; done: boolean };

export default function BuilderScreen() {
  const insets = useSafeAreaInsets();
  const [prompt, setPrompt] = useState("");
  const [building, setBuilding] = useState(false);
  const [buildSteps, setBuildSteps] = useState<BuildStep[]>([]);
  const [selectedTag, setSelectedTag] = useState<string | null>(null);

  const handleBuild = () => {
    if (!prompt.trim()) return;
    const steps: BuildStep[] = [
      { label: "Analyzing your prompt",    done: false },
      { label: "Generating file structure", done: false },
      { label: "Writing components",        done: false },
      { label: "Installing dependencies",   done: false },
      { label: "Preview ready",             done: false },
    ];
    setBuilding(true);
    setBuildSteps(steps);

    steps.forEach((_, i) => {
      setTimeout(() => {
        setBuildSteps((prev) =>
          prev.map((s, idx) => (idx === i ? { ...s, done: true } : s))
        );
        if (i === steps.length - 1) {
          setTimeout(() => setBuilding(false), 800);
        }
      }, (i + 1) * 900);
    });
  };

  return (
    <View style={[styles.container, { paddingTop: insets.top }]}>
      <Backdrop />
      <ScrollView
        style={styles.scroll}
        contentContainerStyle={{ paddingBottom: insets.bottom + 100 }}
        keyboardShouldPersistTaps="handled"
        showsVerticalScrollIndicator={false}
      >
        {/* Header */}
        <View style={styles.header}>
          <View>
            <Text style={styles.headerTitle}>AI Studio</Text>
            <Text style={styles.headerSubtitle}>Build anything with AI</Text>
          </View>
          <LinearGradient
            colors={[PURPLE, BLUE]}
            start={{ x: 0, y: 0 }}
            end={{ x: 1, y: 1 }}
            style={styles.orbBadge}
          >
            <Feather name="zap" size={14} color="white" />
          </LinearGradient>
        </View>

        {/* Build Card */}
        <View style={styles.buildCard}>
          <View style={styles.buildCardHeader}>
            <Feather name="cpu" size={14} color={PURPLE_LIGHT} />
            <Text style={styles.buildCardLabel}>DESCRIBE YOUR PROJECT</Text>
          </View>

          <TextInput
            style={styles.promptInput}
            value={prompt}
            onChangeText={setPrompt}
            placeholder="A social app for dog lovers with real-time chat..."
            placeholderTextColor="rgba(255,255,255,0.25)"
            multiline
            numberOfLines={3}
            textAlignVertical="top"
          />

          {/* Template tags */}
          <ScrollView
            horizontal
            showsHorizontalScrollIndicator={false}
            style={styles.tagScroll}
            contentContainerStyle={styles.tagContainer}
          >
            {TEMPLATE_TAGS.map((tag) => (
              <TouchableOpacity
                key={tag}
                onPress={() => setSelectedTag(selectedTag === tag ? null : tag)}
                style={[
                  styles.tag,
                  selectedTag === tag && styles.tagSelected,
                ]}
              >
                <Text style={[styles.tagText, selectedTag === tag && styles.tagTextSelected]}>
                  {tag}
                </Text>
              </TouchableOpacity>
            ))}
          </ScrollView>

          <TouchableOpacity onPress={handleBuild} activeOpacity={0.8}>
            <LinearGradient
              colors={[PURPLE, BLUE]}
              start={{ x: 0, y: 0 }}
              end={{ x: 1, y: 1 }}
              style={styles.buildButton}
            >
              <Feather name="zap" size={16} color="white" />
              <Text style={styles.buildButtonText}>Build with Apex AI</Text>
            </LinearGradient>
          </TouchableOpacity>
        </View>

        {/* Build progress */}
        {(building || buildSteps.length > 0) && (
          <View style={[styles.progressCard, { overflow: "hidden" }]}>
            {/* Progress bar strip at top */}
            <View style={{ position: "absolute", top: 0, left: 0, right: 0, height: 3, backgroundColor: "rgba(255,255,255,0.08)" }}>
              <View style={{ height: "100%", width: building ? "45%" : "100%", backgroundColor: undefined }}>
                <LinearGradient colors={[PURPLE, BLUE]} start={{ x: 0, y: 0 }} end={{ x: 1, y: 0 }} style={{ flex: 1 }} />
              </View>
            </View>
            <View style={[styles.progressHeader, { marginTop: 12 }]}>
              <View style={{ width: 32, height: 32, borderRadius: 16, backgroundColor: "rgba(124,58,237,0.2)", borderWidth: 1, borderColor: "rgba(124,58,237,0.3)", alignItems: "center", justifyContent: "center" }}>
                <Text style={{ fontSize: 14 }}>✨</Text>
              </View>
              <View>
                <Text style={styles.progressTitle}>
                  {building ? "AI is building..." : "Build complete!"}
                </Text>
                <Text style={{ fontSize: 12, color: "rgba(255,255,255,0.5)" }}>Generating components</Text>
              </View>
            </View>
            {buildSteps.map((step, i) => (
              <View key={step.label} style={styles.stepRow}>
                <View style={[
                  styles.stepDot,
                  step.done
                    ? { backgroundColor: "#4ADE80", borderColor: "rgba(74,222,128,0.3)" }
                    : { backgroundColor: "rgba(255,255,255,0.1)", borderColor: "rgba(255,255,255,0.15)" },
                ]}>
                  {step.done && <Feather name="check" size={9} color="white" />}
                </View>
                <Text style={[
                  styles.stepLabel,
                  { color: step.done ? "rgba(255,255,255,0.8)" : "rgba(255,255,255,0.3)" },
                ]}>
                  {step.label}
                </Text>
              </View>
            ))}
          </View>
        )}

        {/* Recent Projects */}
        <View style={styles.section}>
          <View style={{ flexDirection: "row", justifyContent: "space-between", alignItems: "center", marginBottom: 14 }}>
            <Text style={styles.sectionTitle}>Recent Projects</Text>
            <TouchableOpacity style={{ paddingHorizontal: 10, paddingVertical: 4, borderRadius: 8, borderWidth: 1, borderColor: "rgba(124,58,237,0.5)", backgroundColor: "rgba(124,58,237,0.1)" }}>
              <Text style={{ fontSize: 12, color: PURPLE_LIGHT }}>New +</Text>
            </TouchableOpacity>
          </View>
          {RECENT_PROJECTS.map((project) => (
            <TouchableOpacity key={project.name} style={styles.projectCard} activeOpacity={0.7}>
              <View style={[styles.projectIcon, { borderColor: "rgba(124,58,237,0.2)", backgroundColor: "rgba(124,58,237,0.1)" }]}>
                <Feather name={project.icon} size={16} color={PURPLE_LIGHT} />
              </View>
              <View style={styles.projectInfo}>
                <Text style={styles.projectName}>{project.name}</Text>
                <Text style={{ fontSize: 12, color: "rgba(255,255,255,0.5)", marginTop: 2 }}>{project.stack}</Text>
              </View>
              <View style={{ flexDirection: "row", alignItems: "center", gap: 6, paddingHorizontal: 10, paddingVertical: 4, borderRadius: 99, backgroundColor: `${project.color}15`, borderWidth: 1, borderColor: `${project.color}30` }}>
                <View style={[styles.statusDot, { backgroundColor: project.color }]} />
                <Text style={{ fontSize: 11, color: project.color, fontWeight: "500" }}>{project.status}</Text>
              </View>
            </TouchableOpacity>
          ))}
        </View>

        {/* Actions row */}
        <View style={styles.actionsRow}>
          {[
            { icon: "layers" as const,   label: "Templates" },
            { icon: "github" as const,   label: "Import" },
            { icon: "share-2" as const,  label: "Deploy" },
          ].map(({ icon, label }) => (
            <TouchableOpacity key={label} style={styles.actionCard} activeOpacity={0.7}>
              <Feather name={icon} size={18} color={PURPLE_LIGHT} />
              <Text style={styles.actionLabel}>{label}</Text>
            </TouchableOpacity>
          ))}
        </View>
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  container:   { flex: 1, backgroundColor: BG },
  scroll:      { flex: 1 },
  header:      { flexDirection: "row", justifyContent: "space-between", alignItems: "center", paddingHorizontal: 20, paddingTop: 16, paddingBottom: 20 },
  headerTitle: { fontSize: 24, fontWeight: "700", color: "white", letterSpacing: -0.5 },
  headerSubtitle: { fontSize: 13, color: "rgba(255,255,255,0.45)", marginTop: 2 },
  orbBadge:    { width: 36, height: 36, borderRadius: 12, alignItems: "center", justifyContent: "center" },

  buildCard:       { marginHorizontal: 16, marginBottom: 16, borderRadius: 20, backgroundColor: CARD_BG, borderWidth: 1, borderColor: BORDER, padding: 16 },
  buildCardHeader: { flexDirection: "row", alignItems: "center", gap: 6, marginBottom: 12 },
  buildCardLabel:  { fontSize: 10, fontWeight: "700", letterSpacing: 1.2, color: "rgba(255,255,255,0.4)", textTransform: "uppercase" },
  promptInput:     { backgroundColor: "rgba(255,255,255,0.04)", borderRadius: 14, borderWidth: 1, borderColor: "rgba(124,58,237,0.35)", padding: 14, fontSize: 14, color: "white", minHeight: 80, marginBottom: 12 },
  tagScroll:       { marginBottom: 14 },
  tagContainer:    { gap: 8, paddingRight: 4 },
  tag:             { paddingHorizontal: 14, paddingVertical: 7, borderRadius: 99, backgroundColor: "rgba(255,255,255,0.05)", borderWidth: 1, borderColor: "rgba(255,255,255,0.1)" },
  tagSelected:     { backgroundColor: "rgba(124,58,237,0.18)", borderColor: "rgba(124,58,237,0.45)" },
  tagText:         { fontSize: 12, color: "rgba(255,255,255,0.6)" },
  tagTextSelected: { color: "#EDE9FE", fontWeight: "600" },
  buildButton:     { borderRadius: 14, paddingVertical: 14, flexDirection: "row", alignItems: "center", justifyContent: "center", gap: 8 },
  buildButtonText: { fontSize: 15, fontWeight: "700", color: "white" },

  progressCard:   { marginHorizontal: 16, marginBottom: 16, borderRadius: 20, backgroundColor: CARD_BG, borderWidth: 1, borderColor: BORDER, padding: 16 },
  progressHeader: { flexDirection: "row", alignItems: "center", gap: 8, marginBottom: 14 },
  dot:            { width: 8, height: 8, borderRadius: 4 },
  progressTitle:  { fontSize: 13, fontWeight: "600", color: "rgba(255,255,255,0.8)" },
  stepRow:        { flexDirection: "row", alignItems: "center", gap: 10, marginBottom: 10 },
  stepDot:        { width: 18, height: 18, borderRadius: 9, borderWidth: 1, alignItems: "center", justifyContent: "center" },
  stepLabel:      { fontSize: 13 },

  section:      { marginHorizontal: 16, marginBottom: 16 },
  sectionTitle: { fontSize: 10, fontWeight: "700", letterSpacing: 1.2, color: "rgba(255,255,255,0.3)", textTransform: "uppercase", marginBottom: 10 },

  projectCard:      { flexDirection: "row", alignItems: "center", backgroundColor: CARD_BG, borderWidth: 1, borderColor: BORDER, borderRadius: 16, padding: 14, marginBottom: 8 },
  projectIcon:      { width: 40, height: 40, borderRadius: 12, borderWidth: 1, alignItems: "center", justifyContent: "center", marginRight: 12 },
  projectInfo:      { flex: 1 },
  projectName:      { fontSize: 14, fontWeight: "600", color: "white", marginBottom: 4 },
  projectStatusRow: { flexDirection: "row", alignItems: "center", gap: 5 },
  statusDot:        { width: 5, height: 5, borderRadius: 3 },
  projectStatus:    { fontSize: 11, fontWeight: "600" },

  actionsRow:  { flexDirection: "row", gap: 10, marginHorizontal: 16, marginBottom: 8 },
  actionCard:  { flex: 1, backgroundColor: CARD_BG, borderWidth: 1, borderColor: BORDER, borderRadius: 16, paddingVertical: 16, alignItems: "center", justifyContent: "center", gap: 8 },
  actionLabel: { fontSize: 11, fontWeight: "600", color: "rgba(255,255,255,0.65)" },
});

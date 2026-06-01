export type SettingFieldType = "text" | "toggle" | "dropdown" | "number" | "textarea";
export type ModuleStatus     = "Active" | "Disabled" | "Coming Soon";
export type AppEnvironment   = "sandbox" | "production";
export type Screen           = "modules" | "live-test" | "versions" | "settings" | "deploy";
export type Personality      = "Balanced" | "Playful" | "Professional" | "Aggressive" | "Empathetic" | "Genius";

export interface SettingField {
  key:          string;
  label:        string;
  type:         SettingFieldType;
  options?:     string[];
  placeholder?: string;
  min?:         number;
  max?:         number;
}

export interface Module {
  id:             string;
  name:           string;
  icon:           string;
  description:    string;
  enabled:        boolean;
  status:         ModuleStatus;
  accentColor:    string;
  version:        string;
  dependencies:   string[];
  permissions:    string[];
  settings:       Record<string, string | boolean | number>;
  settingsSchema: SettingField[];
}

export interface DepWarning {
  moduleId:     string;
  missingDeps:  string[];
}

export interface VersionSnapshot {
  id:          string;
  label:       string;
  createdAt:   number;
  environment: AppEnvironment;
  modules:     Module[];
  globalSettings: GlobalSettings;
  note?:       string;
}

export interface GlobalSettings {
  personality:    Personality;
  memoryEnabled:  boolean;
  appMode:        "Creator" | "Assistant" | "Battle" | "Dev";
  language:       string;
  autoSave:       boolean;
  debugMode:      boolean;
}

export const DEFAULT_GLOBAL_SETTINGS: GlobalSettings = {
  personality:   "Balanced",
  memoryEnabled: true,
  appMode:       "Dev",
  language:      "English",
  autoSave:      true,
  debugMode:     false,
};

export interface CommandResult {
  success: boolean;
  message: string;
  type:    "success" | "error" | "info" | "warn";
}

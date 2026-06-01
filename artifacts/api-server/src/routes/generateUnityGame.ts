import { Router } from "express";
import path from "path";
import fs from "fs";
import archiver from "archiver";

const router = Router();

// ── Paths ──────────────────────────────────────────────────────────────────────
// __dirname resolves to dist/ (single bundled file), so 3 levels up = workspace root
const WORKSPACE_ROOT    = path.resolve(__dirname, "../../../");
const UNITY_SCRIPTS_DIR = path.join(WORKSPACE_ROOT, "unity-client/Assets/Scripts");

// ── GET /generate-unity-game/scripts — health check ───────────────────────────
router.get("/generate-unity-game/status", (_req, res) => {
  const scriptsExist = fs.existsSync(UNITY_SCRIPTS_DIR);
  res.json({ ok: true, scriptsDir: UNITY_SCRIPTS_DIR, scriptsExist });
});

// ── POST /generate-unity-game ──────────────────────────────────────────────────
router.post("/generate-unity-game", (req, res) => {
  try {
    const spec = req.body?.spec ?? {};
    const serverUrl: string = req.body?.serverUrl ?? "http://localhost:8080";
    const projectName: string = (req.body?.projectName ?? "ApexFPS")
      .replace(/[^a-zA-Z0-9_-]/g, "_")
      .slice(0, 40);

    // ── Set response headers for zip download ──────────────────────────────
    const filename = `${projectName}-unity-project.zip`;
    res.setHeader("Content-Type", "application/zip");
    res.setHeader("Content-Disposition", `attachment; filename="${filename}"`);
    res.setHeader("X-Apex-Build", "true");

    // ── Build zip ──────────────────────────────────────────────────────────
    const archive = archiver("zip", { zlib: { level: 9 } });
    archive.on("error", (err) => { throw err; });
    archive.pipe(res);

    // ── 1. Core scripts from disk (with server URL injected) ───────────────
    _addScriptsFromDisk(archive, UNITY_SCRIPTS_DIR, projectName, serverUrl);

    // ── 2. Generated GameConfig.cs (encodes game spec) ────────────────────
    archive.append(_generateGameConfig(spec, serverUrl), {
      name: `${projectName}/Assets/Scripts/Game/GameConfig.cs`,
    });

    // ── 3. Weapons.cs ──────────────────────────────────────────────────────
    archive.append(_generateWeaponsCs(spec), {
      name: `${projectName}/Assets/Scripts/Game/Weapons.cs`,
    });

    // ── 4. Stub scene file ─────────────────────────────────────────────────
    archive.append(_sceneStub(projectName), {
      name: `${projectName}/Assets/Scenes/GameScene.unity`,
    });

    // ── 5. ProjectSettings stub ────────────────────────────────────────────
    archive.append(_projectSettingsYaml(projectName), {
      name: `${projectName}/ProjectSettings/ProjectSettings.asset`,
    });

    // ── 6. Package manifest ────────────────────────────────────────────────
    archive.append(_packageManifest(), {
      name: `${projectName}/Packages/manifest.json`,
    });

    // ── 7. Assembly definition ─────────────────────────────────────────────
    archive.append(_assemblyDef(projectName), {
      name: `${projectName}/Assets/Scripts/Apex.asmdef`,
    });

    // ── 8. README ─────────────────────────────────────────────────────────
    archive.append(_readme(spec, projectName, serverUrl), {
      name: `${projectName}/README.md`,
    });

    // ── 9. .gitignore ──────────────────────────────────────────────────────
    archive.append(_gitignore(), {
      name: `${projectName}/.gitignore`,
    });

    archive.finalize();

  } catch (err) {
    console.error("[GenerateUnityGame] Error:", err);
    if (!res.headersSent) {
      res.status(500).json({ error: "Failed to generate Unity project." });
    }
  }
});

// ── Script injector ────────────────────────────────────────────────────────────

function _addScriptsFromDisk(
  archive: archiver.Archiver,
  scriptsDir: string,
  projectName: string,
  serverUrl: string
) {
  const scriptFolders = ["Networking", "Player", "Game", "UI", "Map", "Mobile"];
  const skipFiles     = ["GameManager.cs"]; // we add a tweaked version below

  for (const folder of scriptFolders) {
    const folderPath = path.join(scriptsDir, folder);
    if (!fs.existsSync(folderPath)) continue;

    const files = fs.readdirSync(folderPath).filter((f) => f.endsWith(".cs"));
    for (const file of files) {
      if (skipFiles.includes(file)) continue;

      let content = fs.readFileSync(path.join(folderPath, file), "utf-8");

      // Inject live server URL into NetworkManager
      if (file === "NetworkManager.cs") {
        content = content.replace(
          /public string serverUrl\s*=\s*"[^"]*";/,
          `public string serverUrl = "${serverUrl}";`
        );
        content = content.replace(
          /public string socketPath\s*=\s*"[^"]*";/,
          `public string socketPath = "/api/socket.io";`
        );
        content = content.replace(
          /public string namespaceName\s*=\s*"[^"]*";/,
          `public string namespaceName = "/ame";`
        );
      }

      archive.append(content, {
        name: `${projectName}/Assets/Scripts/${folder}/${file}`,
      });
    }
  }
}

// ── Code generators ────────────────────────────────────────────────────────────

function _generateGameConfig(spec: Record<string, unknown>, serverUrl: string): string {
  const gameType    = (spec.game_type    as string | undefined)  ?? "fps";
  const theme       = (spec.theme        as string | undefined)  ?? "military";
  const mapSize     = (spec.map_size     as string | undefined)  ?? "medium";
  const mapBiome    = (spec.map_biome    as string | undefined)  ?? "urban";
  const playerCount = (spec.player_count as number | undefined)  ?? 16;
  const ttk         = (spec.ttk          as string | undefined)  ?? "medium";
  const hasBots     = (spec.ai_bots      as boolean | undefined) ?? true;
  const respawn     = (spec.respawn_system as boolean | undefined) ?? true;
  const winCond     = (spec.win_condition as string | undefined) ?? "kill_limit";
  const weapons     = (spec.weapons      as string[] | undefined) ?? ["assault_rifle", "shotgun", "sniper"];
  const vehicles    = (spec.vehicles     as string[] | undefined) ?? [];

  const weaponList  = weapons.map((w, i) => `        [${i}] = "${w}"`).join(",\n");
  const vehicleList = vehicles.length > 0
    ? vehicles.map((v, i) => `        [${i}] = "${v}"`).join(",\n")
    : `        // No vehicles configured`;

  return `// ─── AUTO-GENERATED BY APEX GAME GENERATOR ───────────────────────────────────
// Do NOT edit manually — regenerate via Apex Studio → GameForge → Generate Game
// Generated: ${new Date().toISOString()}
// ─────────────────────────────────────────────────────────────────────────────

using UnityEngine;

namespace Apex.Game
{
    /// <summary>
    /// Game configuration — sourced from your GameForge spec.
    /// Inject into any system via GameConfig.Instance.
    /// </summary>
    public static class GameConfig
    {
        // ── Server ─────────────────────────────────────────────────────────
        public const string SERVER_URL     = "${serverUrl}";
        public const string SOCKET_PATH    = "/api/socket.io";
        public const string NAMESPACE      = "/ame";

        // ── Game Type ──────────────────────────────────────────────────────
        public const string GAME_TYPE      = "${gameType}";
        public const string THEME          = "${theme}";
        public const string WIN_CONDITION  = "${winCond}";

        // ── Map ────────────────────────────────────────────────────────────
        public const string MAP_SIZE       = "${mapSize}";
        public const string MAP_BIOME      = "${mapBiome}";

        // ── Players ────────────────────────────────────────────────────────
        public const int    MAX_PLAYERS    = ${playerCount};
        public const bool   AI_BOTS        = ${hasBots ? "true" : "false"};
        public const bool   RESPAWN        = ${respawn ? "true" : "false"};

        // ── TTK profile ────────────────────────────────────────────────────
        //   fast   = aggressive, high-damage
        //   medium = balanced
        //   slow   = tactical, low-damage
        public const string TTK_PROFILE    = "${ttk}";

        // ── Weapons ────────────────────────────────────────────────────────
        public static readonly string[] WEAPONS = new string[]
        {
${weaponList}
        };

        // ── Vehicles ───────────────────────────────────────────────────────
        public static readonly string[] VEHICLES = new string[]
        {
${vehicleList}
        };

        // ── TTK Damage Multiplier ──────────────────────────────────────────
        public static float DamageMultiplier => TTK_PROFILE switch
        {
            "fast"   => 2.0f,
            "slow"   => 0.6f,
            _        => 1.0f,   // medium
        };

        // ── Map Size → Arena Scale ─────────────────────────────────────────
        public static float ArenaSize => MAP_SIZE switch
        {
            "small"  => 40f,
            "large"  => 120f,
            "huge"   => 240f,
            _        => 70f,    // medium
        };

        // ── Kill Limit ─────────────────────────────────────────────────────
        public static int KillLimit => WIN_CONDITION == "kill_limit"
            ? (MAX_PLAYERS <= 4 ? 10 : MAX_PLAYERS <= 8 ? 20 : 30)
            : 999;

        // ── Match Duration (seconds) ───────────────────────────────────────
        public const float MATCH_DURATION = 600f;
    }
}
`;
}

function _generateWeaponsCs(spec: Record<string, unknown>): string {
  const weapons = (spec.weapons as string[] | undefined) ?? ["assault_rifle", "shotgun", "sniper"];
  const ttk     = (spec.ttk    as string | undefined)    ?? "medium";

  const damageBase = ttk === "fast" ? 35 : ttk === "slow" ? 15 : 25;

  const weaponDefs = weapons.map((w) => {
    const name = w.replace(/_/g, " ").replace(/\b\w/g, (c) => c.toUpperCase());
    const slug = w.replace(/_/g, "").replace(/\b\w/g, (c) => c.toUpperCase());
    const dmg  = w.includes("sniper") ? damageBase * 3
               : w.includes("shotgun") ? damageBase * 1.5
               : w.includes("pistol")  ? damageBase * 0.7
               : damageBase;
    const fr   = w.includes("sniper") ? 1.5 : w.includes("shotgun") ? 0.9 : 0.1;
    const mag  = w.includes("sniper") ? 5   : w.includes("shotgun") ? 8   : 30;

    return `        new WeaponData { Name = "${name}", Slug = "${slug}", Damage = ${Math.round(dmg)}f, FireRate = ${fr.toFixed(1)}f, MagazineSize = ${mag} },`;
  }).join("\n");

  return `// AUTO-GENERATED — Apex Game Generator
using System.Collections.Generic;
using UnityEngine;

namespace Apex.Game
{
    [System.Serializable]
    public struct WeaponData
    {
        public string Name;
        public string Slug;
        public float  Damage;
        public float  FireRate;
        public int    MagazineSize;
    }

    public static class WeaponRegistry
    {
        public static readonly List<WeaponData> All = new List<WeaponData>
        {
${weaponDefs}
        };

        public static WeaponData Get(string slug)
        {
            return All.Find(w => w.Slug.ToLower() == slug.ToLower());
        }
    }
}
`;
}

function _sceneStub(projectName: string): string {
  return `%YAML 1.1
%TAG !u! tag:unity3d.com,2011:
--- !u!29 &1
OcclusionCullingSettings:
  m_ObjectHideFlags: 0
  serializedVersion: 2
  m_OcclusionBakeSettings:
    smallestOccluder: 5
    smallestHole: 0.25
    backfaceThreshold: 100
  m_SceneGUID: 00000000000000000000000000000000
  m_OcclusionCullingData: {fileID: 0}
--- !u!104 &2
RenderSettings:
  m_ObjectHideFlags: 0
  serializedVersion: 9
  m_Fog: 0
  m_FogColor: {r: 0.5, g: 0.5, b: 0.5, a: 1}
  m_FogMode: 3
  m_FogDensity: 0.01
  m_LinearFogStart: 0
  m_LinearFogEnd: 300
  m_AmbientSkyColor: {r: 0.212, g: 0.227, b: 0.259, a: 1}
  m_Sun: {fileID: 0}
# Open this scene in Unity Editor and attach scripts per the README.
# Project: ${projectName}
`;
}

function _projectSettingsYaml(projectName: string): string {
  return `%YAML 1.1
%TAG !u! tag:unity3d.com,2011:
--- !u!129 &1
PlayerSettings:
  m_ObjectHideFlags: 0
  serializedVersion: 23
  productGUID: $(uuidgen 2>/dev/null || echo 00000000000000000000000000000001)
  AndroidProfiler: 0
  AndroidFilterTouchesWhenObscured: 0
  AndroidEnableSustainedPerformanceMode: 0
  defaultScreenOrientation: 4
  targetDevice: 2
  useOnDemandResources: 0
  accelerometerFrequency: 60
  companyName: ApexStudios
  productName: ${projectName}
  defaultCursor: {fileID: 0}
  cursorHotspot: {x: 0, y: 0}
  m_SplashScreenBackgroundColor: {r: 0.13, g: 0.12, b: 0.13, a: 1}
  m_ShowUnitySplashScreen: 1
  m_VirtualRealitySplashScreen: {fileID: 0}
  m_HolographicTrackingLossScreen: {fileID: 0}
  defaultScreenWidth: 1920
  defaultScreenHeight: 1080
  defaultScreenWidthWeb: 960
  defaultScreenHeightWeb: 600
`;
}

function _packageManifest(): string {
  return JSON.stringify({
    dependencies: {
      "com.unity.textmeshpro":                "3.0.6",
      "com.unity.inputsystem":                "1.7.0",
      "com.unity.render-pipelines.universal": "14.0.11",
      "com.unity.cinemachine":                "2.9.7",
      "com.unity.audio.mixer":                "1.0.0",
    },
    scopedRegistries: [
      {
        name: "package.openupm.com",
        url:  "https://package.openupm.com",
        scopes: ["com.itisnajim.socketiounity"],
      },
    ],
  }, null, 2) + "\n// Install SocketIOUnity via: Window → Package Manager → Add from git URL\n// https://github.com/itisnajim/SocketIOUnity.git\n";
}

function _assemblyDef(projectName: string): string {
  return JSON.stringify({
    name:                        "Apex",
    rootNamespace:               "Apex",
    references:                  ["Unity.TextMeshPro", "Unity.InputSystem"],
    includePlatforms:            [],
    excludePlatforms:            [],
    allowUnsafeCode:             false,
    overrideReferences:          false,
    precompiledReferences:       [],
    autoReferenced:              true,
    defineConstraints:           [],
    versionDefines:              [],
    noEngineReferences:          false,
  }, null, 2);
}

function _readme(spec: Record<string, unknown>, projectName: string, serverUrl: string): string {
  const weapons     = (spec.weapons      as string[] | undefined) ?? [];
  const playerCount = (spec.player_count as number | undefined)   ?? 16;
  const mapSize     = (spec.map_size     as string | undefined)   ?? "medium";
  const mode        = (spec.game_type    as string | undefined)   ?? "fps";
  const ttk         = (spec.ttk         as string | undefined)    ?? "medium";

  return `# ${projectName} — Apex Unity FPS Client

> **Generated by Apex Game Generator** on ${new Date().toISOString().split("T")[0]}

## Your Game Spec

| Setting | Value |
|---------|-------|
| Mode | ${mode.toUpperCase()} |
| Players | ${playerCount} |
| Map Size | ${mapSize} |
| TTK | ${ttk} |
| Weapons | ${weapons.join(", ")} |
| Backend | \`${serverUrl}\` |

---

## Quick Start

### 1. Install Unity 2022.3 LTS
Download from [unity.com/download](https://unity.com/download)

### 2. Open the project
File → Open Project → select the \`${projectName}\` folder

### 3. Install SocketIOUnity
Window → Package Manager → **+** → Add package from git URL:
\`\`\`
https://github.com/itisnajim/SocketIOUnity.git
\`\`\`

### 4. Create the GameScene
1. Open \`Assets/Scenes/GameScene.unity\`
2. Create empty GameObjects and attach scripts per the hierarchy below
3. Run play mode — it will auto-connect to your AME backend

---

## Scene Hierarchy

\`\`\`
[NetworkManager]  ← NetworkManager.cs (DontDestroyOnLoad)
[GameManager]     ← GameManager.cs
[MapGenerator]    ← MapGenerator.cs  (auto-builds arena)
Main Camera       ← (replaced by FPS camera at runtime)
Directional Light
Canvas            ← GameUI.cs
  ├─ HealthBar
  ├─ AmmoText
  ├─ TimerText
  ├─ KillfeedContainer
  ├─ DeathScreen
  └─ MatchEndScreen
\`\`\`

---

## Configuration is Pre-Filled

All settings are embedded in \`Assets/Scripts/Game/GameConfig.cs\`:
- Server URL: \`${serverUrl}\`
- Max players: \`${playerCount}\`
- Arena size: based on "${mapSize}" map setting
- Weapons: ${weapons.join(", ")}
- Damage multiplier: matches "${ttk}" TTK profile

---

## Files

\`\`\`
Assets/Scripts/
├─ Networking/NetworkManager.cs   — Socket.IO connection
├─ Player/PlayerController.cs     — WASD + mouse look + jump
├─ Player/GunSystem.cs            — Raycast shoot + reload
├─ Player/PlayerSync.cs           — 20Hz sync + remote spawn
├─ Player/RemotePlayer.cs         — Interpolated remote players
├─ Game/GameManager.cs            — Match lifecycle
├─ Game/GameConfig.cs             — YOUR GAME SETTINGS (auto-generated)
├─ Game/Weapons.cs                — Weapon registry (auto-generated)
├─ UI/GameUI.cs                   — HUD, kill feed, end screen
└─ Map/MapGenerator.cs            — Procedural arena
\`\`\`

---

## Mobile Controls (iOS / Android)

The mobile scripts auto-detect the platform. No code changes needed.

### Mobile Canvas Setup

\`\`\`
MobileCanvas (Canvas - ScreenSpace-Overlay)
+-- [MobileInputManager]   <- MobileInputManager.cs
+-- LeftHalf (RectTransform - anchors 0,0 to 0.45,1)
|   +-- JoystickRoot       <- VirtualJoystick.cs
|       +-- OuterRing (Image, circle, alpha 60%)
|       +-- Knob      (Image, circle, alpha 90%)
+-- RightHalf (RectTransform - anchors 0.35,0 to 1,1)
|   +-- TouchLookZone      <- TouchLook.cs (invisible panel)
+-- HUD                    <- MobileHUD.cs
    +-- FireButton   (Image - bottom right)
    +-- JumpButton   (Image - above Fire)
    +-- ReloadButton (Image - left of Fire)
    +-- HealthBarFill (Image - bottom left, horizontal fill)
    +-- HealthText    (TMP_Text)
    +-- AmmoText      (TMP_Text - top right)
    +-- Crosshair     (Image - center, always on)
\`\`\`

Assign references via Inspector > MobileInputManager:
- moveJoystick  -> JoystickRoot
- touchLook     -> TouchLookZone
- mobileHud     -> HUD

Set mobileControlsRoot -> MobileCanvas. It auto-hides on PC.

---

Built with ❤️ by Apex Studio
`;
}

function _gitignore(): string {
  return `[Ll]ibrary/
[Tt]emp/
[Oo]bj/
[Bb]uild/
[Bb]uilds/
[Ll]ogs/
[Uu]ser[Ss]ettings/
*.pidb.meta
*.pdb.meta
*.mdb.meta
.DS_Store
.vs/
ExportedObj/
*.csproj
*.unityproj
*.sln
*.suo
*.tmp
*.user
*.userprefs
*.pidb
*.booproj
*.svd
*.pdb
*.opendb
*.VC.db
.gradle/
Assets/AssetStoreTools*
Assets/Plugins/Editor/JetBrains*
`;
}

export default router;

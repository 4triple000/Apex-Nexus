/**
 * Unity starter project generated from a game plan.
 * The project builds its level from code when you press Play, so it works in any empty scene
 * without hand-made scene files. Supports keyboard/mouse, controllers and touch (mobile).
 */
import type { GamePlan, Target } from "./plan";

export interface ProjectFile { path: string; content: string }

const cs = (s: string) => s.replace(/\\/g, "\\\\").replace(/"/g, '\\"');

function modeOf(camera: GamePlan["camera"]) {
  return camera === "First person" ? "FirstPerson" : camera === "Third person" ? "ThirdPerson" : camera === "Top-down" ? "TopDown" : "SideView";
}

export function unityProject(name: string, title: string, plan: GamePlan, target: Target, extraScripts: ProjectFile[] = []): ProjectFile[] {
  const mobile = target === "mobile";
  const enemyCount = Math.min(12, Math.max(3, plan.characters.length * 2 + 2));
  const files: ProjectFile[] = [
    { path: `${name}/Packages/manifest.json`, content: JSON.stringify({
      dependencies: {
        "com.unity.inputsystem": "1.11.2",
        "com.unity.ugui": "2.0.0",
        "com.unity.modules.physics": "1.0.0",
        "com.unity.modules.ui": "1.0.0",
        "com.unity.modules.audio": "1.0.0",
        "com.unity.modules.animation": "1.0.0",
        "com.unity.modules.imgui": "1.0.0",
      },
    }, null, 2) },
    { path: `${name}/Assets/Apex/Scripts/Apex.Game.asmdef`, content: JSON.stringify({
      name: "Apex.Game",
      references: ["Unity.InputSystem"],
      optionalUnityReferences: [],
      versionDefines: [],
      autoReferenced: true,
    }, null, 2) },
    { path: `${name}/Assets/Apex/Scripts/GameSettings.cs`, content: `// Values from your Apex game plan. Change them here or in the Inspector on the GameManager.
namespace Apex
{
    public enum CameraMode { FirstPerson, ThirdPerson, TopDown, SideView }

    public static class GameSettings
    {
        public static readonly string Title = "${cs(title)}";
        public static readonly string Genre = "${cs(plan.genre)}";
        public static readonly CameraMode Camera = CameraMode.${modeOf(plan.camera)};
        public static readonly bool Mobile = ${mobile ? "true" : "false"};
        public static readonly int EnemyCount = ${enemyCount};
        public static readonly float PlayerSpeed = 6f;
        public static readonly float JumpHeight = 1.4f;
        public static readonly int PlayerHealth = 100;
        public static readonly string FirstLevel = "${cs(plan.levels[0]?.name ?? "Level 1")}";
        public static readonly string FirstGoal = "${cs(plan.levels[0]?.goal ?? "Defeat every enemy")}";
    }
}
` },
    { path: `${name}/Assets/Apex/Scripts/ApexInput.cs`, content: `using UnityEngine;
#if ENABLE_INPUT_SYSTEM
using UnityEngine.InputSystem;
#endif

namespace Apex
{
    /// Reads keyboard/mouse, controllers and the on-screen touch controls in one place.
    public static class ApexInput
    {
        // Set by TouchControls on phones
        public static Vector2 TouchMove;
        public static Vector2 TouchLook;
        public static bool TouchJump;
        public static bool TouchFire;

        public static Vector2 Move
        {
            get
            {
                Vector2 v = TouchMove;
#if ENABLE_INPUT_SYSTEM
                var k = Keyboard.current;
                if (k != null)
                {
                    v.x += (k.dKey.isPressed ? 1 : 0) - (k.aKey.isPressed ? 1 : 0);
                    v.y += (k.wKey.isPressed ? 1 : 0) - (k.sKey.isPressed ? 1 : 0);
                }
                if (Gamepad.current != null) v += Gamepad.current.leftStick.ReadValue();
#else
                v.x += Input.GetAxisRaw("Horizontal");
                v.y += Input.GetAxisRaw("Vertical");
#endif
                return Vector2.ClampMagnitude(v, 1f);
            }
        }

        public static Vector2 Look
        {
            get
            {
                Vector2 v = TouchLook;
#if ENABLE_INPUT_SYSTEM
                if (Mouse.current != null) v += Mouse.current.delta.ReadValue() * 0.1f;
                if (Gamepad.current != null) v += Gamepad.current.rightStick.ReadValue() * 3f;
#else
                v += new Vector2(Input.GetAxis("Mouse X"), Input.GetAxis("Mouse Y"));
#endif
                return v;
            }
        }

        public static bool Jump
        {
            get
            {
                bool j = TouchJump;
#if ENABLE_INPUT_SYSTEM
                if (Keyboard.current != null) j |= Keyboard.current.spaceKey.wasPressedThisFrame;
                if (Gamepad.current != null) j |= Gamepad.current.buttonSouth.wasPressedThisFrame;
#else
                j |= Input.GetButtonDown("Jump");
#endif
                return j;
            }
        }

        public static bool Fire
        {
            get
            {
                bool f = TouchFire;
#if ENABLE_INPUT_SYSTEM
                if (Mouse.current != null) f |= Mouse.current.leftButton.isPressed;
                if (Gamepad.current != null) f |= Gamepad.current.rightTrigger.isPressed;
#else
                f |= Input.GetButton("Fire1");
#endif
                return f;
            }
        }

        public static Vector2 PointerPosition
        {
            get
            {
#if ENABLE_INPUT_SYSTEM
                return Mouse.current != null ? Mouse.current.position.ReadValue() : new Vector2(Screen.width / 2f, Screen.height / 2f);
#else
                return Input.mousePosition;
#endif
            }
        }
    }
}
` },
    { path: `${name}/Assets/Apex/Scripts/Health.cs`, content: `using UnityEngine;

namespace Apex
{
    public class Health : MonoBehaviour
    {
        public int max = 100;
        public bool Dead => Current <= 0;
        public System.Action OnDeath;

        // Starts full; reads max lazily so it can be set right after AddComponent
        public int Current { get => current ?? max; private set => current = value; }
        int? current;

        public void Damage(int amount)
        {
            if (Dead) return;
            Current = Mathf.Max(0, Current - amount);
            if (Dead) OnDeath?.Invoke();
        }

        public void Heal(int amount) => Current = Mathf.Min(max, Current + amount);
    }
}
` },
    { path: `${name}/Assets/Apex/Scripts/PlayerController.cs`, content: `using UnityEngine;

namespace Apex
{
    /// Moves the player for every camera style in your plan and fires with a simple raycast weapon.
    [RequireComponent(typeof(CharacterController))]
    public class PlayerController : MonoBehaviour
    {
        public float speed = GameSettings.PlayerSpeed;
        public float jumpHeight = GameSettings.JumpHeight;
        public float lookSensitivity = 2f;
        public float fireRate = 8f;
        public int damage = 25;

        CharacterController body;
        Camera cam;
        float yaw, pitch, verticalSpeed, nextShot;

        void Start()
        {
            body = GetComponent<CharacterController>();
            cam = Camera.main;
            if (GameSettings.Camera == CameraMode.FirstPerson && !GameSettings.Mobile)
                Cursor.lockState = CursorLockMode.Locked;
        }

        void Update()
        {
            Vector2 move = ApexInput.Move;
            Vector2 look = ApexInput.Look * lookSensitivity;
            Vector3 dir;

            switch (GameSettings.Camera)
            {
                case CameraMode.FirstPerson:
                case CameraMode.ThirdPerson:
                    yaw += look.x;
                    pitch = Mathf.Clamp(pitch - look.y, -80f, 80f);
                    transform.rotation = Quaternion.Euler(0, yaw, 0);
                    dir = transform.forward * move.y + transform.right * move.x;
                    break;
                case CameraMode.TopDown:
                    dir = new Vector3(move.x, 0, move.y);
                    AimAtPointer();
                    break;
                default: // SideView
                    dir = new Vector3(move.x, 0, 0);
                    if (Mathf.Abs(move.x) > 0.1f) transform.rotation = Quaternion.Euler(0, move.x > 0 ? 90 : -90, 0);
                    break;
            }

            if (body.isGrounded && verticalSpeed < 0) verticalSpeed = -2f;
            if (body.isGrounded && ApexInput.Jump) verticalSpeed = Mathf.Sqrt(jumpHeight * 2f * -Physics.gravity.y);
            verticalSpeed += Physics.gravity.y * Time.deltaTime;

            body.Move((dir * speed + Vector3.up * verticalSpeed) * Time.deltaTime);
            if (GameSettings.Camera == CameraMode.SideView)
                transform.position = new Vector3(transform.position.x, transform.position.y, 0);

            UpdateCamera();
            if (ApexInput.Fire && Time.time >= nextShot) Shoot();
        }

        void AimAtPointer()
        {
            if (cam == null) return;
            Ray ray = cam.ScreenPointToRay(ApexInput.PointerPosition);
            if (new Plane(Vector3.up, transform.position).Raycast(ray, out float d))
            {
                Vector3 p = ray.GetPoint(d);
                p.y = transform.position.y;
                if ((p - transform.position).sqrMagnitude > 0.1f) transform.LookAt(p);
            }
        }

        void UpdateCamera()
        {
            if (cam == null) return;
            Transform c = cam.transform;
            switch (GameSettings.Camera)
            {
                case CameraMode.FirstPerson:
                    c.position = transform.position + Vector3.up * 0.7f;
                    c.rotation = Quaternion.Euler(pitch, yaw, 0);
                    break;
                case CameraMode.ThirdPerson:
                    Quaternion rot = Quaternion.Euler(Mathf.Clamp(pitch + 15f, -20f, 60f), yaw, 0);
                    c.position = transform.position + Vector3.up * 1.6f + rot * new Vector3(0, 0, -5f);
                    c.LookAt(transform.position + Vector3.up * 1.2f);
                    break;
                case CameraMode.TopDown:
                    c.position = transform.position + new Vector3(0, 16f, -8f);
                    c.LookAt(transform.position);
                    break;
                default:
                    c.position = transform.position + new Vector3(0, 2f, -14f);
                    c.rotation = Quaternion.Euler(5, 0, 0);
                    break;
            }
        }

        void Shoot()
        {
            nextShot = Time.time + 1f / fireRate;
            Vector3 origin, forward;
            if (GameSettings.Camera == CameraMode.FirstPerson || GameSettings.Camera == CameraMode.ThirdPerson)
            {
                origin = cam.transform.position;
                forward = cam.transform.forward;
            }
            else
            {
                origin = transform.position + Vector3.up * 0.5f;
                forward = transform.forward;
            }
            if (Physics.Raycast(origin, forward, out RaycastHit hit, 100f))
            {
                var h = hit.collider.GetComponentInParent<Health>();
                if (h != null && h.gameObject != gameObject) h.Damage(damage);
            }
            Debug.DrawRay(origin, forward * 100f, Color.cyan, 0.1f);
        }
    }
}
` },
    { path: `${name}/Assets/Apex/Scripts/EnemyAI.cs`, content: `using UnityEngine;

namespace Apex
{
    /// Walks toward the player and hurts them on contact. Swap in NavMeshAgent for smarter paths.
    [RequireComponent(typeof(CharacterController), typeof(Health))]
    public class EnemyAI : MonoBehaviour
    {
        public float speed = 3f;
        public float attackRange = 1.6f;
        public int attackDamage = 10;
        public float attackCooldown = 1f;

        Transform player;
        CharacterController body;
        float nextAttack, verticalSpeed;

        void Start()
        {
            body = GetComponent<CharacterController>();
            var p = FindFirstObjectByType<PlayerController>();
            if (p != null) player = p.transform;
            GetComponent<Health>().OnDeath += () => { GameManager.Instance?.EnemyDefeated(); Destroy(gameObject); };
        }

        void Update()
        {
            if (player == null) return;
            Vector3 to = player.position - transform.position;
            to.y = 0;
            float dist = to.magnitude;
            verticalSpeed = body.isGrounded ? -2f : verticalSpeed + Physics.gravity.y * Time.deltaTime;

            if (dist > attackRange)
            {
                Vector3 step = to.normalized * speed;
                body.Move((step + Vector3.up * verticalSpeed) * Time.deltaTime);
            }
            else if (Time.time >= nextAttack)
            {
                nextAttack = Time.time + attackCooldown;
                player.GetComponent<Health>()?.Damage(attackDamage);
            }
            if (to.sqrMagnitude > 0.01f) transform.rotation = Quaternion.LookRotation(to);
        }
    }
}
` },
    { path: `${name}/Assets/Apex/Scripts/GameManager.cs`, content: `using UnityEngine;

namespace Apex
{
    /// Tracks the goal of the level and shows a simple on-screen status.
    public class GameManager : MonoBehaviour
    {
        public static GameManager Instance { get; private set; }
        public int enemiesLeft;
        Health playerHealth;
        bool over;
        string message = "";

        void Awake() => Instance = this;

        public void Init(Health player, int enemies)
        {
            playerHealth = player;
            enemiesLeft = enemies;
            playerHealth.OnDeath += () => End("You were defeated. Press R to retry.");
        }

        public void EnemyDefeated()
        {
            enemiesLeft--;
            if (enemiesLeft <= 0) End("Level complete!");
        }

        void End(string text)
        {
            if (over) return;
            over = true;
            message = text;
            Cursor.lockState = CursorLockMode.None;
        }

        void Update()
        {
#if ENABLE_INPUT_SYSTEM
            bool retry = UnityEngine.InputSystem.Keyboard.current != null && UnityEngine.InputSystem.Keyboard.current.rKey.wasPressedThisFrame;
#else
            bool retry = Input.GetKeyDown(KeyCode.R);
#endif
            if (over && retry) UnityEngine.SceneManagement.SceneManager.LoadScene(UnityEngine.SceneManagement.SceneManager.GetActiveScene().buildIndex);
        }

        void OnGUI()
        {
            var style = new GUIStyle(GUI.skin.label) { fontSize = 22, fontStyle = FontStyle.Bold };
            style.normal.textColor = Color.white;
            GUI.Label(new Rect(20, 16, 900, 32), $"{GameSettings.Title} · {GameSettings.FirstLevel}", style);
            style.fontSize = 18;
            GUI.Label(new Rect(20, 48, 900, 28), $"Goal: {GameSettings.FirstGoal}   Enemies left: {enemiesLeft}   Health: {(playerHealth ? playerHealth.Current : 0)}", style);
            if (over)
            {
                style.fontSize = 34;
                style.alignment = TextAnchor.MiddleCenter;
                GUI.Label(new Rect(0, Screen.height / 2f - 40, Screen.width, 80), message, style);
            }
        }
    }
}
` },
    { path: `${name}/Assets/Apex/Scripts/LevelBuilder.cs`, content: `using UnityEngine;

namespace Apex
{
    /// Builds a playable level when you press Play: ground, cover, light, camera, player and enemies.
    /// Replace these blocks with your own art as the game grows. Delete this script once you build levels by hand.
    public static class LevelBuilder
    {
        [RuntimeInitializeOnLoadMethod(RuntimeInitializeLoadType.AfterSceneLoad)]
        static void Build()
        {
            if (Object.FindFirstObjectByType<PlayerController>() != null) return; // the scene already has a player

            bool side = GameSettings.Camera == CameraMode.SideView;
            var ground = GameObject.CreatePrimitive(PrimitiveType.Cube);
            ground.name = "Ground";
            ground.transform.localScale = side ? new Vector3(120, 1, 6) : new Vector3(80, 1, 80);
            ground.transform.position = new Vector3(0, -0.5f, 0);
            Tint(ground, new Color(0.12f, 0.11f, 0.22f));

            var rng = new System.Random(7);
            for (int i = 0; i < 14; i++)
            {
                var block = GameObject.CreatePrimitive(PrimitiveType.Cube);
                block.name = side ? "Platform" : "Cover";
                if (side) { block.transform.localScale = new Vector3(4, 0.6f, 4); block.transform.position = new Vector3(-40 + i * 6, 1.5f + (i % 4) * 1.4f, 0); }
                else { block.transform.localScale = new Vector3(2 + rng.Next(4), 1 + rng.Next(3), 2 + rng.Next(4)); block.transform.position = new Vector3(rng.Next(-30, 30), block.transform.localScale.y / 2f, rng.Next(-30, 30)); }
                Tint(block, new Color(0.3f, 0.25f, 0.6f));
            }

            if (Object.FindFirstObjectByType<Light>() == null)
            {
                var sun = new GameObject("Sun").AddComponent<Light>();
                sun.type = LightType.Directional;
                sun.transform.rotation = Quaternion.Euler(50, -30, 0);
                sun.intensity = 1.1f;
            }
            if (Camera.main == null)
            {
                var camGo = new GameObject("Main Camera") { tag = "MainCamera" };
                camGo.AddComponent<Camera>();
                camGo.AddComponent<AudioListener>();
            }

            var player = GameObject.CreatePrimitive(PrimitiveType.Capsule);
            player.name = "Player";
            player.transform.position = side ? new Vector3(-44, 1, 0) : new Vector3(0, 1, -20);
            Object.DestroyImmediate(player.GetComponent<Collider>());
            var cc = player.AddComponent<CharacterController>();
            cc.height = 2f; cc.radius = 0.4f;
            var hp = player.AddComponent<Health>();
            hp.max = GameSettings.PlayerHealth;
            player.AddComponent<PlayerController>();
            Tint(player, new Color(0.3f, 0.9f, 0.55f));

            for (int i = 0; i < GameSettings.EnemyCount; i++)
            {
                var e = GameObject.CreatePrimitive(PrimitiveType.Capsule);
                e.name = "Enemy " + (i + 1);
                e.transform.position = side ? new Vector3(-20 + i * 8, 1, 0) : new Vector3(rng.Next(-30, 30), 1, rng.Next(0, 30));
                Object.DestroyImmediate(e.GetComponent<Collider>());
                e.AddComponent<CharacterController>();
                e.AddComponent<Health>().max = 50;
                e.AddComponent<EnemyAI>();
                Tint(e, new Color(1f, 0.3f, 0.6f));
            }

            var gm = new GameObject("GameManager").AddComponent<GameManager>();
            gm.Init(hp, GameSettings.EnemyCount);
            if (GameSettings.Mobile) new GameObject("TouchControls").AddComponent<TouchControls>();
        }

        static void Tint(GameObject go, Color c)
        {
            var r = go.GetComponent<Renderer>();
            if (r != null) r.material.color = c;
        }
    }
}
` },
    { path: `${name}/Assets/Apex/Scripts/TouchControls.cs`, content: `using System.Collections.Generic;
using UnityEngine;
#if ENABLE_INPUT_SYSTEM
using UnityEngine.InputSystem;
#endif

namespace Apex
{
    /// On-screen controls for phones: left half is a joystick, right half drags to look,
    /// with Jump and Fire buttons in the bottom-right.
    public class TouchControls : MonoBehaviour
    {
        struct Finger { public int id; public Vector2 pos; public bool began, ended; }

        int moveId = -1, lookId = -1;
        Vector2 moveStart, lastLook;
        readonly List<Finger> fingers = new List<Finger>();

        void ReadFingers()
        {
            fingers.Clear();
#if ENABLE_INPUT_SYSTEM
            var screen = Touchscreen.current;
            if (screen == null) return;
            foreach (var t in screen.touches)
            {
                var phase = t.phase.ReadValue();
                if (phase == UnityEngine.InputSystem.TouchPhase.None) continue;
                fingers.Add(new Finger {
                    id = t.touchId.ReadValue(), pos = t.position.ReadValue(),
                    began = phase == UnityEngine.InputSystem.TouchPhase.Began,
                    ended = phase == UnityEngine.InputSystem.TouchPhase.Ended || phase == UnityEngine.InputSystem.TouchPhase.Canceled,
                });
            }
#else
            for (int i = 0; i < Input.touchCount; i++)
            {
                Touch t = Input.GetTouch(i);
                fingers.Add(new Finger {
                    id = t.fingerId, pos = t.position,
                    began = t.phase == UnityEngine.TouchPhase.Began,
                    ended = t.phase == UnityEngine.TouchPhase.Ended || t.phase == UnityEngine.TouchPhase.Canceled,
                });
            }
#endif
        }

        void Update()
        {
            ApexInput.TouchMove = Vector2.zero;
            ApexInput.TouchLook = Vector2.zero;
            ApexInput.TouchJump = false;
            ApexInput.TouchFire = false;
            ReadFingers();

            foreach (var f in fingers)
            {
                if (f.began)
                {
                    if (JumpRect().Contains(f.pos)) { ApexInput.TouchJump = true; continue; }
                    if (f.pos.x < Screen.width / 2f && moveId < 0) { moveId = f.id; moveStart = f.pos; }
                    else if (lookId < 0 && !FireRect().Contains(f.pos)) { lookId = f.id; lastLook = f.pos; }
                }
                if (FireRect().Contains(f.pos) && !f.ended) ApexInput.TouchFire = true;
                if (f.id == moveId) ApexInput.TouchMove = Vector2.ClampMagnitude((f.pos - moveStart) / (Screen.height * 0.12f), 1f);
                if (f.id == lookId) { ApexInput.TouchLook = (f.pos - lastLook) * 0.15f; lastLook = f.pos; }
                if (f.ended)
                {
                    if (f.id == moveId) moveId = -1;
                    if (f.id == lookId) lookId = -1;
                }
            }
        }

        Rect FireRect() { float s = Screen.height * 0.16f; return new Rect(Screen.width - s * 1.3f, s * 0.3f, s, s); }
        Rect JumpRect() { float s = Screen.height * 0.12f; return new Rect(Screen.width - s * 2.9f, s * 0.3f, s, s); }

        void OnGUI()
        {
            // GUI uses a top-left origin; convert from screen space
            var fire = FireRect(); var jump = JumpRect();
            GUI.Box(new Rect(fire.x, Screen.height - fire.yMax, fire.width, fire.height), "FIRE");
            GUI.Box(new Rect(jump.x, Screen.height - jump.yMax, jump.width, jump.height), "JUMP");
        }
    }
}
` },
    { path: `${name}/.gitignore`, content: `[Ll]ibrary/\n[Tt]emp/\n[Oo]bj/\n[Bb]uild/\n[Bb]uilds/\n[Ll]ogs/\n[Uu]ser[Ss]ettings/\n*.csproj\n*.sln\n.vs/\n.idea/\n` },
    { path: `${name}/README.md`, content: unityReadme(name, title, plan, target) },
    { path: `${name}/GAME_PLAN.md`, content: planMarkdown(title, plan) },
    ...extraScripts,
  ];
  return files;
}

function unityReadme(name: string, title: string, plan: GamePlan, target: Target) {
  const mobile = target === "mobile";
  return `# ${title} — Unity starter project

Made with the Apex Engine. Your game plan is in GAME_PLAN.md.

## Open it
1. Install **Unity Hub** (free) from unity.com/download, then install **Unity 6** from the Hub.${mobile ? `
   When installing, add **Android Build Support** and/or **iOS Build Support**.` : ""}
2. Unzip this folder.
3. In Unity Hub choose **Add → Add project from disk** and pick the \`${name}\` folder.
4. Open the project. If Unity asks about the new Input System, choose **Yes** (it restarts once).
5. Create or open any scene (File → New Scene → Basic) and press **Play**.
   The level, player and ${plan.characters.length > 1 ? "enemies" : "enemy"} are built for you from code (see \`Assets/Apex/Scripts/LevelBuilder.cs\`).

## Controls
${plan.controls.map((c) => `- ${c}`).join("\n")}
${mobile ? `
## Put it on your phone
- **Android:** File → Build Profiles → Android → Switch Platform, plug in your phone with USB debugging on, then **Build And Run**.
- **iPhone:** File → Build Profiles → iOS → Switch Platform → Build. Open the generated Xcode project on a Mac and run it on your iPhone.
` : ""}
## What's inside
- \`GameSettings.cs\` — values from your plan (camera style, enemy count, speed).
- \`PlayerController.cs\` — movement, jumping, camera and a raycast weapon for your camera style (${plan.camera}).
- \`EnemyAI.cs\` — enemies that chase and attack.
- \`GameManager.cs\` — the level goal, win/lose, and a simple on-screen status.
- \`LevelBuilder.cs\` — builds a test level when you press Play.${mobile ? "\n- `TouchControls.cs` — on-screen joystick, look, jump and fire for phones." : ""}

## Next steps
- Replace the capsules and cubes with real models (Unity Asset Store has free packs).
- Build your first level by hand, then delete \`LevelBuilder.cs\`.
- Back in Apex, keep refining the plan with the AI helper and download an updated project any time.
`;
}

export function planMarkdown(title: string, plan: GamePlan) {
  return `# ${title}

**Genre:** ${plan.genre}
**Camera:** ${plan.camera}
**Platforms:** ${plan.platforms.join(", ")}

## Pitch
${plan.pitch}

## Core loop
${plan.coreLoop}

## Controls
${plan.controls.map((c) => `- ${c}`).join("\n")}

## Mechanics
${plan.mechanics.map((m) => `- ${m}`).join("\n")}

## Levels
${plan.levels.map((l) => `- **${l.name}:** ${l.goal}`).join("\n")}

## Characters
${plan.characters.map((c) => `- **${c.name}:** ${c.role}`).join("\n")}

## Art style
${plan.artStyle}

## Audio
${plan.audio}

## Checklist
${plan.checklist.map((c) => `- [${c.done ? "x" : " "}] ${c.label}`).join("\n")}
`;
}

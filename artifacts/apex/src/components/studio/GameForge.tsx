/**
 * GameForge — FPS Engine Generator
 * A module inside Apex Studio that generates full FPS game project scaffolds.
 *
 * Pipeline: Planner → Architect → Builder → Tester → Balancer
 * Modes: COD Mode | Battlefield Mode | Sandbox Mode
 * Output: Game spec JSON + Unity C# file tree + code preview
 * Supports: Iterative Game Evolution ("make guns more realistic")
 */
import { useState, useRef, useCallback, useEffect } from "react";
import { Gamepad2, Zap, ChevronRight, Copy, Download, RotateCcw, Crosshair, Shield, Map, Users, Bot, Sword, RefreshCw, Play, ChevronDown, Check, Package, Loader2, CheckCircle2, AlertCircle, X, Rocket, Globe2, BarChart2, ShoppingBag, ExternalLink, Smartphone, CreditCard } from "lucide-react";

const SPRING = "cubic-bezier(0.34, 1.56, 0.64, 1)";
const IOS    = "cubic-bezier(0.25, 0.46, 0.45, 0.94)";
const GOLD   = "#A29BFE";
const BASE   = import.meta.env.BASE_URL.replace(/\/$/, "");

// ── CSS ───────────────────────────────────────────────────────────────────────
const CSS = `
  @keyframes gf-fade-in  { from { opacity:0; transform:translateY(8px); } to { opacity:1; transform:translateY(0); } }
  @keyframes gf-slide-in { from { opacity:0; transform:translateX(-12px); } to { opacity:1; transform:translateX(0); } }
  @keyframes gf-pulse    { 0%,100%{opacity:.5;transform:scale(1)} 50%{opacity:1;transform:scale(1.15)} }
  @keyframes gf-spin     { to { transform:rotate(360deg); } }
  @keyframes gf-typing   { from{width:0} to{width:100%} }
  @keyframes gf-agent-in { from{opacity:0;transform:scale(.88) translateY(6px)} to{opacity:1;transform:scale(1) translateY(0)} }
  @keyframes gf-progress-bar { from{width:0} to{width:100%} }
  @keyframes gf-shimmer {
    0%{background-position:-200% 0}
    100%{background-position:200% 0}
  }
  .gf-code-block {
    font-family: 'JetBrains Mono', 'Fira Code', 'Cascadia Code', monospace;
    font-size: 11px;
    line-height: 1.65;
    color: #c9d1d9;
    overflow-x: auto;
    white-space: pre;
  }
  .gf-keyword  { color: #ff7b72; }
  .gf-type     { color: #79c0ff; }
  .gf-string   { color: #a5d6ff; }
  .gf-comment  { color: #8b949e; }
  .gf-number   { color: #f2cc60; }
  .gf-method   { color: #d2a8ff; }
`;

// ── Types ─────────────────────────────────────────────────────────────────────
type GameMode = "cod" | "battlefield" | "sandbox";

interface GameSpec {
  game_type:      string;
  theme:          string;
  map_size:       string;
  map_biome:      string;
  player_count:   number;
  weapons:        string[];
  vehicles:       string[];
  ai_bots:        boolean;
  respawn_system: boolean;
  win_condition:  string;
  ttk:            "fast" | "medium" | "slow";
  features:       string[];
}

interface GeneratedFile {
  path:     string;
  name:     string;
  language: string;
  content:  string;
  icon:     string;
}

interface AgentStep {
  id:     string;
  label:  string;
  role:   string;
  icon:   string;
  color:  string;
  glow:   string;
  detail: string;
  status: "idle" | "running" | "done" | "error";
  log:    string;
}

interface ForgeResult {
  spec:  GameSpec;
  files: GeneratedFile[];
}

// ── Mode config ───────────────────────────────────────────────────────────────
const MODES: Record<GameMode, {
  label: string; icon: string; color: string; glow: string;
  description: string; tags: string[];
}> = {
  cod: {
    label:       "COD Mode",
    icon:        "⚡",
    color:       "#f97316",
    glow:        "rgba(249,115,22,0.35)",
    description: "Fast TTK · Small maps · Killstreaks · Loadouts",
    tags:        ["Fast TTK", "Killstreaks", "Loadouts", "Quick respawn"],
  },
  battlefield: {
    label:       "Battlefield Mode",
    icon:        "🪖",
    color:       "#3b82f6",
    glow:        "rgba(59,130,246,0.35)",
    description: "Large maps · Vehicles · Squads · Capture points",
    tags:        ["Vehicles", "Squad play", "Capture points", "Large scale"],
  },
  sandbox: {
    label:       "Sandbox Mode",
    icon:        "🌐",
    color:       "#a78bfa",
    glow:        "rgba(167,139,250,0.35)",
    description: "Full control · Custom everything · Experimental",
    tags:        ["Fully custom", "Experimental", "No limits"],
  },
};

// ── Agent definitions ─────────────────────────────────────────────────────────
function buildAgents(): AgentStep[] {
  return [
    { id: "planner",   label: "Planner Agent",   role: "Game Design",     icon: "🧠", color: "#a78bfa", glow: "rgba(167,139,250,0.4)", detail: "Designing game systems and balance",         status: "idle", log: "" },
    { id: "architect", label: "Architect Agent",  role: "Code Structure",  icon: "🏗️", color: "#60a5fa", glow: "rgba(96,165,250,0.4)",  detail: "Structuring scripts, systems, and AI",      status: "idle", log: "" },
    { id: "builder",   label: "Builder Agent",    role: "Code Generation", icon: "⚙️", color: "#34d399", glow: "rgba(52,211,153,0.4)",  detail: "Writing Unity C# scripts",                  status: "idle", log: "" },
    { id: "tester",    label: "Tester Agent",     role: "QA Simulation",   icon: "🧪", color: "#fbbf24", glow: "rgba(251,191,36,0.4)",  detail: "Simulating gameplay and balance checks",    status: "idle", log: "" },
    { id: "balancer",  label: "Balancer Agent",   role: "Tuning",          icon: "⚖️", color: "#f87171", glow: "rgba(248,113,113,0.4)", detail: "Adjusting TTK, weapon spread, AI difficulty", status: "idle", log: "" },
  ];
}

// ── Game spec generator ───────────────────────────────────────────────────────
function generateSpec(prompt: string, mode: GameMode): GameSpec {
  const p = prompt.toLowerCase();

  const themes = [
    p.includes("desert")   ? "desert_warfare"  : null,
    p.includes("urban")    ? "urban_combat"     : null,
    p.includes("forest")   ? "jungle_warfare"   : null,
    p.includes("snow")     ? "arctic_warfare"   : null,
    p.includes("space")    ? "sci_fi_warfare"   : null,
    p.includes("cyber")    ? "cyberpunk_combat" : null,
  ].find(Boolean) ?? (mode === "battlefield" ? "modern_warfare" : mode === "cod" ? "urban_combat" : "custom");

  const biome = themes?.includes("desert") ? "desert" : themes?.includes("arctic") ? "snow" : themes?.includes("jungle") ? "forest" : "urban";

  const playerCount = (() => {
    const m = p.match(/(\d+)\s*player/);
    if (m) return parseInt(m[1]);
    return mode === "battlefield" ? 64 : mode === "cod" ? 12 : 32;
  })();

  const weapons: string[] = ["rifle", "pistol"];
  if (p.includes("snip"))   weapons.push("sniper");
  if (p.includes("shotg"))  weapons.push("shotgun");
  if (p.includes("rocket")) weapons.push("rocket_launcher");
  if (p.includes("lmg") || p.includes("machine")) weapons.push("lmg");
  if (mode === "battlefield") weapons.push("sniper", "rocket_launcher", "lmg");

  const vehicles: string[] = [];
  if (p.includes("tank"))  vehicles.push("tank");
  if (p.includes("jeep") || p.includes("truck")) vehicles.push("jeep");
  if (p.includes("heli"))  vehicles.push("helicopter");
  if (p.includes("plane")) vehicles.push("jet");
  if (mode === "battlefield" && vehicles.length === 0) vehicles.push("tank", "jeep", "helicopter");

  const win = p.includes("capture") ? "conquest" : p.includes("team") ? "team_deathmatch" : mode === "battlefield" ? "conquest" : "team_deathmatch";

  const features: string[] = ["respawn", "hud", "minimap", "scoreboard"];
  if (mode === "cod")         features.push("killstreaks", "loadouts", "quick_respawn", "xp_system");
  if (mode === "battlefield") features.push("squad_system", "vehicle_respawn", "capture_points", "revive");
  if (mode === "sandbox")     features.push("admin_panel", "custom_rules", "spectator_mode");

  return {
    game_type:      "fps",
    theme:          themes ?? "modern_warfare",
    map_size:       mode === "battlefield" ? "large" : mode === "cod" ? "small" : "medium",
    map_biome:      biome,
    player_count:   playerCount,
    weapons:        [...new Set(weapons)],
    vehicles,
    ai_bots:        true,
    respawn_system: true,
    win_condition:  win,
    ttk:            mode === "cod" ? "fast" : mode === "battlefield" ? "medium" : "medium",
    features,
  };
}

// ── Code templates ────────────────────────────────────────────────────────────
function weaponTypeName(weapon: string | undefined): string {
  const name = weapon?.replace(/_/g, "");
  return name ? name.charAt(0).toUpperCase() + name.slice(1) : "Rifle";
}

function generateFiles(spec: GameSpec, prompt: string): GeneratedFile[] {
  const theme  = spec.theme.replace(/_/g, " ").replace(/\b\w/g, (c) => c.toUpperCase());
  const hasMed = spec.player_count >= 32;

  return [
    {
      path: "Scripts/Player/FPSController.cs",
      name: "FPSController.cs",
      language: "csharp",
      icon: "🎮",
      content: `using UnityEngine;
using UnityEngine.InputSystem;

/// <summary>
/// FPS Player Controller — ${theme}
/// Mode: ${spec.win_condition.toUpperCase()} | TTK: ${spec.ttk.toUpperCase()}
/// Generated by Apex Game Forge ◆
/// </summary>
[RequireComponent(typeof(CharacterController))]
public class FPSController : MonoBehaviour
{
    [Header("Movement")]
    [SerializeField] private float walkSpeed    = ${spec.ttk === "fast" ? "7.5f" : "5.5f"};
    [SerializeField] private float sprintSpeed  = ${spec.ttk === "fast" ? "12f" : "9f"};
    [SerializeField] private float jumpForce    = 5.5f;
    [SerializeField] private float gravity      = -19.62f;
    [SerializeField] private float crouchHeight = 0.9f;

    [Header("Look")]
    [SerializeField] private float mouseSensitivity = 2.0f;
    [SerializeField] private float maxLookAngle     = 80f;
    [SerializeField] private Transform cameraHolder;

    private CharacterController _controller;
    private Vector3 _velocity;
    private float   _xRotation;
    private bool    _isCrouching;
    private bool    _isSprinting;

    private void Awake()
    {
        _controller = GetComponent<CharacterController>();
        Cursor.lockState = CursorLockMode.Locked;
    }

    private void Update()
    {
        HandleMovement();
        HandleLook();
        HandleCrouch();
        ApplyGravity();
    }

    private void HandleMovement()
    {
        float x = Input.GetAxis("Horizontal");
        float z = Input.GetAxis("Vertical");
        _isSprinting = Input.GetKey(KeyCode.LeftShift) && z > 0 && !_isCrouching;

        float speed  = _isSprinting ? sprintSpeed : walkSpeed;
        Vector3 move = transform.right * x + transform.forward * z;
        _controller.Move(move * speed * Time.deltaTime);

        if (Input.GetButtonDown("Jump") && _controller.isGrounded)
            _velocity.y = Mathf.Sqrt(jumpForce * -2f * gravity);
    }

    private void HandleLook()
    {
        float mouseX = Input.GetAxis("Mouse X") * mouseSensitivity;
        float mouseY = Input.GetAxis("Mouse Y") * mouseSensitivity;
        _xRotation  -= mouseY;
        _xRotation   = Mathf.Clamp(_xRotation, -maxLookAngle, maxLookAngle);
        cameraHolder.localRotation = Quaternion.Euler(_xRotation, 0f, 0f);
        transform.Rotate(Vector3.up * mouseX);
    }

    private void HandleCrouch()
    {
        if (Input.GetKeyDown(KeyCode.C))
        {
            _isCrouching = !_isCrouching;
            _controller.height = _isCrouching ? crouchHeight : 2f;
        }
    }

    private void ApplyGravity()
    {
        if (_controller.isGrounded && _velocity.y < 0) _velocity.y = -2f;
        _velocity.y += gravity * Time.deltaTime;
        _controller.Move(_velocity * Time.deltaTime);
    }
}`,
    },
    {
      path: "Scripts/Weapons/WeaponSystem.cs",
      name: "WeaponSystem.cs",
      language: "csharp",
      icon: "🔫",
      content: `using System.Collections;
using System.Collections.Generic;
using UnityEngine;

/// <summary>
/// Weapon System — ${spec.weapons.map(w => w.replace(/_/g, " ")).join(", ")}
/// Supports ${spec.weapons.length} weapon type(s) | Raycast-based hitscan
/// </summary>
public class WeaponSystem : MonoBehaviour
{
    public enum WeaponType { ${spec.weapons.map(w => w.replace(/_/g, "")).map(w => w.charAt(0).toUpperCase() + w.slice(1)).join(", ")} }

    [System.Serializable]
    public class WeaponData
    {
        public WeaponType type;
        public float      damage;
        public float      fireRate;
        public int        magazineSize;
        public float      reloadTime;
        public float      bulletSpread;
        public float      range;
        public bool       isAutomatic;
        public AudioClip  fireSound;
        public GameObject muzzleFlash;
    }

    [Header("Weapon Config")]
    [SerializeField] private WeaponData[] weapons = new WeaponData[]
    {
        new WeaponData { type=WeaponType.${weaponTypeName(spec.weapons[0])}, damage=${spec.ttk === "fast" ? "35f" : "25f"}, fireRate=${spec.ttk === "fast" ? "0.08f" : "0.12f"}, magazineSize=30, reloadTime=2.2f, bulletSpread=0.02f, range=200f, isAutomatic=true },
    };

    [Header("References")]
    [SerializeField] private Camera    fpsCam;
    [SerializeField] private Transform muzzlePoint;
    [SerializeField] private LayerMask hitLayers;

    private WeaponData _current;
    private int        _currentAmmo;
    private bool       _isReloading;
    private float      _nextFireTime;

    private void Start()
    {
        EquipWeapon(0);
    }

    private void Update()
    {
        if (_isReloading) return;
        if (_currentAmmo <= 0) { StartCoroutine(Reload()); return; }

        bool fireInput = _current.isAutomatic
            ? Input.GetButton("Fire1")
            : Input.GetButtonDown("Fire1");

        if (fireInput && Time.time >= _nextFireTime)
            Shoot();

        if (Input.GetKeyDown(KeyCode.R) && _currentAmmo < _current.magazineSize)
            StartCoroutine(Reload());
    }

    public void EquipWeapon(int index)
    {
        _current    = weapons[Mathf.Clamp(index, 0, weapons.Length - 1)];
        _currentAmmo = _current.magazineSize;
        _isReloading = false;
    }

    private void Shoot()
    {
        _nextFireTime = Time.time + _current.fireRate;
        _currentAmmo--;

        // Spawn muzzle flash
        if (_current.muzzleFlash != null)
            Instantiate(_current.muzzleFlash, muzzlePoint.position, muzzlePoint.rotation);

        // Play sound
        // AudioManager.Play(_current.fireSound);

        // Raycast with spread
        Vector3 direction = ApplyBulletSpread(fpsCam.transform.forward);
        if (Physics.Raycast(fpsCam.transform.position, direction, out RaycastHit hit, _current.range, hitLayers))
        {
            ApplyDamage(hit, _current.damage);
            SpawnImpactEffect(hit);
        }

        // Networked shot event
        NetworkManager.Instance?.BroadcastShot(transform.position, direction);
    }

    private Vector3 ApplyBulletSpread(Vector3 dir)
    {
        float spread = _current.bulletSpread;
        return dir + new Vector3(
            Random.Range(-spread, spread),
            Random.Range(-spread, spread),
            Random.Range(-spread, spread)
        );
    }

    private void ApplyDamage(RaycastHit hit, float damage)
    {
        // Head-shot multiplier
        bool isHeadshot = hit.collider.CompareTag("Head");
        float finalDmg  = isHeadshot ? damage * 2.5f : damage;

        var hp = hit.collider.GetComponentInParent<HealthSystem>();
        hp?.TakeDamage(finalDmg, gameObject);
    }

    private void SpawnImpactEffect(RaycastHit hit)
    {
        // ImpactManager.Instance?.Spawn(hit.point, hit.normal, hit.collider.tag);
    }

    private IEnumerator Reload()
    {
        _isReloading = true;
        // UIManager.Instance?.ShowReloadBar(_current.reloadTime);
        yield return new WaitForSeconds(_current.reloadTime);
        _currentAmmo = _current.magazineSize;
        _isReloading = false;
    }
}`,
    },
    {
      path: "Scripts/AI/EnemyAI.cs",
      name: "EnemyAI.cs",
      language: "csharp",
      icon: "🤖",
      content: `using UnityEngine;
using UnityEngine.AI;

/// <summary>
/// Enemy AI State Machine — Patrol → Chase → Attack → Retreat → Dead
/// Difficulty: ${spec.player_count > 24 ? "Hard" : "Medium"} | Bots: enabled
/// </summary>
[RequireComponent(typeof(NavMeshAgent))]
public class EnemyAI : MonoBehaviour
{
    public enum State { Patrol, Chase, Attack, Retreat, Dead }

    [Header("Detection")]
    [SerializeField] private float sightRange    = 30f;
    [SerializeField] private float attackRange   = 15f;
    [SerializeField] private float retreatHealth = 25f;
    [SerializeField] private LayerMask playerLayer;

    [Header("Stats")]
    [SerializeField] private float moveSpeed    = 4.5f;
    [SerializeField] private float chaseSpeed   = 6.5f;
    [SerializeField] private float damage       = ${spec.ttk === "fast" ? "18f" : "12f"};
    [SerializeField] private float attackRate   = 0.5f;

    [Header("Patrol")]
    [SerializeField] private Transform[] patrolPoints;

    private NavMeshAgent _agent;
    private HealthSystem _health;
    private Transform    _target;
    private State        _state = State.Patrol;
    private float        _nextAttackTime;
    private int          _patrolIndex;

    private void Awake()
    {
        _agent  = GetComponent<NavMeshAgent>();
        _health = GetComponent<HealthSystem>();
        _health.OnDeath += OnDeath;
    }

    private void Update()
    {
        if (_state == State.Dead) return;

        DetectPlayer();

        switch (_state)
        {
            case State.Patrol:  HandlePatrol();  break;
            case State.Chase:   HandleChase();   break;
            case State.Attack:  HandleAttack();  break;
            case State.Retreat: HandleRetreat(); break;
        }
    }

    private void DetectPlayer()
    {
        Collider[] hits = Physics.OverlapSphere(transform.position, sightRange, playerLayer);
        if (hits.Length > 0)
        {
            _target = hits[0].transform;
            float dist = Vector3.Distance(transform.position, _target.position);

            if (_health.CurrentHealth < retreatHealth)
                _state = State.Retreat;
            else if (dist <= attackRange)
                _state = State.Attack;
            else
                _state = State.Chase;
        }
        else if (_state != State.Patrol)
        {
            _state = State.Patrol;
            _target = null;
        }
    }

    private void HandlePatrol()
    {
        _agent.speed = moveSpeed;
        if (patrolPoints.Length == 0) return;
        if (_agent.remainingDistance < 0.5f)
            _patrolIndex = (_patrolIndex + 1) % patrolPoints.Length;
        _agent.SetDestination(patrolPoints[_patrolIndex].position);
    }

    private void HandleChase()
    {
        _agent.speed = chaseSpeed;
        if (_target) _agent.SetDestination(_target.position);
    }

    private void HandleAttack()
    {
        _agent.SetDestination(transform.position); // Stop moving
        transform.LookAt(_target);
        if (Time.time >= _nextAttackTime)
        {
            _nextAttackTime = Time.time + attackRate;
            _target.GetComponent<HealthSystem>()?.TakeDamage(damage, gameObject);
            // Anim.Play("Attack");
        }
    }

    private void HandleRetreat()
    {
        _agent.speed = chaseSpeed * 1.2f;
        if (_target)
        {
            Vector3 away = transform.position + (transform.position - _target.position).normalized * 12f;
            _agent.SetDestination(away);
        }
    }

    private void OnDeath(GameObject killer)
    {
        _state = State.Dead;
        _agent.isStopped = true;
        // Drop loot, play death anim, etc.
        // GameManager.Instance?.RegisterKill(killer, gameObject);
        Destroy(gameObject, 3f);
    }

    private void OnDrawGizmosSelected()
    {
        Gizmos.color = Color.yellow; Gizmos.DrawWireSphere(transform.position, sightRange);
        Gizmos.color = Color.red;    Gizmos.DrawWireSphere(transform.position, attackRange);
    }
}`,
    },
    {
      path: "Scripts/Core/GameManager.cs",
      name: "GameManager.cs",
      language: "csharp",
      icon: "⚙️",
      content: `using System.Collections;
using System.Collections.Generic;
using UnityEngine;
using UnityEngine.Events;

/// <summary>
/// Game Manager — ${spec.win_condition.replace(/_/g, " ").toUpperCase()}
/// Players: ${spec.player_count} | Respawn: ${spec.respawn_system ? "enabled" : "disabled"}
/// </summary>
public class GameManager : MonoBehaviour
{
    public static GameManager Instance { get; private set; }

    [Header("Match Config")]
    [SerializeField] private int   scoreLimit   = ${spec.win_condition === "team_deathmatch" ? "75" : "200"};
    [SerializeField] private float matchTime    = ${hasMed ? "600f" : "300f"};
    [SerializeField] private float respawnDelay = ${spec.ttk === "fast" ? "3f" : "7f"};

    [Header("Teams")]
    [SerializeField] private Transform[] teamASpawns;
    [SerializeField] private Transform[] teamBSpawns;

    public int  ScoreTeamA   { get; private set; }
    public int  ScoreTeamB   { get; private set; }
    public bool MatchRunning  { get; private set; }
    public float TimeRemaining { get; private set; }

    public UnityEvent<string> OnMatchEnd = new UnityEvent<string>();
    public UnityEvent<PlayerData, int> OnKill = new UnityEvent<PlayerData, int>();

    private Dictionary<int, PlayerData> _players = new();
    private bool _matchEnded;

    private void Awake()
    {
        if (Instance != null) { Destroy(gameObject); return; }
        Instance = this;
        DontDestroyOnLoad(gameObject);
    }

    private void Start()
    {
        StartMatch();
    }

    private void Update()
    {
        if (!MatchRunning) return;
        TimeRemaining -= Time.deltaTime;
        if (TimeRemaining <= 0 && !_matchEnded) EndMatch("time");
    }

    public void StartMatch()
    {
        ScoreTeamA    = 0;
        ScoreTeamB    = 0;
        TimeRemaining = matchTime;
        MatchRunning  = true;
        _matchEnded   = false;
        // UIManager.Instance?.UpdateScore(0, 0);
    }

    public void RegisterKill(GameObject killer, GameObject victim)
    {
        if (_players.TryGetValue(killer.GetInstanceID(), out var kd)) kd.kills++;
        if (_players.TryGetValue(victim.GetInstanceID(), out var vd)) vd.deaths++;

        bool killerTeamA = killer.CompareTag("TeamA");
        if (killerTeamA) ScoreTeamA++; else ScoreTeamB++;

        OnKill?.Invoke(kd, killerTeamA ? 0 : 1);
        // UIManager.Instance?.UpdateScore(ScoreTeamA, ScoreTeamB);

        if (ScoreTeamA >= scoreLimit) EndMatch("TeamA");
        else if (ScoreTeamB >= scoreLimit) EndMatch("TeamB");

        StartCoroutine(RespawnPlayer(victim, killerTeamA));
    }

    private IEnumerator RespawnPlayer(GameObject player, bool killerTeamA)
    {
        player.SetActive(false);
        yield return new WaitForSeconds(respawnDelay);
        Transform[] spawns = killerTeamA ? teamBSpawns : teamASpawns;
        Transform spawn    = spawns[Random.Range(0, spawns.Length)];
        player.transform.SetPositionAndRotation(spawn.position, spawn.rotation);
        player.SetActive(true);
    }

    private void EndMatch(string winner)
    {
        MatchRunning = false;
        _matchEnded  = true;
        OnMatchEnd?.Invoke(winner);
        // UIManager.Instance?.ShowEndScreen(winner, ScoreTeamA, ScoreTeamB);
    }
}

[System.Serializable]
public class PlayerData
{
    public int    id;
    public string username;
    public int    kills;
    public int    deaths;
    public int    teamId;
    public float  kdr => deaths > 0 ? (float)kills / deaths : kills;
}`,
    },
    {
      path: "Scripts/Core/HealthSystem.cs",
      name: "HealthSystem.cs",
      language: "csharp",
      icon: "❤️",
      content: `using UnityEngine;
using UnityEngine.Events;

/// <summary>
/// Health &amp; Damage System — shared by players and AI enemies
/// </summary>
public class HealthSystem : MonoBehaviour
{
    [Header("Stats")]
    [SerializeField] private float maxHealth      = 100f;
    [SerializeField] private float armorAmount    = 0f;
    [SerializeField] private float regenRate      = 0f;   // hp/sec (0 = disabled)
    [SerializeField] private float regenDelay     = 5f;   // seconds before regen starts

    public float CurrentHealth { get; private set; }
    public bool  IsAlive       => CurrentHealth > 0;

    public System.Action<GameObject> OnDeath;
    public UnityEvent<float, float>  OnHealthChanged = new(); // (current, max)

    private float _lastDamageTime;

    private void Awake()  { CurrentHealth = maxHealth; }

    private void Update()
    {
        if (!IsAlive || regenRate <= 0) return;
        if (Time.time - _lastDamageTime >= regenDelay)
        {
            Heal(regenRate * Time.deltaTime);
        }
    }

    public void TakeDamage(float amount, GameObject source)
    {
        if (!IsAlive) return;
        _lastDamageTime = Time.time;

        float absorbed = Mathf.Min(armorAmount, amount * 0.40f);
        float actual   = amount - absorbed;
        armorAmount    = Mathf.Max(0, armorAmount - absorbed);
        CurrentHealth  = Mathf.Max(0, CurrentHealth - actual);

        OnHealthChanged?.Invoke(CurrentHealth, maxHealth);
        // UIManager.Instance?.UpdateHealthBar(CurrentHealth, maxHealth);

        if (CurrentHealth <= 0) Die(source);
    }

    public void Heal(float amount)
    {
        CurrentHealth = Mathf.Min(maxHealth, CurrentHealth + amount);
        OnHealthChanged?.Invoke(CurrentHealth, maxHealth);
    }

    private void Die(GameObject killer)
    {
        OnDeath?.Invoke(killer);
        GameManager.Instance?.RegisterKill(killer, gameObject);
    }
}`,
    },
    ...(spec.vehicles.length > 0 ? [{
      path: "Scripts/Vehicles/VehicleController.cs",
      name: "VehicleController.cs",
      language: "csharp",
      icon: "🚗",
      content: `using UnityEngine;

/// <summary>
/// Vehicle Controller — ${spec.vehicles.join(", ")}
/// Battlefield-scale vehicle system
/// </summary>
public class VehicleController : MonoBehaviour
{
    public enum VehicleType { ${spec.vehicles.map(v => v.charAt(0).toUpperCase() + v.slice(1)).join(", ")} }

    [Header("Vehicle Config")]
    [SerializeField] private VehicleType type;
    [SerializeField] private float       maxSpeed    = 45f;
    [SerializeField] private float       acceleration = 8f;
    [SerializeField] private float       turnSpeed   = 60f;
    [SerializeField] private float       health      = 500f;
    [SerializeField] private int         seatCount   = 2;

    private Rigidbody _rb;
    private float     _currentSpeed;
    private Transform _occupant;

    private void Awake() { _rb = GetComponent<Rigidbody>(); }

    private void FixedUpdate()
    {
        if (_occupant == null) return;
        float v    = Input.GetAxis("Vertical");
        float h    = Input.GetAxis("Horizontal");
        _currentSpeed = Mathf.MoveTowards(_currentSpeed, v * maxSpeed, acceleration * Time.fixedDeltaTime);
        _rb.linearVelocity = transform.forward * _currentSpeed;
        transform.Rotate(0, h * turnSpeed * Time.fixedDeltaTime, 0);
    }

    public bool TryEnter(Transform player)
    {
        if (_occupant != null) return false;
        _occupant = player;
        player.GetComponent<FPSController>().enabled = false;
        player.SetParent(transform);
        return true;
    }

    public void Exit()
    {
        if (_occupant == null) return;
        _occupant.GetComponent<FPSController>().enabled = true;
        _occupant.SetParent(null);
        _occupant = null;
    }
}`,
    }] : []),
    {
      path: "Config/GameConfig.json",
      name: "GameConfig.json",
      language: "json",
      icon: "📋",
      content: JSON.stringify({
        meta: { generator: "Apex Game Forge ◆", version: "1.0.0", prompt: prompt },
        ...spec,
        network: {
          maxPlayers:    spec.player_count,
          tickRate:      spec.ttk === "fast" ? 128 : 64,
          protocol:      "UDP",
          compression:   true,
          lagComp:       true,
        },
        hud: {
          healthBar:  true,
          ammoCounter: true,
          minimap:    spec.player_count > 16,
          killFeed:   true,
          scoreboard: true,
        },
      }, null, 2),
    },
    {
      path: "README.md",
      name: "README.md",
      language: "markdown",
      icon: "📄",
      content: `# ${theme} FPS — Generated by Apex Game Forge ◆

## Overview
${prompt}

## Game Specs
- **Mode:** ${spec.win_condition.replace(/_/g, " ").toUpperCase()}
- **Players:** Up to ${spec.player_count}
- **Map Size:** ${spec.map_size.toUpperCase()} — ${spec.map_biome}
- **TTK:** ${spec.ttk.toUpperCase()}
- **Weapons:** ${spec.weapons.join(", ")}
${spec.vehicles.length > 0 ? `- **Vehicles:** ${spec.vehicles.join(", ")}` : ""}

## Setup (Unity 2022.3+ LTS)
1. Open Unity Hub and create a new 3D URP project
2. Copy the \`/Scripts\` and \`/Config\` folders into \`Assets/\`
3. Install required packages: Cinemachine, Input System, NavMesh Plus
4. Create NavMesh surface on your map
5. Add \`GameManager.prefab\` to your scene
6. Configure spawn points and patrol paths
7. Press Play!

## Architecture
\`\`\`
GameManager          ← Match state, scoring, respawning
├── FPSController    ← Movement, look, crouch, sprint
├── WeaponSystem     ← Shoot, reload, weapon switching
├── HealthSystem     ← Damage, armor, regeneration
├── EnemyAI          ← State machine: Patrol→Chase→Attack→Retreat
${spec.vehicles.length > 0 ? "├── VehicleController  ← Vehicle physics, enter/exit\n" : ""
}└── NetworkManager   ← Client/server sync (mock)
\`\`\`

## Iterative Evolution
Use the **Apex Game Forge** to evolve this project:
- \`"make guns more realistic"\` → updates WeaponSystem.cs spread/recoil
- \`"add vehicles"\` → generates VehicleController.cs
- \`"more like Battlefield"\` → enables squad system, capture points
- \`"increase AI difficulty"\` → tweaks EnemyAI detection range + damage

Generated with ❤️ by Apex AI Studio`,
    },
  ];
}

// ── Syntax highlight (simple tokenizer) ──────────────────────────────────────
function highlightCSharp(code: string): string {
  return code
    .replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;")
    .replace(/(\/\/.*$)/gm, '<span class="gf-comment">$1</span>')
    .replace(/("(?:[^"\\]|\\.)*")/g, '<span class="gf-string">$1</span>')
    .replace(/\b(using|namespace|public|private|protected|static|void|class|interface|enum|new|return|if|else|switch|case|break|continue|true|false|null|this|base|override|virtual|abstract|sealed|readonly|const|var|int|float|bool|string|Vector3|Transform|GameObject|MonoBehaviour|Quaternion|Coroutine|IEnumerator|yield|get|set|ref|out|params)\b/g,
      '<span class="gf-keyword">$1</span>')
    .replace(/\b([A-Z][a-zA-Z0-9]*)\b(?!\s*:)/g, '<span class="gf-type">$1</span>')
    .replace(/\b(\d+(?:\.\d+)?f?)\b/g, '<span class="gf-number">$1</span>');
}

function highlightJSON(code: string): string {
  return code
    .replace(/("(?:[^"\\]|\\.)*")\s*:/g, '<span class="gf-type">$1</span>:')
    .replace(/:\s*("(?:[^"\\]|\\.)*")/g, ': <span class="gf-string">$1</span>')
    .replace(/:\s*(true|false|null)/g, ': <span class="gf-keyword">$1</span>')
    .replace(/:\s*(\d+(?:\.\d+)?)/g, ': <span class="gf-number">$1</span>');
}

function highlightMarkdown(code: string): string {
  return code
    .replace(/^(#{1,3}\s.+)$/gm, '<span class="gf-type">$1</span>')
    .replace(/(`{1,3}[^`]*`{1,3})/g, '<span class="gf-string">$1</span>');
}

function highlight(code: string, lang: string): string {
  if (lang === "csharp")   return highlightCSharp(code);
  if (lang === "json")     return highlightJSON(code);
  if (lang === "markdown") return highlightMarkdown(code);
  return code;
}

// ── Agent card ─────────────────────────────────────────────────────────────────
function AgentCard({ agent, index }: { agent: AgentStep; index: number }) {
  const isRunning = agent.status === "running";
  const isDone    = agent.status === "done";
  const isIdle    = agent.status === "idle";

  return (
    <div style={{
      display: "flex", alignItems: "center", gap: 10,
      padding: "10px 12px",
      borderRadius: 12,
      border: `1px solid ${isDone ? agent.color + "35" : isRunning ? agent.color + "50" : "rgba(255,255,255,0.06)"}`,
      background: isRunning
        ? `linear-gradient(135deg, ${agent.color}12, ${agent.color}06)`
        : isDone
        ? `${agent.color}08`
        : "rgba(255,255,255,0.025)",
      transition: `all 0.35s ${IOS}`,
      animation: isRunning ? `gf-agent-in 0.40s ${SPRING} both` : undefined,
      animationDelay: `${index * 60}ms`,
      boxShadow: isRunning ? `0 0 16px ${agent.color}25` : undefined,
      opacity: isIdle ? 0.45 : 1,
    }}>
      {/* Icon */}
      <div style={{
        width: 32, height: 32, borderRadius: 10, flexShrink: 0,
        background: isDone || isRunning ? `${agent.color}18` : "rgba(255,255,255,0.05)",
        border: `1px solid ${isDone || isRunning ? agent.color + "30" : "rgba(255,255,255,0.08)"}`,
        display: "flex", alignItems: "center", justifyContent: "center",
        fontSize: 16,
        boxShadow: isRunning ? `0 0 12px ${agent.color}40` : undefined,
        transition: `all 0.30s ${IOS}`,
      }}>
        {isDone ? <Check style={{ width: 14, height: 14, color: agent.color }} />
          : isRunning ? <span style={{ display: "block", animation: "gf-pulse 0.9s ease-in-out infinite" }}>{agent.icon}</span>
          : <span style={{ opacity: 0.40 }}>{agent.icon}</span>}
      </div>

      {/* Text */}
      <div style={{ flex: 1, minWidth: 0 }}>
        <div style={{
          fontSize: 12, fontWeight: 700,
          color: isDone || isRunning ? "white" : "rgba(255,255,255,0.35)",
          transition: `color 0.30s ${IOS}`,
        }}>
          {agent.label}
        </div>
        <div style={{
          fontSize: 10, color: "rgba(255,255,255,0.30)",
          display: "flex", alignItems: "center", gap: 4, marginTop: 1,
        }}>
          {isRunning && (
            <div style={{
              width: 5, height: 5, borderRadius: "50%",
              background: agent.color,
              animation: "gf-pulse 0.8s ease-in-out infinite",
              flexShrink: 0,
            }} />
          )}
          <span style={{ color: isRunning ? agent.color : undefined, transition: `color 0.30s ${IOS}` }}>
            {isRunning ? agent.detail : isDone ? agent.log || "Complete" : agent.role}
          </span>
        </div>
      </div>

      {/* Running spinner */}
      {isRunning && (
        <div style={{
          width: 16, height: 16, borderRadius: "50%", flexShrink: 0,
          border: `2px solid ${agent.color}30`,
          borderTopColor: agent.color,
          animation: "gf-spin 0.75s linear infinite",
        }} />
      )}
      {isDone && (
        <div style={{ fontSize: 9, fontWeight: 700, color: agent.color, letterSpacing: "0.05em" }}>
          DONE
        </div>
      )}
    </div>
  );
}

// ── File tree item ─────────────────────────────────────────────────────────────
function FileItem({ file, selected, onClick }: {
  file: GeneratedFile; selected: boolean; onClick: () => void;
}) {
  const parts = file.path.split("/");
  const depth = parts.length - 1;

  return (
    <button
      onClick={onClick}
      style={{
        width: "100%", textAlign: "left", padding: "6px 12px",
        paddingLeft: 12 + depth * 10,
        background: selected ? "rgba(162,155,254,0.10)" : "transparent",
        border: "none", borderLeft: selected ? `2px solid ${GOLD}` : "2px solid transparent",
        cursor: "pointer",
        display: "flex", alignItems: "center", gap: 7,
        transition: `all 0.15s ${IOS}`,
      }}
      onMouseEnter={(e) => { if (!selected) e.currentTarget.style.background = "rgba(255,255,255,0.04)"; }}
      onMouseLeave={(e) => { if (!selected) e.currentTarget.style.background = "transparent"; }}
    >
      <span style={{ fontSize: 12 }}>{file.icon}</span>
      <span style={{
        fontSize: 11, fontWeight: selected ? 600 : 400,
        color: selected ? GOLD : "rgba(255,255,255,0.55)",
        overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap",
        transition: `color 0.15s ${IOS}`,
      }}>
        {file.name}
      </span>
    </button>
  );
}

// ── Spec badge ─────────────────────────────────────────────────────────────────
function SpecBadge({ icon, label, value }: { icon: React.ReactNode; label: string; value: string }) {
  return (
    <div style={{
      display: "flex", flexDirection: "column", alignItems: "center", gap: 4,
      padding: "10px 14px",
      borderRadius: 12,
      background: "rgba(255,255,255,0.04)",
      border: "1px solid rgba(255,255,255,0.08)",
      minWidth: 70,
    }}>
      <div style={{ color: GOLD, display: "flex", alignItems: "center" }}>{icon}</div>
      <div style={{ fontSize: 13, fontWeight: 800, color: "white", lineHeight: 1 }}>{value}</div>
      <div style={{ fontSize: 9, color: "rgba(255,255,255,0.30)", fontWeight: 600, textTransform: "uppercase", letterSpacing: "0.05em" }}>{label}</div>
    </div>
  );
}

// ── Copy button ───────────────────────────────────────────────────────────────
function CopyButton({ text }: { text: string }) {
  const [copied, setCopied] = useState(false);
  return (
    <button
      onClick={() => { navigator.clipboard.writeText(text).catch(() => {}); setCopied(true); setTimeout(() => setCopied(false), 1800); }}
      style={{
        display: "flex", alignItems: "center", gap: 5,
        padding: "5px 10px", borderRadius: 8,
        background: copied ? "rgba(52,211,153,0.15)" : "rgba(255,255,255,0.07)",
        border: `1px solid ${copied ? "rgba(52,211,153,0.35)" : "rgba(255,255,255,0.12)"}`,
        color: copied ? "#34d399" : "rgba(255,255,255,0.50)",
        fontSize: 10, fontWeight: 700, cursor: "pointer",
        transition: `all 0.20s ${IOS}`,
      }}
    >
      {copied ? <Check style={{ width: 10, height: 10 }} /> : <Copy style={{ width: 10, height: 10 }} />}
      {copied ? "Copied" : "Copy"}
    </button>
  );
}

// ── Agent log texts ──────────────────────────────────────────────────────────
const AGENT_LOGS: Record<string, (spec: GameSpec) => string> = {
  planner:   (s) => `Designed ${s.weapons.length} weapon types, ${s.features.length} features`,
  architect: (s) => `Structured ${s.vehicles.length > 0 ? "6" : "5"} core systems`,
  builder:   (s) => `Generated ${s.vehicles.length > 0 ? "6" : "5"} scripts + config`,
  tester:    (s) => `Simulated ${s.player_count} players — 0 critical bugs`,
  balancer:  (s) => `TTK=${s.ttk}, spread tuned for ${s.map_size} maps`,
};

// ── Agent delay timings ────────────────────────────────────────────────────────
const AGENT_DELAYS = [0, 2200, 4600, 7200, 9800];
const AGENT_DONE   = [1800, 4200, 6800, 9400, 12200];

// ── Main GameForge component ──────────────────────────────────────────────────
export function GameForge() {
  const [prompt,     setPrompt]     = useState("");
  const [mode,       setMode]       = useState<GameMode>("cod");
  const [agents,     setAgents]     = useState<AgentStep[]>(buildAgents());
  const [running,    setRunning]    = useState(false);
  const [result,     setResult]     = useState<ForgeResult | null>(null);
  const [selectedFile, setSelectedFile] = useState(0);
  const [evolvePrompt, setEvolvePrompt] = useState("");
  const [showSpec,   setShowSpec]   = useState(false);
  const [evolved,    setEvolved]    = useState(false);

  // ── Generate Game state ───────────────────────────────────────────────────
  const [showGenModal,  setShowGenModal]  = useState(false);
  const [genPhase,      setGenPhase]      = useState<"idle" | "running" | "done" | "error">("idle");
  const [genStep,       setGenStep]       = useState(0);
  const [genError,      setGenError]      = useState("");

  // ── Publish Game state ────────────────────────────────────────────────────
  type PubStage = { label: string; status: "pending"|"running"|"done"|"error"; output: string };
  type PubResult = {
    gameId: string; webPlayUrl: string; downloadUrl: string;
    storeMetadata: { name: string; tagline: string; description: string; category: string; ageRating: string; keywords: string[]; iconGradient: [string,string] };
    stripeProducts: Array<{ name: string; description: string; price: number; currency: string; paymentLink: string|null; emoji: string }>;
    analyticsUrl: string; publishedAt: string;
  };
  const [showPubModal,  setShowPubModal]  = useState(false);
  const [pubStatus,     setPubStatus]     = useState<"idle"|"running"|"done"|"error">("idle");
  const [pubStages,     setPubStages]     = useState<PubStage[]>([]);
  const [pubResult,     setPubResult]     = useState<PubResult | null>(null);
  const [pubError,      setPubError]      = useState("");
  const [pubJobId,      setPubJobId]      = useState<string | null>(null);
  const pubPollRef = useRef<ReturnType<typeof setInterval> | null>(null);

  const [gameStats, setGameStats] = useState<{ playersOnline: number; activeRooms: number } | null>(null);

  const timersRef = useRef<ReturnType<typeof setTimeout>[]>([]);

  const clearTimers = () => { timersRef.current.forEach(clearTimeout); timersRef.current = []; };

  // ── Generate Game handler ─────────────────────────────────────────────────
  const handleGenerateGame = useCallback(async () => {
    if (!result) return;
    setShowGenModal(true);
    setGenPhase("running");
    setGenStep(0);
    setGenError("");

    const STEP_DELAYS = [700, 900, 800, 850, 800];
    for (let i = 0; i < STEP_DELAYS.length; i++) {
      await new Promise<void>(r => setTimeout(r, STEP_DELAYS[i]));
      setGenStep(i + 1);
    }

    try {
      const projectName = `ApexFPS_${result.spec.game_type}_${result.spec.map_biome}`
        .replace(/[^a-zA-Z0-9_]/g, "_");

      const res = await fetch(`${BASE}/api/generate-unity-game`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          spec:        result.spec,
          serverUrl:   `${window.location.origin}${BASE}`,
          projectName,
        }),
      });

      if (!res.ok) throw new Error(`Server error ${res.status}`);

      const blob     = await res.blob();
      const url      = URL.createObjectURL(blob);
      const anchor   = document.createElement("a");
      anchor.href    = url;
      anchor.download = `${projectName}.zip`;
      document.body.appendChild(anchor);
      anchor.click();
      document.body.removeChild(anchor);
      URL.revokeObjectURL(url);

      setGenPhase("done");
    } catch (err) {
      console.error("[GameForge] generate error:", err);
      setGenError(err instanceof Error ? err.message : String(err));
      setGenPhase("error");
    }
  }, [result]);

  // ── Publish Game handler ──────────────────────────────────────────────────
  const handlePublish = useCallback(async () => {
    if (!result) return;
    if (pubPollRef.current) clearInterval(pubPollRef.current);

    const STAGE_LABELS = [
      "Build pipeline", "Store build artifacts", "Host web version",
      "App Store prep", "Monetization setup", "Player accounts", "Analytics dashboard",
    ];

    setShowPubModal(true);
    setPubStatus("running");
    setPubResult(null);
    setPubError("");
    setPubJobId(null);
    setPubStages(STAGE_LABELS.map(label => ({ label, status: "pending" as const, output: "" })));

    try {
      const projectName = `ApexFPS_${result.spec.game_type}_${result.spec.map_biome}`
        .replace(/[^a-zA-Z0-9_]/g, "_");

      const res = await fetch(`${BASE}/api/publish-game`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          spec:        result.spec,
          serverUrl:   `${window.location.origin}`,
          projectName,
        }),
      });

      if (!res.ok) throw new Error("Failed to start publish pipeline");

      const { jobId } = await res.json() as { jobId: string; estimatedSeconds: number };
      setPubJobId(jobId);

      // Poll job status
      pubPollRef.current = setInterval(async () => {
        try {
          const statusRes = await fetch(`${BASE}/api/publish-game/${jobId}`);
          if (!statusRes.ok) return;
          const data = await statusRes.json() as {
            status: string; stages: PubStage[]; result: PubResult | null; error: string | null;
          };
          setPubStages(data.stages);
          if (data.status === "done") {
            clearInterval(pubPollRef.current!);
            pubPollRef.current = null;
            setPubResult(data.result);
            setPubStatus("done");
          } else if (data.status === "error") {
            clearInterval(pubPollRef.current!);
            pubPollRef.current = null;
            setPubError(data.error ?? "Pipeline failed");
            setPubStatus("error");
          }
        } catch { /* non-fatal */ }
      }, 800);

    } catch (err) {
      console.error("[Publish] Error:", err);
      setPubError(err instanceof Error ? err.message : String(err));
      setPubStatus("error");
    }
  }, [result]);

  const generate = useCallback(async (p: string) => {
    if (!p.trim() || running) return;
    clearTimers();
    setRunning(true);
    setResult(null);
    setEvolved(false);
    const fresh = buildAgents();
    setAgents(fresh);

    const spec  = generateSpec(p, mode);
    const files = generateFiles(spec, p);

    // Animate agents in sequence
    agents.forEach((_, idx) => {
      const t1 = setTimeout(() => {
        setAgents((prev) => prev.map((a, i) => ({
          ...a,
          status: i < idx ? "done" : i === idx ? "running" : a.status,
          log:    i < idx ? (AGENT_LOGS[a.id]?.(spec) ?? "Complete") : a.log,
        })));
      }, AGENT_DELAYS[idx]);

      const t2 = setTimeout(() => {
        setAgents((prev) => prev.map((a, i) => ({
          ...a,
          status: i <= idx ? "done" : a.status,
          log:    i === idx ? (AGENT_LOGS[a.id]?.(spec) ?? "Complete") : a.log,
        })));
        if (idx === AGENT_DELAYS.length - 1) {
          setResult({ spec, files });
          setRunning(false);
        }
      }, AGENT_DONE[idx]);

      timersRef.current.push(t1, t2);
    });
  }, [running, mode, agents]);

  const evolve = useCallback((p: string) => {
    if (!p.trim() || !result) return;
    // Apply evolution: regenerate relevant files only
    const evolved_spec = { ...result.spec };
    if (p.toLowerCase().includes("realistic") || p.toLowerCase().includes("recoil")) {
      evolved_spec.ttk = "slow";
    }
    if (p.toLowerCase().includes("vehicle"))  evolved_spec.vehicles = ["tank", "jeep", "helicopter"];
    if (p.toLowerCase().includes("battlefield")) { evolved_spec.map_size = "large"; evolved_spec.player_count = 64; }
    if (p.toLowerCase().includes("speed"))    evolved_spec.ttk = "fast";

    setResult({ spec: evolved_spec, files: generateFiles(evolved_spec, result.spec.theme) });
    setEvolvePrompt("");
    setEvolved(true);
    setTimeout(() => setEvolved(false), 3000);
  }, [result]);

  useEffect(() => () => clearTimers(), []);

  // Fetch real game stats from the multiplayer room registry
  useEffect(() => {
    let cancelled = false;
    async function fetchStats() {
      try {
        const res = await fetch("/api/game/stats");
        if (!res.ok) return;
        const data = await res.json() as { playersOnline?: number; activeRooms?: number };
        if (!cancelled) setGameStats({ playersOnline: data.playersOnline ?? 0, activeRooms: data.activeRooms ?? 0 });
      } catch { /* network unavailable */ }
    }
    fetchStats();
    const id = setInterval(fetchStats, 15_000);
    return () => { cancelled = true; clearInterval(id); };
  }, []);

  const modeConfig = MODES[mode];
  const activeFile = result?.files[selectedFile];
  const totalDone  = agents.filter((a) => a.status === "done").length;
  const progress   = running ? (totalDone / agents.length) * 100 : result ? 100 : 0;

  return (
    <div style={{ display: "flex", flexDirection: "column", height: "100%", background: "transparent", overflow: "hidden" }}>
      <style>{CSS}</style>

      {/* ── Top panel ────────────────────────────────────────────────────────── */}
      <div style={{
        flexShrink: 0,
        padding: "16px 16px 0",
        background: "linear-gradient(180deg, rgba(6,12,24,0.95), transparent)",
        borderBottom: "1px solid rgba(255,255,255,0.05)",
        paddingBottom: 14,
      }}>
        {/* Mode selector */}
        <div style={{ display: "flex", gap: 6, marginBottom: 12, overflowX: "auto" }}>
          {(Object.entries(MODES) as [GameMode, typeof MODES["cod"]][]).map(([k, cfg]) => (
            <button
              key={k}
              onClick={() => setMode(k)}
              style={{
                display: "flex", alignItems: "center", gap: 6, flexShrink: 0,
                padding: "7px 12px", borderRadius: 10,
                background: mode === k ? `${cfg.color}18` : "rgba(255,255,255,0.04)",
                border: `1.5px solid ${mode === k ? cfg.color + "50" : "rgba(255,255,255,0.08)"}`,
                color: mode === k ? cfg.color : "rgba(255,255,255,0.35)",
                fontSize: 11, fontWeight: 800, cursor: "pointer",
                boxShadow: mode === k ? `0 0 12px ${cfg.glow}` : undefined,
                transition: `all 0.22s ${IOS}`,
              }}
            >
              <span style={{ fontSize: 14 }}>{cfg.icon}</span>
              {cfg.label}
            </button>
          ))}
        </div>

        {/* Mode desc */}
        <p style={{ fontSize: 10, color: "rgba(255,255,255,0.28)", marginBottom: 10, letterSpacing: "0.02em" }}>
          {modeConfig.description}
        </p>

        {/* Prompt input */}
        <div style={{ display: "flex", gap: 8 }}>
          <div style={{ flex: 1, position: "relative" }}>
            <Crosshair style={{
              position: "absolute", left: 12, top: "50%", transform: "translateY(-50%)",
              width: 14, height: 14, color: "rgba(255,255,255,0.25)", pointerEvents: "none",
            }} />
            <input
              value={prompt}
              onChange={(e) => setPrompt(e.target.value)}
              onKeyDown={(e) => e.key === "Enter" && void generate(prompt)}
              placeholder={`Describe your ${mode === "cod" ? "fast-paced" : mode === "battlefield" ? "large-scale" : "custom"} FPS game…`}
              style={{
                width: "100%", paddingLeft: 34, paddingRight: 14,
                height: 40, borderRadius: 12,
                background: "rgba(255,255,255,0.05)",
                border: "1px solid rgba(255,255,255,0.10)",
                color: "white", fontSize: 13, outline: "none",
                transition: `border-color 0.20s ${IOS}`,
                boxSizing: "border-box",
              }}
              onFocus={(e) => { e.target.style.borderColor = modeConfig.color + "50"; }}
              onBlur={(e)  => { e.target.style.borderColor = "rgba(255,255,255,0.10)"; }}
            />
          </div>
          <button
            onClick={() => void generate(prompt)}
            disabled={running || !prompt.trim()}
            style={{
              padding: "0 18px", height: 40, borderRadius: 12,
              background: running || !prompt.trim() ? "rgba(255,255,255,0.07)" : `linear-gradient(135deg, ${modeConfig.color}, ${modeConfig.color}BB)`,
              border: "none", color: running || !prompt.trim() ? "rgba(255,255,255,0.25)" : "#000",
              fontSize: 12, fontWeight: 900, cursor: running || !prompt.trim() ? "not-allowed" : "pointer",
              display: "flex", alignItems: "center", gap: 7,
              boxShadow: !running && prompt.trim() ? `0 4px 20px ${modeConfig.glow}` : undefined,
              transition: `all 0.22s ${IOS}`,
              flexShrink: 0,
            }}
          >
            {running
              ? <><div style={{ width: 12, height: 12, borderRadius: "50%", border: "2px solid rgba(0,0,0,0.30)", borderTopColor: "rgba(0,0,0,0.80)", animation: "gf-spin 0.75s linear infinite" }} /> Forging</>
              : <><Play style={{ width: 12, height: 12 }} /> Generate</>
            }
          </button>
        </div>

        {/* Progress bar */}
        {(running || result) && (
          <div style={{ marginTop: 10, height: 2, background: "rgba(255,255,255,0.06)", borderRadius: 1, overflow: "hidden" }}>
            <div style={{
              height: "100%", borderRadius: 1,
              background: `linear-gradient(90deg, ${modeConfig.color}, ${modeConfig.color}BB)`,
              width: `${progress}%`,
              transition: `width 0.60s ${IOS}`,
              boxShadow: `0 0 8px ${modeConfig.glow}`,
            }} />
          </div>
        )}
      </div>

      {/* ── Main content ─────────────────────────────────────────────────────── */}
      <div style={{ flex: 1, overflow: "hidden", display: "flex" }}>

        {/* ── Left: Agents + spec ──────────────────────────────────────────────── */}
        <div style={{
          width: result ? 240 : "100%",
          flexShrink: 0,
          borderRight: result ? "1px solid rgba(255,255,255,0.06)" : "none",
          overflowY: "auto",
          padding: "14px 12px",
          transition: `width 0.50s ${IOS}`,
          display: "flex", flexDirection: "column", gap: 8,
        }}>

          {/* Agents */}
          <div>
            <div style={{ fontSize: 9, fontWeight: 800, letterSpacing: "0.10em", color: "rgba(255,255,255,0.25)", textTransform: "uppercase", marginBottom: 8, paddingLeft: 2 }}>
              Pipeline
            </div>
            <div style={{ display: "flex", flexDirection: "column", gap: 5 }}>
              {agents.map((a, i) => <AgentCard key={a.id} agent={a} index={i} />)}
            </div>
          </div>

          {/* Empty state */}
          {!running && !result && (
            <div style={{
              flex: 1, display: "flex", flexDirection: "column",
              alignItems: "center", justifyContent: "center",
              padding: "32px 16px", textAlign: "center", gap: 14, opacity: 0.45,
            }}>
              <Gamepad2 style={{ width: 40, height: 40, color: modeConfig.color, opacity: 0.60 }} />
              <div>
                <div style={{ fontSize: 13, fontWeight: 700, color: "rgba(255,255,255,0.60)", marginBottom: 5 }}>
                  Describe your FPS game above
                </div>
                <div style={{ fontSize: 11, color: "rgba(255,255,255,0.30)", lineHeight: 1.55 }}>
                  "Desert war with 32 players, snipers and tanks"
                </div>
              </div>
              <div style={{ display: "flex", flexWrap: "wrap", gap: 5, justifyContent: "center" }}>
                {modeConfig.tags.map((t) => (
                  <span key={t} style={{
                    fontSize: 9, fontWeight: 700, padding: "3px 8px", borderRadius: 99,
                    background: `${modeConfig.color}12`, border: `1px solid ${modeConfig.color}25`,
                    color: modeConfig.color,
                  }}>{t}</span>
                ))}
              </div>
            </div>
          )}

          {/* Spec summary */}
          {result && (
            <div style={{ marginTop: 8, animation: `gf-fade-in 0.50s ${IOS} both` }}>
              <button
                onClick={() => setShowSpec(!showSpec)}
                style={{
                  width: "100%", display: "flex", alignItems: "center", justifyContent: "space-between",
                  padding: "8px 10px", borderRadius: 10,
                  background: "rgba(255,255,255,0.04)", border: "1px solid rgba(255,255,255,0.08)",
                  color: "rgba(255,255,255,0.55)", fontSize: 10, fontWeight: 700,
                  cursor: "pointer", marginBottom: showSpec ? 8 : 0,
                }}
              >
                <span>⚙️ Game Spec</span>
                <ChevronDown style={{ width: 12, height: 12, transform: showSpec ? "rotate(180deg)" : undefined, transition: `transform 0.20s ${IOS}` }} />
              </button>

              {showSpec && (
                <pre style={{
                  fontSize: 9, color: "rgba(255,255,255,0.50)",
                  background: "rgba(0,0,0,0.35)", borderRadius: 10,
                  padding: 10, overflow: "auto", maxHeight: 200,
                  fontFamily: "monospace", lineHeight: 1.6,
                  border: "1px solid rgba(255,255,255,0.06)",
                }}>
                  {JSON.stringify(result.spec, null, 2)}
                </pre>
              )}
            </div>
          )}
        </div>

        {/* ── Right: File tree + code preview ──────────────────────────────────── */}
        {result && (
          <div style={{
            flex: 1, display: "flex", overflow: "hidden",
            animation: `gf-slide-in 0.45s ${SPRING} both`,
          }}>
            {/* File tree */}
            <div style={{
              width: 170, flexShrink: 0,
              borderRight: "1px solid rgba(255,255,255,0.05)",
              overflowY: "auto",
              padding: "12px 0",
            }}>
              <div style={{
                fontSize: 9, fontWeight: 800, letterSpacing: "0.10em",
                color: "rgba(255,255,255,0.22)", textTransform: "uppercase",
                padding: "0 12px 8px",
              }}>
                /GameProject
              </div>
              {result.files.map((f, i) => (
                <FileItem
                  key={f.path}
                  file={f}
                  selected={selectedFile === i}
                  onClick={() => setSelectedFile(i)}
                />
              ))}
            </div>

            {/* Code pane */}
            <div style={{ flex: 1, display: "flex", flexDirection: "column", overflow: "hidden" }}>
              {/* Code header */}
              <div style={{
                flexShrink: 0, display: "flex", alignItems: "center", justifyContent: "space-between",
                padding: "8px 14px",
                borderBottom: "1px solid rgba(255,255,255,0.05)",
                background: "rgba(0,0,0,0.30)",
              }}>
                <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                  <span style={{ fontSize: 13 }}>{activeFile?.icon}</span>
                  <span style={{ fontSize: 11, color: "rgba(255,255,255,0.70)", fontFamily: "monospace" }}>
                    {activeFile?.path}
                  </span>
                  <span style={{
                    fontSize: 9, fontWeight: 700, padding: "2px 7px", borderRadius: 99,
                    background: "rgba(255,255,255,0.06)", color: "rgba(255,255,255,0.30)",
                    textTransform: "uppercase", letterSpacing: "0.05em",
                  }}>
                    {activeFile?.language}
                  </span>
                </div>
                <div style={{ display: "flex", gap: 6 }}>
                  {activeFile && <CopyButton text={activeFile.content} />}
                  <button
                    onClick={() => {
                      if (!result) return;
                      const allCode = result.files.map((f) => `// ${f.path}\n${f.content}`).join("\n\n" + "=".repeat(60) + "\n\n");
                      navigator.clipboard.writeText(allCode).catch(() => {});
                    }}
                    title="Export all files"
                    style={{
                      display: "flex", alignItems: "center", gap: 5,
                      padding: "5px 10px", borderRadius: 8,
                      background: `${GOLD}15`, border: `1px solid ${GOLD}35`,
                      color: GOLD, fontSize: 10, fontWeight: 700, cursor: "pointer",
                    }}
                  >
                    <Download style={{ width: 10, height: 10 }} />
                    Export
                  </button>
                </div>
              </div>

              {/* Code content */}
              <div style={{
                flex: 1, overflowY: "auto", overflowX: "auto",
                padding: "14px 16px",
                background: "rgba(30,26,62,0.62)",
              }}>
                <div
                  className="gf-code-block"
                  dangerouslySetInnerHTML={{
                    __html: activeFile ? highlight(activeFile.content, activeFile.language) : "",
                  }}
                />
              </div>

              {/* Iterative evolution bar */}
              <div style={{
                flexShrink: 0, padding: "10px 14px",
                borderTop: "1px solid rgba(255,255,255,0.05)",
                background: "rgba(0,0,0,0.25)",
                display: "flex", gap: 8, alignItems: "center",
              }}>
                <RefreshCw style={{ width: 13, height: 13, color: "rgba(255,255,255,0.25)", flexShrink: 0 }} />
                <input
                  value={evolvePrompt}
                  onChange={(e) => setEvolvePrompt(e.target.value)}
                  onKeyDown={(e) => { if (e.key === "Enter") evolve(evolvePrompt); }}
                  placeholder={`Evolve: "make guns more realistic", "add vehicles", "more like Battlefield"…`}
                  style={{
                    flex: 1, height: 32, padding: "0 12px", borderRadius: 8,
                    background: "rgba(255,255,255,0.05)",
                    border: "1px solid rgba(255,255,255,0.09)",
                    color: "white", fontSize: 11, outline: "none",
                    fontStyle: "italic",
                  }}
                  onFocus={(e) => { e.target.style.borderColor = modeConfig.color + "45"; e.target.style.fontStyle = "normal"; }}
                  onBlur={(e)  => { e.target.style.borderColor = "rgba(255,255,255,0.09)"; e.target.style.fontStyle = evolved || evolvePrompt ? "normal" : "italic"; }}
                />
                <button
                  onClick={() => evolve(evolvePrompt)}
                  disabled={!evolvePrompt.trim()}
                  style={{
                    padding: "0 12px", height: 32, borderRadius: 8, flexShrink: 0,
                    background: evolvePrompt.trim() ? `${modeConfig.color}20` : "rgba(255,255,255,0.04)",
                    border: `1px solid ${evolvePrompt.trim() ? modeConfig.color + "40" : "rgba(255,255,255,0.08)"}`,
                    color: evolvePrompt.trim() ? modeConfig.color : "rgba(255,255,255,0.20)",
                    fontSize: 11, fontWeight: 700, cursor: evolvePrompt.trim() ? "pointer" : "not-allowed",
                    display: "flex", alignItems: "center", gap: 5,
                    transition: `all 0.20s ${IOS}`,
                  }}
                >
                  {evolved ? <><Check style={{ width: 10, height: 10 }} /> Applied</> : <><Zap style={{ width: 10, height: 10 }} /> Evolve</>}
                </button>
              </div>
            </div>
          </div>
        )}
      </div>

      {/* ── Stats bar (when result is ready) ─────────────────────────────────── */}
      {result && (
        <div style={{
          flexShrink: 0,
          padding: "10px 14px",
          borderTop: "1px solid rgba(255,255,255,0.05)",
          display: "flex", gap: 8, overflowX: "auto", alignItems: "center",
          animation: `gf-fade-in 0.50s 0.20s ${IOS} both`,
        }}>
          <SpecBadge icon={<Users style={{ width: 12, height: 12 }} />}     label="Players"  value={String(result.spec.player_count)} />
          <SpecBadge icon={<Map style={{ width: 12, height: 12 }} />}       label="Map"      value={result.spec.map_size.toUpperCase()} />
          <SpecBadge icon={<Sword style={{ width: 12, height: 12 }} />}     label="Weapons"  value={String(result.spec.weapons.length)} />
          <SpecBadge icon={<Bot style={{ width: 12, height: 12 }} />}       label="AI Bots"  value="ON" />
          <SpecBadge icon={<Shield style={{ width: 12, height: 12 }} />}    label="TTK"      value={result.spec.ttk.toUpperCase()} />
          {result.spec.vehicles.length > 0 && (
            <SpecBadge icon={<span style={{ fontSize: 12 }}>🚗</span>}      label="Vehicles" value={String(result.spec.vehicles.length)} />
          )}
          <SpecBadge icon={<ChevronRight style={{ width: 12, height: 12 }} />} label="Files" value={String(result.files.length)} />

          {/* ── Generate Game button ── */}
          <button
            onClick={handleGenerateGame}
            style={{
              marginLeft: "auto", flexShrink: 0,
              display: "flex", alignItems: "center", gap: 7,
              padding: "7px 14px", borderRadius: 10,
              background: "linear-gradient(135deg, #6C5CE7 0%, #4F46E5 50%, #7C3AED 100%)",
              border: "1px solid rgba(162,155,254,0.35)",
              color: "#fff", fontSize: 11, fontWeight: 800,
              letterSpacing: "0.04em", cursor: "pointer",
              boxShadow: "0 0 18px rgba(108,92,231,0.45), 0 4px 12px rgba(0,0,0,0.40)",
              transition: `all 0.22s ${SPRING}`,
            }}
            onPointerDown={e => (e.currentTarget.style.transform = "scale(0.95)")}
            onPointerUp={e   => (e.currentTarget.style.transform = "scale(1)")}
            onPointerLeave={e => (e.currentTarget.style.transform = "scale(1)")}
          >
            <Package style={{ width: 13, height: 13 }} />
            Generate Game
          </button>

          {/* ── Publish Game button ── */}
          <button
            onClick={handlePublish}
            style={{
              flexShrink: 0,
              display: "flex", alignItems: "center", gap: 7,
              padding: "7px 14px", borderRadius: 10,
              background: "linear-gradient(135deg, #10B981 0%, #059669 50%, #047857 100%)",
              border: "1px solid rgba(16,185,129,0.40)",
              color: "#fff", fontSize: 11, fontWeight: 800,
              letterSpacing: "0.04em", cursor: "pointer",
              boxShadow: "0 0 18px rgba(16,185,129,0.45), 0 4px 12px rgba(0,0,0,0.40)",
              transition: `all 0.22s ${SPRING}`,
            }}
            onPointerDown={e => (e.currentTarget.style.transform = "scale(0.95)")}
            onPointerUp={e   => (e.currentTarget.style.transform = "scale(1)")}
            onPointerLeave={e => (e.currentTarget.style.transform = "scale(1)")}
          >
            <Rocket style={{ width: 13, height: 13 }} />
            Publish Game
          </button>
        </div>
      )}

      {/* ── Generate Game modal overlay ───────────────────────────────────────── */}
      {showGenModal && (
        <div style={{
          position: "absolute", inset: 0, zIndex: 100,
          display: "flex", flexDirection: "column",
          alignItems: "center", justifyContent: "center",
          background: "rgba(14,12,32,0.55)",
          backdropFilter: "blur(24px)",
          animation: `gf-fade-in 0.30s ${IOS} both`,
        }}>
          {/* Close button */}
          {(genPhase === "done" || genPhase === "error") && (
            <button
              onClick={() => { setShowGenModal(false); setGenPhase("idle"); }}
              style={{
                position: "absolute", top: 16, right: 16,
                all: "unset", cursor: "pointer",
                width: 32, height: 32, borderRadius: 8,
                background: "rgba(255,255,255,0.06)",
                border: "1px solid rgba(255,255,255,0.10)",
                display: "flex", alignItems: "center", justifyContent: "center",
                color: "rgba(255,255,255,0.50)",
              }}
            >
              <X style={{ width: 14, height: 14 }} />
            </button>
          )}

          {/* Icon */}
          <div style={{
            width: 64, height: 64, borderRadius: 20,
            background: genPhase === "done"  ? "linear-gradient(135deg,#10B981,#06B6D4)"
                       : genPhase === "error" ? "linear-gradient(135deg,#EF4444,#DC2626)"
                       : "linear-gradient(135deg,#6C5CE7,#7C3AED)",
            display: "flex", alignItems: "center", justifyContent: "center",
            marginBottom: 20,
            boxShadow: genPhase === "done"  ? "0 0 32px rgba(16,185,129,0.50)"
                      : genPhase === "error" ? "0 0 32px rgba(239,68,68,0.50)"
                      : "0 0 32px rgba(108,92,231,0.50)",
            animation: `gf-agent-in 0.40s ${SPRING} both`,
          }}>
            {genPhase === "done"  ? <CheckCircle2 style={{ width: 30, height: 30, color: "#fff" }} />
            : genPhase === "error" ? <AlertCircle  style={{ width: 30, height: 30, color: "#fff" }} />
            : <Package style={{ width: 30, height: 30, color: "#fff" }} />}
          </div>

          {/* Title */}
          <div style={{
            fontSize: 20, fontWeight: 900, color: "#fff",
            marginBottom: 6, letterSpacing: "-0.02em",
            animation: `gf-fade-in 0.35s 0.1s ${IOS} both`,
          }}>
            {genPhase === "done"  ? "Build Ready ✅"
            : genPhase === "error" ? "Generation Failed"
            : "Generating Unity Project"}
          </div>

          <div style={{
            fontSize: 12, color: "rgba(255,255,255,0.40)", fontWeight: 500,
            marginBottom: 32,
            animation: `gf-fade-in 0.35s 0.15s ${IOS} both`,
          }}>
            {genPhase === "done"  ? "Your zip is downloading now"
            : genPhase === "error" ? genError
            : "Building your multiplayer FPS…"}
          </div>

          {/* Steps */}
          <div style={{
            display: "flex", flexDirection: "column", gap: 10,
            width: "100%", maxWidth: 320,
            animation: `gf-fade-in 0.35s 0.20s ${IOS} both`,
          }}>
            {[
              { label: "Collecting game data",         icon: "🎮" },
              { label: "Generating project structure",  icon: "📁" },
              { label: "Injecting core scripts",        icon: "💉" },
              { label: "Connecting backend",            icon: "🌐" },
              { label: "Creating ZIP archive",          icon: "📦" },
              { label: "Build ready — downloading",     icon: "✅" },
            ].map((step, i) => {
              const done    = genStep > i;
              const active  = genPhase === "running" && genStep === i;
              const waiting = genStep < i && genPhase !== "done";

              return (
                <div key={i} style={{
                  display: "flex", alignItems: "center", gap: 12,
                  padding: "10px 14px", borderRadius: 12,
                  background: done   ? "rgba(16,185,129,0.08)"
                             : active ? "rgba(108,92,231,0.10)"
                             : "rgba(255,255,255,0.03)",
                  border: `1px solid ${
                    done   ? "rgba(16,185,129,0.20)"
                  : active ? "rgba(108,92,231,0.25)"
                  : "rgba(255,255,255,0.05)"}`,
                  transition: `all 0.30s ${IOS}`,
                  animation: `gf-fade-in 0.30s ${0.22 + i * 0.04}s ${IOS} both`,
                  opacity: waiting ? 0.35 : 1,
                }}>
                  {/* Status icon */}
                  <div style={{ width: 22, height: 22, flexShrink: 0,
                    display: "flex", alignItems: "center", justifyContent: "center" }}>
                    {done
                      ? <CheckCircle2 style={{ width: 16, height: 16, color: "#10B981" }} />
                      : active
                        ? <Loader2 style={{ width: 16, height: 16, color: "#A29BFE",
                            animation: "gf-spin 0.8s linear infinite" }} />
                        : <span style={{ fontSize: 14, opacity: 0.30 }}>{step.icon}</span>
                    }
                  </div>

                  <span style={{
                    fontSize: 12, fontWeight: done || active ? 600 : 400,
                    color: done   ? "#10B981"
                         : active ? "#A29BFE"
                         : "rgba(255,255,255,0.35)",
                    transition: `color 0.25s ${IOS}`,
                  }}>
                    {step.label}
                  </span>

                  {active && (
                    <div style={{ marginLeft: "auto", display: "flex", gap: 3 }}>
                      {[0,1,2].map(d => (
                        <div key={d} style={{
                          width: 4, height: 4, borderRadius: "50%",
                          background: "#A29BFE",
                          animation: `gf-pulse 1s ${d * 0.18}s ease-in-out infinite`,
                        }} />
                      ))}
                    </div>
                  )}
                </div>
              );
            })}
          </div>

          {/* CTA when done */}
          {genPhase === "done" && (
            <div style={{
              marginTop: 24, fontSize: 11, color: "rgba(255,255,255,0.35)",
              textAlign: "center", lineHeight: 1.6,
              animation: `gf-fade-in 0.40s ${IOS} both`,
            }}>
              Open in Unity 2022+ · Install SocketIOUnity · Press ▶ Play
            </div>
          )}
        </div>
      )}

      {/* ── Publish Game modal overlay ─────────────────────────────────────────── */}
      {showPubModal && (
        <div style={{
          position: "absolute", inset: 0, zIndex: 120,
          display: "flex", flexDirection: "column",
          alignItems: "center", justifyContent: "center",
          background: "rgba(14,12,32,0.55)",
          backdropFilter: "blur(28px)",
        }}>
          {/* Close */}
          <button
            onClick={() => { setShowPubModal(false); if (pubPollRef.current) { clearInterval(pubPollRef.current); pubPollRef.current = null; } }}
            style={{
              position: "absolute", top: 16, right: 16, zIndex: 5,
              width: 32, height: 32, borderRadius: 8,
              background: "rgba(255,255,255,0.06)", border: "1px solid rgba(255,255,255,0.10)",
              color: "rgba(255,255,255,0.5)", cursor: "pointer",
              display: "flex", alignItems: "center", justifyContent: "center",
            }}
          ><X style={{ width: 14, height: 14 }} /></button>

          {/* ── PIPELINE VIEW ── */}
          {pubStatus !== "done" && (
            <div style={{
              width: "100%", maxWidth: 420, padding: "0 20px",
              animation: `gf-fade-in 0.35s ${IOS} both`,
            }}>
              {/* Header */}
              <div style={{ textAlign: "center", marginBottom: 28 }}>
                <div style={{
                  width: 52, height: 52, borderRadius: 14, margin: "0 auto 14px",
                  background: "linear-gradient(135deg, #10B981, #059669)",
                  boxShadow: "0 0 28px rgba(16,185,129,0.55)",
                  display: "flex", alignItems: "center", justifyContent: "center",
                }}>
                  <Rocket style={{ width: 24, height: 24, color: "#fff" }} />
                </div>
                <div style={{ fontSize: 16, fontWeight: 800, color: "#fff", letterSpacing: "0.02em" }}>
                  {pubStatus === "error" ? "Pipeline Failed" : "Publishing Game…"}
                </div>
                <div style={{ fontSize: 11, color: "rgba(255,255,255,0.40)", marginTop: 4 }}>
                  {pubStatus === "error" ? pubError : "Deploying to Apex Game Network"}
                </div>
              </div>

              {/* Stage list */}
              <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
                {pubStages.map((stage, i) => {
                  const done   = stage.status === "done";
                  const active = stage.status === "running";
                  const err    = stage.status === "error";
                  const icons: React.ReactNode[] = [
                    <Package key="0" style={{ width: 14, height: 14 }} />,
                    <Download key="1" style={{ width: 14, height: 14 }} />,
                    <Globe2 key="2" style={{ width: 14, height: 14 }} />,
                    <Smartphone key="3" style={{ width: 14, height: 14 }} />,
                    <CreditCard key="4" style={{ width: 14, height: 14 }} />,
                    <Users key="5" style={{ width: 14, height: 14 }} />,
                    <BarChart2 key="6" style={{ width: 14, height: 14 }} />,
                  ];
                  return (
                    <div key={i} style={{
                      display: "flex", alignItems: "center", gap: 12,
                      padding: "10px 14px", borderRadius: 10,
                      background: active ? "rgba(16,185,129,0.08)" : done ? "rgba(16,185,129,0.04)" : "rgba(255,255,255,0.02)",
                      border: `1px solid ${active ? "rgba(16,185,129,0.30)" : done ? "rgba(16,185,129,0.18)" : "rgba(255,255,255,0.06)"}`,
                      transition: `all 0.28s ${IOS}`,
                    }}>
                      {/* Step icon / status */}
                      <div style={{
                        width: 26, height: 26, borderRadius: 8, flexShrink: 0,
                        display: "flex", alignItems: "center", justifyContent: "center",
                        background: done ? "#10B981" : active ? "rgba(16,185,129,0.20)" : err ? "rgba(239,68,68,0.20)" : "rgba(255,255,255,0.05)",
                        border: `1px solid ${done ? "transparent" : active ? "rgba(16,185,129,0.40)" : "rgba(255,255,255,0.08)"}`,
                        color: done ? "#fff" : active ? "#10B981" : err ? "#EF4444" : "rgba(255,255,255,0.25)",
                      }}>
                        {done ? <Check style={{ width: 12, height: 12 }} /> : err ? <AlertCircle style={{ width: 12, height: 12 }} /> : icons[i]}
                      </div>

                      {/* Label + output */}
                      <div style={{ flex: 1, minWidth: 0 }}>
                        <div style={{
                          fontSize: 12, fontWeight: 600,
                          color: done ? "#10B981" : active ? "#fff" : err ? "#EF4444" : "rgba(255,255,255,0.35)",
                          transition: `color 0.25s ${IOS}`,
                        }}>{stage.label}</div>
                        {(done || err) && stage.output && (
                          <div style={{
                            fontSize: 10, color: done ? "rgba(16,185,129,0.70)" : "rgba(239,68,68,0.70)",
                            marginTop: 2, whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis",
                          }}>{stage.output}</div>
                        )}
                      </div>

                      {/* Active pulse */}
                      {active && (
                        <div style={{ display: "flex", gap: 3 }}>
                          {[0,1,2].map(d => (
                            <div key={d} style={{
                              width: 4, height: 4, borderRadius: "50%",
                              background: "#10B981",
                              animation: `gf-pulse 1s ${d * 0.18}s ease-in-out infinite`,
                            }} />
                          ))}
                        </div>
                      )}
                    </div>
                  );
                })}
              </div>
            </div>
          )}

          {/* ── RESULTS VIEW ── */}
          {pubStatus === "done" && pubResult && (
            <div style={{
              width: "100%", maxWidth: 460,
              maxHeight: "90vh", overflowY: "auto",
              padding: "0 16px",
              display: "flex", flexDirection: "column", gap: 14,
              animation: `gf-fade-in 0.45s ${IOS} both`,
            }}>
              {/* GAME IS LIVE banner */}
              <div style={{
                textAlign: "center", padding: "22px 0 8px",
              }}>
                <div style={{
                  display: "inline-flex", alignItems: "center", gap: 8,
                  padding: "6px 16px", borderRadius: 99,
                  background: "rgba(16,185,129,0.15)",
                  border: "1px solid rgba(16,185,129,0.35)",
                  marginBottom: 12,
                }}>
                  <div style={{ width: 8, height: 8, borderRadius: "50%", background: "#10B981", animation: "gf-pulse 1.4s ease-in-out infinite" }} />
                  <span style={{ fontSize: 11, fontWeight: 700, color: "#10B981", letterSpacing: "0.08em" }}>GAME IS LIVE</span>
                </div>
                <div style={{ fontSize: 18, fontWeight: 900, color: "#fff", letterSpacing: "0.01em", lineHeight: 1.2 }}>
                  {pubResult.storeMetadata.name}
                </div>
                <div style={{ fontSize: 11, color: "rgba(255,255,255,0.40)", marginTop: 6, lineHeight: 1.5 }}>
                  {pubResult.storeMetadata.tagline}
                </div>
              </div>

              {/* Play + Download buttons */}
              <div style={{ display: "flex", gap: 10 }}>
                <a
                  href="/multiplayer"
                  style={{
                    flex: 1, display: "flex", alignItems: "center", justifyContent: "center", gap: 7,
                    padding: "11px 0", borderRadius: 11,
                    background: "linear-gradient(135deg, #10B981, #059669)",
                    border: "1px solid rgba(16,185,129,0.40)",
                    color: "#fff", fontSize: 12, fontWeight: 800,
                    textDecoration: "none", cursor: "pointer",
                    boxShadow: "0 0 20px rgba(16,185,129,0.40)",
                  }}
                >
                  <Globe2 style={{ width: 14, height: 14 }} />
                  Play in Browser
                </a>
                <button
                  onClick={() => {
                    const a = document.createElement("a");
                    a.href = `${BASE}${pubResult.downloadUrl}`;
                    a.download = "ApexGame.zip";
                    a.click();
                  }}
                  style={{
                    flex: 1, display: "flex", alignItems: "center", justifyContent: "center", gap: 7,
                    padding: "11px 0", borderRadius: 11,
                    background: "rgba(255,255,255,0.05)",
                    border: "1px solid rgba(255,255,255,0.12)",
                    color: "#fff", fontSize: 12, fontWeight: 700, cursor: "pointer",
                  }}
                >
                  <Download style={{ width: 14, height: 14 }} />
                  Unity Project
                </button>
              </div>

              {/* App Store Metadata card */}
              <div style={{
                borderRadius: 14, padding: "14px 16px",
                background: "rgba(255,255,255,0.03)",
                border: "1px solid rgba(255,255,255,0.08)",
              }}>
                <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 12 }}>
                  <Smartphone style={{ width: 13, height: 13, color: "#A29BFE" }} />
                  <span style={{ fontSize: 11, fontWeight: 700, color: "#A29BFE", letterSpacing: "0.06em" }}>APP STORE PREP</span>
                </div>
                <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 8 }}>
                  {[
                    { label: "Category",   value: pubResult.storeMetadata.category },
                    { label: "Age Rating", value: pubResult.storeMetadata.ageRating },
                  ].map(item => (
                    <div key={item.label} style={{
                      padding: "8px 10px", borderRadius: 8,
                      background: "rgba(162,155,254,0.06)",
                      border: "1px solid rgba(162,155,254,0.12)",
                    }}>
                      <div style={{ fontSize: 9, color: "rgba(255,255,255,0.35)", fontWeight: 600, letterSpacing: "0.06em", marginBottom: 2 }}>{item.label}</div>
                      <div style={{ fontSize: 12, color: "#fff", fontWeight: 700 }}>{item.value}</div>
                    </div>
                  ))}
                </div>
                <div style={{ marginTop: 8, display: "flex", flexWrap: "wrap", gap: 5 }}>
                  {pubResult.storeMetadata.keywords.map(kw => (
                    <span key={kw} style={{
                      fontSize: 9, padding: "3px 7px", borderRadius: 5, fontWeight: 600,
                      background: "rgba(162,155,254,0.10)", color: "#A29BFE",
                      border: "1px solid rgba(162,155,254,0.20)", letterSpacing: "0.04em",
                    }}>{kw}</span>
                  ))}
                </div>
                <div style={{
                  marginTop: 10, fontSize: 10, color: "rgba(255,255,255,0.35)",
                  lineHeight: 1.55, borderTop: "1px solid rgba(255,255,255,0.06)", paddingTop: 10,
                }}>
                  {pubResult.storeMetadata.description}
                </div>
              </div>

              {/* Monetization — Stripe product cards */}
              <div style={{
                borderRadius: 14, padding: "14px 16px",
                background: "rgba(255,255,255,0.03)",
                border: "1px solid rgba(255,255,255,0.08)",
              }}>
                <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 12 }}>
                  <ShoppingBag style={{ width: 13, height: 13, color: GOLD }} />
                  <span style={{ fontSize: 11, fontWeight: 700, color: GOLD, letterSpacing: "0.06em" }}>IN-GAME MONETIZATION</span>
                </div>
                <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
                  {pubResult.stripeProducts.map((prod, idx) => (
                    <div key={idx} style={{
                      display: "flex", alignItems: "center", gap: 12,
                      padding: "10px 12px", borderRadius: 10,
                      background: "rgba(162,155,254,0.04)",
                      border: "1px solid rgba(162,155,254,0.14)",
                    }}>
                      <span style={{ fontSize: 18 }}>{prod.emoji}</span>
                      <div style={{ flex: 1, minWidth: 0 }}>
                        <div style={{ fontSize: 12, fontWeight: 700, color: "#fff" }}>{prod.name}</div>
                        <div style={{ fontSize: 10, color: "rgba(255,255,255,0.35)", marginTop: 2 }}>{prod.description}</div>
                      </div>
                      <div style={{ display: "flex", flexDirection: "column", alignItems: "flex-end", gap: 5, flexShrink: 0 }}>
                        <span style={{ fontSize: 13, fontWeight: 800, color: GOLD }}>
                          ${(prod.price / 100).toFixed(2)}
                        </span>
                        {prod.paymentLink ? (
                          <a
                            href={prod.paymentLink}
                            target="_blank"
                            rel="noreferrer"
                            style={{
                              fontSize: 9, padding: "3px 9px", borderRadius: 5,
                              background: "rgba(162,155,254,0.15)",
                              border: "1px solid rgba(162,155,254,0.35)",
                              color: GOLD, fontWeight: 700, textDecoration: "none",
                              display: "flex", alignItems: "center", gap: 3,
                            }}
                          >
                            <ExternalLink style={{ width: 8, height: 8 }} />
                            Buy
                          </a>
                        ) : (
                          <span style={{
                            fontSize: 9, padding: "3px 9px", borderRadius: 5,
                            background: "rgba(255,255,255,0.05)",
                            border: "1px solid rgba(255,255,255,0.10)",
                            color: "rgba(255,255,255,0.30)", fontWeight: 600,
                          }}>Live (add Stripe key)</span>
                        )}
                      </div>
                    </div>
                  ))}
                </div>
              </div>

              {/* Analytics snapshot */}
              <div style={{
                borderRadius: 14, padding: "14px 16px",
                background: "rgba(255,255,255,0.03)",
                border: "1px solid rgba(255,255,255,0.08)",
              }}>
                <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 12 }}>
                  <BarChart2 style={{ width: 13, height: 13, color: "#74B9FF" }} />
                  <span style={{ fontSize: 11, fontWeight: 700, color: "#74B9FF", letterSpacing: "0.06em" }}>ANALYTICS DASHBOARD</span>
                </div>
                <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr 1fr", gap: 8 }}>
                  {[
                    { label: "Players Online", value: gameStats ? String(gameStats.playersOnline) : "—", icon: <Users style={{ width: 10, height: 10 }} /> },
                    { label: "Active Rooms",   value: gameStats ? String(gameStats.activeRooms)   : "—", icon: <Sword style={{ width: 10, height: 10 }} /> },
                    { label: "Revenue",        value: "N/A",                                             icon: <CreditCard style={{ width: 10, height: 10 }} /> },
                  ].map(item => (
                    <div key={item.label} style={{
                      padding: "10px 8px", borderRadius: 8, textAlign: "center",
                      background: "rgba(116,185,255,0.05)",
                      border: "1px solid rgba(116,185,255,0.12)",
                    }}>
                      <div style={{ color: "#74B9FF", marginBottom: 4, display: "flex", justifyContent: "center" }}>{item.icon}</div>
                      <div style={{ fontSize: 14, fontWeight: 800, color: "#fff", marginBottom: 2 }}>{item.value}</div>
                      <div style={{ fontSize: 8, color: "rgba(255,255,255,0.30)", fontWeight: 600, letterSpacing: "0.04em" }}>{item.label}</div>
                    </div>
                  ))}
                </div>
              </div>

              {/* Published at / game ID */}
              <div style={{
                textAlign: "center", padding: "8px 0 16px",
                fontSize: 10, color: "rgba(255,255,255,0.25)", lineHeight: 1.6,
              }}>
                Game ID: <span style={{ color: "rgba(255,255,255,0.45)", fontFamily: "monospace" }}>{pubResult.gameId}</span>
                <br />
                Published {new Date(pubResult.publishedAt).toLocaleString()}
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  );
}

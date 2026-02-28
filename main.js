let GAME = null;
let commandHistory = [];
let historyIndex = -1;
let playerCurrentHealth = 0;
let playerMaxHealth = 0;
let playerXP = 0;
let playerLvl = 0;
let playerXpForNextLvl = 0;
let saveToDelete = null;
let autoScrollEnabled = true;
let waitingForNameInput = false;

// --- Global Preferences (Persistent across saves) ---
let GLOBAL_PREFS = {
  textSpeed: 1,
  musicVolume: 100,
  musicMuted: false,
  narrationStyle: "narrator", // "narrator" or "block"
  narrationHotkey: null       // Saved as key name, e.g., "N"
};

function saveGlobalPrefs() {
  localStorage.setItem("script_heroes_prefs", JSON.stringify(GLOBAL_PREFS));
}

function loadGlobalPrefs() {
  const saved = localStorage.getItem("script_heroes_prefs");
  if (saved) {
    try {
      const parsed = JSON.parse(saved);
      GLOBAL_PREFS = { ...GLOBAL_PREFS, ...parsed };
    } catch (e) {
      console.error("Failed to parse global prefs", e);
    }
  }
}

// Initial load
loadGlobalPrefs();

const FORBIDDEN_KEYWORDS = [
  "nigger", "hitler", "adolf", "epstein", "kim jong un", "donald trump", "trump",
  "nazi", "terrorist", "pedophile", "rape", "fuck", "shit", "asshole", "bitch", "raping"
];

function validateAndFormatName(name) {
  if (!name || name.trim() === "") return { valid: false, reason: "Name cannot be empty." };

  const cleanName = name.trim();
  const lowerName = cleanName.toLowerCase();

  // Check forbidden keywords
  for (const keyword of FORBIDDEN_KEYWORDS) {
    if (lowerName.includes(keyword)) {
      return { valid: false, reason: "That name is not allowed." };
    }
  }

  // Auto-capitalize
  const formattedName = cleanName.charAt(0).toUpperCase() + cleanName.slice(1);

  // Script injection protection
  const sanitizedName = escapeHTML(formattedName);

  return { valid: true, name: sanitizedName };
}

function escapeHTML(str) {
  if (!str) return "";
  const div = document.createElement("div");
  div.textContent = str;
  return div.innerHTML;
}

const gameLog = document.getElementById("output-log");

gameLog.addEventListener("scroll", () => {
  const atBottom =
    gameLog.scrollTop + gameLog.clientHeight >= gameLog.scrollHeight - 5;

  autoScrollEnabled = atBottom;
});

const startScreen = document.getElementById("start-screen");
const gameScreen = document.getElementById("game-screen");
const btnContinue = document.getElementById("btn-continue");


const outputLog = document.getElementById("output-log");
const choices = document.getElementById("choices");
const commandInput = document.getElementById("command-input");
const commandSubmit = document.getElementById("command-submit");

const nicknameInput = document.getElementById("nickname-input");
const btnStartGame = document.getElementById("btn-new-game");
const btnLoadSave = document.getElementById("btn-load");
const saveStatus = document.getElementById("save-status");

const btnSave = document.getElementById("btn-save");
const btnExport = document.getElementById("btn-export");
const btnImport = document.getElementById("btn-import");
const btnSettings = document.getElementById("btn-settings");
const btnSettingsStart = document.getElementById("btn-settings-start");

const btnInventory = document.getElementById("btn-inventory");
const btnTeam = document.getElementById("btn-team");
const btnQuests = document.getElementById("btn-quests");
const btnTravel = document.getElementById("btn-travel");

// --- Patch / Update System ---
const GAME_VERSION = "0.0.5c";
const GITHUB_REPO = "Maki1612/Script-Heroes";

const PATCH_NOTES = {
  "0.0.5c": [
    "Placeholder for new changes."
  ],
  "0.0.4": [
    "Refined map icon alignment for streets and roads.",
    "Fixed map tooltip collisions with dynamic positioning.",
    "Implemented hover-only descriptions for map icons with improved stacking (z-index).",
    "Added /patches command and version history system.",
    "Fixed travel bug to Layla's House via improved robust matching."
  ],
  "0.0.3": [
    "Added Greenwood exploration system with 5 new locations.",
    "Added new NPCs: Sister Helena, Layla, and Layla's Mother.",
    "Added companion quest 'Lost Memories'.",
    "Improved combat log scrollability.",
    "Rebalanced flee mechanic for low-SPD characters.",
    "Fixed Fortify and Weaken skill durations."
  ],
  "0.0.2": [
    "Improved UI status bar with detailed level and XP tracking.",
    "Fixed quest reward processing order.",
    "Added dynamic music region system.",
    "Improved road drawing logic on the map."
  ],
  "0.0.1": [
    "Initial Alpha Release.",
    "Basic combat and questing systems implemented.",
    "Core world map and movement systems."
  ]
};

const patchNotice = document.getElementById("patch-notice");
const patchText = document.getElementById("patch-text");
const btnPatch = document.getElementById("btn-patch");
const btnPatchDismiss = document.getElementById("btn-patch-dismiss");

let latestVersion = null;

function compareVersions(local, remote) {
  if (!local || !remote) return 0;

  const parsePart = (part) => {
    const s = part.toString().trim();
    const num = parseInt(s, 10);
    // Extract everything after the leading number
    const suffix = s.replace(/^[0-9]+/, "");
    return { num: isNaN(num) ? 0 : num, suffix };
  };

  const a = local.toString().split(".");
  const b = remote.toString().split(".");

  for (let i = 0; i < Math.max(a.length, b.length); i++) {
    const pa = parsePart(a[i] || "0");
    const pb = parsePart(b[i] || "0");

    if (pb.num > pa.num) return 1;
    if (pb.num < pa.num) return -1;

    // Numeric parts are equal, compare suffixes
    if (pb.suffix !== pa.suffix) {
      // Empty suffix is usually "older" than any alphanumeric suffix (e.g. 0.0.5 < 0.0.5a)
      if (pa.suffix === "") return 1;
      if (pb.suffix === "") return -1;

      if (pb.suffix > pa.suffix) return 1;
      if (pb.suffix < pa.suffix) return -1;
    }
  }
  return 0;
}

async function checkForUpdate() {
  try {
    console.log(`[UpdateCheck] Checking repository: ${GITHUB_REPO}`);

    // Attempt 1: Try 'main' branch
    let url = `https://raw.githubusercontent.com/${GITHUB_REPO}/main/version.json?t=${Date.now()}`;
    let res = await fetch(url, { cache: "no-store" });

    if (!res.ok) {
      console.warn(`[UpdateCheck] 'main' branch check failed (${res.status}). Trying 'master' branch...`);
      url = `https://raw.githubusercontent.com/${GITHUB_REPO}/master/version.json?t=${Date.now()}`;
      res = await fetch(url, { cache: "no-store" });
    }

    if (!res.ok) {
      console.warn(`[UpdateCheck] Update check failed: ${res.status} ${res.statusText}`);
      console.log(`[UpdateCheck] Ensure 'version.json' is pushed to GitHub in 'main' or 'master' branch.`);
      return;
    }

    const remote = await res.json();
    latestVersion = remote.version;
    console.log(`[UpdateCheck] Success! Remote: ${latestVersion} | Local: ${GAME_VERSION}`);

    const comparison = compareVersions(GAME_VERSION, latestVersion);
    if (comparison === 1) {
      console.log(`[UpdateCheck] Update FOUND! Displaying banner.`);
      patchText.textContent = `Update available: v${latestVersion} (current: v${GAME_VERSION})`;
      patchNotice.style.display = "flex";
    } else {
      console.log(`[UpdateCheck] No update needed (Comparison: ${comparison})`);
    }
  } catch (e) {
    console.error("[UpdateCheck] Connectivity error:", e);
  }
}

async function applyPatch() {
  const versionToUse = latestVersion || GAME_VERSION;
  const fileName = `script heroes ${versionToUse}.zip`;

  console.log(`[PatchSystem] Starting download: ${fileName}`);
  console.log(`[PatchSystem] Targeted version: ${versionToUse}`);

  // 1. Export saves first
  await exportSaves();

  // 2. Download the full repo as ZIP
  const zipUrl = `https://github.com/${GITHUB_REPO}/archive/refs/heads/main.zip`;
  const a = document.createElement("a");
  a.href = zipUrl;
  a.download = fileName;

  // Browsers may ignore .download for cross-origin URLs. 
  // We log this so the user knows what to expect.
  console.log(`[PatchSystem] Triggering download for: ${zipUrl}`);

  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
}

if (btnPatch) {
  btnPatch.addEventListener("click", () => applyPatch());
}

if (btnPatchDismiss) {
  btnPatchDismiss.addEventListener("click", () => {
    patchNotice.style.display = "none";
  });
}

function showPatchNotes() {
  const versions = Object.keys(PATCH_NOTES).sort((a, b) => compareVersions(a, b));
  logBlock("Patch Notes / Version History:", versions.map(v => {
    const notes = PATCH_NOTES[v].map(note => `  • ${note}`).join("<br>");
    return `<strong>v${v}</strong><br>${notes}`;
  }));
}

// Check for updates on page load (non-blocking)
checkForUpdate();
const COMMAND_DETAILS = {
  "/help": "Display this help message with a list of all commands.",
  "/save": "Save your current game progress to a new or existing slot.",
  "/load": "List available save files or load a specific save by name.",
  "/loadslot": "Load a save from a specific numerical slot index.",
  "/deleteslot": "Permanently delete a save from a specific slot index.",
  "/clear": "Clear all messages from the game log.",
  "/inventory": "Open your inventory to view and use items.",
  "/quests": "Open the quest log to review your active objectives.",
  "/team": "Open team management to organize your party and equipment.",
  "/status": "Display your current character level, XP, HP, and location.",
  "/travel": "Open the quick travel menu to move between unlocked areas.",
  "/class": "Change your hero's class specialty (e.g., /class mage).",
  "/talk": "Initiate a conversation with an NPC in your current area.",
  "/go": "Travel to a specific connected location.",
  "/patches": "View the history of updates and fixes for Script Heroes."
};
const AVAILABLE_COMMANDS = Object.keys(COMMAND_DETAILS);

async function hashSaveObject(obj) {
  const json = JSON.stringify(obj);
  const encoder = new TextEncoder();
  const data = encoder.encode(json);

  const hashBuffer = await crypto.subtle.digest("SHA-256", data);
  const hashArray = Array.from(new Uint8Array(hashBuffer));
  const hashHex = hashArray.map(b => b.toString(16).padStart(2, "0")).join("");

  return hashHex;
}

async function computeSaveHash(save) {
  const relevant = {
    playerName: save.playerName,
    chapter: save.chapter,
    scene: save.scene,
    data: save.data,
    logHistory: save.logHistory
  };

  const json = JSON.stringify(relevant);
  const encoder = new TextEncoder();
  const data = encoder.encode(json);

  const hashBuffer = await crypto.subtle.digest("SHA-256", data);
  const hashArray = Array.from(new Uint8Array(hashBuffer));
  return hashArray.map(b => b.toString(16).padStart(2, "0")).join("");
}

async function updateStartscreenButtons() {
  const saves = await getAllSaves();

  if (saves.length > 0) {
    btnContinue.style.display = "block";
    btnLoadSave.style.display = "block";
  } else {
    btnContinue.style.display = "none";
    btnLoadSave.style.display = "none";
  }
};

// Initial setup
async function initApp() {
  await migrateFromLocalStorage();
  await updateStartscreenButtons();
}

initApp();

function createNewGameData(nickname) {
  return {
    player: {
      name: nickname,
      level: 1,
      xp: 0,
      hp: 20,
      maxHp: 20,
      alignment: 0 // Range -100 to 100
    },
    story: {
      chapter: 1,
      scene: 1,
      location: "Willowvane",
      introCompleted: false,
      forestWolfDefeated: false
    },
    inventory: [],
    weapons: [],
    sets: [],
    flags: {},
    roster: [],
    team: [null, null, null, null, null],
    quests: {
      active: [],
      completed: [],
      lastDailyDate: null,
      currentDaily: null
    },
    materials: {
      ability_fragment: 0
    },
    system: {
      createdAt: Date.now(),
      lastSave: Date.now(),
      currentSaveId: null
    },
    settings: {
      textSpeed: 1, // Multiplier: 0.5 = slow, 1 = normal, 1.5 = fast, 2 = very fast
      musicVolume: 100, // 0-100
      musicMuted: false
    }
  };
}


function enterGame(isNewGame = false) {
  document.getElementById("load-menu").style.display = "none";
  document.getElementById("start-log").textContent = "";
  document.getElementById("output-log").style.pointerEvents = "auto";
  startScreen.style.visibility = "hidden";
  startScreen.style.pointerEvents = "none";

  // Hide Start Screen Background
  const starBg = document.getElementById("star-background");
  if (starBg) starBg.style.display = "none";
  document.body.style.background = "#0f172a"; // Set to plain dark background

  gameScreen.style.display = "block";

  updateDynamicPlayerVars();
  updateStatusBar();

  // Check if this is a new game that needs the intro
  if (!GAME.story.introCompleted && !isNewGame) {
    startIntroScene();
  } else if (GAME.story.introCompleted) {
    log("Welcome back to Script Heroes. For a list of commands, type /help.");
    commandInput.focus();
  }

  updateQuickActions();
}

function updateDynamicPlayerVars() {
  const heroId = (GAME.team && GAME.team[0]) ? GAME.team[0] : null;
  const hero = heroId ? GAME.roster.find(c => c.id === heroId) : null;

  if (hero) {
    playerCurrentHealth = Math.floor(hero.currentResources.hp);
    playerMaxHealth = Math.floor(hero.maxStats.hp);
  } else {
    playerCurrentHealth = GAME.player.hp;
    playerMaxHealth = GAME.player.maxHp;
  }

  // Player level/xp always comes from GAME.player (separate from character level)
  playerXP = Math.floor(GAME.player.xp);
  playerLvl = GAME.player.level;
  playerXpForNextLvl = xpForNextLevel(GAME.player.level);
}

function clearLog() {
  outputLog.innerHTML = "";
}

let lastLogWasBlockEnd = true;

function log(text) {
  const gameLog = document.getElementById("output-log");

  if (gameScreen.style.display !== "none" && gameLog) {
    gameLog.innerHTML += text + "<br>";

    if (autoScrollEnabled) {
      gameLog.scrollTop = gameLog.scrollHeight;
    }

    return;
  }

  const startLog = document.getElementById("start-log");
  if (startScreen.style.display !== "none" && startLog) {
    startLog.innerHTMl += text + "\n";
    startLog.scrollTop = startLog.scrollHeight;
    return;
  }
}

function logBlock(title, lines = []) {
  log(`<strong>${title}</strong>`);

  lines.forEach(line => {
    log(line);
  });

  log("<br>");
}

function updateStatusBar() {

  document.getElementById("player-name").textContent = "Name: " + GAME.player.name;
  document.getElementById("player-level").textContent = `Level: ${playerLvl} (${playerXP}/${playerXpForNextLvl} XP)`;

  // Currency from inventory
  const goldItem = GAME.inventory.find(i => i.id === "gold_coins");
  const silverItem = GAME.inventory.find(i => i.id === "silver_coins");
  const bronzeItem = GAME.inventory.find(i => i.id === "bronze_coins");
  document.getElementById("player-gold").textContent = `G: ${goldItem ? goldItem.quantity : 0}`;
  document.getElementById("player-silver").textContent = `S: ${silverItem ? silverItem.quantity : 0}`;
  document.getElementById("player-bronze").textContent = `B: ${bronzeItem ? bronzeItem.quantity : 0}`;

  document.getElementById("player-location").textContent = "Area: " + GAME.story.location;

  const alignVal = GAME.player.alignment || 0;
  let alignText = "Neutral";
  if (alignVal >= 80) alignText = "Heroic";
  else if (alignVal >= 30) alignText = "Good";
  else if (alignVal <= -80) alignText = "Evil";
  else if (alignVal <= -30) alignText = "Bad";

  const alignEl = document.getElementById("player-alignment");
  if (alignEl) {
    alignEl.textContent = `Align: ${alignText}`;
    alignEl.style.color = alignVal >= 30 ? "#facc15" : alignVal <= -30 ? "#f87171" : "#94a3b8";
  }
}
btnStartGame.addEventListener("click", async () => {
  const validation = validateAndFormatName(nicknameInput.value);
  if (!validation.valid && nicknameInput.value.trim() !== "") {
    showNotification(validation.reason, "error");
    return;
  }

  let nickname = validation.valid ? validation.name : "Hero";

  // Start loader first, then swap screens while obscured
  const loaderPromise = showLoader(2);

  clearLog();
  GAME = createNewGameData(nickname);
  autoSave();
  enterGame(true); // true means skip the internal startIntroScene call

  await loaderPromise;
  startIntroScene(); // Manually start intro after loader is gone
});

btnSettings.addEventListener("click", () => openSettings());
if (btnSettingsStart) btnSettingsStart.addEventListener("click", () => openSettings());

const btnPatchNotes = document.getElementById("btn-patch-notes");
if (btnPatchNotes) {
  btnPatchNotes.addEventListener("click", () => {
    // We can show patch notes even before the game starts by logging to start-log if output-log is hidden
    const targetLog = (gameScreen.style.display === "none") ? document.getElementById("start-log") : outputLog;

    const versions = Object.keys(PATCH_NOTES).sort((a, b) => compareVersions(a, b));
    let html = `<strong>Patch Notes / Version History:</strong><br>`;
    versions.forEach(v => {
      const notes = PATCH_NOTES[v].map(note => `  • ${note}`).join("<br>");
      html += `<br><strong>v${v}</strong><br>${notes}`;
    });

    if (gameScreen.style.display === "none") {
      targetLog.innerHTML = html;
      targetLog.scrollTop = 0;
    } else {
      showPatchNotes();
    }
  });
}

function toggleFullscreen() {
  if (!document.fullscreenElement && !document.webkitFullscreenElement) {
    const el = document.documentElement;
    if (el.requestFullscreen) {
      el.requestFullscreen();
    } else if (el.webkitRequestFullscreen) {
      el.webkitRequestFullscreen(); // Safari / iOS
    }
  } else {
    if (document.exitFullscreen) {
      document.exitFullscreen();
    } else if (document.webkitExitFullscreen) {
      document.webkitExitFullscreen(); // Safari / iOS
    }
  }
}

const menuToggle = document.getElementById("menu-toggle");
const sideMenu = document.getElementById("side-menu");

// Side menu toggle logic
menuToggle.addEventListener("click", () => {
  const visible = sideMenu.style.display === "flex";
  sideMenu.style.display = visible ? "none" : "flex";
});

// Fullscreen toggle logic
const fullscreenToggle = document.getElementById("fullscreen-toggle");
const fullscreenCheckbox = document.getElementById("fullscreen-checkbox");
const fsExpand = document.getElementById("fs-expand");
const fsCompress = document.getElementById("fs-compress");

if (fullscreenToggle) fullscreenToggle.addEventListener("click", toggleFullscreen);
if (fullscreenCheckbox) {
  fullscreenCheckbox.addEventListener("change", toggleFullscreen);
}

// Update icon on fullscreen change
function onFullscreenChange() {
  const isFullscreen = !!(document.fullscreenElement || document.webkitFullscreenElement);
  if (fsExpand) fsExpand.style.display = isFullscreen ? "none" : "block";
  if (fsCompress) fsCompress.style.display = isFullscreen ? "block" : "none";
  if (fullscreenCheckbox) fullscreenCheckbox.checked = isFullscreen;
}
document.addEventListener("fullscreenchange", onFullscreenChange);
document.addEventListener("webkitfullscreenchange", onFullscreenChange);

btnInventory.addEventListener("click", () => openInventory());
btnTeam.addEventListener("click", () => openTeamMenu());
btnQuests.addEventListener("click", () => openQuestMenu());
btnTravel.addEventListener("click", () => openQuickTravel());

// --- Inventory System ---
const inventoryOverlay = document.getElementById("inventory-overlay");
const inventoryGrid = document.getElementById("inventory-grid");
const inventoryDetail = document.getElementById("inventory-detail");
const btnCloseInventory = document.getElementById("btn-close-inventory");
let activeInvTab = "consumable";

function openInventory() {
  // Close side menu if open
  sideMenu.style.display = "none";
  inventoryOverlay.style.display = "flex";
  inventoryDetail.style.display = "none";
  renderInventoryTab(activeInvTab);
}

// Tab switching
document.querySelectorAll(".inv-tab-btn").forEach(btn => {
  btn.addEventListener("click", () => {
    document.querySelectorAll(".inv-tab-btn").forEach(b => b.classList.remove("active"));
    btn.classList.add("active");
    activeInvTab = btn.dataset.invTab;
    inventoryDetail.style.display = "none";
    renderInventoryTab(activeInvTab);
  });
});

// Close
if (btnCloseInventory) {
  btnCloseInventory.addEventListener("click", () => {
    inventoryOverlay.style.display = "none";
  });
}

function renderInventoryTab(type) {
  const items = GAME.inventory.filter(i => i.type === type);
  inventoryGrid.innerHTML = "";

  if (items.length === 0) {
    inventoryGrid.innerHTML = `<div class="inv-empty">No ${type} items yet.</div>`;
    return;
  }

  items.forEach(item => {
    const card = document.createElement("div");
    card.className = `inv-card rarity-${item.rarity || "common"}`;
    card.innerHTML = `
      <div class="inv-card-icon">${item.icon || "📦"}</div>
      <div class="inv-card-name">${item.name}</div>
      ${item.quantity > 1 ? `<div class="inv-card-qty">x${item.quantity}</div>` : ""}
    `;
    card.addEventListener("click", () => {
      // Highlight selected card
      inventoryGrid.querySelectorAll(".inv-card").forEach(c => c.classList.remove("selected"));
      card.classList.add("selected");
      showItemDetail(item);
    });
    inventoryGrid.appendChild(card);
  });
}

function showItemDetail(item) {
  inventoryDetail.style.display = "flex";

  document.getElementById("inv-detail-icon").textContent = item.icon || "📦";
  document.getElementById("inv-detail-name").textContent = item.name;

  const rarityEl = document.getElementById("inv-detail-rarity");
  rarityEl.textContent = (item.rarity || "common").toUpperCase();
  rarityEl.className = `inv-detail-rarity rarity-${item.rarity || "common"}`;

  document.getElementById("inv-detail-desc").textContent = item.description || "No description.";

  // Stats (for equipment)
  const statsEl = document.getElementById("inv-detail-stats");
  statsEl.innerHTML = "";
  if (item.stats) {
    Object.entries(item.stats).forEach(([key, val]) => {
      if (val !== 0) {
        statsEl.innerHTML += `<span class="inv-stat-tag">${key.toUpperCase()} +${val}</span>`;
      }
    });
  }
  if (item.type === "equipment" && item.level) {
    statsEl.innerHTML += `<span class="inv-stat-tag">Lv. ${item.level}</span>`;
  }
  if (item.sellValue) {
    statsEl.innerHTML += `<span class="inv-stat-tag" style="border-color:#eab308;color:#eab308">SELL VALUE: ${item.sellValue} ●</span>`;
  }

  // Actions
  const actionsEl = document.getElementById("inv-detail-actions");
  actionsEl.innerHTML = "";

  if (item.usable) {
    const useBtn = document.createElement("button");
    useBtn.className = "inv-action-btn use";
    useBtn.textContent = "Use";
    useBtn.addEventListener("click", () => useItem(item));
    actionsEl.appendChild(useBtn);
  }

  if (item.type === "equipment") {
    const upgradeBtn = document.createElement("button");
    upgradeBtn.className = "inv-action-btn upgrade";
    upgradeBtn.textContent = "Upgrade (Coming Soon)";
    upgradeBtn.disabled = true;
    upgradeBtn.style.opacity = "0.5";
    actionsEl.appendChild(upgradeBtn);
  }
}

async function useItem(item) {
  if (!item.usable || !item.onUse) {
    log(`${item.name} cannot be used right now.`);
    return;
  }

  // Action dispatch
  switch (item.onUse) {
    case "heal_50":
      if (GAME.player.hp >= GAME.player.maxHp) {
        log("HP is already full!");
        return;
      }
      GAME.player.hp = Math.min(GAME.player.maxHp, GAME.player.hp + 50);
      log(`Used ${item.name}. Restored 50 HP. (${GAME.player.hp}/${GAME.player.maxHp})`);
      updateStatusBar();
      break;

    case "heal_full":
      GAME.player.hp = GAME.player.maxHp;
      log(`Used ${item.name}. Fully restored HP.`);
      updateStatusBar();
      break;

    case "inspect_guild_card":
      const hero = GAME.roster.find(c => c.id === GAME.team[0]);
      const completedCount = GAME.quests.completed ? GAME.quests.completed.length : 0;
      const cardLines = [
        "<strong>━━━ Adventurer's Guild Card ━━━</strong>",
        "",
        `  Name: <strong>${GAME.player.name}</strong>`,
        `  Level: <strong>${GAME.player.level}</strong>`,
        `  Quests Completed: <strong>${completedCount}</strong>`,
        `  Role: <span style=\"color:#78716c; font-style:italic;\">▓▓▓▓▓▓</span> <span style=\"color:#57534e;\">(scorched — illegible)</span>`,
        "",
        "<strong>━━━━━━━━━━━━━━━━━━━━━━━━━━━━</strong>"
      ];
      inventoryOverlay.style.display = "none";
      log(cardLines.join("<br>"));
      return; // Don't consume key items

    case "open_map":
      inventoryOverlay.style.display = "none";
      openWorldMap();
      return; // Don't consume key items

    case "xp_shard_5":
    case "xp_shard_15":
    case "xp_shard_30":
    case "xp_shard_50":
    case "xp_shard_100":
      showNotification("Open a character's detail view and use the Level Up button to apply XP Shards.", "info");
      return;

    default:
      log(`Used ${item.name}.`);
      break;
  }

  // Consume the item (except key items)
  if (item.type !== "key") {
    const itemId = item.instanceId || item.id;
    removeItem(itemId, 1);
    await autoSave();
  }

  // Refresh inventory view
  renderInventoryTab(activeInvTab);
  inventoryDetail.style.display = "none";
}


// --- World Map ---
function openWorldMap() {
  const currentLoc = GAME.story.location;

  // Build overlay
  const overlay = document.createElement("div");
  overlay.id = "map-overlay";

  // Kingdom Selection Dropdown
  const kingdoms = Object.keys(KINGDOM_DATA);
  const currentKingdom = "Kingdom of Sural"; // Default

  overlay.innerHTML = `
    <div class="map-header">
      <div style="display:flex; align-items:center; gap:15px;">
        <h2>World Map</h2>
        <select id="map-kingdom-select" class="map-kingdom-select">
          ${kingdoms.map(k => `<option value="${k}" ${k === currentKingdom ? 'selected' : ''}>${k}</option>`).join("")}
        </select>
      </div>
      <button id="map-close-btn" class="map-close-btn">✕</button>
    </div>
    <div class="map-area" id="map-area">
      <svg class="map-roads" id="map-roads"></svg>
    </div>
    <div class="map-footer">
      <span class="map-legend"><span style="color:#f59e0b">★</span> Current location</span>
      <span class="map-legend"><span style="color:#e2e8f0">■</span> Town / City</span>
      <span class="map-legend"><span style="color:#e2e8f0">▲</span> Wilderness / Outskirts</span>
      <span class="map-legend"><span style="color:#475569">?</span> Locked area</span>
      <span class="map-legend" id="map-quest-legend" style="display:none;"><span id="legend-quest-dot">●</span> Tracked Objective</span>
    </div>
  `;
  document.body.appendChild(overlay);

  const mapArea = document.getElementById("map-area");
  const svg = document.getElementById("map-roads");
  const kingdomSelect = document.getElementById("map-kingdom-select");

  function renderMapContent(kingdomName) {
    const kingdom = KINGDOM_DATA[kingdomName];
    if (!kingdom) return;

    // Clear existing nodes and lines
    mapArea.querySelectorAll(".map-node, .map-region-label").forEach(n => n.remove());
    svg.innerHTML = "";

    // Draw region labels
    if (kingdomName === "Kingdom of Sural") {
      drawRegionLabel("Willowvane", 22, 58); // Adjusted Willowvane label position
      drawRegionLabel("Roads", 45, 52);
      drawRegionLabel("Greenwood", 35, 23);
      drawRegionLabel("Sural", 72, 45);
    }

    // Draw location nodes
    kingdom.locations.forEach(locName => {
      const locData = WORLD_DATA.locations[locName];
      const pos = MAP_POSITIONS[locName];
      if (!pos || !locData) return;

      const isLocked = locData.locked && !(locData.unlockFlag && GAME.story[locData.unlockFlag]);
      const isCurrent = locName === currentLoc;
      const trackedQuest = getTrackedQuestForArea(locName);

      const node = document.createElement("div");
      node.className = `map-node${isCurrent ? " map-current" : ""}${isLocked ? " map-locked" : ""}`;
      node.style.left = pos.x + "%";
      node.style.top = pos.y + "%";

      // POI Highlighting
      if (trackedQuest && !isLocked) {
        const questColor = trackedQuest.type === 'main' ? '#f59e0b' : trackedQuest.type === 'adventurer' ? '#22c55e' : trackedQuest.type === 'daily' ? '#60a5fa' : '#a855f7';
        node.style.boxShadow = `0 0 15px ${questColor}, inset 0 0 10px ${questColor}`;
        node.style.borderColor = questColor;
        node.style.borderStyle = "solid";
        node.style.borderWidth = "2px";
        node.style.borderRadius = "50%";
        document.getElementById("map-quest-legend").style.display = "inline";
        document.getElementById("legend-quest-dot").style.color = questColor;
      }

      const displayName = isLocked ? "???" : locName;
      const displayIcon = isLocked ? "?" : pos.icon;
      const desc = isLocked ? "This area has not been explored yet." : locData.description;

      node.innerHTML = `
        <div class="map-node-icon">${displayIcon}</div>
        <div class="map-node-label">${displayName}</div>
        ${isCurrent ? '<div class="map-node-marker">★</div>' : ""}
      `;

      node.addEventListener("mouseenter", () => {
        const tip = document.createElement("div");
        tip.className = "map-tooltip";
        if (pos.y < 25) tip.classList.add("bottom");
        tip.innerHTML = `<strong>${displayName}</strong><br><span style="color:#94a3b8;font-size:0.8rem">${desc}</span>`;
        node.appendChild(tip);
      });

      node.addEventListener("mouseleave", () => {
        const tip = node.querySelector(".map-tooltip");
        if (tip) tip.remove();
      });

      node.addEventListener("click", (e) => {
        e.stopPropagation();
        // Optional: you could still trigger travel here if desired
      });

      mapArea.appendChild(node);
    });

    // Draw roads function
    function drawMapRoads() {
      const kingdomName = kingdomSelect.value;
      const kingdom = KINGDOM_DATA[kingdomName];
      if (!kingdom) return;

      const areaRect = mapArea.getBoundingClientRect();
      svg.setAttribute("width", areaRect.width);
      svg.setAttribute("height", areaRect.height);
      svg.innerHTML = ""; // Clear old lines

      const drawnPairs = new Set();
      kingdom.locations.forEach(locName => {
        const locData = WORLD_DATA.locations[locName];
        const fromPos = MAP_POSITIONS[locName];
        if (!fromPos || !locData) return;

        locData.connections.forEach(connName => {
          if (!kingdom.locations.includes(connName)) return;
          const toPos = MAP_POSITIONS[connName];
          if (!toPos) return;

          const pairKey = [locName, connName].sort().join("|");
          if (drawnPairs.has(pairKey)) return;
          drawnPairs.add(pairKey);

          const connData = WORLD_DATA.locations[connName];
          const fromLocked = locData.locked && !(locData.unlockFlag && GAME.story[locData.unlockFlag]);
          const toLocked = connData && connData.locked && !(connData.unlockFlag && GAME.story[connData.unlockFlag]);
          const isLockedRoad = fromLocked || toLocked;

          const x1 = (fromPos.x / 100) * areaRect.width;
          const y1 = (fromPos.y / 100) * areaRect.height;
          const x2 = (toPos.x / 100) * areaRect.width;
          const y2 = (toPos.y / 100) * areaRect.height;

          const line = document.createElementNS("http://www.w3.org/2000/svg", "line");
          line.setAttribute("x1", x1);
          line.setAttribute("y1", y1);
          line.setAttribute("x2", x2);
          line.setAttribute("y2", y2);
          line.setAttribute("stroke", isLockedRoad ? "#334155" : "#f59e0b");
          line.setAttribute("stroke-width", isLockedRoad ? "1" : "2");
          line.setAttribute("stroke-dasharray", isLockedRoad ? "6,4" : "none");
          line.setAttribute("stroke-opacity", isLockedRoad ? "0.3" : "0.5");
          svg.appendChild(line);
        });
      });
    }

    // Initial draw
    requestAnimationFrame(drawMapRoads);

    // Watch for resizes (like fullscreen toggle)
    const resizeObserver = new ResizeObserver(() => {
      drawMapRoads();
    });
    resizeObserver.observe(mapArea);
    overlay._resizeObserver = resizeObserver; // Store for cleanup
  }

  function drawRegionLabel(name, x, y) {
    const lbl = document.createElement("div");
    lbl.className = "map-region-label";
    lbl.style.left = x + "%";
    lbl.style.top = y + "%";
    lbl.innerText = name;
    mapArea.appendChild(lbl);
  }

  kingdomSelect.addEventListener("change", (e) => {
    renderMapContent(e.target.value);
  });

  // Initial render
  renderMapContent(currentKingdom);

  // Close handler
  document.getElementById("map-close-btn").addEventListener("click", () => {
    if (overlay._resizeObserver) overlay._resizeObserver.disconnect();
    overlay.remove();
  });
  overlay.addEventListener("click", (e) => {
    if (e.target === overlay) {
      if (overlay._resizeObserver) overlay._resizeObserver.disconnect();
      overlay.remove();
    }
  });
}

// --- Settings System ---
const settingsOverlay = document.getElementById("settings-overlay");
const btnCloseSettings = document.getElementById("btn-close-settings");
const textSpeedOptions = document.getElementById("text-speed-options");
const musicVolumeSlider = document.getElementById("music-volume-slider");
const musicVolumeValue = document.getElementById("music-volume-value");
const musicMuteCheckbox = document.getElementById("music-mute-checkbox");
const fullscreenCheckboxRef = document.getElementById("fullscreen-checkbox");

function openSettings() {
  // Close side menu if open
  if (typeof sideMenu !== 'undefined' && sideMenu) sideMenu.style.display = "none";

  const overlay = document.getElementById("settings-overlay");
  if (overlay) {
    overlay.style.display = "flex";
  }

  if (typeof refreshSettingsUI === 'function') {
    refreshSettingsUI();
  }
}

function refreshSettingsUI() {
  const s = GLOBAL_PREFS;
  // Text speed
  const currentSpeed = s.textSpeed || 1;
  textSpeedOptions.querySelectorAll(".setting-btn").forEach(btn => {
    btn.classList.toggle("active", parseFloat(btn.dataset.speed) === currentSpeed);
  });
  // Music
  const vol = s.musicVolume !== undefined ? s.musicVolume : 100;
  musicVolumeSlider.value = vol;
  musicVolumeValue.textContent = vol + "%";
  musicMuteCheckbox.checked = !!s.musicMuted;

  // Fullscreen
  if (fullscreenCheckboxRef) {
    fullscreenCheckboxRef.checked = !!(document.fullscreenElement || document.webkitFullscreenElement);
  }

  // Narration Style
  const narrationStyle = s.narrationStyle || "narrator";
  const styleOptions = document.getElementById("narration-style-options");
  if (styleOptions) {
    styleOptions.querySelectorAll(".setting-btn").forEach(btn => {
      btn.classList.toggle("active", btn.dataset.style === narrationStyle);
    });
  }

  // Hotkey
  const btnBindHotkey = document.getElementById("btn-bind-hotkey");
  if (btnBindHotkey) {
    btnBindHotkey.textContent = s.narrationHotkey || "None";
  }
}

if (btnCloseSettings) {
  btnCloseSettings.addEventListener("click", () => {
    settingsOverlay.style.display = "none";
  });
}

textSpeedOptions.querySelectorAll(".setting-btn").forEach(btn => {
  btn.addEventListener("click", () => {
    const speed = parseFloat(btn.dataset.speed);
    GLOBAL_PREFS.textSpeed = speed;
    saveGlobalPrefs();
    refreshSettingsUI();
  });
});

// Narration Style Listeners
const styleOptionsContainer = document.getElementById("narration-style-options");
if (styleOptionsContainer) {
  styleOptionsContainer.querySelectorAll(".setting-btn").forEach(btn => {
    btn.addEventListener("click", () => {
      GLOBAL_PREFS.narrationStyle = btn.dataset.style;
      saveGlobalPrefs();
      refreshSettingsUI();
    });
  });
}

// Hotkey Binding
let isBindingHotkey = false;
const btnBindHotkey = document.getElementById("btn-bind-hotkey");
if (btnBindHotkey) {
  btnBindHotkey.addEventListener("click", () => {
    isBindingHotkey = true;
    btnBindHotkey.classList.add("binding");
    btnBindHotkey.textContent = "...";
  });
}

window.addEventListener("keydown", (e) => {
  if (isBindingHotkey) {
    e.preventDefault();
    const key = e.key;

    // Restrictions: Escape, F-keys
    const isFKey = /^F[1-9][0-2]?$/.test(key);
    if (key === "Escape" || isFKey) {
      isBindingHotkey = false;
      btnBindHotkey.classList.remove("binding");
      refreshSettingsUI();
      return;
    }

    GLOBAL_PREFS.narrationHotkey = key;
    isBindingHotkey = false;
    btnBindHotkey.classList.remove("binding");
    saveGlobalPrefs();
    refreshSettingsUI();
    return;
  }

  // Global Hotkey Toggle logic
  if (GLOBAL_PREFS.narrationHotkey && e.key === GLOBAL_PREFS.narrationHotkey) {
    // Deactivate if command line is focused
    if (document.activeElement === commandInput) return;

    GLOBAL_PREFS.narrationStyle = (GLOBAL_PREFS.narrationStyle === "narrator") ? "block" : "narrator";
    saveGlobalPrefs();
    refreshSettingsUI();
    showNotification(`Narration Style: ${GLOBAL_PREFS.narrationStyle.charAt(0).toUpperCase() + GLOBAL_PREFS.narrationStyle.slice(1)}`);
  }
});

let volumeSaveTimeout = null;
musicVolumeSlider.addEventListener("input", () => {
  const vol = parseInt(musicVolumeSlider.value);
  musicVolumeValue.textContent = vol + "%";
  GLOBAL_PREFS.musicVolume = vol;
  musicPlayer.setVolume(vol / 100);

  clearTimeout(volumeSaveTimeout);
  volumeSaveTimeout = setTimeout(() => saveGlobalPrefs(), 500);
});

musicMuteCheckbox.addEventListener("change", () => {
  GLOBAL_PREFS.musicMuted = musicMuteCheckbox.checked;
  musicPlayer.setMuted(musicMuteCheckbox.checked);
  saveGlobalPrefs();
});

// --- Music Player ---
const musicPlayer = {
  audio: new Audio(),
  currentPlaylist: "game",  // "game" or "fight"
  trackCounts: { game: 0, fight: 0 },
  currentTrack: { game: 0, fight: 0 },
  discovered: { game: false, fight: false },
  playing: false,

  // Discover how many tracks exist in a folder by trying to load them
  async discoverTracks(type) {
    const folder = type === "game" ? "game_music" : "fight_music";
    let count = 0;

    while (true) {
      const trackNum = count + 1;
      const url = `./${folder}/track${trackNum}.mp3`;
      const exists = await this._fileExists(url);
      if (!exists) break;
      count++;
    }

    this.trackCounts[type] = count;
    this.discovered[type] = true;
    console.log(`Music: Found ${count} ${type} track(s)`);
    return count;
  },

  _fileExists(url) {
    return new Promise(resolve => {
      const a = new Audio();
      a.preload = "metadata";
      a.onloadedmetadata = () => resolve(true);
      a.onerror = () => resolve(false);
      a.src = url;
    });
  },

  getTrackUrl(type, index) {
    const folder = type === "game" ? "game_music" : "fight_music";
    return `./${folder}/track${index + 1}.mp3`;
  },

  applySettings() {
    const s = GLOBAL_PREFS;
    const vol = s.musicVolume !== undefined ? s.musicVolume : 100;
    const muted = !!s.musicMuted;
    this.audio.volume = vol / 100;
    this.audio.muted = muted;
  },

  setVolume(vol) {
    this.audio.volume = Math.max(0, Math.min(1, vol));
  },

  setMuted(muted) {
    this.audio.muted = muted;
  },

  async play(type) {
    if (!type) type = this.currentPlaylist;
    this.currentPlaylist = type;

    // Discover tracks if not yet done
    if (!this.discovered[type]) {
      await this.discoverTracks(type);
    }

    if (this.trackCounts[type] === 0) {
      console.log(`Music: No ${type} tracks found, skipping playback`);
      return;
    }

    this.playing = true;
    this._playTrack(type, this.currentTrack[type]);
  },

  _playTrack(type, index) {
    if (!this.playing) return;
    if (this.trackCounts[type] === 0) return;

    // Wrap around
    index = index % this.trackCounts[type];
    this.currentTrack[type] = index;

    this.audio.src = this.getTrackUrl(type, index);
    this.applySettings();

    this.audio.onended = () => {
      // Play next track
      this.currentTrack[type] = (index + 1) % this.trackCounts[type];
      this._playTrack(type, this.currentTrack[type]);
    };

    this.audio.play().catch(e => {
      // Autoplay may be blocked — we'll retry on user interaction
      console.log("Music: Autoplay blocked, will retry on interaction");
      this._waitForInteraction();
    });
  },

  _waitForInteraction() {
    const handler = () => {
      if (this.playing) {
        this.audio.play().catch(() => { });
      }
      document.removeEventListener("click", handler);
      document.removeEventListener("keydown", handler);
    };
    document.addEventListener("click", handler, { once: true });
    document.addEventListener("keydown", handler, { once: true });
  },

  stop() {
    this.playing = false;
    this.audio.pause();
    this.audio.currentTime = 0;
  },

  pause() {
    this.playing = false;
    this.audio.pause();
  },

  async switchTo(type) {
    if (this.currentPlaylist === type && this.playing) return;
    this.audio.pause();
    this.currentPlaylist = type;
    await this.play(type);
  }
};

// Start game music on page load (will discover tracks automatically)
// Added a small delay to ensure the UI and log are ready
setTimeout(() => {
  musicPlayer.play("game");
}, 500);

function openTeamMenu() {
  log("Opened Team Menu.");
  // später: Charaktere, Stats, Ausrüstung
};

function openQuestLog() {
  log("Opened Quest List.");
  // später: aktive Quests, abgeschlossene Quests, Belohnungen
};

function openQuickTravel() {
  log("You haven't unlocked Quick travel yet.");
  // später: Orte, Kosten, Freischaltungen
};

function getCurrentLogHistory() {
  const gameLog = document.getElementById("output-log");

  if (!gameLog) return [];

  const lines = gameLog.innerHTML
    .split("<br>")
    .map(line => line.trim())
    .filter(line => line !== "");

  return lines.slice(-100); // Keep last 100 lines
}

function restoreLog(history) {
  const logArea = document.getElementById("output-log");

  if (!logArea) return;

  if (!history || !Array.isArray(history)) {
    logArea.innerHTML = "";
    return;
  }

  logArea.innerHTML = history.join("<br>") + "<br>";
  logArea.scrollTop = logArea.scrollHeight;
}

commandInput.addEventListener("keydown", (e) => {
  if (e.key === "Enter") {
    e.preventDefault();
    commandSubmit.click();
    return;
  }

  if (e.key === "ArrowUp") {
    if (historyIndex > 0) {
      historyIndex--;
      commandInput.value = commandHistory[historyIndex];
    }
    e.preventDefault();
  }

  if (e.key === "ArrowDown") {
    if (historyIndex < commandHistory.length - 1) {
      historyIndex++;
      commandInput.value = commandHistory[historyIndex];
    } else {
      historyIndex = commandHistory.length;
      commandInput.value = "";
    }
    e.preventDefault();
  }
});

commandSubmit.addEventListener("click", () => {
  const cmd = commandInput.value.trim();
  if (cmd === "") return;

  commandHistory.push(cmd);
  historyIndex = commandHistory.length;

  commandInput.value = "";
  handleCommand(cmd);
});

async function handleCommand(cmd) {

  if (waitingForNameInput) {
    if (cmd.trim() !== "") {
      const validation = validateAndFormatName(cmd);
      if (!validation.valid) {
        typeMessage(`'I'm sorry, I couldn't quite catch that. Could you say it again?' (${validation.reason})`);
        return;
      }

      GAME.player.name = validation.name;
      waitingForNameInput = false;
      commandInput.placeholder = "";
      commandInput.disabled = true;
      commandSubmit.disabled = true;
      updateStatusBar();
      clearChoices();
      typeMessage(`'Ah, ${GAME.player.name}. Indeed, a fine name.'`, () => {
        showClassSelection();
      });
    }
    return;
  }

  cmd = cmd.trim().toLowerCase();
  const args = cmd.split(" ");
  const baseCmd = args[0];

  if (baseCmd === "/load" && args[1]) {
    const id = args[1];
    await loadGameById(id);
    await autoSave();
    return;
  }

  if (baseCmd === "/loadslot") {
    const index = parseInt(args[1]);
    await loadGameFromSlot(index);
    return;
  }

  if (baseCmd === "/deleteslot") {
    const index = parseInt(args[1]);
    deleteSaveSlot(index);
    log(`Deleted save slot ${index}.`);
    return;
  }

  if (baseCmd === "/load") {
    await printSaveFilesToOutputLog();
    return;
  }

  switch (baseCmd) {
    case "/help":
      logBlock(
        "Available Commands:",
        AVAILABLE_COMMANDS.map(cmd => `<strong>${cmd}</strong> - ${COMMAND_DETAILS[cmd]}`)
      );
      break;

    case "/status":
      const lvl = GAME.player.level;
      const xp = GAME.player.xp;
      const next = xpForNextLevel(lvl);

      logBlock("Status:",
        [
          `Level: ${lvl}`,
          `XP: ${xp}/${next} (noch ${next - xp} XP bis Level-Up)`,
          `HP: ${GAME.player.hp}/${GAME.player.maxHp}`,
          `Ort: ${GAME.story.location}`
        ]
      );
      break;

    case "/inventory":
      openInventory();
      break;

    case "/quests":
      logBlock("Quests:", ["(Feature will be implemented at a later time.)"]);
      break;

    case "/team":
      logBlock("Team-Menu:", ["(Feature will be implemented at a later time.)"]);
      break;

    case "/travel":
      logBlock("Quick Travel:", ["(Feature will be implemented at a later time.)"]);
      break;

    case "/clear":
      clearLog();
      break;

    case "/save": {
      const saveId = await saveGame();
      showNotification("Game saved!", "info");
      showSaveNamePopup(saveId);
      break;
    }

    case "/guild":
    case "/class":
      if (!args[1]) {
        log("Usage: /class [tank|mage|ranger|support|warrior|healer]");
      } else {
        const role = args[1].toLowerCase();
        const mainHero = GAME.roster[0]; // Hero is always first
        const templateId = `hero_${role}`;
        if (CHARACTER_ROSTER[templateId]) {
          if (mainHero.changeClass(templateId)) {
            log(`Successfully swapped class to <strong>${mainHero.class}</strong>! Stats recalculated.`);
            updateStatusBar();
            if (teamOverlay.style.display !== "none") renderTeamTab();
          }
        } else {
          log("Invalid class role.");
        }
      }
      break;

    case "/talk": {
      const npcName = args.slice(1).join(" ");
      if (!npcName) {
        log("Usage: /talk [NPC Name]");
      } else {
        talkToNPC(npcName);
      }
      break;
    }

    case "/go": {
      const locName = args.slice(1).join(" ");
      if (!locName) {
        log("Usage: /go [Location Name]");
      } else {
        travelTo(locName);
      }
      break;
    }

    case "/patches":
    case "/version":
      showPatchNotes();
      break;

    case "/test-update":
      latestVersion = "9.9.9-debug";
      patchText.textContent = `Update available: v${latestVersion} (DEBUG TEST)`;
      patchNotice.style.display = "flex";
      log("Debug: Triggered update notice.");
      break;

    case "/test-version": {
      const v1 = args[1] || GAME_VERSION;
      const v2 = args[2] || "0.0.6";
      const res = compareVersions(v1, v2);
      log(`Version Test: ${v1} vs ${v2} -> Result: ${res} (${res === 1 ? v2 + " is newer" : (res === -1 ? v1 + " is newer" : "Equal")})`);
      break;
    }

    default:
      log("Unknown Command. For a list of commands, type /help.");
  }
};

function xpForNextLevel(level) {
  // Matches Character.prototype.getMaxXp(): Math.floor(20 * Math.pow(this.level, 1.5))
  return Math.floor(20 * Math.pow(level, 1.5));
}

async function addXP(amount) {
  GAME.player.xp += amount;

  let leveled = false;
  while (GAME.player.xp >= xpForNextLevel(GAME.player.level)) {
    const needed = xpForNextLevel(GAME.player.level);
    GAME.player.xp -= needed;
    GAME.player.level++;
    leveled = true;
  }

  if (leveled) {
    log(`🎉 Level Up! You reached Level ${GAME.player.level}.`);
  }

  updateDynamicPlayerVars();
  updateStatusBar();
  await autoSave();
}

function changeAlignment(amount) {
  if (!GAME) return;
  const old = GAME.alignment || 0;
  GAME.alignment = Math.max(-100, Math.min(100, old + amount));

  const diff = GAME.alignment - old;
  if (diff === 0) return;

  const color = diff > 0 ? "#e2e8f0" : "#ef4444";
  const label = diff > 0 ? "light shifted" : "darkness deepened";
  log(`<br><span style="color:${color}; font-style:italic;">Your internal ${label}... (Alignment: ${GAME.alignment})</span>`);
  autoSave();
}

// --- IndexedDB Storage Logic ---
const DB_NAME = "ScriptHeroesDB";
const STORE_NAME = "saves";
const DB_VERSION = 1;

function initDB() {
  return new Promise((resolve, reject) => {
    const request = indexedDB.open(DB_NAME, DB_VERSION);

    request.onupgradeneeded = (e) => {
      const db = e.target.result;
      if (!db.objectStoreNames.contains(STORE_NAME)) {
        db.createObjectStore(STORE_NAME, { keyPath: "id" });
      }
    };

    request.onsuccess = (e) => resolve(e.target.result);
    request.onerror = (e) => reject("IndexedDB error: " + e.target.errorCode);
  });
}

async function getDB() {
  return await initDB();
}

async function getAllSaves() {
  const db = await getDB();
  return new Promise((resolve, reject) => {
    const transaction = db.transaction(STORE_NAME, "readonly");
    const store = transaction.objectStore(STORE_NAME);
    const request = store.getAll();

    request.onsuccess = () => resolve(request.result || []);
    request.onerror = () => reject(request.error);
  });
}

async function storeAllSaves(saves) {
  const db = await getDB();
  return new Promise((resolve, reject) => {
    const transaction = db.transaction(STORE_NAME, "readwrite");
    const store = transaction.objectStore(STORE_NAME);

    // Clear existing to match old "storeAll" behavior or just put all
    store.clear();
    saves.forEach(save => store.put(save));

    transaction.oncomplete = () => resolve();
    transaction.onerror = () => reject(transaction.error);
  });
}

// Single save helper (more efficient than storeAllSaves)
async function putSave(save) {
  const db = await getDB();
  return new Promise((resolve, reject) => {
    const transaction = db.transaction(STORE_NAME, "readwrite");
    const store = transaction.objectStore(STORE_NAME);
    store.put(save);
    transaction.oncomplete = () => resolve();
    transaction.onerror = () => reject(transaction.error);
  });
}

async function deleteSaveFromDB(id) {
  const db = await getDB();
  return new Promise((resolve, reject) => {
    const transaction = db.transaction(STORE_NAME, "readwrite");
    const store = transaction.objectStore(STORE_NAME);
    store.delete(id);
    transaction.oncomplete = () => resolve();
    transaction.onerror = () => reject(transaction.error);
  });
}

async function migrateFromLocalStorage() {
  const raw = localStorage.getItem("game_saves");
  if (raw) {
    try {
      const saves = JSON.parse(raw);
      if (Array.isArray(saves) && saves.length > 0) {
        console.log("Migrating saves from localStorage to IndexedDB...");
        await storeAllSaves(saves);
        localStorage.removeItem("game_saves");
        console.log("Migration complete. localStorage cleared.");
      }
    } catch (e) {
      console.error("Migration failed:", e);
    }
  }
}

// Check if any saves exist across both
async function hasSave() {
  const saves = await getAllSaves();
  return saves.length > 0;
}

async function saveGame(customName = null) {
  const saves = await getAllSaves();

  GAME.system.lastSave = Date.now();
  const defaultId = GAME.system.currentSaveId || ("save_" + Date.now());
  const newSave = {
    id: customName && customName.trim() !== "" ? customName : defaultId,
    timestamp: Date.now(),
    playerName: GAME.player.name,
    chapter: GAME.story.chapter,
    scene: GAME.story.scene,
    data: GAME,
    logHistory: getCurrentLogHistory()
  };

  // Only check for duplicates if it's a NEW custom name or a new game save
  if (!GAME.system.currentSaveId || (customName && customName !== GAME.system.currentSaveId)) {
    const existing = saves.find(s => s.id === newSave.id);
    if (existing) {
      newSave.id = newSave.id + "_" + Date.now();
    }
  }

  // Update current save ID after choosing final name
  GAME.system.currentSaveId = newSave.id;

  newSave.hash = await computeSaveHash(newSave);

  await putSave(newSave);

  logBlock("Game saved.", [
    `ID: ${newSave.id}`,
    `Time: ${new Date(newSave.timestamp).toLocaleString()}`
  ]);

  return newSave.id;
}

async function renameSave(oldId, newName) {
  if (!newName || newName.trim() === "") return oldId;

  const saves = await getAllSaves();
  const save = saves.find(s => s.id === oldId);
  if (!save) return oldId;

  let finalName = newName.trim();
  const existing = saves.find(s => s.id === finalName);
  if (existing && existing.id !== oldId) {
    finalName += "_" + Date.now();
  }

  const updatedSave = {
    ...save,
    id: finalName,
    hash: "" // Reset hash to recompute
  };

  // Recompute hash for the new object structure (id changed)
  updatedSave.hash = await computeSaveHash(updatedSave);

  await deleteSaveFromDB(oldId);
  await putSave(updatedSave);

  return finalName;
}

function showSaveNamePopup(saveId) {
  const overlay = document.createElement("div");
  overlay.className = "save-modal-overlay";

  overlay.innerHTML = `
    <div class="save-modal">
      <h3>Name Your Save</h3>
      <p>Enter a name to help you identify this save later.</p>
      <input type="text" id="save-name-input" placeholder="My Epic Journey..." value="${saveId || ''}" maxlength="30">
      <div class="save-modal-buttons">
        <button class="save-modal-btn cancel" id="save-modal-cancel">Keep Default</button>
        <button class="save-modal-btn confirm" id="save-modal-confirm">Save Name</button>
      </div>
    </div>
  `;

  document.body.appendChild(overlay);

  const input = overlay.querySelector("#save-name-input");
  const confirmBtn = overlay.querySelector("#save-modal-confirm");
  const cancelBtn = overlay.querySelector("#save-modal-cancel");

  input.focus();

  const close = () => overlay.remove();

  confirmBtn.onclick = async () => {
    const newName = escapeHTML(input.value.trim());
    if (newName) {
      const finalId = await renameSave(saveId, newName);
      showNotification(`Save renamed to "${finalId}"`, "info");
    }
    close();
  };

  cancelBtn.onclick = close;

  overlay.onclick = (e) => {
    if (e.target === overlay) close();
  };

  input.onkeydown = (e) => {
    if (e.key === "Enter") confirmBtn.onclick();
    if (e.key === "Escape") cancelBtn.onclick();
  };
}

async function loadGameMenu() {
  const saves = await getAllSaves();
  const menu = document.getElementById("load-menu");

  menu.innerHTML = "";

  if (saves.length === 0) {
    menu.style.display = "block";
    menu.innerHTML = "<div>No Savefiles available.</div>";
    return;
  }

  menu.style.display = "block";

  saves.forEach(save => {
    const slot = document.createElement("div");
    slot.className = "save-slot";

    const label = document.createElement("div");
    label.textContent = `${save.id} — ${new Date(save.timestamp).toLocaleString()}`;
    label.style.flex = "1";

    const del = document.createElement("button");
    del.textContent = "X";
    del.className = "delete-btn-slot";
    del.style.marginLeft = "10px";
    del.style.background = "#d62828";
    del.style.color = "white";
    del.style.border = "none";
    del.style.borderRadius = "4px";
    del.style.cursor = "pointer";
    del.style.padding = "4px 8px";

    del.addEventListener("click", (e) => {
      e.stopPropagation();
      openDeletePopup(save.id);
    });


    slot.addEventListener("click", () => {
      loadGameById(save.id);
    });

    slot.style.display = "flex";
    slot.style.alignItems = "center";

    slot.appendChild(label);
    slot.appendChild(del);
    menu.appendChild(slot);
  });
};

async function loadLatestGame() {
  const saves = await getAllSaves();
  if (saves.length === 0) {
    log("No saved games found.");
    return;
  }
  // Sort by timestamp descending
  saves.sort((a, b) => b.timestamp - a.timestamp);
  await loadGameById(saves[0].id);
}


async function autoSave() {
  GAME.system.lastSave = Date.now();
  const auto = {
    id: "autosave",
    timestamp: Date.now(),
    playerName: GAME.player.name,
    chapter: GAME.story.chapter,
    scene: GAME.story.scene,
    data: GAME,
    logHistory: getCurrentLogHistory()
  };

  auto.hash = await computeSaveHash(auto);

  await putSave(auto);
}

async function setStoryScene(chapter, scene) {
  GAME.story.chapter = chapter;
  GAME.story.scene = scene;
  await autoSave();
};

async function normalizeCurrency() {
  if (!GAME || !GAME.inventory) return;

  const bronze = GAME.inventory.find(i => i.id === "bronze_coins");
  const silver = GAME.inventory.find(i => i.id === "silver_coins");
  const gold = GAME.inventory.find(i => i.id === "gold_coins");

  let changed = false;

  // Bronze -> Silver
  if (bronze && bronze.quantity >= 100) {
    const silverGain = Math.floor(bronze.quantity / 100);
    bronze.quantity %= 100;

    const existingSilver = GAME.inventory.find(i => i.id === "silver_coins");
    if (existingSilver) {
      existingSilver.quantity += silverGain;
    } else {
      GAME.inventory.push({
        id: "silver_coins", name: "Silver Coins", type: "key",
        description: "Standard currency of Sural. 100 silver coins equal 1 gold coin.",
        rarity: "uncommon", icon: "●", stackable: true, quantity: silverGain, usable: false
      });
    }
    log(`<span style="color:#eab308">Exchanged ${silverGain * 100} Bronze for ${silverGain} Silver!</span>`);
    changed = true;
  }

  // Re-fetch Silver in case it was just added or modified
  const currentSilver = GAME.inventory.find(i => i.id === "silver_coins");

  // Silver -> Gold
  if (currentSilver && currentSilver.quantity >= 100) {
    const goldGain = Math.floor(currentSilver.quantity / 100);
    currentSilver.quantity %= 100;

    const existingGold = GAME.inventory.find(i => i.id === "gold_coins");
    if (existingGold) {
      existingGold.quantity += goldGain;
    } else {
      GAME.inventory.push({
        id: "gold_coins", name: "Gold Coins", type: "key",
        description: "High value currency of Sural.",
        rarity: "rare", icon: "🪙", stackable: true, quantity: goldGain, usable: false
      });
    }
    log(`<span style="color:#eab308">Exchanged ${goldGain * 100} Silver for ${goldGain} Gold!</span>`);
    changed = true;
  }

  if (changed) {
    updateStatusBar();
    await autoSave();
  }
}

async function addItem(itemObj) {
  // If stackable, try to find existing stack
  if (itemObj.stackable !== false) {
    const existing = GAME.inventory.find(i => i.id === itemObj.id);
    if (existing) {
      existing.quantity = (existing.quantity || 1) + (itemObj.quantity || 1);

      // Currency Conversion Logic check
      if (itemObj.id === "bronze_coins" || itemObj.id === "silver_coins") {
        await normalizeCurrency();
      } else {
        await autoSave();
      }
      return;
    }
  }

  // Equipment gets a unique instance ID
  if (itemObj.type === "equipment") {
    itemObj.instanceId = crypto.randomUUID();
    itemObj.stackable = false;
    itemObj.quantity = 1;
    if (!itemObj.level) itemObj.level = 1;
  }

  // Ensure quantity defaults
  if (!itemObj.quantity) itemObj.quantity = 1;

  GAME.inventory.push(itemObj);

  // Currency Conversion Logic for new stacks
  if (itemObj.id === "bronze_coins" || itemObj.id === "silver_coins") {
    await normalizeCurrency();
  }

  // Centralized logging with rarity colors
  const color = getRarityColor(itemObj.rarity);
  const qty = itemObj.quantity > 1 ? ` x${itemObj.quantity}` : "";
  log(`<span style="color:${color}">Received: ${itemObj.name}${qty}</span>`);

  await autoSave();
}

function removeItem(id, quantity = 1) {
  const idx = GAME.inventory.findIndex(i => i.id === id || i.instanceId === id);
  if (idx === -1) return false;

  const item = GAME.inventory[idx];
  if (item.stackable !== false && item.quantity > quantity) {
    item.quantity -= quantity;
  } else {
    GAME.inventory.splice(idx, 1);
  }
  return true;
}


async function loadGameById(id) {
  const saves = await getAllSaves();
  const save = saves.find(s => s.id === id);

  if (!save) {
    logBlock("Error:", [`Savefile ${id} not found.`]);
    return;
  }

  const expectedHash = save.hash;
  const actualHash = await hashSaveObject({
    playerName: save.playerName,
    chapter: save.chapter,
    scene: save.scene,
    data: save.data,
    logHistory: save.logHistory
  });

  if (expectedHash !== actualHash) {
    logBlock("Warning:", [
      "Savefile integrity check failed.",
      "The save may be corrupted or modified."
    ]);
    return;
  }

  GAME = save.data;
  if (GAME.system) GAME.system.currentSaveId = id;

  // Re-instantiate Character methods
  rehydrateGAME();
  updateDynamicPlayerVars();

  // Backfill Team System for old saves
  if (!GAME.roster) GAME.roster = [];
  if (!GAME.team) GAME.team = [null, null, null, null, null];

  // Backfill Quest System for old saves
  if (!GAME.quests) GAME.quests = { active: [], completed: [], lastDailyDate: null, currentDaily: null };

  // Backfill Settings for old saves
  if (!GAME.settings) GAME.settings = { textSpeed: 1, musicVolume: 100, musicMuted: false };
  if (GAME.settings.musicVolume === undefined) GAME.settings.musicVolume = 100;
  if (GAME.settings.musicMuted === undefined) GAME.settings.musicMuted = false;

  // Backfill Combat flags for old saves
  if (GAME.story.forestWolfDefeated === undefined) GAME.story.forestWolfDefeated = false;
  if (GAME.story.roadUnlocked === undefined) GAME.story.roadUnlocked = false;

  // Start loader and swap screen while obscured
  const loaderPromise = showLoader(2);

  if (startScreen.style.visibility !== "hidden") {
    enterGame();
  }

  await loaderPromise;

  updateStatusBar();
  updateQuickActions();
  clearLog();
  restoreLog(save.logHistory);
  log(`Successfully loaded Save file ${id}.`);
}

async function loadGameFromSlot(index) {
  const saves = await getAllSaves();
  const manualSaves = saves.filter(s => s.id !== "autosave");
  manualSaves.sort((a, b) => b.timestamp - a.timestamp);

  if (index < 1 || index > manualSaves.length) {
    logBlock("Error:", [`Save slot ${index} not found.`]);
    return;
  }

  const save = manualSaves[index - 1];
  await loadGameById(save.id);
}

async function deleteSaveSlot(index) {
  const saves = await getAllSaves();
  const manualSaves = saves.filter(s => s.id !== "autosave");
  manualSaves.sort((a, b) => b.timestamp - a.timestamp);

  if (index < 1 || index > manualSaves.length) {
    logBlock("Error:", [`Save slot ${index} not found.`]);
    return;
  }

  const saveToDelete = manualSaves[index - 1];
  await deleteSaveFromDB(saveToDelete.id);
}

async function loadLatestGame() {
  const saves = await getAllSaves();

  if (saves.length === 0) {
    logBlock("No saved Files found.");
    return;
  }

  const auto = saves.find(s => s.id === "autosave");

  if (auto) {
    const expected = auto.hash;
    const actual = await computeSaveHash(auto);

    if (expected !== actual) {
      logBlock("Warning:", [
        "Autosave integrity check failed.",
        "The autosave may be corrupted or modified."
      ]);
      return;
    }
    const loaderPromise = showLoader(2);
    GAME = auto.data;
    rehydrateGAME();
    clearLog();
    restoreLog(auto.logHistory);
    log("Loaded Autosave.");
    updateStatusBar();
    enterGame();
    await loaderPromise;
    return;
  }

  const manualSaves = saves.filter(s => s.id !== "autosave");

  if (manualSaves.length === 0) {
    logBlock("No saved files found.");
    return;
  }

  manualSaves.sort((a, b) => b.timestamp - a.timestamp);
  const latest = manualSaves[0];

  const expected = latest.hash;
  const actual = await computeSaveHash(latest);

  if (expected !== actual) {
    logBlock("Warning:", [
      `Integrity check failed for save ${latest.id}.`,
      "The save may be corrupted or modified."
    ]);
    return;
  }
  const loaderPromise = showLoader(2);
  GAME = latest.data;
  rehydrateGAME();
  clearLog();
  restoreLog(latest.logHistory);
  log(`Successfully Loaded Savefile ${latest.id}.`);
  updateStatusBar();
  updateQuickActions();
  enterGame();
  await loaderPromise;
}

btnSave.addEventListener("click", async () => {
  const saveId = await saveGame();
  showNotification("Game saved!", "info");
  showSaveNamePopup(saveId);
});
btnExport.addEventListener("click", async () => await exportSaves());
btnImport.addEventListener("click", () => {
  const input = document.createElement("input");
  input.type = "file";
  input.accept = "application/json";
  input.onchange = async (e) => {
    const file = e.target.files[0];
    if (file) {
      await importSaves(file);
    }
  };
  input.click();
});
btnContinue.addEventListener("click", async () => await loadLatestGame());
btnLoadSave.addEventListener("click", async () => await loadGameMenu());

function openDeletePopup(saveId) {
  saveToDelete = saveId;
  document.getElementById("delete-popup").style.display = "flex";
}

function closeDeletePopup() {
  saveToDelete = null;
  document.getElementById("delete-popup").style.display = "none";
}

async function deleteSave() {
  if (!saveToDelete) return;

  await deleteSaveFromDB(saveToDelete);

  saveToDelete = null;
  closeDeletePopup();
  await loadGameMenu();
}

document.getElementById("delete-yes").addEventListener("click", deleteSave);
document.getElementById("delete-no").addEventListener("click", closeDeletePopup);

async function exportSaves() {
  const saves = await getAllSaves();
  const json = JSON.stringify(saves, null, 2);

  const blob = new Blob([json], { type: "application/json" });
  const url = URL.createObjectURL(blob);

  const a = document.createElement("a");
  a.href = url;
  a.download = "game_saves_export.json";
  a.click();

  URL.revokeObjectURL(url);
}

async function importSaves(file) {
  const text = await file.text();
  let imported;

  try {
    imported = JSON.parse(text);
  } catch (e) {
    logBlock("Import Error:", ["Invalid JSON file."]);
    return;
  }

  if (!Array.isArray(imported)) {
    logBlock("Import Error:", ["File does not contain a save array."]);
    return;
  }

  const existingSaves = await getAllSaves();
  const valid = [];
  let mergedCount = 0;

  for (const save of imported) {
    if (!save.hash) continue;

    const actual = await computeSaveHash(save);
    if (actual !== save.hash) continue;

    // Avoid duplicates by checking ID
    if (!existingSaves.find(s => s.id === save.id)) {
      await putSave(save);
      mergedCount++;
    }
  }

  if (mergedCount === 0) {
    logBlock("Import Result:", ["No new valid saves were found or all were duplicates."]);
    return;
  }

  logBlock("Import Complete:", [
    `${mergedCount} new save(s) merged successfully.`,
    "Type /load to see the updated list."
  ]);
}

async function printSaveFilesToOutputLog() {
  const allSaves = await getAllSaves();
  const saves = allSaves.filter(s => s.id !== "autosave");
  saves.sort((a, b) => b.timestamp - a.timestamp);

  if (!saves || saves.length === 0) {
    log("No manual save files found.");
    return;
  }

  log("=== Available Save Files ===");

  saves.forEach((save, index) => {
    const date = new Date(save.timestamp).toLocaleString();
    const name = save.playerName || `Save ${index + 1}`;

    log(`${index + 1}. ${name} — ${date}`);
    log(`   /loadslot ${index + 1}   |   /deleteslot ${index + 1}`);
  });

  log("============================");
}

function showLoader(seconds) {
  return new Promise((resolve) => {
    const loader = document.getElementById("loader-overlay");
    if (!loader) {
      console.error("Loader not found");
      resolve();
      return;
    }

    loader.classList.remove("hidden");

    setTimeout(() => {
      loader.classList.add("hidden");
      // Wait for the 0.4s CSS transition to finish before resolving
      setTimeout(resolve, 400);
    }, seconds * 1000);
  });
}

const btnImportStart = document.getElementById("btn-import-start");
if (btnImportStart) {
  btnImportStart.addEventListener("click", () => {
    const input = document.createElement("input");
    input.type = "file";
    input.accept = "application/json";

    input.onchange = async (e) => {
      const file = e.target.files[0];
      if (file) {
        await importSaves(file);
        location.reload();
      }
    };

    input.click();
  });
}

const RARITY = {
  R: {
    name: "Rare",
    growthMod: 1.0,
    caps: [20, 30, 40, 50, 60, 70], // Last is Soft Max
    hiddenCap: null
  },
  SR: {
    name: "Super Rare",
    growthMod: 1.25,
    caps: [30, 40, 50, 60, 70, 80],
    hiddenCap: 100
  },
  SSR: {
    name: "SSR",
    growthMod: 1.5,
    caps: [30, 50, 60, 70, 80, 100],
    hiddenCap: 120
  },
  UR: {
    name: "Ultra Rare",
    growthMod: 2.0,
    caps: [50, 60, 75, 90, 100, 120],
    hiddenCap: 150
  }
};
const CLASS = {
  WARRIOR: "Warrior",
  TANK: "Tank",
  MAGE: "Mage",
  RANGER: "Ranger",
  HEALER: "Healer",
  SUPPORT: "Support"
};

const MAP_POSITIONS = {
  // ■ = Town / City    ▲ = Wilderness / Outskirts    ─ = Road
  "Willowvane": { x: 20, y: 40, icon: "■" },
  "Town Square": { x: 28, y: 52, icon: "■" },
  "Forest Entrance": { x: 16, y: 65, icon: "▲" },
  "Willowvane Road": { x: 45, y: 51, icon: "─" },
  "Greenwood": { x: 35, y: 30, icon: "■" },
  "Greenwood Street": { x: 28, y: 24, icon: "─" },
  "Town Plaza": { x: 18, y: 10, icon: "■" },
  "Church": { x: 38, y: 8, icon: "■" },
  "Abandoned House": { x: 15, y: 22, icon: "■" },
  "Greenwood Forest": { x: 42, y: 18, icon: "▲" },
  "Goblin Cave": { x: 48, y: 10, icon: "▲" },
  "Layla's House": { x: 52, y: 22, icon: "■" },
  "Sural City": { x: 72, y: 50, icon: "■" }
};

const KINGDOM_DATA = {
  "Kingdom of Sural": {
    regions: ["Willowvane", "Greenwood", "Sural"],
    locations: ["Willowvane", "Town Square", "Forest Entrance", "Willowvane Road", "Greenwood", "Greenwood Street", "Town Plaza", "Church", "Abandoned House", "Greenwood Forest", "Goblin Cave", "Layla's House", "Sural City"]
  }
};

const WORLD_DATA = {
  locations: {
    "Willowvane": {
      name: "Willowvane",
      region: "Willowvane",
      description: "The peaceful outskirts of the village. The air smells of pine and fresh earth.",
      npcs: ["Elderly Woman"],
      connections: ["Town Square"]
    },
    "Town Square": {
      name: "Town Square",
      region: "Willowvane",
      description: "A bustling area with cobblestone paths. A dormant fountain stands at the center.",
      npcs: ["Elder"],
      connections: ["Willowvane", "Forest Entrance", "Willowvane Road"]
    },
    "Forest Entrance": {
      name: "Forest Entrance",
      region: "Willowvane",
      description: "The edge of a dark, dense forest. You hear distant, unsettling sounds.",
      npcs: [],
      connections: ["Town Square"]
    },
    "Willowvane Road": {
      name: "Willowvane Road",
      region: "Roads",
      description: "A well-worn dirt road stretching out from Willowvane. Merchants and travelers occasionally pass through.",
      npcs: ["Farmer"],
      connections: ["Town Square", "Greenwood", "Sural City"],
      locked: true,
      unlockFlag: "roadUnlocked"
    },
    "Greenwood": {
      name: "Greenwood",
      region: "Greenwood",
      description: "A large, bustling market town surrounded by ancient oak trees. The scent of spices and fresh bread fills the air.",
      npcs: ["Merchant"],
      connections: ["Willowvane Road", "Greenwood Street"],
      locked: true,
      unlockFlag: "roadUnlocked"
    },
    "Greenwood Street": {
      name: "Greenwood Street",
      region: "Greenwood",
      description: "A lively cobblestone street lined with shops and homes. Residents bustle about their daily routines under the shade of towering oaks.",
      npcs: [],
      connections: ["Greenwood", "Town Plaza", "Church", "Abandoned House", "Greenwood Forest", "Goblin Cave", "Layla's House"],
      locked: true,
      unlockFlag: "greenwoodStreetUnlocked"
    },
    "Town Plaza": {
      name: "Town Plaza",
      region: "Greenwood",
      description: "A wide, open plaza at the heart of Greenwood. A beautiful stone fountain sits at its center, water cascading gently. Townsfolk gather here to rest and talk.",
      npcs: [],
      connections: ["Greenwood Street"],
      locked: true,
      unlockFlag: "townPlazaDiscovered"
    },
    "Church": {
      name: "Church",
      region: "Greenwood",
      description: "A modest stone church with stained glass windows. Inside, the Sisters care for orphaned children, providing them with shelter, warmth, and hope.",
      npcs: ["Sister Helena"],
      connections: ["Greenwood Street"],
      locked: true,
      unlockFlag: "churchDiscovered"
    },
    "Abandoned House": {
      name: "Abandoned House",
      region: "Greenwood",
      description: "A crumbling house in the center of town. The front door is shattered outward — whatever destroyed it came from the inside. Claw marks scar the walls.",
      npcs: [],
      connections: ["Greenwood Street"],
      locked: true,
      unlockFlag: "abandonedHouseDiscovered"
    },
    "Greenwood Forest": {
      name: "Greenwood Forest",
      region: "Greenwood",
      description: "A dense, ancient forest just outside the town walls. Sunlight barely penetrates the thick canopy. The air is heavy with the scent of moss and damp earth.",
      npcs: [],
      connections: ["Greenwood Street"],
      locked: true,
      unlockFlag: "greenwoodForestDiscovered"
    },
    "Goblin Cave": {
      name: "Goblin Cave",
      region: "Greenwood",
      description: "A dark cave mouth carved into a rocky hillside. Old goblin tracks litter the ground, but something — or someone — seems to have cleared them out already.",
      npcs: ["Layla"],
      connections: ["Greenwood Street"],
      locked: true,
      unlockFlag: "goblinCaveDiscovered"
    },
    "Layla's House": {
      name: "Layla's House",
      region: "Greenwood",
      description: "A cozy, well-kept home tucked behind a row of oaks. Flowerpots line the windowsills. A warm light glows from within.",
      npcs: ["Layla", "Layla's Mother"],
      connections: ["Greenwood Street"],
      locked: true,
      unlockFlag: "laylasHouseUnlocked"
    },
    "Sural City": {
      name: "Sural City",
      region: "Sural",
      description: "The grand capital of the human kingdom. Towering stone walls and gleaming spires rise above the rooftops.",
      npcs: [],
      connections: ["Willowvane Road"],
      locked: true,
      unlockFlag: "roadUnlocked"
    }
  },
  npcs: {
    "Elderly Woman": {
      name: "Elderly Woman",
      dialogue: {
        default: ["Bless you, traveler. I hope you find what you're looking for."]
      }
    },
    "Elder": {
      name: "Elder",
      dialogue: {
        default: ["Greetings, traveler. Our town isn't what it used to be."],
        quest_m1: [
          "Ah, that card... it has the mark of the Adventurer's Guild. It's been a long time since I've seen one of those.",
          "You were found near the outskirts, were you not? Truly a strange occurrence in these troubled times.",
          "We are plagued by shadows... it is no longer safe to wander far from the square.",
          "If you truly wish to help, go to the Forest Entrance and report back on what you see. We must know the extent of the threat."
        ],
        post_wolf: [
          "You... you actually defeated that beast? Remarkable. You are stronger than you look.",
          "Listen well. Beyond the village road lies the wider world.",
          "To the northeast is <b>Greenwood</b> — a large market town. You'll find better supplies and perhaps others who share your sense of adventure.",
          "And further along the road... <b>Sural City</b>, the capital of our kingdom. A place of great power, but also great danger.",
          "I have marked both on your map. The road from Willowvane is now safe enough to travel, thanks to you.",
          "Go forth, adventurer. Willowvane will remember what you've done."
        ]
      }
    },
    "Farmer": {
      name: "Farmer",
      dialogue: {
        default: ["Oh, you again! Thank ye for helping me out. If ye ever pass through, don't be a stranger."],
        intro: [
          "Wait! Wait, please! Ye there, adventurer!",
          "Sorry to stop ye on the road like this... My name's Bertram. I work the fields just outside the village.",
          "My daughter Hina... she left home a few weeks ago. Said she wanted to become an adventurer, can ye believe it?",
          "Now I've got nobody to help me with the deliveries. I've got a package that needs to reach a merchant at the marketplace in Greenwood.",
          "Would ye be willing to take it there for me? I'd be in yer debt, truly."
        ],
        quest_m2: [
          "Oh, bless ye! Here, take this package. It needs to go to the merchant at the Greenwood marketplace.",
          "His name's Garrett — he runs the biggest stall in town. Can't miss him.",
          "Tell him Bertram sent ye, and he'll know what it's about."
        ],
        about_hina: [
          "Hina... aye, my little girl. Well, she's not so little anymore, I suppose.",
          "She was always so lively, full of energy. Running through the fields, swinging sticks like they were swords...",
          "One morning she just packed her things and left a note. Said she was going to find an adventurer party and see the world.",
          "I'm sad she's gone, and worried sick most days... but I believe in her. She's got her mother's spirit.",
          "I just hope she finds great friends out there. A good party to watch her back, ye know?",
          "If ye ever run into a girl named Hina on yer travels... tell her old dad misses her."
        ],
        post_quest: ["Ye already delivered the package? That was fast! Garrett must've been pleased. Thank ye kindly, adventurer."]
      }
    },
    "Merchant": {
      name: "Merchant Garrett",
      dialogue: {
        default: ["Welcome to Greenwood Market! Finest goods in the region. Have a look around."],
        delivery: [
          "Hmm? A delivery from Bertram? Ah, I've been waiting for this!",
          "That old farmer makes the best preserved goods this side of the kingdom. Can't get enough of 'em.",
          "Here, take this for your trouble. And tell Bertram I said thanks!"
        ]
      }
    },
    "Sister Helena": {
      name: "Sister Helena",
      dialogue: {
        default: [
          "Welcome, child. This is the Church of Greenwood.",
          "We take in orphans from across the region and raise them with love and care.",
          "Many of these children lost their families to the growing darkness... but here, they find a new one.",
          "If you ever need a moment of peace, you are always welcome."
        ]
      }
    },
    "Layla": {
      name: "Layla",
      dialogue: {
        default: [
          "Oh, you're back. What's up? Looking for more goblins to fight?",
          "I already cleared this cave out, so you're a bit late for that."
        ],
        first_meeting: [
          "Hm? Who are you? Another adventurer come to clear the goblin cave?",
          "Well, you're too late. I wiped these goblins out a long time ago. My little brother and his friends used to play in the forest nearby...",
          "I couldn't let those things anywhere near them. So I took care of it. Every last one.",
          "The name's Layla. I used to be ranked third among all adventurers in the kingdom. But that was... before.",
          "I stopped adventuring recently. Had my reasons. Now I just keep busy making sure the area around Greenwood stays safe.",
          "My brother actually just left for the capital with his friends not long ago. Said they wanted to become adventurers themselves.",
          "Anyway... you look like you've been walking for a while. Why don't you come by my place for lunch?",
          "My mom makes the best vegetable stew you'll ever taste. Trust me on that one.",
          "It's just down the road on Greenwood Street. I'll head there now. See you around."
        ],
        at_home: [
          "Hey, you made it! Come in, sit down. Mom's already got the stew going.",
          "Mom, this is the adventurer I was telling you about!"
        ]
      }
    },
    "Layla's Mother": {
      name: "Layla's Mother",
      dialogue: {
        default: [
          "Oh my, a visitor! How wonderful. Please, sit down.",
          "Layla doesn't bring friends home very often. You must be special.",
          "Thank you for being kind to my daughter. She acts tough, but she has a gentle heart.",
          "Would you like some tea? I just made a fresh pot."
        ]
      }
    }
  }
};

const CHARACTER_ROSTER = {
  "aria_healer": {
    name: "Aria",
    class: CLASS.HEALER,
    rarity: RARITY.SR,
    baseStats: {
      hp: 80, atk: 8, def: 8, spd: 6,
      mana: 60, stamina: 20,
      critRate: 0.0, guardRate: 0.05
    },
    growth: {
      hp: 8, atk: 1.5, def: 1.5, spd: 0.1,
      mana: 6, stamina: 1
    },
    abilities: [
      { name: "Heal", desc: "Restores 20% HP.", mult: 0.2, cost: { mana: 12 }, type: "heal" }
    ],
    passives: [],
    leaderSkill: { name: "Pure Heart", desc: "+10% Healing Received for the team.", effect: { healRecMult: 1.1 } },
    lore: "A gentle soul from the northern valleys, Aria's presence alone seems to soothe the weary.",
    personal: "Loves: Pressed flowers, Morning tea. Dislikes: High winds, Dishonesty."
  },
  // Main Hero templates (R rarity — upgradeable to UR through story progression)
  "hero_warrior": {
    name: "Hero",
    class: CLASS.WARRIOR,
    rarity: RARITY.R,
    baseStats: {
      hp: 120, atk: 12, def: 10, spd: 6,
      mana: 20, stamina: 40,
      critRate: 0.05, guardRate: 0.05
    },
    growth: {
      hp: 12, atk: 2.5, def: 2.0, spd: 0.15,
      mana: 2, stamina: 4
    },
    abilities: [
      { name: "Slash", desc: "Deals 120% ATK damage.", mult: 1.2, cost: { stamina: 8 }, type: "attack" },
      { name: "Power Strike", desc: "Deals 150% ATK damage.", mult: 1.5, cost: { stamina: 15 }, type: "attack" }
    ],
    passives: [],
    leaderSkill: { name: "Brave Heart", desc: "+5% ATK for the team.", effect: { atkMult: 1.05 } },
    lore: "A wayward soul from a distant land, seeking purpose in a world consumed by shadows.",
    personal: "Loves: Open roads, Sharpening tools. Dislikes: Enclosed spaces, Greed."
  },
  "hero_tank": {
    name: "Hero",
    class: CLASS.TANK,
    rarity: RARITY.R,
    baseStats: {
      hp: 150, atk: 8, def: 15, spd: 5,
      mana: 20, stamina: 40,
      critRate: 0.02, guardRate: 0.15
    },
    growth: {
      hp: 15, atk: 1.5, def: 2.5, spd: 0.1,
      mana: 2, stamina: 4
    },
    abilities: [
      { name: "Shield Bash", desc: "Deals 100% ATK damage. Chance to stun.", mult: 1.0, cost: { stamina: 10 }, type: "attack", stunChance: 0.3 },
      { name: "Fortify", desc: "Reduces incoming damage by 50% for 2 turns.", mult: 0, cost: { stamina: 12 }, type: "buff", effect: "fortify" }
    ],
    passives: [],
    leaderSkill: { name: "Iron Defense", desc: "+10% Team DEF.", effect: { defMult: 1.1 } },
    lore: "A wayward soul from a distant land, seeking purpose in a world consumed by shadows.",
    personal: "Loves: Heavy shields, Cold water. Dislikes: Rust, Cowardice."
  },
  "hero_mage": {
    name: "Hero",
    class: CLASS.MAGE,
    rarity: RARITY.R,
    baseStats: {
      hp: 80, atk: 12, def: 5, spd: 7,
      mana: 70, stamina: 20,
      critRate: 0.05, guardRate: 0.0
    },
    growth: {
      hp: 8, atk: 3.5, def: 1.0, spd: 0.2,
      mana: 7, stamina: 2
    },
    abilities: [
      { name: "Arcane Bolt", desc: "Deals 140% ATK magic damage.", mult: 1.4, cost: { mana: 15 }, type: "attack" },
      { name: "Fireball", desc: "Deals 180% ATK magic damage.", mult: 1.8, cost: { mana: 20 }, type: "attack" }
    ],
    passives: [],
    leaderSkill: { name: "Mana Flow", desc: "+10% Team Mana Pool.", effect: { manaMult: 1.1 } },
    lore: "A wayward soul from a distant land, seeking purpose in a world consumed by shadows.",
    personal: "Loves: Old scrolls, Starlight. Dislikes: Distractions, Dust."
  },
  "hero_ranger": {
    name: "Hero",
    class: CLASS.RANGER,
    rarity: RARITY.R,
    baseStats: {
      hp: 90, atk: 12, def: 6, spd: 11,
      mana: 30, stamina: 40,
      critRate: 0.12, guardRate: 0.0
    },
    growth: {
      hp: 9, atk: 2.5, def: 1.2, spd: 0.35,
      mana: 3, stamina: 4
    },
    abilities: [
      { name: "Quick Shot", desc: "Deals 110% ATK damage. +15% crit chance.", mult: 1.1, cost: { stamina: 8 }, type: "attack", critBonus: 0.15 },
      { name: "Piercing Arrow", desc: "Deals 130% ATK damage. Ignores defense.", mult: 1.3, cost: { stamina: 14 }, type: "attack", ignoresDef: true }
    ],
    passives: [],
    leaderSkill: { name: "Swift Wind", desc: "+10% Team SPD.", effect: { spdMult: 1.1 } },
    lore: "A wayward soul from a distant land, seeking purpose in a world consumed by shadows.",
    personal: "Loves: High vantage points, Jerky. Dislikes: Muddy paths, Heavy armor."
  },
  "hero_healer": {
    name: "Hero",
    class: CLASS.HEALER,
    rarity: RARITY.R,
    baseStats: {
      hp: 100, atk: 8, def: 8, spd: 6,
      mana: 50, stamina: 25,
      critRate: 0.0, guardRate: 0.05
    },
    growth: {
      hp: 10, atk: 1.5, def: 1.5, spd: 0.1,
      mana: 5, stamina: 2
    },
    abilities: [
      { name: "Heal", desc: "Restores 30% of max HP.", mult: 0.3, cost: { mana: 12 }, type: "heal" },
      { name: "Smite", desc: "Deals 110% ATK holy damage.", mult: 1.1, cost: { mana: 10 }, type: "attack" }
    ],
    passives: [],
    leaderSkill: { name: "Devotion", desc: "+10% Healing Received for the team.", effect: { healRecMult: 1.1 } },
    lore: "A wayward soul from a distant land, seeking purpose in a world consumed by shadows.",
    personal: "Loves: Sunlight, Healing herbs. Dislikes: Undead, Pointless conflict."
  },
  "hero_support": {
    name: "Hero",
    class: CLASS.SUPPORT,
    rarity: RARITY.R,
    baseStats: {
      hp: 100, atk: 7, def: 9, spd: 8,
      mana: 60, stamina: 25,
      critRate: 0.02, guardRate: 0.05
    },
    growth: {
      hp: 10, atk: 1.2, def: 1.8, spd: 0.2,
      mana: 7, stamina: 2
    },
    abilities: [
      { name: "Mend", desc: "Restores 25% of max HP.", mult: 0.25, cost: { mana: 10 }, type: "heal" },
      { name: "Weaken", desc: "Reduces enemy ATK by 20% for 2 turns.", mult: 0, cost: { mana: 14 }, type: "debuff", effect: "weaken" }
    ],
    passives: [],
    leaderSkill: { name: "Tactical Edge", desc: "+10% Team SPD.", effect: { spdMult: 1.1 } },
    lore: "A wayward soul from a distant land, seeking purpose in a world consumed by shadows.",
    personal: "Loves: Chess, Map making. Dislikes: Unpredictability, Rushed plans."
  }
};

const TEAM_EFFECTS = [
  {
    name: "Classic Trio",
    desc: "Increases Team ATK by 10%.",
    check: (team) => {
      const classes = team.map(c => c?.class);
      return classes.includes(CLASS.TANK) && classes.includes(CLASS.MAGE) && classes.includes(CLASS.SUPPORT);
    },
    effect: { atkMult: 1.1 }
  },
  {
    name: "Vanguard Synergy",
    desc: "Increases Team DEF by 15%.",
    check: (team) => {
      const classes = team.map(c => c?.class);
      return classes.filter(cls => cls === CLASS.TANK || cls === CLASS.WARRIOR).length >= 2;
    },
    effect: { defMult: 1.15 }
  },
  {
    name: "Cover Fire",
    desc: "Increases Team SPD by 5%.",
    check: (team) => {
      const classes = team.map(c => c?.class);
      return classes.includes(CLASS.RANGER) && classes.includes(CLASS.TANK);
    },
    effect: { spdMult: 1.05 }
  }
];

function getActiveTeamEffects() {
  const teamChars = GAME.team
    .map(id => GAME.roster.find(c => c.id === id))
    .filter(c => c !== undefined && c !== null);

  const effects = TEAM_EFFECTS.filter(effect => effect.check(teamChars));

  // Add Leader Skill from Slot 0
  const leaderId = GAME.team[0];
  const leader = leaderId ? GAME.roster.find(c => c.id === leaderId) : null;
  if (leader) {
    const template = CHARACTER_ROSTER[leader.templateId];
    if (template && template.leaderSkill) {
      effects.push({
        name: `Leader: ${template.leaderSkill.name}`,
        desc: template.leaderSkill.desc,
        effect: template.leaderSkill.effect,
        isLeader: true
      });
    }
  }

  return effects;
}

// ============================================
//                ENEMY DATA
// ============================================
const ENEMY_DATA = {
  "forest_wolf": {
    name: "Starving Wolf",
    baseHp: 110, baseAtk: 16, baseDef: 5, baseSpd: 7,
    bronzeReward: 25,
    abilities: [
      { name: "Bite", mult: 1.2 },
      { name: "Snarl", mult: 0.7 }
    ],
    classScaling: {
      "Warrior": { hp: 1.0, atk: 1.0, def: 1.0 },
      "Tank": { hp: 0.9, atk: 1.1, def: 0.8 },
      "Mage": { hp: 0.8, atk: 0.8, def: 0.7 },
      "Ranger": { hp: 0.9, atk: 0.9, def: 0.9 },
      "Healer": { hp: 0.7, atk: 0.6, def: 0.6 },
      "Support": { hp: 0.7, atk: 0.6, def: 0.6 }
    },
    drops: [
      { chance: 0.03, item: { id: "ability_fragment", name: "Ability Fragment", type: "material", description: "A shimmering shard of pure potential. Used to upgrade character abilities.", rarity: "rare", icon: "✨", stackable: true, quantity: 1, usable: false } }
    ]
  },
  // --- Road Encounter: Wild Animals ---
  "wild_boar": {
    name: "Wild Boar",
    baseHp: 70, baseAtk: 11, baseDef: 6, baseSpd: 5,
    bronzeReward: 8,
    abilities: [
      { name: "Charge", mult: 1.4 },
      { name: "Tusk Gore", mult: 1.0, stunChance: 0.2 }
    ],
    classScaling: {
      "Warrior": { hp: 1.0, atk: 1.0, def: 1.0 },
      "Tank": { hp: 0.9, atk: 1.1, def: 0.8 },
      "Mage": { hp: 0.8, atk: 0.9, def: 0.7 },
      "Ranger": { hp: 0.9, atk: 0.9, def: 0.9 },
      "Healer": { hp: 0.8, atk: 0.7, def: 0.7 },
      "Support": { hp: 0.8, atk: 0.7, def: 0.7 }
    },
    drops: [
      { chance: 0.40, item: { id: "boar_hide", name: "Boar Hide", type: "material", description: "Thick animal hide. Used for crafting leather armor.", rarity: "common", icon: "▬", stackable: true, quantity: 1, usable: false } },
      { chance: 0.15, item: { id: "boar_tusk", name: "Boar Tusk", type: "material", description: "A sharp tusk. Can be sold to merchants or used in weapon upgrades.", rarity: "uncommon", icon: "▸", stackable: true, quantity: 1, usable: false } },
      { chance: 0.03, item: { id: "ability_fragment", name: "Ability Fragment", type: "material", description: "A shimmering shard of pure potential. Used to upgrade character abilities.", rarity: "rare", icon: "✨", stackable: true, quantity: 1, usable: false } }
    ]
  },
  "timber_wolf": {
    name: "Timber Wolf",
    baseHp: 60, baseAtk: 14, baseDef: 4, baseSpd: 9,
    bronzeReward: 14,
    abilities: [
      { name: "Lunge", mult: 1.3 },
      { name: "Feral Bite", mult: 1.5 }
    ],
    classScaling: {
      "Warrior": { hp: 1.0, atk: 1.0, def: 1.0 },
      "Tank": { hp: 0.9, atk: 1.1, def: 0.8 },
      "Mage": { hp: 0.8, atk: 0.9, def: 0.7 },
      "Ranger": { hp: 1.0, atk: 1.0, def: 1.0 },
      "Healer": { hp: 0.8, atk: 0.7, def: 0.7 },
      "Support": { hp: 0.8, atk: 0.7, def: 0.7 }
    },
    drops: [
      { chance: 0.03, item: { id: "ability_fragment", name: "Ability Fragment", type: "material", description: "A shimmering shard of pure potential. Used to upgrade character abilities.", rarity: "rare", icon: "✨", stackable: true, quantity: 1, usable: false } },
      { chance: 0.35, item: { id: "wolf_pelt", name: "Wolf Pelt", type: "material", description: "A thick grey pelt. Valued by tanners and leatherworkers.", rarity: "common", icon: "▬", stackable: true, quantity: 1, usable: false } },
      { chance: 0.10, item: { id: "wolf_fang", name: "Wolf Fang", type: "material", description: "A razor-sharp canine tooth. Sought after for weapon enchanting.", rarity: "uncommon", icon: "▸", stackable: true, quantity: 1, usable: false } }
    ]
  },
  "venomous_snake": {
    name: "Venomous Snake",
    baseHp: 35, baseAtk: 16, baseDef: 2, baseSpd: 12,
    bronzeReward: 10,
    abilities: [
      { name: "Venom Strike", mult: 1.6 },
      { name: "Coil & Strike", mult: 1.1 }
    ],
    classScaling: {
      "Warrior": { hp: 1.0, atk: 0.9, def: 1.0 },
      "Tank": { hp: 1.0, atk: 1.0, def: 0.8 },
      "Mage": { hp: 0.8, atk: 0.7, def: 0.6 },
      "Ranger": { hp: 0.9, atk: 0.8, def: 0.8 },
      "Healer": { hp: 0.7, atk: 0.6, def: 0.6 },
      "Support": { hp: 0.7, atk: 0.6, def: 0.6 }
    },
    drops: [
      { chance: 0.30, item: { id: "snake_venom", name: "Snake Venom", type: "material", description: "A small vial of potent venom. Alchemists pay well for this.", rarity: "uncommon", icon: "◊", stackable: true, quantity: 1, usable: false } },
      { chance: 0.08, item: { id: "serpent_scale", name: "Serpent Scale", type: "material", description: "An iridescent scale. A rare crafting component for enchanted armor.", rarity: "rare", icon: "◈", stackable: true, quantity: 1, usable: false } }
    ]
  },
  // --- Road Encounter: Bandits ---
  "road_bandit": {
    name: "Road Bandit",
    baseHp: 65, baseAtk: 10, baseDef: 5, baseSpd: 6,
    bronzeReward: 20,
    abilities: [
      { name: "Slash", mult: 1.2 },
      { name: "Dirty Trick", mult: 0.8, stunChance: 0.25 }
    ],
    classScaling: {
      "Warrior": { hp: 1.0, atk: 1.0, def: 1.0 },
      "Tank": { hp: 1.0, atk: 1.1, def: 0.8 },
      "Mage": { hp: 0.9, atk: 0.9, def: 0.8 },
      "Ranger": { hp: 1.0, atk: 1.0, def: 1.0 },
      "Healer": { hp: 0.8, atk: 0.8, def: 0.7 },
      "Support": { hp: 0.8, atk: 0.8, def: 0.7 }
    },
    drops: [
      { chance: 0.35, item: { id: "torn_cloth", name: "Torn Cloth", type: "material", description: "Ragged cloth scavenged from a bandit. Can be sold or used for basic repairs.", rarity: "common", icon: "□", stackable: true, quantity: 2, usable: false } },
      { chance: 0.20, item: { id: "stolen_pouch", name: "Stolen Coin Pouch", type: "sellable", description: "A small bag of pilfered coins. Worth 15 bronze to any merchant.", rarity: "common", icon: "◘", stackable: true, quantity: 1, usable: false, sellValue: 15 } }
    ]
  },
  "bandit_archer": {
    name: "Bandit Archer",
    baseHp: 50, baseAtk: 13, baseDef: 3, baseSpd: 8,
    bronzeReward: 18,
    abilities: [
      { name: "Arrow Shot", mult: 1.3 },
      { name: "Aimed Shot", mult: 1.7 }
    ],
    classScaling: {
      "Warrior": { hp: 1.0, atk: 1.0, def: 1.0 },
      "Tank": { hp: 0.9, atk: 1.2, def: 0.8 },
      "Mage": { hp: 0.9, atk: 0.8, def: 0.7 },
      "Ranger": { hp: 1.0, atk: 1.0, def: 1.0 },
      "Healer": { hp: 0.8, atk: 0.7, def: 0.7 },
      "Support": { hp: 0.8, atk: 0.7, def: 0.7 }
    },
    drops: [
      { chance: 0.30, item: { id: "crude_arrowhead", name: "Crude Arrowhead", type: "material", description: "A roughly forged arrowhead. Useful for weapon upgrades.", rarity: "common", icon: "►", stackable: true, quantity: 3, usable: false } },
      { chance: 0.12, item: { id: "bandit_bow_string", name: "Frayed Bowstring", type: "material", description: "A worn but usable bowstring. Required for crafting ranged weapons.", rarity: "uncommon", icon: "─", stackable: true, quantity: 1, usable: false } }
    ]
  },
  "bandit_captain": {
    name: "Bandit Captain",
    baseHp: 95, baseAtk: 14, baseDef: 8, baseSpd: 7,
    bronzeReward: 35,
    abilities: [
      { name: "Heavy Swing", mult: 1.5 },
      { name: "Rally Cry", mult: 0.6, stunChance: 0.15 }
    ],
    classScaling: {
      "Warrior": { hp: 1.0, atk: 1.0, def: 1.0 },
      "Tank": { hp: 1.0, atk: 1.1, def: 0.9 },
      "Mage": { hp: 0.9, atk: 0.9, def: 0.8 },
      "Ranger": { hp: 1.0, atk: 1.0, def: 1.0 },
      "Healer": { hp: 0.8, atk: 0.8, def: 0.7 },
      "Support": { hp: 0.8, atk: 0.8, def: 0.7 }
    },
    drops: [
      { chance: 0.25, item: { id: "bandit_insignia", name: "Bandit Insignia", type: "material", description: "A crude insignia worn by bandit leaders. Proof of bounty for town guards.", rarity: "uncommon", icon: "◙", stackable: true, quantity: 1, usable: false } },
      { chance: 0.10, item: { id: "iron_ingot", name: "Iron Ingot", type: "material", description: "A bar of refined iron. Essential for forging weapons and armor.", rarity: "rare", icon: "▰", stackable: true, quantity: 1, usable: false } },
      { chance: 0.30, item: { id: "stolen_pouch", name: "Stolen Coin Pouch", type: "sellable", description: "A small bag of pilfered coins. Worth 15 bronze to any merchant.", rarity: "common", icon: "◘", stackable: true, quantity: 1, usable: false, sellValue: 15 } }
    ]
  }
};

// Road travel configuration: steps and encounter pools per destination
const ROAD_ENCOUNTERS = {
  // Key = destination, value = { steps, encounterChance, pool (weighted), flavorTexts, originOverrides }
  "Greenwood": {
    steps: 1,
    encounterChance: 0.5,
    pool: ["wild_boar", "timber_wolf", "venomous_snake"],
    flavorTexts: [
      "The path winds through rolling green hills. Birds chirp above you.",
      "You pass a weathered signpost pointing towards Greenwood.",
      "Wildflowers line the road. The air is fresh and calm."
    ],
    minLevel: 2,
    maxLevel: 6,
    originOverrides: {
      "Greenwood Street": 0,
      "Town Plaza": 0,
      "Church": 0,
      "Abandoned House": 0,
      "Greenwood Forest": 0,
      "Goblin Cave": 0,
      "Layla's House": 0
    }
  },
  "Sural City": {
    steps: [3, 5],
    encounterChance: 0.45,
    pool: ["wild_boar", "timber_wolf", "venomous_snake", "road_bandit", "bandit_archer", "bandit_captain"],
    poolWeights: [0.20, 0.20, 0.15, 0.20, 0.15, 0.10],
    flavorTexts: [
      "The road stretches long ahead. Wagon tracks mark the dirt path.",
      "You pass the ruins of an old watchtower. It's been abandoned for years.",
      "A merchant caravan passes you heading the opposite direction.",
      "The trees grow thinner as the landscape opens into wide plains.",
      "You spot the distant spires of Sural City on the horizon.",
      "A cold wind blows across the open road. You pull your cloak tighter.",
      "You cross a stone bridge over a shallow stream."
    ],
    minLevel: 6,
    maxLevel: 10
  },
  "Town Square": {
    steps: 0,
    encounterChance: 0,
    pool: [],
    flavorTexts: [
      "You make your way back towards the center of Willowvane.",
      "The dormant fountain of the Town Square comes into view.",
      "The cobblestone paths feel familiar under your feet."
    ],
    originOverrides: {
      "Willowvane Road": 1 // Returning from the road takes 1 step
    }
  },
  "Willowvane Road": {
    steps: 1, // Default from Greenwood/Town is 1
    encounterChance: 0,
    pool: [],
    flavorTexts: [
      "You travel back along the dusty road.",
      "The familiar sights of Willowvane come into view.",
      "A quiet journey back towards the village."
    ],
    minLevel: 2,
    maxLevel: 6,
    originOverrides: {
      "Sural City": [3, 5] // Back from Sural City still takes 3-5
    }
  }
};

// ============================================
//              COMBAT SYSTEM
// ============================================
let combatState = null;

function createEnemy(enemyId, playerClass, playerLevel, options = {}) {
  const template = ENEMY_DATA[enemyId];
  if (!template) return null;

  const min = options.minLevel || 1;
  const max = options.maxLevel || 99;

  // Biased Level Selection: Weighted towards center (player's level within bounds)
  const center = Math.max(min, Math.min(max, playerLevel));
  const possibleLevels = [];
  for (let i = min; i <= max; i++) {
    // Weight calculation: inverse of distance from player level
    // 10 is just a base to keep weights as larger integers before selection
    const weight = Math.round(10 / (1 + Math.abs(center - i)));
    for (let j = 0; j < weight; j++) possibleLevels.push(i);
  }
  const selectedLevel = possibleLevels[Math.floor(Math.random() * possibleLevels.length)];

  const scaling = template.classScaling[playerClass] || { hp: 1, atk: 1, def: 1 };
  const lvlMult = 1 + 0.1 * (selectedLevel - 1);

  return {
    name: `${template.name} (Lv ${selectedLevel})`,
    level: selectedLevel,
    hp: Math.floor(template.baseHp * scaling.hp * lvlMult),
    maxHp: Math.floor(template.baseHp * scaling.hp * lvlMult),
    atk: Math.floor(template.baseAtk * scaling.atk * lvlMult),
    def: Math.floor(template.baseDef * scaling.def * lvlMult),
    spd: template.baseSpd,
    abilities: template.abilities,
    bronzeReward: Math.floor(template.bronzeReward * lvlMult),
    stunned: false, atkMod: 1.0, defMod: 1.0
  };
}

function renderHpBar(current, max, length = 20) {
  const pct = Math.max(0, current / max);
  const filled = Math.round(pct * length);
  const empty = length - filled;
  let color = "#22c55e";
  if (pct < 0.5) color = "#eab308";
  if (pct < 0.25) color = "#ef4444";
  return `<span style="color:${color}">${"█".repeat(filled)}</span><span style="color:#334155">${"░".repeat(empty)}</span> ${Math.floor(current)}/${Math.floor(max)}`;
}

function getHpBarClass(pct) {
  if (pct > 0.5) return "hp-green";
  if (pct > 0.25) return "hp-yellow";
  return "hp-red";
}

function getStatusEffects(combatant, side) {
  const effects = [];
  if (!combatState) return effects;
  if (side === "enemy") {
    if (combatant.stunned) effects.push({ name: "Stunned", type: "debuff" });
    if (combatant.atkMod < 1.0) effects.push({ name: `ATK ↓ (${Math.round(combatant.atkMod * 100)}%)`, type: "debuff" });
    if (combatant.atkMod > 1.0) effects.push({ name: `ATK ↑ (${Math.round(combatant.atkMod * 100)}%)`, type: "buff" });
    if (combatant.defMod < 1.0) effects.push({ name: `DEF ↓`, type: "debuff" });
    if (combatant.defMod > 1.0) effects.push({ name: `DEF ↑`, type: "buff" });
  } else {
    if (combatState.defending) effects.push({ name: "Defending", type: "buff" });
    if (combatState.fortifyTurns > 0) effects.push({ name: `Fortify (${combatState.fortifyTurns}t)`, type: "buff" });
  }
  return effects;
}

function buildStatusButton(effects, cardId) {
  if (effects.length === 0) return "";
  return `<span class="status-btn" onclick="toggleStatusPopup('${cardId}')" style="position:relative;">Status
    <span class="status-popup" id="popup-${cardId}" style="display:none;">
      ${effects.map(e => {
    const arrow = e.type === "buff" ? '<span class="buff-arrow">▲</span>'
      : e.type === "debuff" ? '<span class="debuff-arrow">▼</span>'
        : '<span class="neutral-dot">●</span>';
    return `<span class="status-item">${arrow} ${e.name}</span>`;
  }).join("")}
    </span>
  </span>`;
}

function toggleStatusPopup(cardId) {
  const popup = document.getElementById("popup-" + cardId);
  if (!popup) return;
  document.querySelectorAll(".status-popup").forEach(p => {
    if (p.id !== "popup-" + cardId) p.style.display = "none";
  });
  popup.style.display = popup.style.display === "none" ? "block" : "none";
}

function updateCombatDisplay() {
  if (!combatState) return;
  const display = document.getElementById("combat-display");
  if (!display) return;
  display.style.display = "flex";

  // Initialize structure if not present
  if (!display.querySelector('.combat-team')) {
    display.innerHTML = `
      <div id="combat-enemies-container" class="combat-team"></div>
      <div class="combat-divider">━━━━━━ VS ━━━━━━</div>
      <div id="combat-players-container" class="combat-team"></div>
      <div id="combat-log"></div>
    `;
  }

  const { enemies, players, activeId } = combatState;

  const enemyCards = enemies.map((e, i) => {
    const id = `enemy-${i}`;
    const hpPct = Math.max(0, e.hp / e.maxHp);
    const isActive = activeId === id;
    const isDead = e.hp <= 0;
    const effects = getStatusEffects(e, "enemy");
    return `<div class="combat-card${isActive ? " active-turn" : ""}${isDead ? " dead-card" : ""}">
      <div class="card-name">${isActive ? '<span class="turn-arrow">▶</span>' : ""}${e.name}</div>
      <div class="hp-bar-container"><div class="hp-bar-fill ${getHpBarClass(hpPct)}" style="width:${Math.round(hpPct * 100)}%"></div></div>
      <div class="card-stats"><span class="hp-text">${Math.max(0, Math.floor(e.hp))}/${Math.floor(e.maxHp)}</span></div>
      ${buildStatusButton(effects, id)}
    </div>`;
  }).join("");

  const playerCards = players.map((p, i) => {
    const id = `player-${i}`;
    const hpPct = Math.max(0, p.currentResources.hp / p.maxStats.hp);
    const isActive = activeId === id;
    const isDead = p.currentResources.hp <= 0;
    const effects = getStatusEffects(p, "player");
    return `<div class="combat-card${isActive ? " active-turn" : ""}${isDead ? " dead-card" : ""}">
      <div class="card-name">${isActive ? '<span class="turn-arrow">▶</span>' : ""}${p.name} <span class="card-class">${p.class}</span></div>
      <div class="hp-bar-container"><div class="hp-bar-fill ${getHpBarClass(hpPct)}" style="width:${Math.round(hpPct * 100)}%"></div></div>
      <div class="card-stats">
        <span class="hp-text">${Math.max(0, Math.floor(p.currentResources.hp))}/${Math.floor(p.maxStats.hp)}</span>
        <span class="mp-text"> MP:${Math.floor(p.currentResources.mana)}</span>
        <span class="sp-text"> SP:${Math.floor(p.currentResources.stamina)}</span>
      </div>
      ${buildStatusButton(effects, id)}
    </div>`;
  }).join("");

  document.getElementById("combat-enemies-container").innerHTML = enemyCards;
  document.getElementById("combat-players-container").innerHTML = playerCards;
}

function combatLog(text) {
  const cl = document.getElementById("combat-log");
  if (cl) {
    cl.innerHTML += text + "<br>";
    // Use requestAnimationFrame to ensure scroll happens after next layout
    requestAnimationFrame(() => {
      cl.scrollTop = cl.scrollHeight;
    });
  }
}

function hideCombatDisplay() {
  const display = document.getElementById("combat-display");
  if (display) { display.style.display = "none"; display.innerHTML = ""; }
}

function renderCombatStatus() { updateCombatDisplay(); }

function calcDamage(atk, def, mult, critRate, ignoresDef = false) {
  const effectiveDef = ignoresDef ? 0 : def * 0.4;
  let damage = Math.max(1, (atk * mult) - effectiveDef);
  // Variance: ±15%
  damage *= (0.95 + Math.random() * 0.1);
  // Crit check
  let isCrit = false;
  if (Math.random() < critRate) {
    damage *= 1.5;
    isCrit = true;
  }
  return { damage: Math.floor(damage), isCrit };
}

function startCombat(enemyId, onVictory, onDefeat, options = {}) {
  const players = GAME.team
    .map(id => id ? GAME.roster.find(c => c.id === id) : null)
    .filter(c => c != null);
  if (players.length === 0) { log("No heroes in team!"); return; }

  // Calculate Average Party Level
  const totalLvl = players.reduce((sum, p) => sum + p.level, 0);
  const avgLvl = Math.max(1, Math.round(totalLvl / players.length));

  const hero = players[0]; // Primary character for class scaling reference

  // Dynamic Enemy Count
  let enemies = [];
  if (options.storyFight) {
    const enemy = createEnemy(enemyId, hero.class, avgLvl, options);
    enemies = [enemy];
  } else {
    const count = players.length;
    for (let i = 0; i < count; i++) {
      enemies.push(createEnemy(enemyId, hero.class, avgLvl, options));
    }
  }

  combatState = {
    players,
    enemies,
    hero,
    heroTemplate: CHARACTER_ROSTER[hero.templateId],
    enemy: enemies[0], // Focus target (defaults to first)
    enemyId,
    defending: false,
    fortifyTurns: 0,
    weakenTurns: 0,
    turnCount: 0,
    activeId: "player-0",
    storyFight: !!options.storyFight,
    fleeLocation: GAME.story.location || null,
    onVictory: onVictory || (() => { }),
    onDefeat: onDefeat || (() => { })
  };

  musicPlayer.switchTo("fight");

  combatLog("<strong style='color:#ef4444'>⚔️ A fight has begun!</strong>");
  updateCombatDisplay();
  playerTurn();
}

function playerTurn() {
  if (!combatState) return;

  combatState.defending = false;
  combatState.turnCount++;
  combatState.activeId = "player-0";
  updateCombatDisplay();

  const actions = [
    { text: "⚔️ Attack", callback: () => playerAttack() },
    { text: "✨ Abilities", callback: () => showAbilityMenu() },
    { text: "🛡️ Defend", callback: () => playerDefend() }
  ];
  if (!combatState.storyFight) {
    actions.push({ text: "🏃 Flee", callback: () => playerFlee() });
  }
  renderChoices(actions);
}

function playerAttack() {
  clearChoices();
  const { hero, enemy } = combatState;
  const critRate = hero.maxStats.critRate || 0;
  const { damage, isCrit } = calcDamage(hero.maxStats.atk, enemy.def * enemy.defMod, 1.0, critRate);

  enemy.hp -= damage;
  const critText = isCrit ? " <strong style='color:#fbbf24'>CRITICAL!</strong>" : "";
  combatLog(`${hero.name} attacks ${enemy.name} for <strong>${damage}</strong> damage.${critText}`);

  // Resource Regen on normal attack
  const manaRegen = Math.floor(hero.maxStats.mana * 0.05);
  const staminaRegen = Math.floor(hero.maxStats.stamina * 0.10);

  if (manaRegen > 0 || staminaRegen > 0) {
    hero.currentResources.mana = Math.min(hero.maxStats.mana, hero.currentResources.mana + manaRegen);
    hero.currentResources.stamina = Math.min(hero.maxStats.stamina, hero.currentResources.stamina + staminaRegen);
    // Optional: Log regen? Might be too spammy. Let's keep it silent or subtle.
  }

  updateCombatDisplay();

  checkCombatEnd() || enemyTurn();
}

function showAbilityMenu() {
  clearChoices();
  const { hero, heroTemplate } = combatState;

  const abilityChoices = heroTemplate.abilities.map((ability, index) => {
    // Build cost string
    let costStr = "";
    if (ability.cost) {
      const parts = [];
      if (ability.cost.mana) parts.push(`${ability.cost.mana} MP`);
      if (ability.cost.stamina) parts.push(`${ability.cost.stamina} SP`);
      costStr = ` [${parts.join(", ")}]`;
    }

    // Check if player can afford it
    let canUse = true;
    if (ability.cost) {
      if (ability.cost.mana && hero.currentResources.mana < ability.cost.mana) canUse = false;
      if (ability.cost.stamina && hero.currentResources.stamina < ability.cost.stamina) canUse = false;
    }

    return {
      text: `${ability.name}${costStr} — ${ability.desc}${canUse ? "" : " (Not enough)"}`,
      callback: canUse ? () => useAbility(index) : () => {
        combatLog("<span style='color:#ef4444'>Not enough resources!</span>");
        showAbilityMenu();
      }
    };
  });

  // Add back button
  abilityChoices.push({ text: "← Back", callback: () => playerTurn() });

  renderChoices(abilityChoices);
}

function applyHeal(caster, target, ability, skillIdx) {
  const skillLv = caster.skillLevels[skillIdx] || 1;
  const lvMult = 1 + (skillLv - 1) * 0.03;
  const healAmount = Math.floor(target.maxStats.hp * ability.mult * lvMult);
  target.currentResources.hp = Math.min(target.maxStats.hp, target.currentResources.hp + healAmount);
  const targetLabel = caster === target ? "self" : target.name;
  combatLog(`${caster.name} uses <strong>${ability.name}</strong> (Lv ${skillLv}) on ${targetLabel} and restores <strong style="color:#22c55e">${healAmount}</strong> HP!`);
  renderCombatStatus();
  enemyTurn();
}

function useAbility(index) {
  clearChoices();
  const { hero, heroTemplate, enemy } = combatState;
  const ability = heroTemplate.abilities[index];
  if (!ability) { playerTurn(); return; }

  // Deduct cost
  if (ability.cost) {
    if (ability.cost.mana) hero.currentResources.mana -= ability.cost.mana;
    if (ability.cost.stamina) hero.currentResources.stamina -= ability.cost.stamina;
  }

  // Handle ability type
  if (ability.type === "heal") {
    // Show target selection for heals
    const teamMembers = combatState.players
      .filter(c => c.currentResources.hp > 0);

    if (teamMembers.length === 1) {
      // Only one member — heal them directly
      applyHeal(hero, teamMembers[0], ability, index);
      return;
    }

    // Show target selection
    const targetChoices = teamMembers.map(member => {
      const hpPct = Math.floor((member.currentResources.hp / member.maxStats.hp) * 100);
      const hpColor = hpPct > 50 ? "#22c55e" : hpPct > 25 ? "#eab308" : "#ef4444";
      return {
        text: `${member.name} (${member.class}) — HP: ${Math.floor(member.currentResources.hp)}/${Math.floor(member.maxStats.hp)} [${hpPct}%]`,
        callback: () => {
          clearChoices();
          applyHeal(hero, member, ability, index);
        }
      };
    });
    targetChoices.push({ text: "← Back", callback: () => showAbilityMenu() });
    renderChoices(targetChoices);
    return;
  }

  if (ability.type === "buff" && ability.effect === "fortify") {
    combatState.fortifyTurns = 2;
    combatLog(`${hero.name} uses <strong>${ability.name}</strong>! Damage taken reduced for 2 turns.`);
    updateCombatDisplay();
    enemyTurn();
    return;
  }

  if (ability.type === "debuff" && ability.effect === "weaken") {
    combatState.weakenTurns = 2;
    enemy.atkMod = 0.8;
    combatLog(`${hero.name} uses <strong>${ability.name}</strong>! Enemy ATK reduced by 20% for 2 turns.`);
    updateCombatDisplay();
    enemyTurn();
    return;
  }

  // Attack ability
  let critRate = hero.maxStats.critRate || 0;
  if (ability.critBonus) critRate += ability.critBonus;
  const ignoresDef = !!ability.ignoresDef;

  const skillLv = hero.skillLevels[index] || 1;
  const lvMult = 1 + (skillLv - 1) * 0.03;
  const { damage, isCrit } = calcDamage(hero.maxStats.atk, enemy.def * enemy.defMod, ability.mult * lvMult, critRate, ignoresDef);

  enemy.hp -= damage;
  const critText = isCrit ? " <strong style='color:#fbbf24'>CRITICAL!</strong>" : "";
  combatLog(`${hero.name} uses <strong>${ability.name}</strong> (Lv ${skillLv}) dealing <strong>${damage}</strong> damage!${critText}`);

  // Stun check
  if (ability.stunChance && Math.random() < ability.stunChance) {
    enemy.stunned = true;
    combatLog(`<span style="color:#a78bfa">${enemy.name} is stunned!</span>`);
  }
  updateCombatDisplay();
  checkCombatEnd() || enemyTurn();
}

function playerDefend() {
  clearChoices();
  combatState.defending = true;
  combatLog(`${combatState.hero.name} takes a defensive stance.`);
  updateCombatDisplay();
  enemyTurn();
}

function playerFlee() {
  clearChoices();
  const { hero, enemy } = combatState;
  // Base 40%, ±3% per SPD point difference, floor 20%, cap 85%
  const fleeChance = 0.4 + (hero.maxStats.spd - enemy.spd) * 0.03;

  if (Math.random() < Math.min(0.85, Math.max(0.20, fleeChance))) {
    const returnTo = combatState.fleeLocation;
    combatLog("You successfully fled from the battle!");
    endCombat(true);
    // Return to the area where the fight started
    if (returnTo) {
      GAME.story.location = returnTo;
      updateStatusBar();
      log(`<br>You flee back to <strong>${returnTo}</strong>.`);
      updateQuickActions();
      autoSave();
    }
  } else {
    combatLog("You failed to escape!");
    enemyTurn();
  }
}

function enemyTurn() {
  if (!combatState) return;

  setTimeout(() => {
    if (!combatState) return;
    const { hero, enemy, players } = combatState;

    combatState.activeId = "enemy-0";
    updateCombatDisplay();

    // Tick status effects (fortify/weaken tick AFTER damage is dealt)

    // Check stun
    if (enemy.stunned) {
      enemy.stunned = false;
      combatLog(`<span style="color:#a78bfa">${enemy.name} is stunned and cannot act!</span>`);
      updateCombatDisplay();
      setTimeout(() => { if (combatState) playerTurn(); }, 600);
      return;
    }

    // Pick random ability and random living target
    const ability = enemy.abilities[Math.floor(Math.random() * enemy.abilities.length)];
    const livingPlayers = players.filter(p => p.currentResources.hp > 0);
    if (livingPlayers.length === 0) { checkCombatEnd(); return; }
    const target = livingPlayers[Math.floor(Math.random() * livingPlayers.length)];

    const atkPower = enemy.atk * enemy.atkMod;
    const defPower = target.maxStats.def;

    let damage = Math.max(1, (atkPower * ability.mult) - (defPower * 0.4));
    damage *= (0.95 + Math.random() * 0.1);

    // Apply defending (only if the target is the hero who defended)
    if (target === hero && combatState.defending) damage *= 0.5;

    // Apply fortify
    if (target === hero && combatState.fortifyTurns > 0) damage *= 0.5;

    // Guard check
    const guardRate = target.maxStats.guardRate || 0;
    let guarded = false;
    if (Math.random() < guardRate) {
      damage *= 0.3;
      guarded = true;
    }

    damage = Math.floor(damage);

    // Apply to shield first
    if (target.currentResources.shield > 0) {
      const shieldAbsorb = Math.min(target.currentResources.shield, damage);
      target.currentResources.shield -= shieldAbsorb;
      damage -= shieldAbsorb;
    }

    target.currentResources.hp -= damage;

    let msg = `${enemy.name} uses <strong>${ability.name}</strong> on ${target.name} dealing <strong>${damage}</strong> damage!`;
    if (guarded) msg += " <span style='color:#60a5fa'>GUARDED!</span>";
    if (target === hero && combatState.defending) msg += " <span style='color:#94a3b8'>(Defended)</span>";
    combatLog(msg);

    updateCombatDisplay();

    // Tick status effects AFTER damage is dealt so they last the full duration
    if (combatState && combatState.fortifyTurns > 0) combatState.fortifyTurns--;
    if (combatState && combatState.weakenTurns > 0) {
      combatState.weakenTurns--;
      if (combatState.weakenTurns === 0) enemy.atkMod = 1.0;
    }

    if (!checkCombatEnd()) {
      setTimeout(() => { if (combatState) playerTurn(); }, 600);
    }
  }, 800);
}

function checkCombatEnd() {
  if (!combatState) return true;
  const { hero, enemy, players, enemies } = combatState;

  const allEnemiesDead = enemies.every(e => e.hp <= 0);
  if (allEnemiesDead) {
    enemies.forEach(e => e.hp = Math.max(0, e.hp));
    updateCombatDisplay();
    combatLog(`<strong style="color:#22c55e">🎉 Victory!</strong> Enemies defeated!`);

    // Calculate Totals from all enemies
    let totalBronze = 0;
    enemies.forEach(e => {
      totalBronze += (e.bronzeReward || 0);
    });

    // Cascading XP Shard Drops
    const shardTiers = [
      { id: "xp_shard_tiny", name: "Tiny XP Shard", rarity: "common", icon: "✨", xp: 5, chance: 0.90 },
      { id: "xp_shard_small", name: "Small XP Shard", rarity: "uncommon", icon: "🌟", xp: 15, chance: 0.40 },
      { id: "xp_shard_medium", name: "Medium XP Shard", rarity: "rare", icon: "❇️", xp: 30, chance: 0.15 },
      { id: "xp_shard_big", name: "Big XP Shard", rarity: "super_rare", icon: "🌌", xp: 50, chance: 0.03 },
      { id: "xp_shard_large", name: "Large XP Shard", rarity: "legendary", icon: "👑", xp: 100, chance: 0.005 }
    ];

    const droppedShards = [];
    shardTiers.forEach(tier => {
      let count = 0;
      while (count < 3 && Math.random() < tier.chance) {
        droppedShards.push(tier);
        count++;
      }
    });

    const shardResultsText = droppedShards.length > 0
      ? droppedShards.map(s => `<span style="color:${getRarityColor(s.rarity)}">${s.icon} ${s.name}</span>`).join(", ")
      : "None";

    combatLog(`<em>Total Rewards: ${totalBronze} Bronze Coins</em>`);
    if (droppedShards.length > 0) {
      combatLog(`<em>Acquired Shards: ${shardResultsText}</em>`);
    }

    // Add Shards to inventory
    droppedShards.forEach(shard => {
      addItem({
        id: shard.id, name: shard.name, type: "consumable",
        description: `A shard containing ${shard.xp} character XP. Can be used from inventory.`,
        rarity: shard.rarity, icon: shard.icon, stackable: true, quantity: 1, usable: true,
        onUse: `xp_shard_${shard.xp}`
      });
    });

    addItem({
      id: "bronze_coins", name: "Bronze Coins", type: "key",
      description: "Common currency of Sural. 100 bronze coins equal 1 silver coin.",
      rarity: "common", icon: "●", stackable: true, quantity: totalBronze, usable: false
    });

    // Process item drops
    const enemyDrops = ENEMY_DATA[combatState.enemyId].drops || [];
    enemyDrops.forEach(drop => {
      if (Math.random() < drop.chance) {
        addItem({ ...drop.item });
      }
    });

    updateStatusBar();

    updateStatusBar();

    // Global Drop: Ability Fragment (15%)
    if (Math.random() < 0.15) {
      if (!GAME.materials.ability_fragment) GAME.materials.ability_fragment = 0;
      GAME.materials.ability_fragment++;
      combatLog(`<span style="color:#a855f7">✨ Found an Ability Fragment! (${GAME.materials.ability_fragment})</span>`);
      // Auto-save logic handles material updates
    }

    updateStatusBar();

    const onVictory = combatState.onVictory;

    // Require click to close
    combatLog("<br><em>Click anywhere to continue...</em>");

    const finish = () => {
      document.removeEventListener("click", finish);
      combatState = null;
      hideCombatDisplay();
      musicPlayer.switchTo("game");
      onVictory();
    };

    // Small delay to prevent immediate closing from the attack click
    setTimeout(() => {
      document.addEventListener("click", finish, { once: true });
    }, 500);

    return true;
  }

  const allPlayersDead = players.every(p => p.currentResources.hp <= 0);
  if (allPlayersDead) {
    players.forEach(p => p.currentResources.hp = 0);
    updateCombatDisplay();
    combatLog(`<strong style="color:#ef4444">💀 Defeat...</strong> ${hero.name} has fallen.`);
    showNotification("Your party has fallen... Load your last save to continue.", "error");
    log("<span style='color:#ef4444'>Your party has fallen... Load your last save to continue.</span>");

    const onDefeat = combatState.onDefeat;
    const enemyId = combatState.enemyId;
    const onVictory = combatState.onVictory;
    combatState = null;
    hideCombatDisplay();
    musicPlayer.switchTo("game");

    // Restore HP to 50% and offer retry
    setTimeout(() => {
      players.forEach(p => {
        p.currentResources.hp = Math.floor(p.maxStats.hp * 0.5);
        p.currentResources.mana = Math.floor(p.maxStats.mana * 0.5);
        p.currentResources.stamina = Math.floor(p.maxStats.stamina * 0.5);
      });
      combatLog("You regain consciousness, battered but alive...");

      renderChoices([
        {
          text: "↻ Load Last Save", callback: () => {
            clearChoices();
            loadLatestGame();
          }
        }
      ]);
    }, 1200);
    return true;
  }

  return false;
}

function endCombat(fled) {
  if (!combatState) return;
  combatState = null;
  hideCombatDisplay();
  musicPlayer.switchTo("game");
}



class Character {
  constructor(templateId) {
    const template = CHARACTER_ROSTER[templateId];
    if (!template) throw new Error("Invalid Char ID");
    this.id = crypto.randomUUID();
    this.templateId = templateId;
    this.name = template.name;
    this.class = template.class;
    this.rarity = template.rarity;

    this.level = 1;
    this.xp = 0;

    // Progression State
    this.awakeningRank = 0; // Index in caps array
    this.currentCap = this.rarity.caps[0];
    this.hiddenPotentialUnlocked = false;

    // Stats
    this.maxStats = { ...template.baseStats };
    this.currentResources = { ...template.baseStats, shield: 0 }; // hp, mana, stamina, shield

    // Equipment
    this.equipment = {
      head: null,
      chest: null,
      legs: null,
      feet: null,
      weapon: null,
      extra1: null,
      extra2: null,
      extra3: null
    };

    // Skills (Initialize with level 1)
    this.skillLevels = {};
    if (template.abilities) {
      template.abilities.forEach((_, index) => {
        this.skillLevels[index] = 1;
      });
    }
    if (template.passives) {
      template.passives.forEach((_, index) => {
        // Passives might not level up, or use a different key. 
        // For now, let's track them too if needed, or just abilities.
        // We'll stick to abilities for active leveling for now.
      });
    }
  }
  canAwaken() {
    if (this.hiddenPotentialUnlocked) return false;
    if (this.level < this.currentCap) return false;
    if (this.awakeningRank < this.rarity.caps.length - 1) return true;
    if (this.rarity.hiddenCap && !this.hiddenPotentialUnlocked) return true;
    return false;
  }
  getMaxXp() {
    // Adjusted curve: Level 1 -> 2 needs 20 XP
    return Math.floor(20 * Math.pow(this.level, 1.5));
  }
  gainCharXp(amount) {
    if (this.level >= this.currentCap) return;

    this.xp += amount;
    let leveled = false;

    while (this.xp >= this.getMaxXp() && this.level < this.currentCap) {
      this.xp -= this.getMaxXp();
      this.levelUp();
      leveled = true;
    }

    if (leveled) {
      log(`🎉 ${this.name} leveled up to Lv ${this.level}!`);
    }
  }
  upgradeAbility(index) {
    const currentLv = this.skillLevels[index] || 1;
    if (currentLv >= 10) {
      log(`${this.name}'s ability is already at max level!`);
      return false;
    }

    const cost = 5 + (currentLv * 2);
    if ((GAME.materials.ability_fragment || 0) < cost) {
      log(`Not enough Ability Fragments! (Need ${cost})`);
      return false;
    }

    GAME.materials.ability_fragment -= cost;
    this.skillLevels[index] = currentLv + 1;
    log(`✨ ${this.name}'s ability upgraded to Lv ${this.skillLevels[index]}!`);
    autoSave();
    return true;
  }
  awaken() {
    if (!this.canAwaken()) return false;

    // (Placeholder) Consume materials here
    // Normal Awakening
    if (this.awakeningRank < this.rarity.caps.length - 1) {
      this.awakeningRank++;
      this.currentCap = this.rarity.caps[this.awakeningRank];
      console.log(`${this.name} awakened! Level cap increased to ${this.currentCap}.`);
      return true;
    }
    // Hidden Potential Awakening
    if (this.rarity.hiddenCap && !this.hiddenPotentialUnlocked) {
      this.hiddenPotentialUnlocked = true;
      this.currentCap = this.rarity.hiddenCap;
      console.log(`${this.name} unlocked HIDDEN POTENTIAL! Level cap is now ${this.currentCap}.`);
      return true;
    }

    return false;
  }
  levelUp() {
    if (this.level >= this.currentCap) {
      console.log("Max level reached. Awaken to proceed.");
      return;
    }
    const oldStats = { ...this.maxStats };
    this.level++;
    const template = CHARACTER_ROSTER[this.templateId];
    const growthMod = this.rarity.growthMod;

    // Apply Growth & Calculate Config
    let statsMsg = [];
    for (let stat in template.growth) {
      const gain = template.growth[stat] * growthMod;
      this.maxStats[stat] += gain;

      // Force HP to be integer
      if (stat === "hp") {
        this.maxStats[stat] = Math.floor(this.maxStats[stat]);
      }

      if (gain > 0) {
        // Format: +1.5 or +2
        const val = Number.isInteger(gain) ? gain : gain.toFixed(1);
        statsMsg.push(`${stat.toUpperCase()} +${val}`);
      }
    }

    this.fullHeal();
    log(`<strong>${this.name} reached Level ${this.level}!</strong><br><span style="color:#22c55e">${statsMsg.join(", ")}</span>`);
  }

  fullHeal() {
    this.currentResources.hp = this.maxStats.hp;
    this.currentResources.mana = this.maxStats.mana;
    this.currentResources.stamina = this.maxStats.stamina;
    this.currentResources.shield = 0;
  }

  applyShield(amount) {
    this.currentResources.shield += amount;
    // Condition: Shield cannot exceed character max HP
    if (this.currentResources.shield > this.maxStats.hp) {
      this.currentResources.shield = this.maxStats.hp;
    }
    console.log(`${this.name} received shield. Current shield: ${Math.floor(this.currentResources.shield)}`);
  }

  changeClass(newTemplateId) {
    const template = CHARACTER_ROSTER[newTemplateId];
    if (!template) return false;

    this.templateId = newTemplateId;
    this.class = template.class;

    // Reset to level 1 base stats
    this.maxStats = { ...template.baseStats };

    // Re-apply growth for each level gained
    const growthMod = this.rarity.growthMod;
    for (let i = 1; i < this.level; i++) {
      for (let stat in template.growth) {
        this.maxStats[stat] += template.growth[stat] * growthMod;
        if (stat === "hp") this.maxStats[stat] = Math.floor(this.maxStats[stat]);
      }
    }

    // Update abilities
    this.skillLevels = {};
    if (template.abilities) {
      template.abilities.forEach((_, index) => {
        this.skillLevels[index] = 1;
      });
    }

    this.fullHeal();
    return true;
  }
}

function rehydrateGAME() {
  if (!GAME || !GAME.roster) return;
  GAME.roster.forEach(char => {
    Object.setPrototypeOf(char, Character.prototype);
  });
}

// --- Team System Logic ---

// UI Elements
const teamOverlay = document.getElementById("team-menu-overlay");
const btnCloseTeam = document.getElementById("btn-close-team");
const teamTabs = document.querySelectorAll(".tab-btn");
const tabContents = document.querySelectorAll(".tab-content");
const teamSlotsContainer = document.querySelector(".team-slots-container");
const rosterGrid = document.querySelector(".roster-grid");
const charDetailView = document.getElementById("char-detail-view");

// Open Team Menu
function openTeamMenu(tab = 'team') {
  if (!GAME || !GAME.roster) {
    console.log("Game not started yet.");
    return;
  }

  // Reset effects banner persistence bug
  if (effectsBanner) {
    effectsBanner.style.display = "none";
    effectsBanner.innerHTML = "";
  }

  teamOverlay.style.display = "flex";
  switchTab(tab);
  renderTeamTab(); // Always refresh team view
}

// Close Team Menu
if (btnCloseTeam) {
  btnCloseTeam.addEventListener("click", () => {
    teamOverlay.style.display = "none";
    charDetailView.style.display = "none";
  });
}


// Tab Switching
teamTabs.forEach(btn => {
  btn.addEventListener("click", () => {
    switchTab(btn.dataset.tab);
  });
});

function switchTab(tabName) {
  // Update Buttons
  teamTabs.forEach(btn => {
    btn.classList.toggle("active", btn.dataset.tab === tabName);
  });

  // Update Content
  tabContents.forEach(content => {
    content.style.display = (content.id === `tab-${tabName}`) ? "block" : "none";
  });

  // Render Content
  if (tabName === 'team') renderTeamTab();
  if (tabName === 'roster') renderRosterTab();
  if (tabName === 'armory') renderArmoryTab();
}

// Render Team Tab
function renderTeamTab() {
  teamSlotsContainer.innerHTML = "";

  GAME.team.forEach((charId, index) => {
    const slot = document.createElement("div");
    slot.className = "team-slot";

    // Find character object if ID exists
    const char = charId ? GAME.roster.find(c => c.id === charId) : null;

    if (char) {
      slot.classList.add("filled");
      if (index === 0) slot.classList.add("leader-slot");

      const xpPct = Math.floor((char.xp / char.getMaxXp()) * 100);
      const leaderLabel = index === 0 ? `<div class="leader-badge">LEADER</div>` : "";

      slot.innerHTML = `
        <div class="char-card-inner">
          ${leaderLabel}
          <div class="char-name">${char.name}</div>
          <div class="char-info">${char.class}</div>
          <div class="char-info" style="font-size:0.8rem; margin-top:2px;">Lv ${char.level} / ${char.currentCap}</div>
          
          <div class="stat-bar"><div class="bar-fill hp-fill" style="width: ${(char.currentResources.hp / char.maxStats.hp) * 100}%"></div></div>
          ${char.currentResources.shield > 0 ? `<div class="stat-bar shield-bar"><div class="bar-fill shield-fill" style="width: ${(char.currentResources.shield / char.maxStats.hp) * 100}%"></div></div>` : ""}
          <div class="stat-bar"><div class="bar-fill mana-fill" style="width: ${(char.currentResources.mana / char.maxStats.mana) * 100}%"></div></div>
          <div class="stat-bar xp-bar" title="XP: ${Math.floor(char.xp)} / ${char.getMaxXp()}"><div class="bar-fill xp-fill" style="width: ${xpPct}%"></div></div>
          
          <div class="char-card-stats">
            <div class="stat-item"><span>HP</span><span class="val">${Math.floor(char.maxStats.hp)}</span></div>
            <div class="stat-item"><span>ATK</span><span class="val">${Math.floor(char.maxStats.atk)}</span></div>
            <div class="stat-item"><span>DEF</span><span class="val">${Math.floor(char.maxStats.def)}</span></div>
            <div class="stat-item"><span>SPD</span><span class="val">${Math.floor(char.maxStats.spd)}</span></div>
          </div>
        </div>
      `;

      slot.addEventListener("click", () => openCharDetail(char));
    } else {
      slot.innerHTML = `<span style="color:#64748b;">+ Empty Slot</span>`;
      slot.addEventListener("click", () => switchToRosterToSelect(index));
    }

    const wrapper = document.createElement("div");
    wrapper.className = "team-slot-wrapper";
    wrapper.appendChild(slot);

    if (char) {
      const activeCount = GAME.team.filter(id => id !== null).length;
      const removeBtn = document.createElement("button");
      removeBtn.className = "remove-party-btn";
      removeBtn.innerHTML = "Remove from party";

      if (index === 0) {
        removeBtn.disabled = true;
        removeBtn.style.opacity = "0.5";
        removeBtn.style.cursor = "not-allowed";
        removeBtn.title = "The Leader cannot be removed.";
      } else if (activeCount <= 1) {
        removeBtn.disabled = true;
        removeBtn.style.opacity = "0.5";
        removeBtn.style.cursor = "not-allowed";
        removeBtn.title = "At least one character must remain in the party.";
      }

      removeBtn.onclick = (e) => {
        if (index === 0) return;
        if (activeCount <= 1) return;
        e.stopPropagation();
        GAME.team[index] = null;
        renderTeamTab();
      };
      wrapper.appendChild(removeBtn);

      const exchangeBtn = document.createElement("button");
      exchangeBtn.className = "exchange-btn";
      exchangeBtn.innerHTML = "Exchange";
      exchangeBtn.onclick = (e) => {
        e.stopPropagation();
        switchToRosterToSelect(index);
      };
      wrapper.appendChild(exchangeBtn);
    }

    teamSlotsContainer.appendChild(wrapper);
  });
}

// Render Roster Tab
function renderRosterTab(pickingForSlot = null) {
  rosterGrid.innerHTML = "";

  GAME.roster.forEach(char => {
    const card = document.createElement("div");
    card.className = "roster-card";

    // Check if in team
    const isInTeam = GAME.team.includes(char.id);
    const teamStatus = isInTeam ? `<span style="color:#ef4444; font-size:0.8rem;">[In Team]</span>` : "";

    const xpPct = Math.floor((char.xp / char.getMaxXp()) * 100);

    card.innerHTML = `
      <div class="char-name">${char.name} ${teamStatus}</div>
      <div class="char-info">${char.class}</div>
      ${char.currentResources.shield > 0 ? `<div class="stat-bar shield-bar" style="margin-bottom: 5px;"><div class="bar-fill shield-fill" style="width: ${(char.currentResources.shield / char.maxStats.hp) * 100}%"></div></div>` : ""}
      <div class="char-info">Lv ${char.level} / ${char.currentCap}</div>
      <div class="stat-bar xp-bar" style="height:4px; margin: 4px 0;" title="XP: ${Math.floor(char.xp)} / ${char.getMaxXp()}"><div class="bar-fill xp-fill" style="width: ${xpPct}%"></div></div>
      <div class="char-card-stats">
        <div class="stat-item"><span>HP</span><span class="val">${Math.floor(char.maxStats.hp)}</span></div>
        <div class="stat-item"><span>ATK</span><span class="val">${Math.floor(char.maxStats.atk)}</span></div>
        <div class="stat-item"><span>DEF</span><span class="val">${Math.floor(char.maxStats.def)}</span></div>
        <div class="stat-item"><span>SPD</span><span class="val">${Math.floor(char.maxStats.spd)}</span></div>
      </div>
    `;

    card.addEventListener("click", () => {
      if (pickingForSlot !== null) {
        assignToTeam(pickingForSlot, char.id);
      } else {
        openCharDetail(char);
      }
    });

    rosterGrid.appendChild(card);
  });
}

// Render Armory Tab (Placeholder)
function renderArmoryTab() {
  const armoryGrid = document.querySelector(".armory-grid");
  if (armoryGrid) armoryGrid.innerHTML = "<div style='padding:20px; color:#94a3b8;'>No equipment found.</div>";
}

// Helper: Switch to Roster to pick a character
function switchToRosterToSelect(slotIndex) {
  switchTab('roster');
  renderRosterTab(slotIndex); // Pass slot index to indicate selection mode
}

// Helper: Assign character to team slot
function assignToTeam(slotIndex, charId) {
  // Main hero (index 0) must always be in slot 0
  const mainHeroId = GAME.roster[0]?.id;
  let finalSlot = slotIndex;

  if (charId === mainHeroId) {
    finalSlot = 0;
  } else if (slotIndex === 0 && GAME.team[0] === mainHeroId) {
    // Prevent replacing the main hero in slot 0 if they are there
    log("The Hero must remain in the first slot.");
    return;
  }

  // If char is already in another slot, remove it from there
  const existingIndex = GAME.team.indexOf(charId);
  if (existingIndex !== -1) {
    GAME.team[existingIndex] = null;
  }

  GAME.team[finalSlot] = charId;
  openTeamMenu('team'); // Return to team view
}

const btnViewEffects = document.getElementById("btn-view-effects");
const effectsBanner = document.getElementById("active-effects-banner");

if (btnViewEffects) {
  btnViewEffects.addEventListener("click", () => {
    if (effectsBanner.style.display === "block") {
      effectsBanner.style.display = "none";
      return;
    }

    const active = getActiveTeamEffects();
    if (active.length > 0) {
      effectsBanner.innerHTML = active.map(e => `
        <div class="effect-item"><strong>${e.name}</strong>: ${e.desc}</div>
      `).join("");
      effectsBanner.style.display = "block";
    } else {
      effectsBanner.innerHTML = "<div>No team effect activated</div>";
      effectsBanner.style.display = "block";
    }
  });
}

// Character Detail View
function openCharDetail(char) {
  charDetailView.style.display = "flex";

  charDetailView.innerHTML = `
    <div class="detail-header">
      <div>
        <h2 style="margin:0; color:${getRarityColor(char.rarity)}">${char.name}</h2>
        <div style="color:#94a3b8;">${char.class} (${char.rarity.name}) - Lvl ${char.level} / ${char.currentCap}</div>
      </div>
      <div>
        <button class="upgrade-btn" id="btn-detail-close">Close</button>
      </div>
    </div>

    <div class="detail-grid">
      <div class="left-col">
        <h3 style="color:#e2e8f0; margin-top:0;">Equipment</h3>
        <div class="equipment-grid">
           ${renderEquipSlot(char, 'head', 'Head')}
           ${renderEquipSlot(char, 'chest', 'Chest')}
           ${renderEquipSlot(char, 'legs', 'Legs')}
           ${renderEquipSlot(char, 'feet', 'Feet')}
           ${renderEquipSlot(char, 'weapon', 'Weapon')}
           ${renderEquipSlot(char, 'extra1', 'Acc 1')}
           ${renderEquipSlot(char, 'extra2', 'Acc 2')}
           ${renderEquipSlot(char, 'extra3', 'Acc 3')}
        </div>
        
        <h3 style="color:#e2e8f0;">Actions</h3>
        <div style="display:flex; gap:10px; flex-wrap: wrap;">
           <button class="upgrade-btn" id="btn-awaken" ${char.canAwaken() ? '' : 'disabled'}>Awaken</button>
           <button class="upgrade-btn" id="btn-level-up" style="background:#0ea5e9; border-color:#0284c7;" ${char.level >= char.currentCap ? 'disabled' : ''}>Level Up</button>
        </div>
        ${char.canAwaken() ? '<div style="color:#fbbf24; font-size:0.8rem; margin-top:5px;">Awakening Available!</div>' : ''}
        
        <div class="materials-display" style="margin-top:15px; background:rgba(0,0,0,0.2); padding:10px; border-radius:4px;">
          <div style="font-size:0.8rem; color:#94a3b8;">Available Materials:</div>
          <div style="color:#e2e8f0;">✨ Ability Shards: ${GAME.materials.ability_fragment || 0}</div>
        </div>
      </div>

      <div class="right-col">
        <h3 style="color:#e2e8f0; margin-top:0;">Stats</h3>
        <div class="stats-panel">
           ${renderStatBox('HP', char.maxStats.hp)}
           ${char.currentResources.shield > 0 ? renderStatBox('Shield', Math.floor(char.currentResources.shield), '#22d3ee') : ''}
           ${renderStatBox('Mana', char.maxStats.mana)}
           ${renderStatBox('Stamina', char.maxStats.stamina)}
           ${renderStatBox('ATK', char.maxStats.atk)}
           ${renderStatBox('DEF', char.maxStats.def)}
           ${renderStatBox('SPD', char.maxStats.spd)}
        </div>

        <h3 style="color:#e2e8f0;">Skills</h3>
        <div class="skills-list">
           ${renderSkillsList(char)}
        </div>
      </div>
    </div>

    <div class="char-profile-section" style="margin-top:20px; padding-top:15px; border-top:1px solid rgba(255,255,255,0.1);">
      <h3 style="color:#e2e8f0; margin-top:0;">Character Profile</h3>
      <p class="lore-text" style="font-style:italic; color:#94a3b8; line-height:1.4;">"${CHARACTER_ROSTER[char.templateId].lore || 'A mysterious figure with an untold story.'}"</p>
      <div class="personal-info" style="font-size:0.9rem; color:#e2e8f0; margin-top:10px;">
        ${CHARACTER_ROSTER[char.templateId].personal || ''}
      </div>
    </div>
  `;

  // Bind actions
  document.getElementById("btn-detail-close").onclick = closeCharDetail;

  document.getElementById("btn-awaken").onclick = () => {
    if (char.awaken()) {
      openCharDetail(char); // Refresh
    }
  };

  document.getElementById("btn-level-up").onclick = () => {
    openShardPicker(char);
  };
}

function openShardPicker(char) {
  // Find all XP shards in inventory
  const shards = GAME.inventory.filter(i => i.id && i.id.startsWith("xp_shard_"));

  // Remove existing picker if any
  const existing = document.getElementById("shard-picker-overlay");
  if (existing) existing.remove();

  const overlay = document.createElement("div");
  overlay.id = "shard-picker-overlay";
  overlay.className = "shard-picker-overlay";

  const xpPct = char.xp / char.getMaxXp();

  let shardListHtml = '';
  if (shards.length === 0) {
    shardListHtml = '<div class="shard-empty">No XP Shards available.<br>Defeat enemies to earn shards.</div>';
  } else {
    shardListHtml = shards.map(shard => {
      const xpVal = parseInt(shard.onUse.split("_")[2]);
      return `
        <div class="shard-pick-row" data-shard-id="${shard.id}" data-xp="${xpVal}" data-max="${shard.quantity}">
          <div class="shard-pick-info">
            <span class="shard-pick-icon">${shard.icon || '💎'}</span>
            <span class="shard-pick-name">${shard.name}</span>
            <span class="shard-pick-xp">+${xpVal} XP</span>
          </div>
          <div class="shard-pick-actions">
            <span class="shard-pick-qty">x${shard.quantity}</span>
            <button class="shard-pick-select-btn">Select</button>
          </div>
        </div>
      `;
    }).join('');
  }

  overlay.innerHTML = `
    <div class="shard-picker-panel">
      <div class="shard-picker-header">
        <h3>Level Up — ${char.name}</h3>
        <button class="shard-picker-close" id="shard-picker-close">✕</button>
      </div>
      <div class="shard-picker-char-info">
        <div class="shard-char-level" id="shard-preview-level">Lv. ${char.level} / ${char.currentCap}</div>
        <div class="shard-xp-bar-container">
          <div class="shard-xp-bar-fill" id="shard-preview-bar" style="width:${Math.round(xpPct * 100)}%"></div>
        </div>
        <div class="shard-xp-text" id="shard-preview-xp">${Math.floor(char.xp)} / ${Math.floor(char.getMaxXp())} XP</div>
      </div>
      <div class="shard-list" id="shard-list-container">
        ${shardListHtml}
      </div>
      <div class="shard-slider-panel" id="shard-slider-panel" style="display:none;">
        <div class="shard-slider-header">
          <span id="shard-slider-name"></span>
          <button class="shard-slider-back" id="shard-slider-back">← Back</button>
        </div>
        <div class="shard-slider-controls">
          <input type="range" id="shard-slider" min="1" max="1" value="1" class="shard-range-slider">
          <div class="shard-slider-labels">
            <span>1</span>
            <span id="shard-slider-value" class="shard-slider-current">1</span>
            <span id="shard-slider-max">1</span>
          </div>
        </div>
        <div class="shard-preview-result" id="shard-preview-result">
          <div class="shard-preview-delta" id="shard-preview-delta"></div>
        </div>
        <button class="shard-confirm-btn" id="shard-confirm-btn">Confirm</button>
      </div>
    </div>
  `;

  document.body.appendChild(overlay);

  // State for slider
  let selectedShardId = null;
  let selectedXpVal = 0;
  let selectedMax = 0;

  const listContainer = document.getElementById("shard-list-container");
  const sliderPanel = document.getElementById("shard-slider-panel");
  const slider = document.getElementById("shard-slider");
  const sliderValue = document.getElementById("shard-slider-value");
  const sliderMax = document.getElementById("shard-slider-max");
  const sliderName = document.getElementById("shard-slider-name");
  const previewBar = document.getElementById("shard-preview-bar");
  const previewLevel = document.getElementById("shard-preview-level");
  const previewXp = document.getElementById("shard-preview-xp");
  const previewDelta = document.getElementById("shard-preview-delta");
  const confirmBtn = document.getElementById("shard-confirm-btn");

  // Simulate XP gain without mutating the character
  function simulateXp(count) {
    let simLevel = char.level;
    let simXp = char.xp;
    const simCap = char.currentCap;
    const totalXp = selectedXpVal * count;
    let xpRemaining = totalXp;

    // apply xp level by level
    simXp += xpRemaining;
    let simMaxXp = Math.floor(20 * Math.pow(simLevel, 1.5));

    while (simXp >= simMaxXp && simLevel < simCap) {
      simXp -= simMaxXp;
      simLevel++;
      simMaxXp = Math.floor(20 * Math.pow(simLevel, 1.5));
    }

    // If at cap, clamp XP
    if (simLevel >= simCap) {
      simLevel = simCap;
      // XP doesn't carry over past cap
    }

    return { level: simLevel, xp: simXp, maxXp: simMaxXp, totalXp };
  }

  function updatePreview(count) {
    const sim = simulateXp(count);
    const pct = Math.min(100, Math.round((sim.xp / sim.maxXp) * 100));
    const levelsGained = sim.level - char.level;

    previewBar.style.width = pct + "%";

    if (levelsGained > 0) {
      previewBar.style.background = "linear-gradient(90deg, #22c55e, #4ade80)";
      previewLevel.textContent = `Lv. ${char.level} → Lv. ${sim.level} / ${char.currentCap}`;
      previewLevel.style.color = "#22c55e";
      previewDelta.innerHTML = `<span style="color:#22c55e;">↑ ${levelsGained} Level${levelsGained > 1 ? 's' : ''} gained</span> · +${sim.totalXp} XP`;
    } else {
      previewBar.style.background = "linear-gradient(90deg, #0ea5e9, #38bdf8)";
      previewLevel.textContent = `Lv. ${sim.level} / ${char.currentCap}`;
      previewLevel.style.color = "#0ea5e9";
      previewDelta.innerHTML = `+${sim.totalXp} XP`;
    }

    previewXp.textContent = `${Math.floor(sim.xp)} / ${Math.floor(sim.maxXp)} XP`;
    sliderValue.textContent = count;
  }

  // Select a shard row
  overlay.querySelectorAll(".shard-pick-select-btn").forEach(btn => {
    btn.addEventListener("click", () => {
      const row = btn.closest(".shard-pick-row");
      selectedShardId = row.dataset.shardId;
      selectedXpVal = parseInt(row.dataset.xp);
      selectedMax = parseInt(row.dataset.max);

      // Switch to slider view
      listContainer.style.display = "none";
      sliderPanel.style.display = "flex";

      const shard = shards.find(s => s.id === selectedShardId);
      sliderName.textContent = shard ? shard.name : "XP Shard";

      slider.min = 1;
      slider.max = selectedMax;
      slider.value = 1;
      sliderMax.textContent = selectedMax;

      updatePreview(1);
    });
  });

  // Slider input
  slider.addEventListener("input", () => {
    updatePreview(parseInt(slider.value));
  });

  // Back button
  document.getElementById("shard-slider-back").onclick = () => {
    sliderPanel.style.display = "none";
    listContainer.style.display = "block";

    // Reset preview to current state
    const curPct = Math.round((char.xp / char.getMaxXp()) * 100);
    previewBar.style.width = curPct + "%";
    previewBar.style.background = "linear-gradient(90deg, #0ea5e9, #38bdf8)";
    previewLevel.textContent = `Lv. ${char.level} / ${char.currentCap}`;
    previewLevel.style.color = "#0ea5e9";
    previewXp.textContent = `${Math.floor(char.xp)} / ${Math.floor(char.getMaxXp())} XP`;
  };

  // Confirm button
  confirmBtn.onclick = () => {
    if (!selectedShardId) return;
    const count = parseInt(slider.value);

    if (char.level >= char.currentCap) {
      showNotification(`${char.name} is already at the level cap!`, "warn");
      return;
    }

    // Apply shards
    for (let i = 0; i < count; i++) {
      if (char.level >= char.currentCap) break;
      char.gainCharXp(selectedXpVal);
    }
    removeItem(selectedShardId, count);
    log(`Used ${count}x XP Shard on <strong>${char.name}</strong>. Gained ${selectedXpVal * count} XP.`);
    autoSave();
    updateStatusBar();

    // Refresh picker and character detail
    overlay.remove();
    openCharDetail(char);
    openShardPicker(char);
  };

  // Close button
  document.getElementById("shard-picker-close").onclick = () => {
    overlay.remove();
  };

  // Close on backdrop click
  overlay.addEventListener("click", (e) => {
    if (e.target === overlay) overlay.remove();
  });
}


function renderSkillsList(char) {
  let html = '';
  // Abilities
  char.templateId && CHARACTER_ROSTER[char.templateId].abilities.forEach((skill, idx) => {
    const lvl = char.skillLevels[idx] || 1;
    const upgradeCost = 5 + (lvl * 2);
    const canAfford = (GAME.materials.ability_fragment || 0) >= upgradeCost;
    const isMax = lvl >= 10;

    let costStr = '';
    if (skill.cost) {
      if (skill.cost.mana) costStr = `<span class="skill-cost mp">${skill.cost.mana} MP</span>`;
      if (skill.cost.stamina) costStr = `<span class="skill-cost sp">${skill.cost.stamina} SP</span>`;
    }

    html += `
           <div class="skill-row">
             <div class="skill-info">
               <h4 style="display:flex; align-items:center; gap:8px;">${skill.name} ${costStr}</h4>
               <div class="skill-desc">${skill.desc}</div>
             </div>
             <div style="display:flex; flex-direction:column; align-items:flex-end; gap:4px;">
               <div style="font-size:0.75rem; color:#94a3b8;">Lv. ${lvl}${isMax ? ' (MAX)' : ''}</div>
               ${!isMax ? `
               <button class="upgrade-btn small" 
                       ${canAfford ? '' : 'disabled'} 
                       onclick="const c = GAME.roster.find(r=>r.id=='${char.id}'); if(c.upgradeAbility(${idx})) openCharDetail(c)">
                 Upgrade (${upgradeCost} ✨)
               </button>` : ''}
             </div>
           </div>`;
  });
  return html;
}

function closeCharDetail() {
  charDetailView.style.display = "none";
  renderTeamTab();
}

function renderEquipSlot(char, slotKey, label) {
  const item = char.equipment[slotKey];
  return `
      <div class="equip-slot ${item ? 'equipped' : ''}" onclick="showNotification('Equipment selection not implemented yet', 'info')">
        ${item ? item.name : label}
      </div>
    `;
}

function renderStatBox(label, value) {
  return `
      <div class="stat-box">
        <span class="stat-label">${label}</span>
        <span class="stat-value">${Math.floor(value)}</span>
      </div>
    `;
}

function getRarityColor(rarity) {
  const r = (typeof rarity === 'string') ? rarity.toLowerCase() : (rarity?.id || 'common').toLowerCase();
  const colors = {
    'common': '#94a3b8',
    'uncommon': '#22c55e',
    'rare': '#3b82f6',
    'epic': '#a855f7',
    'super rare': '#a855f7',
    'ssr': '#eab308',
    'ultra rare': '#ef4444',
    'legendary': '#f97316'
  };
  return colors[r] || '#fff';
}

// Hook up main menu button
// btnTeam is already defined globally
if (btnTeam) btnTeam.addEventListener("click", () => openTeamMenu());

// TEST INIT




// Hook up main menu buttons
document.getElementById("btn-team").addEventListener("click", () => openTeamMenu());

// --- Quest System ---

const QUEST_CATALOG = {
  main: [
    {
      id: "m1", name: "The Beginning", desc: "Speak with the Elder to learn about the world.", type: "main",
      objectives: [
        { desc: "Talk to the Elder in Town.", area: "Town Square", type: "interact", current: 0, required: 1 },
        { desc: "Explore the Forest Entrance.", area: "Forest Entrance", type: "explore", current: 0, required: 1 },
        { desc: "Return to the Elder.", area: "Town Square", type: "interact", current: 0, required: 1 }
      ],
      rewards: {
        xp: 50,
        items: [
          { id: "silver_coins", name: "Silver Coins", type: "currency", quantity: 5, icon: "🪙", description: "Standard currency.", stackable: true }
        ]
      }
    },
    {
      id: "m2", name: "Farmer's Delivery", desc: "Help Farmer Bertram deliver a package to Merchant Garrett in Greenwood.", type: "main",
      prerequisite: () => GAME.story.farmerMet,
      objectives: [
        { desc: "Deliver the package to Merchant Garrett in Greenwood.", area: "Greenwood", type: "interact", current: 0, required: 1 }
      ],
      rewards: {
        xp: 50,
        items: [
          { id: "bronze_coins", name: "Bronze Coins", type: "currency", quantity: 30, icon: "🪙", description: "Common currency.", stackable: true }
        ]
      }
    },
    {
      id: "m3", name: "Rising Shadows", desc: "Investigate reports of dark energy.", type: "main",
      objectives: [
        { desc: "Visit the Ruins.", area: "ruins", type: "explore", current: 0, required: 1 },
        { desc: "Defeat the Shadow Scout.", area: "ruins", type: "kill", target: "shadow_scout", current: 0, required: 1 }
      ]
    }
  ],
  adventurer: [
    {
      id: "a1", name: "Goblin Hunt", desc: "The guild is offering a bounty on goblins.", type: "adventurer",
      objectives: [{ desc: "Defeat 5 Goblins.", area: "forest", type: "kill", target: "goblin", current: 0, required: 5 }]
    },
    {
      id: "a2", name: "Ore Collection", desc: "The blacksmith needs raw ore.", type: "adventurer",
      objectives: [{ desc: "Collect 3 Iron Ore.", area: "mines", type: "gather", target: "iron_ore", current: 0, required: 3 }]
    }
  ],
  comrade: [
    {
      id: "c1", name: "Lost Memories", desc: "Find the owner of the old picture frame found in the abandoned house.", type: "comrade",
      prerequisite: () => GAME.story.abandonedHouseSearched,
      objectives: [
        { desc: "Find the owner of the picture.", type: "interact", current: 0, required: 1 }
      ]
    }
  ],
  daily: [
    {
      id: "d1", name: "Training Grounds", desc: "Complete a training session.", type: "daily",
      objectives: [{ desc: "Train at the Training Grounds.", area: "town", type: "interact", current: 0, required: 1 }]
    },
    {
      id: "d2", name: "Herb Gathering", desc: "Gather herbs for the apothecary.", type: "daily",
      objectives: [{ desc: "Gather 3 Herbs.", area: "forest", type: "gather", target: "herb", current: 0, required: 3 }]
    },
    {
      id: "d3", name: "Patrol Duty", desc: "Patrol the town perimeter.", type: "daily",
      objectives: [{ desc: "Patrol the Town Perimeter.", area: "town", type: "explore", current: 0, required: 1 }]
    }
  ]
};

// Quest UI Elements
const questOverlay = document.getElementById("quest-overlay");
const questBody = document.getElementById("quest-body");
const questTabBtns = document.querySelectorAll(".quest-tab-btn");
let currentQuestTab = "main";

// Quest Log Message
function questLog(msg) {
  log(`<span style="color:#fbbf24">[Quest]</span> ${msg}`);
}

// Open/Close Quest Menu
function openQuestMenu() {
  if (!GAME || !GAME.quests) {
    console.log("Game not started yet.");
    return;
  }
  questOverlay.style.display = "flex";
  switchQuestTab(currentQuestTab);
}

function closeQuestMenu() {
  questOverlay.style.display = "none";
}

// Tab Switching
function switchQuestTab(tab) {
  currentQuestTab = tab;
  questTabBtns.forEach(btn => {
    btn.classList.toggle("active", btn.dataset.qtab === tab);
  });
  renderQuestList(tab);
}

// Render Quest List
function renderQuestList(type) {
  if (!questBody) return;

  if (type === "daily") {
    renderDailyTab();
    return;
  }

  const catalog = QUEST_CATALOG[type] || [];
  let html = '';

  catalog.forEach(quest => {
    const isCompleted = GAME.quests.completed.includes(quest.id);

    // Skip quests whose prerequisites are not met
    if (quest.prerequisite && !quest.prerequisite() && !isCompleted && !GAME.quests.active.some(q => q.id === quest.id)) {
      return;
    }

    // Auto-activate quests from the catalog (no manual accept needed)
    if (!isCompleted && !GAME.quests.active.some(q => q.id === quest.id)) {
      const clone = JSON.parse(JSON.stringify(quest));
      clone.objectiveIndex = 0;
      clone.tracked = false;
      GAME.quests.active.push(clone);
    }

    const activeQuest = GAME.quests.active.find(q => q.id === quest.id);
    const isTracked = activeQuest ? activeQuest.tracked : false;

    const statusClass = isCompleted ? 'quest-completed' : 'quest-active';
    const statusLabel = isCompleted ? '✓ Completed' : '● Active';
    const typeColor = type === 'main' ? '#f59e0b' : type === 'adventurer' ? '#22c55e' : type === 'daily' ? '#60a5fa' : '#a855f7';

    html += `
      <div class="quest-card ${statusClass}">
        <div class="quest-card-header">
          <div>
            <span class="quest-type-badge" style="background:${typeColor}">${type.toUpperCase()}</span>
            <strong>${quest.name}</strong>
            ${isTracked ? '<span class="quest-tracked-badge">★ TRACKED</span>' : ''}
          </div>
          <span class="quest-status">${statusLabel}</span>
        </div>
        <div class="quest-desc">${quest.desc}</div>
        ${activeQuest && !isCompleted ? renderObjectives(activeQuest) : ''}
        <div class="quest-actions">
          ${activeQuest && !isCompleted ? `<button class="upgrade-btn" style="background:${isTracked ? '#475569' : '#3b82f6'}" onclick="toggleTrackQuest('${quest.id}')">${isTracked ? 'Untrack' : 'Track'}</button>` : ''}
        </div>
      </div>
    `;
  });

  if (!html) html = '<div style="color:#64748b; text-align:center; padding:40px;">No quests in this category yet.</div>';
  questBody.innerHTML = html;
}

// Render Daily Tab
function renderDailyTab() {
  const daily = getDailyQuest();
  const isActive = GAME.quests.active.some(q => q.id === daily.id);
  const isCompleted = GAME.quests.completed.includes(daily.id + '_' + GAME.quests.lastDailyDate);
  const activeQuest = GAME.quests.active.find(q => q.id === daily.id);
  const isTracked = activeQuest ? activeQuest.tracked : false;

  const today = new Date().toDateString();
  const canStartNew = GAME.quests.lastDailyDate === today && !isActive && !isCompleted;

  let html = `
    <div class="daily-header">
      <span style="color:#f59e0b; font-size:1.1rem;">☀ Today's Daily Quest</span>
      <span style="color:#64748b; font-size:0.85rem;">${today}</span>
    </div>
    <div class="quest-card ${isCompleted ? 'quest-completed' : isActive ? 'quest-active' : 'quest-available'}">
      <div class="quest-card-header">
        <div>
          <span class="quest-type-badge" style="background:#60a5fa">DAILY</span>
          <strong>${daily.name}</strong>
          ${isTracked ? '<span class="quest-tracked-badge">★ TRACKED</span>' : ''}
        </div>
        <span class="quest-status">${isCompleted ? '✓ Done Today' : isActive ? '● Active' : '○ Available'}</span>
      </div>
      <div class="quest-desc">${daily.desc}</div>
      ${isActive ? renderObjectives(activeQuest) : ''}
      <div class="quest-actions">
        ${!isActive && !isCompleted ? `<button class="upgrade-btn" onclick="acceptDailyQuest()">Accept</button>` : ''}
        ${isActive ? `<button class="upgrade-btn" style="background:${isTracked ? '#475569' : '#3b82f6'}" onclick="toggleTrackQuest('${daily.id}')"> ${isTracked ? 'Untrack' : 'Track'}</button>` : ''}
        ${isCompleted ? '<div style="color:#22c55e; margin-top:5px;">Come back tomorrow for a new quest!</div>' : ''}
      </div>
    </div>
  `;
  questBody.innerHTML = html;
}

// Render Objectives
function renderObjectives(quest) {
  let html = '<div class="quest-objectives">';
  quest.objectives.forEach((obj, i) => {
    const isCurrent = i === quest.objectiveIndex;
    const isDone = i < quest.objectiveIndex;
    const progress = obj.required > 1 ? ` (${obj.current || 0}/${obj.required})` : '';
    const icon = isDone ? '✓' : isCurrent ? '►' : '○';
    const cls = isDone ? 'obj-done' : isCurrent ? 'obj-current' : 'obj-pending';
    html += `<div class="quest-obj ${cls}">${icon} ${obj.desc}${progress}</div>`;
  });
  html += '</div>';
  return html;
}

// Get Daily Quest (date-locked)
function getDailyQuest() {
  const today = new Date().toDateString();
  if (GAME.quests.lastDailyDate === today && GAME.quests.currentDaily) {
    return GAME.quests.currentDaily;
  }
  // New day — pick a random daily
  const pool = QUEST_CATALOG.daily;
  const pick = pool[Math.floor(Math.random() * pool.length)];
  GAME.quests.currentDaily = JSON.parse(JSON.stringify(pick)); // Deep clone
  GAME.quests.lastDailyDate = today;
  return GAME.quests.currentDaily;
}

// Accept a quest
function acceptQuest(questId, type) {
  if (GAME.quests.active.some(q => q.id === questId)) return;
  if (GAME.quests.completed.includes(questId)) return;

  const catalog = QUEST_CATALOG[type];
  const template = catalog.find(q => q.id === questId);
  if (!template) return;

  const quest = JSON.parse(JSON.stringify(template)); // Deep clone
  quest.objectiveIndex = 0;
  quest.tracked = false;
  GAME.quests.active.push(quest);
  questLog(`Accepted: <strong>${quest.name}</strong>`);
  renderQuestList(currentQuestTab);
}

// Accept daily quest
function acceptDailyQuest() {
  const daily = getDailyQuest();
  if (GAME.quests.active.some(q => q.id === daily.id)) return;

  const quest = JSON.parse(JSON.stringify(daily));
  quest.objectiveIndex = 0;
  quest.tracked = false;
  GAME.quests.active.push(quest);
  questLog(`Accepted daily: <strong>${quest.name}</strong>`);
  renderQuestList('daily');
}

// Progress a quest objective
async function progressQuest(questId, amount = 1) {
  const quest = GAME.quests.active.find(q => q.id === questId);
  if (!quest || quest.objectiveIndex >= quest.objectives.length) return;

  const obj = quest.objectives[quest.objectiveIndex];
  obj.current = Math.min((obj.current || 0) + amount, obj.required || 1);

  if (obj.current >= (obj.required || 1)) {
    quest.objectiveIndex++;
    if (quest.objectiveIndex >= quest.objectives.length) {
      await completeQuest(questId);
    } else {
      questLog(`${quest.name} — objective complete! Next: ${quest.objectives[quest.objectiveIndex].desc}`);
    }
  } else {
    questLog(`${quest.name} — ${obj.desc} (${obj.current}/${obj.required})`);
  }
}

// Complete a quest
async function completeQuest(questId) {
  const idx = GAME.quests.active.findIndex(q => q.id === questId);
  if (idx === -1) return;

  const quest = GAME.quests.active[idx];
  GAME.quests.active.splice(idx, 1);

  if (quest.type === 'daily') {
    GAME.quests.completed.push(quest.id + '_' + GAME.quests.lastDailyDate);
  } else {
    GAME.quests.completed.push(quest.id);
  }

  questLog(`<strong>Quest Complete: ${quest.name}!</strong>`);

  // Award Rewards
  if (quest.rewards) {
    if (quest.rewards.xp) {
      await addXP(quest.rewards.xp);
      questLog(`Gained ${quest.rewards.xp} XP!`);
    }
    if (quest.rewards.items) {
      for (const item of quest.rewards.items) {
        await addItem({ ...item });
        questLog(`Obtained: ${item.quantity}x ${item.name}`);
      }
    }
  }

  // Full party heal on completing "The Beginning"
  if (quest.id === "m1") {
    GAME.roster.forEach(c => c.fullHeal());
    questLog(`Your party has been fully healed!`);
  }

  updateStatusBar(); // Ensure UI reflects all rewards (currency, etc.)
  renderQuestList(currentQuestTab);
}

// Toggle quest tracking
function toggleTrackQuest(questId) {
  const quest = GAME.quests.active.find(q => q.id === questId);
  if (!quest) return;

  const newState = !quest.tracked;

  // If we are tracking a new quest, untrack ALL others first (Single Track Only)
  if (newState) {
    GAME.quests.active.forEach(q => q.tracked = false);
  }

  quest.tracked = newState;
  questLog(`${quest.name} — ${quest.tracked ? 'Now tracking' : 'Stopped tracking'}`);
  renderQuestList(currentQuestTab);
  updateQuickActions(); // Update markers immediately
}

// Interaction & Travel System
function updateQuickActions() {
  if (!GAME || !GAME.story.introCompleted) {
    clearChoices();
    return;
  }

  const locKey = GAME.story.location;
  const location = WORLD_DATA.locations[locKey];
  if (!location) {
    clearChoices();
    return;
  }

  const choicesList = [];

  // NPC Actions
  location.npcs.forEach(npcName => {
    const isQuestHighlight = GAME.quests.active.some(q => {
      if (!q.tracked) return false;
      const obj = q.objectives[q.objectiveIndex];
      return obj && obj.type === "interact" && obj.desc.includes(npcName);
    });

    choicesList.push({
      text: `Talk to ${npcName}`,
      callback: () => handleCommand(`/talk ${npcName}`),
      highlight: isQuestHighlight
    });
  });

  // --- Explore action for Greenwood ---
  if (locKey === "Greenwood") {
    const discovered = GAME.story.greenwoodDiscovered || [];
    const undiscovered = GREENWOOD_DISCOVERABLE_PLACES.filter(p => !discovered.includes(p));
    if (undiscovered.length > 0) {
      choicesList.push({
        text: "🔍 Explore Greenwood",
        callback: () => exploreGreenwood(),
        highlight: false
      });
    }
  }

  // --- Greenwood Street: show all places, "???" for undiscovered ---
  if (locKey === "Greenwood Street") {
    const discovered = GAME.story.greenwoodDiscovered || [];

    // Always show "Go to Greenwood" link
    choicesList.push({
      text: "Go to Greenwood",
      callback: () => handleCommand("/go Greenwood"),
      highlight: false
    });

    // Show Layla's House if unlocked
    if (GAME.story.laylasHouseUnlocked) {
      choicesList.push({
        text: "Go to Layla's House",
        callback: () => handleCommand("/go Layla's House"),
        highlight: false
      });
    }

    // Show all discoverable places — discovered ones are clickable, others are "???"
    GREENWOOD_DISCOVERABLE_PLACES.forEach(placeName => {
      if (discovered.includes(placeName)) {
        const isQuestHighlight = GAME.quests.active.some(q => {
          if (!q.tracked) return false;
          const obj = q.objectives[q.objectiveIndex];
          return obj && (obj.area === placeName);
        });
        choicesList.push({
          text: `Go to ${placeName}`,
          callback: () => handleCommand(`/go ${placeName}`),
          highlight: isQuestHighlight
        });
      } else {
        choicesList.push({
          text: "??? — Undiscovered",
          callback: () => { log('<span style="color:#64748b"><em>You haven\'t discovered this place yet. Try exploring from Greenwood.</em></span>'); },
          highlight: false
        });
      }
    });

    if (choicesList.length > 0) {
      renderChoices(choicesList);
    } else {
      clearChoices();
    }
    return; // Skip normal travel rendering for Greenwood Street
  }

  // Travel Actions (filter out locked locations)
  location.connections.forEach(targetLoc => {
    const targetData = WORLD_DATA.locations[targetLoc];
    if (targetData) {
      if (targetData.locked) {
        // Dynamic unlock check
        if (targetData.unlockFlag && GAME.story[targetData.unlockFlag]) {
          // It's unlocked by story, proceed
        } else {
          return; // skip locked locations
        }
      }
    }

    const isQuestHighlight = GAME.quests.active.some(q => {
      if (!q.tracked) return false;
      const obj = q.objectives[q.objectiveIndex];
      return obj && (obj.area === targetLoc || (obj.type === "explore" && obj.area === targetLoc));
    });

    choicesList.push({
      text: `Go to ${targetLoc}`,
      callback: () => handleCommand(`/go ${targetLoc}`),
      highlight: isQuestHighlight
    });
  });

  if (choicesList.length > 0) {
    renderChoices(choicesList);
  } else {
    clearChoices();
  }
}

// --- Greenwood Exploration System ---
const GREENWOOD_DISCOVERABLE_PLACES = ["Town Plaza", "Church", "Abandoned House", "Greenwood Forest", "Goblin Cave"];

function exploreGreenwood() {
  if (!GAME.story.greenwoodDiscovered) GAME.story.greenwoodDiscovered = [];
  const discovered = GAME.story.greenwoodDiscovered;
  const undiscovered = GREENWOOD_DISCOVERABLE_PLACES.filter(p => !discovered.includes(p));

  if (undiscovered.length === 0) {
    log('<span style="color:#94a3b8"><em>You\'ve already discovered every place in Greenwood.</em></span>');
    return;
  }

  commandInput.disabled = true;
  commandSubmit.disabled = true;
  clearChoices();

  log('<br><span style="color:#f59e0b"><em>You wander through the streets and alleys of Greenwood, exploring...</em></span>');

  setTimeout(() => {
    const discoveryChance = 0.6; // 60% chance to discover
    if (Math.random() < discoveryChance) {
      // Discover a random undiscovered place
      const place = undiscovered[Math.floor(Math.random() * undiscovered.length)];
      discovered.push(place);

      // Unlock Greenwood Street on first discovery
      if (!GAME.story.greenwoodStreetUnlocked) {
        GAME.story.greenwoodStreetUnlocked = true;
        log('<strong style="color:#22c55e">You\'ve found Greenwood Street!</strong> A central road connecting to various parts of town.');
      }

      // Set the individual discovery flag for the map
      const placeData = WORLD_DATA.locations[place];
      if (placeData && placeData.unlockFlag) {
        GAME.story[placeData.unlockFlag] = true;
      }

      log(`<strong style="color:#22c55e">✦ Discovered: ${place}!</strong>`);
      log(`<span style="color:#94a3b8"><em>You can now visit ${place} from Greenwood Street.</em></span>`);
      showNotification(`Discovered: ${place}!`, "success");
    } else {
      // Failed to discover
      const failMessages = [
        "You wander for a while but don't find anything new. Perhaps try again?",
        "The streets twist and turn, but nothing catches your eye this time.",
        "You explore a few side streets but find only dead ends.",
        "A local shoos you away from an alley. Maybe next time you'll have better luck.",
        "You get turned around and end up back where you started."
      ];
      const msg = failMessages[Math.floor(Math.random() * failMessages.length)];
      log(`<span style="color:#94a3b8"><em>${msg}</em></span>`);
    }

    commandInput.disabled = false;
    commandSubmit.disabled = false;
    updateQuickActions();
    autoSave();
  }, 1500);
}

async function talkToNPC(npcName) {
  const currentLocData = WORLD_DATA.locations[GAME.story.location];
  if (!currentLocData) return;

  const npc = currentLocData.npcs.find(n => n.toLowerCase() === npcName.toLowerCase());

  if (!npc) {
    log(`There is no one named "${npcName}" here.`);
    return;
  }

  const npcData = WORLD_DATA.npcs[npc];
  let lines = [...npcData.dialogue.default];
  let onComplete = null;

  // Quest specific dialogue
  if (npc === "Elder" && hasQuestObjectiveActive("m1", "Talk to the Elder in Town.")) {
    lines = [...npcData.dialogue.quest_m1];
    onComplete = () => progressQuest("m1");
  }
  // Post-wolf dialogue — unlocks the road
  else if (npc === "Elder" && (GAME.story.forestWolfDefeated || hasQuestObjectiveActive("m1", "Return to the Elder."))) {
    if (!GAME.story.roadUnlocked) {
      lines = [...npcData.dialogue.post_wolf];
      onComplete = () => {
        GAME.story.roadUnlocked = true;
        autoSave();
        updateQuickActions();
        if (hasQuestObjectiveActive("m1", "Return to the Elder.")) {
          progressQuest("m1");
        }
      };
    } else {
      lines = [...npcData.dialogue.post_wolf];
    }
  }
  // --- Farmer NPC ---
  else if (npc === "Farmer") {
    if (GAME.quests.completed.includes("m2")) {
      lines = [...npcData.dialogue.post_quest];
    } else if (GAME.quests.active.some(q => q.id === "m2")) {
      lines = ["Don't forget to deliver that package to Garrett in Greenwood, will ye?"];
    } else {
      lines = [...npcData.dialogue.default];
    }
    // Always offer "ask about daughter" after dialogue
    onComplete = () => {
      renderChoices([{
        text: "Ask about his daughter",
        callback: () => {
          commandInput.disabled = true;
          commandSubmit.disabled = true;
          clearChoices();
          playDialogueSequence([...npcData.dialogue.about_hina], () => {
            commandInput.disabled = false;
            commandSubmit.disabled = false;
            commandInput.focus();
            updateQuickActions();
          });
        }
      }]);
    };
  }
  // --- Merchant Garrett NPC ---
  else if (npc === "Merchant") {
    if (hasQuestObjectiveActive("m2", "Deliver the package to Merchant Garrett in Greenwood.")) {
      lines = [...npcData.dialogue.delivery];
      onComplete = () => {
        removeItem("farmers_delivery", 1);
        progressQuest("m2");
      };
    }
  }
  // --- Sister Helena NPC ---
  else if (npc === "Sister Helena") {
    lines = [...npcData.dialogue.default];
  }
  // --- Layla NPC ---
  else if (npc === "Layla") {
    if (GAME.story.location === "Layla's House") {
      lines = [...npcData.dialogue.at_home];
    } else {
      lines = [...npcData.dialogue.default];
    }
  }
  // --- Layla's Mother NPC ---
  else if (npc === "Layla's Mother") {
    lines = [...npcData.dialogue.default];
  }

  commandInput.disabled = true;
  commandSubmit.disabled = true;
  clearChoices();

  playDialogueSequence(lines, () => {
    commandInput.disabled = false;
    commandSubmit.disabled = false;
    commandInput.focus();
    if (onComplete) onComplete();
    updateQuickActions();
  });
}

function playDialogueSequence(lines, callback) {
  if (!lines || lines.length === 0) {
    if (callback) callback();
    return;
  }

  const currentLine = lines[0];
  const remaining = lines.slice(1);

  typeMessage(`'${currentLine}'`, () => {
    if (remaining.length > 0) {
      setTimeout(() => {
        playDialogueSequence(remaining, callback);
      }, 1000);
    } else {
      if (callback) callback();
    }
  });
}

function travelTo(locName) {
  const originName = GAME.story.location;
  const currentLoc = WORLD_DATA.locations[originName];

  // Robust matching: trim and handle common character variations (like apostrophes)
  const normalize = (str) => str.toLowerCase().trim().replace(/['’‘´`]/g, "'").replace(/\s+/g, ' ');
  const target = currentLoc.connections.find(c => normalize(c) === normalize(locName));

  if (!target) {
    log(`You cannot go to "${locName}" from here.`);
    return;
  }

  // Handle Road Encounters if destination has a config
  const config = ROAD_ENCOUNTERS[target];
  if (config) {
    // Determine steps: Check for origin-specific overrides first
    let steps = config.steps;
    if (config.originOverrides && config.originOverrides[originName] !== undefined) {
      steps = config.originOverrides[originName];
    }

    if ((Array.isArray(steps) && steps.length > 0) || (typeof steps === 'number' && steps > 0)) {
      log(`<br><em>You set off towards ${target}...</em>`);
      // Create a temporary config object with the resolved steps for this trip
      const tripConfig = { ...config, steps };
      startRoadTravel(target, tripConfig);
      return;
    }
  }

  completeTravel(target);
}


// --- Road Travel System ---
function startRoadTravel(targetLoc, config, currentStep = 1, fixedTotal = null) {
  const totalSteps = fixedTotal || (Array.isArray(config.steps) ?
    Math.floor(Math.random() * (config.steps[1] - config.steps[0] + 1)) + config.steps[0] :
    config.steps);

  if (currentStep > totalSteps) {
    // Arrival
    commandInput.disabled = false;
    commandSubmit.disabled = false;
    completeTravel(targetLoc);
    return;
  }

  // Lock input
  commandInput.disabled = true;
  commandSubmit.disabled = true;
  clearChoices();

  const flavor = config.flavorTexts[Math.floor(Math.random() * config.flavorTexts.length)];
  log(`<br><span style="color:#94a3b8"><em>Step ${currentStep}/${totalSteps}: ${flavor}</em></span>`);

  setTimeout(() => {
    if (Math.random() < config.encounterChance && config.pool.length > 0) {
      // Pick enemy (basic weighted or random)
      let enemyId;
      if (config.poolWeights) {
        let r = Math.random();
        let total = 0;
        for (let j = 0; j < config.pool.length; j++) {
          total += config.poolWeights[j];
          if (r < total) {
            enemyId = config.pool[j];
            break;
          }
        }
      } else {
        enemyId = config.pool[Math.floor(Math.random() * config.pool.length)];
      }

      log(`<strong style="color:#ef4444">⚠ Ambush!</strong> A ${ENEMY_DATA[enemyId].name} leaps from the shadows!`);

      setTimeout(() => {
        startCombat(enemyId,
          // onVictory
          () => {
            log(`<span style="color:#22c55e">The path is clear. Travel resumes...</span>`);
            setTimeout(() => startRoadTravel(targetLoc, config, currentStep + 1, totalSteps), 1500);
          },
          // onDefeat (retreat)
          () => {
            commandInput.disabled = false;
            commandSubmit.disabled = false;
            GAME.story.location = "Town Square";
            updateStatusBar();
            log("<br>You stumble back to the Town Square, wounded but alive.");
            updateQuickActions();
            autoSave();
          },
          { minLevel: config.minLevel, maxLevel: config.maxLevel }
        );
      }, 1000);
    } else {
      // Safe step
      setTimeout(() => startRoadTravel(targetLoc, config, currentStep + 1, totalSteps), 1200);
    }
  }, 800);
}

function completeTravel(target) {
  GAME.story.location = target;
  updateStatusBar();
  log(`<br><strong style="color:#f59e0b">Arrived at: ${target}</strong>`);
  log(WORLD_DATA.locations[target].description);

  // Dynamic Region Music (if applicable)
  const locRegions = {
    "Willowvane": "game",
    "Town Square": "game",
    "Forest Entrance": "forest",
    "Willowvane Road": "road",
    "Greenwood": "town",
    "Greenwood Street": "town",
    "Town Plaza": "town",
    "Church": "town",
    "Abandoned House": "forest",
    "Greenwood Forest": "forest",
    "Goblin Cave": "forest",
    "Layla's House": "town",
    "Sural City": "castle"
  };
  const m = locRegions[target] || "game";
  musicPlayer.switchTo(m);

  // Check unique triggers
  if (target === "Forest Entrance") {
    if (!GAME.story.forestWolfDefeated && hasQuestObjectiveActive("m1", "Explore the Forest Entrance.")) {
      setTimeout(() => {
        typeMessage("A low growl echoes from the treeline. The bushes rustle violently, and a pair of hungry eyes emerge from the shadows.", () => {
          setTimeout(() => {
            typeMessage("A starving wolf leaps onto the path, baring its fangs. It's blocking your way forward.", () => {
              setTimeout(() => {
                startCombat("forest_wolf",
                  () => {
                    GAME.story.forestWolfDefeated = true;
                    setTimeout(() => {
                      typeMessage("The wolf retreats into the forest, whimpering. The path ahead is clear now.", () => {
                        progressQuest("m1");
                        updateQuickActions();
                        autoSave();
                      });
                    }, 1000);
                  },
                  () => {
                    GAME.story.location = "Town Square";
                    updateStatusBar();
                    log("<br>You stumble back to the Town Square, wounded but alive.");
                    updateQuickActions();
                    autoSave();
                  },
                  { storyFight: true, minLevel: 1, maxLevel: 1 }
                );
              }, 800);
            });
          }, 1000);
        });
      }, 500);
      return;
    }

    if (hasQuestObjectiveActive("m1", "Explore the Forest Entrance.")) {
      progressQuest("m1");
    }
  }

  // --- Farmer intro trigger on first visit to Willowvane Road ---
  if (target === "Willowvane Road" && !GAME.story.farmerMet) {
    GAME.story.farmerMet = true;
    const farmerData = WORLD_DATA.npcs["Farmer"];
    setTimeout(() => {
      commandInput.disabled = true;
      commandSubmit.disabled = true;
      clearChoices();
      playDialogueSequence([...farmerData.dialogue.intro], () => {
        // Auto-accept m2 quest and give the delivery item immediately
        acceptQuest("m2", "main");
        addItem({
          id: "farmers_delivery", name: "Farmer's Delivery", type: "key",
          description: "A carefully wrapped package from Farmer Bertram, meant for Merchant Garrett in Greenwood.",
          rarity: "common", icon: "📦", stackable: false, quantity: 1, usable: false
        });
        questLog("Obtained: 📦 Farmer's Delivery");
        commandInput.disabled = false;
        commandSubmit.disabled = false;
        updateQuickActions();
        autoSave();
      });
    }, 500);
    return;
  }

  // --- Abandoned House: first visit triggers quest item + companion quest ---
  if (target === "Abandoned House" && !GAME.story.abandonedHouseSearched) {
    GAME.story.abandonedHouseSearched = true;
    setTimeout(() => {
      commandInput.disabled = true;
      commandSubmit.disabled = true;
      clearChoices();
      playDialogueSequence([
        "The door hangs off its hinges — shattered outward, as if something burst through from inside.",
        "The interior is in ruins. Furniture is overturned. Deep claw marks gouge the walls and floor.",
        "Whatever happened here... it wasn't a simple break-in. The destruction radiates outward from a single point.",
        "Amidst the debris, something catches your eye — an old picture frame, cracked but intact.",
        "The picture shows a young elf girl with reddish-brown hair, hugging a red-haired woman. They both look happy.",
        "Who were they? And what happened here?"
      ], () => {
        // Give quest item
        addItem({
          id: "old_picture_frame", name: "Old Picture Frame", type: "key",
          description: "A cracked picture frame found in the abandoned house. It shows a young elf girl with reddish-brown hair hugging a red-haired woman.",
          rarity: "rare", icon: "🖼️", stackable: false, quantity: 1, usable: false
        });
        log('<strong style="color:#a855f7">✦ Obtained: Old Picture Frame</strong>');
        showNotification("Obtained: Old Picture Frame", "info");

        // Accept companion quest
        acceptQuest("c1", "comrade");

        commandInput.disabled = false;
        commandSubmit.disabled = false;
        updateQuickActions();
        autoSave();
      });
    }, 500);
    return;
  }

  // --- Goblin Cave: first visit triggers Layla encounter ---
  if (target === "Goblin Cave" && !GAME.story.laylaMet) {
    GAME.story.laylaMet = true;
    const laylaData = WORLD_DATA.npcs["Layla"];
    setTimeout(() => {
      commandInput.disabled = true;
      commandSubmit.disabled = true;
      clearChoices();
      playDialogueSequence([...laylaData.dialogue.first_meeting], () => {
        // Unlock Layla's House
        GAME.story.laylasHouseUnlocked = true;
        log('<strong style="color:#22c55e">✦ Layla\'s House is now accessible from Greenwood Street!</strong>');
        showNotification("Layla's House unlocked!", "success");

        commandInput.disabled = false;
        commandSubmit.disabled = false;
        updateQuickActions();
        autoSave();
      });
    }, 500);
    return;
  }

  // --- Layla's House: first visit triggers introduction to mother ---
  if (target === "Layla's House" && !GAME.story.laylaMotherMet) {
    GAME.story.laylaMotherMet = true;
    const laylaData = WORLD_DATA.npcs["Layla"];
    setTimeout(() => {
      commandInput.disabled = true;
      commandSubmit.disabled = true;
      clearChoices();
      playDialogueSequence([...laylaData.dialogue.at_home], () => {
        const motherData = WORLD_DATA.npcs["Layla's Mother"];
        playDialogueSequence([...motherData.dialogue.default], () => {
          commandInput.disabled = false;
          commandSubmit.disabled = false;
          updateQuickActions();
          autoSave();
        });
      });
    }, 500);
    return;
  }

  updateQuickActions();
  autoSave();
}


function hasQuestObjectiveActive(questId, objectiveDesc) {
  const quest = GAME.quests.active.find(q => q.id === questId);
  if (!quest) return false;
  const currentObj = quest.objectives[quest.objectiveIndex];
  return currentObj && currentObj.desc === objectiveDesc;
}

// Check if a quest is tracked for a given area (for area indicators later)
// Check if a quest is tracked for a given area (returns quest object)
function getTrackedQuestForArea(area) {
  return GAME.quests.active.find(q => {
    if (!q.tracked) return false;
    const obj = q.objectives[q.objectiveIndex];
    return obj && obj.area === area;
  });
}

// Wire up quest button & overlay events
// btnQuests is already declared globally at top of file
if (btnQuests) btnQuests.addEventListener("click", () => openQuestMenu());

const btnCloseQuests = document.getElementById("btn-close-quests");
if (btnCloseQuests) btnCloseQuests.addEventListener("click", () => closeQuestMenu());

questTabBtns.forEach(btn => {
  btn.addEventListener("click", () => switchQuestTab(btn.dataset.qtab));
});

// --- Intro Scene & Character Creation ---

let typewriterTimeout = null;

function clearChoices() {
  choices.innerHTML = "";
}

function renderChoices(options) {
  clearChoices();
  options.forEach(opt => {
    const btn = document.createElement("button");
    btn.className = "choice-btn";
    if (opt.highlight) btn.classList.add("highlight");
    btn.textContent = opt.text;
    btn.onclick = opt.callback;
    choices.appendChild(btn);
  });
}

function typeMessage(text, callback) {
  const narrationStyle = GLOBAL_PREFS.narrationStyle || "narrator";

  if (narrationStyle === "block") {
    log(text);
    if (callback) callback();
    return;
  }

  let i = 0;
  const baseSpeed = 30; // ms per char at 100%
  const multiplier = GLOBAL_PREFS.textSpeed || 1;
  const speed = Math.max(5, Math.round(baseSpeed / multiplier));

  // Create a paragraph for this message
  const p = document.createElement("p");
  outputLog.appendChild(p);

  let currentText = "";

  function type() {
    if (i < text.length) {
      if (text.charAt(i) === "<") {
        const endTag = text.indexOf(">", i);
        if (endTag !== -1) {
          currentText += text.substring(i, endTag + 1);
          i = endTag + 1;
        } else {
          currentText += text.charAt(i);
          i++;
        }
      } else {
        currentText += text.charAt(i);
        i++;
      }
      p.innerHTML = currentText;
      outputLog.scrollTop = outputLog.scrollHeight;
      typewriterTimeout = setTimeout(type, speed);
    } else {
      if (callback) callback();
    }
  }

  type();
}

function showNotification(message, type = "warn") {
  const container = document.getElementById("notification-container") || document.createElement("div");
  if (!container.id) {
    container.id = "notification-container";
    document.body.appendChild(container);
  }

  const notification = document.createElement("div");
  notification.className = `game-notification ${type}`;
  notification.textContent = message;

  container.appendChild(notification);

  // Trigger reflow for animation
  void notification.offsetWidth;
  notification.classList.add("show");

  setTimeout(() => {
    notification.classList.remove("show");
    setTimeout(() => notification.remove(), 300);
  }, 3000);
}

function startIntroScene() {
  clearLog();
  clearChoices();
  commandInput.disabled = true;
  commandSubmit.disabled = true;

  typeMessage("You wake up feeling the rough cobblestones of a town square against your back...", () => {
    setTimeout(() => {
      typeMessage("The air is fresh, carrying the scent of pine. An elderly woman is leaning over you, concern etched into her face.", () => {
        setTimeout(() => {
          typeMessage("She holds out a small, rectangular object. 'Heavens, are you alright, dear? You were lying there as still as a statue. I found this old Adventurer's Guild Card lying right next to you...'", () => {
            setTimeout(() => {
              if (GAME.player.name === "Hero") {
                typeMessage("'The ink has run a bit... can you clarify what your name is, dear? I want to make sure this belongs to you.'", () => {
                  showNamePrompt();
                });
              } else {
                typeMessage(`'Ah, ${GAME.player.name}. It says so right here on the card. A fine name.'`, () => {
                  showClassSelection();
                });
              }
            }, 1000);
          });
        }, 1000);
      });
    }, 1000);
  });
}

function showNamePrompt() {
  waitingForNameInput = true;
  commandInput.disabled = false;
  commandSubmit.disabled = false;
  commandInput.placeholder = "Your name...";
  commandInput.focus();

  renderChoices([
    {
      text: "State Name",
      callback: () => {
        const val = commandInput.value.trim();
        if (val !== "") {
          handleCommand(val);
          commandInput.value = "";
        }
      }
    }
  ]);
}

function showClassSelection() {
  const CLASS_INFO = {
    "Warrior": {
      template: "hero_warrior",
      strengths: "High ATK and HP. Strong physical damage dealer with powerful stamina-based abilities.",
      weaknesses: "Low mana pool. Limited utility and no healing. Relies heavily on raw damage.",
      stats: "HP 120 | ATK 12 | DEF 10 | SPD 6"
    },
    "Tank": {
      template: "hero_tank",
      strengths: "Highest HP and DEF. Can stun enemies and Fortify to absorb heavy hits. Great guard rate.",
      weaknesses: "Lowest ATK and SPD. Fights take longer. Low critical hit chance.",
      stats: "HP 150 | ATK 8 | DEF 15 | SPD 5"
    },
    "Mage": {
      template: "hero_mage",
      strengths: "Highest ATK and mana pool. Devastating magic abilities. Good speed for acting first.",
      weaknesses: "Lowest HP and DEF. Very fragile — a few hits can be fatal. No guard chance.",
      stats: "HP 80 | ATK 12 | DEF 5 | SPD 7"
    },
    "Ranger": {
      template: "hero_ranger",
      strengths: "Highest SPD and crit rate (12%). Can ignore enemy defense. Acts first in combat.",
      weaknesses: "Low DEF and no guard chance. Moderate HP. Relies on crits to deal big damage.",
      stats: "HP 90 | ATK 12 | DEF 6 | SPD 11"
    },
    "Healer": {
      template: "hero_healer",
      strengths: "Can heal 30% max HP. Balanced stats with decent survivability. Self-sustaining.",
      weaknesses: "Low ATK. Slow in combat. Damage output is limited compared to other classes.",
      stats: "HP 100 | ATK 8 | DEF 8 | SPD 6"
    },
    "Support": {
      template: "hero_support",
      strengths: "Can heal allies and debuff enemies (Weaken). High mana pool. Good team utility.",
      weaknesses: "Lowest ATK. Jack of all trades, master of none. Weak solo damage.",
      stats: "HP 100 | ATK 7 | DEF 9 | SPD 8"
    }
  };

  typeMessage("She pauses, her finger tracing a scorched section of the Guild Card. 'Dear me... it seems the Role field is completely unreadable. It looks like it was caught in a magical fire.'", () => {
    setTimeout(() => {
      typeMessage("'What was your specialty again? Are you a Warrior, a Tank, a Mage, a Ranger, a Healer, or a Support?'", () => {
        // Add info panel and strategy note to the log
        const infoPanel = document.createElement("div");
        infoPanel.id = "class-info-panel";
        infoPanel.innerHTML = `
          <div class="intro-strategy-box">
            <div class="intro-strategy-header">Strategic Insight</div>
            <div class="intro-strategy-text">
              Your choice of role is <strong>not final</strong> and can be changed as you progress. 
              With a maximum party size of <strong>5</strong>, consider a <strong>Tank, Healer, or Support</strong> 
              to ensure your team thrives against the challenges ahead!
            </div>
          </div>
          <div class="class-info-placeholder">Hover over a class to see details</div>
        `;
        const outputLog = document.getElementById("output-log") || document.getElementById("start-log");
        if (outputLog) outputLog.appendChild(infoPanel);

        const classNames = Object.keys(CLASS_INFO);
        renderChoices(classNames.map(name => ({
          text: name,
          callback: () => finalizeCharacter(CLASS_INFO[name].template)
        })));

        // Add hover listeners to choice buttons
        const buttons = choices.querySelectorAll(".choice-btn");
        buttons.forEach((btn, i) => {
          const info = CLASS_INFO[classNames[i]];
          const showInfo = () => {
            infoPanel.innerHTML = `
              <div class="class-info-card">
                <div class="class-info-name">${classNames[i]}</div>
                <div class="class-info-stats">${info.stats}</div>
                <div class="class-info-row">
                  <span class="class-info-label" style="color:#22c55e">+ Strengths:</span>
                  <span>${info.strengths}</span>
                </div>
                <div class="class-info-row">
                  <span class="class-info-label" style="color:#ef4444">- Weaknesses:</span>
                  <span>${info.weaknesses}</span>
                </div>
              </div>
            `;
          };
          btn.addEventListener("mouseenter", showInfo);
          btn.addEventListener("focus", showInfo);
        });
      });
    }, 1000);
  });
}

function finalizeCharacter(templateId) {
  clearChoices();
  const panel = document.getElementById("class-info-panel");
  if (panel) panel.remove();
  const hero = new Character(templateId);
  hero.name = GAME.player.name;

  GAME.roster.push(hero);
  GAME.team[0] = hero.id; // Always place in first slot
  GAME.story.introCompleted = true;

  typeMessage(`'I see... a ${hero.class}. A noble calling.'`, () => {
    setTimeout(() => {
      typeMessage("She hands you back the Guild Card along with an old map.", () => {
        // Give the player the Guild Card
        addItem({
          id: "guild_card",
          name: "Adventurer's Guild Card",
          type: "key",
          description: "A worn parchment card bearing the seal of the Adventurer's Guild. The role field is scorched and illegible.",
          rarity: "rare",
          icon: "🪪",
          stackable: false,
          quantity: 1,
          usable: true,
          onUse: "inspect_guild_card"
        });
        // Give the player a map key item
        addItem({
          id: "old_map",
          name: "Old Map",
          type: "key",
          description: "A weathered map of the area surrounding Willowvane. It shows paths leading to nearby locations.",
          rarity: "uncommon",
          icon: "🗺️",
          stackable: false,
          quantity: 1,
          usable: true,
          onUse: "open_map"
        });

        // Give the player some starting coins
        addItem({
          id: "bronze_coins",
          name: "Bronze Coins",
          type: "key",
          description: "Common currency of Sural. 100 bronze coins equal 1 silver coin.",
          rarity: "common",
          icon: "●",
          stackable: true,
          quantity: 23,
          usable: false
        });
        addItem({
          id: "silver_coins",
          name: "Silver Coins",
          type: "key",
          description: "Standard currency of Sural. 100 silver coins equal 1 gold coin.",
          rarity: "uncommon",
          icon: "●",
          stackable: true,
          quantity: 4,
          usable: false
        });
        log("She also hands over a small pouch. 'I found this with your belongings. It isn't much, but it's yours.'");
        updateStatusBar();

        setTimeout(() => {
          typeMessage("'Take this. Go see the Elder at the town square. He has been looking for someone like you.'", () => {
            // Unlock game
            commandInput.disabled = false;
            commandSubmit.disabled = false;
            commandInput.focus();

            // Trigger first quest
            acceptQuest("m1", "main");

            log("<br><strong>The journey begins...</strong>");
            log("Tip: Use the menu to manage your Team, Inventory, and Quests.");

            autoSave();
            updateQuickActions();
          });
        }, 1000);
      });
    }, 1000);
  });
}

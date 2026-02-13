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

const FORBIDDEN_KEYWORDS = [
  "nigger", "hitler", "adolf", "epstein", "kim jong un", "donald trump", "trump",
  "nazi", "terrorist", "pedophile", "rape", "fuck", "shit", "asshole", "bitch"
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

  return { valid: true, name: formattedName };
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

const btnInventory = document.getElementById("btn-inventory");
const btnTeam = document.getElementById("btn-team");
const btnQuests = document.getElementById("btn-quests");
const btnTravel = document.getElementById("btn-travel");

// --- Patch / Update System ---
const LOCAL_VERSION = "0.0.1";
const GITHUB_REPO = "your-username/script-heroes"; // TODO: Replace with actual repo

const patchNotice = document.getElementById("patch-notice");
const patchText = document.getElementById("patch-text");
const btnPatch = document.getElementById("btn-patch");
const btnPatchDismiss = document.getElementById("btn-patch-dismiss");

let latestVersion = null;

function compareVersions(local, remote) {
  const a = local.split(".").map(Number);
  const b = remote.split(".").map(Number);
  for (let i = 0; i < Math.max(a.length, b.length); i++) {
    const av = a[i] || 0;
    const bv = b[i] || 0;
    if (bv > av) return 1;  // remote is newer
    if (bv < av) return -1; // local is newer
  }
  return 0; // equal
}

async function checkForUpdate() {
  try {
    const url = `https://raw.githubusercontent.com/${GITHUB_REPO}/main/version.json?t=${Date.now()}`;
    const res = await fetch(url, { cache: "no-store" });
    if (!res.ok) return;

    const remote = await res.json();
    latestVersion = remote.version;

    if (compareVersions(LOCAL_VERSION, latestVersion) === 1) {
      patchText.textContent = `Update available: v${latestVersion} (current: v${LOCAL_VERSION})`;
      patchNotice.style.display = "flex";
    }
  } catch (e) {
    // No internet or repo not found — silently ignore
    console.log("Update check skipped:", e.message);
  }
}

async function applyPatch() {
  // 1. Export saves first
  await exportSaves();

  // 2. Download the full repo as ZIP
  const zipUrl = `https://github.com/${GITHUB_REPO}/archive/refs/heads/main.zip`;
  const a = document.createElement("a");
  a.href = zipUrl;
  a.download = "script-heroes-update.zip";
  a.click();
}

if (btnPatch) {
  btnPatch.addEventListener("click", () => applyPatch());
}

if (btnPatchDismiss) {
  btnPatchDismiss.addEventListener("click", () => {
    patchNotice.style.display = "none";
  });
}

// Check for updates on page load (non-blocking)
checkForUpdate();
const AVAILABLE_COMMANDS = [
  "/help", "/save", "/load", "/loadslot", "/deleteslot", "/clear",
  "/inventory", "/quests", "/team", "/status", "/travel", "/class", "/guild",
  "/talk", "/go"
];

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
      maxHp: 20
    },
    story: {
      chapter: 1,
      scene: 1,
      location: "Willowvane",
      introCompleted: false
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
    system: {
      createdAt: Date.now(),
      lastSave: Date.now()
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
}

function updateDynamicPlayerVars() {
  playerCurrentHealth = GAME.player.hp;
  playerMaxHealth = GAME.player.maxHp;
  playerXP = GAME.player.xp;
  playerLvl = GAME.player.level;
  playerXpForNextLvl = xpForNextLevel(GAME.player.level);
};

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
  document.getElementById("player-gold").textContent = `🪙 ${goldItem ? goldItem.quantity : 0}`;
  document.getElementById("player-silver").textContent = `S: ${silverItem ? silverItem.quantity : 0}`;
  document.getElementById("player-bronze").textContent = `B: ${bronzeItem ? bronzeItem.quantity : 0}`;

  document.getElementById("player-location").textContent = "Area: " + GAME.story.location;

}
btnStartGame.addEventListener("click", async () => {
  const validation = validateAndFormatName(nicknameInput.value);
  if (!validation.valid && nicknameInput.value.trim() !== "") {
    alert(validation.reason);
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

const menuToggle = document.getElementById("menu-toggle");
const sideMenu = document.getElementById("side-menu");

// Side menu toggle logic
menuToggle.addEventListener("click", () => {
  const visible = sideMenu.style.display === "flex";
  sideMenu.style.display = visible ? "none" : "flex";
});

// Fullscreen toggle logic
const fullscreenToggle = document.getElementById("fullscreen-toggle");
const btnFullscreenStart = document.getElementById("btn-fullscreen-start");
const fsExpand = document.getElementById("fs-expand");
const fsCompress = document.getElementById("fs-compress");

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

fullscreenToggle.addEventListener("click", toggleFullscreen);
if (btnFullscreenStart) btnFullscreenStart.addEventListener("click", toggleFullscreen);

// Update icon on fullscreen change
function onFullscreenChange() {
  const isFullscreen = !!(document.fullscreenElement || document.webkitFullscreenElement);
  fsExpand.style.display = isFullscreen ? "none" : "block";
  fsCompress.style.display = isFullscreen ? "block" : "none";
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

  if (item.type !== "key") {
    const discardBtn = document.createElement("button");
    discardBtn.className = "inv-action-btn discard";
    discardBtn.textContent = item.quantity > 1 ? "Discard 1" : "Discard";
    discardBtn.addEventListener("click", async () => {
      const itemId = item.instanceId || item.id;
      removeItem(itemId, 1);
      await autoSave();
      inventoryDetail.style.display = "none";
      renderInventoryTab(activeInvTab);
      log(`Discarded ${item.name}.`);
    });
    actionsEl.appendChild(discardBtn);
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
      // Display a text-based map of the world
      const currentLoc = GAME.story.location;
      const mapLines = [];
      mapLines.push("You unfold the old map and study it...");
      mapLines.push("");
      for (const [locName, locData] of Object.entries(WORLD_DATA.locations)) {
        const marker = locName === currentLoc ? " ★ (You are here)" : "";
        mapLines.push(`<strong>${locData.name}</strong>${marker}`);
        mapLines.push(`  <span style="color:#94a3b8;">${locData.description}</span>`);
        if (locData.connections.length > 0) {
          mapLines.push(`  → Connects to: ${locData.connections.join(", ")}`);
        }
        mapLines.push("");
      }
      inventoryOverlay.style.display = "none";
      log(mapLines.join("<br>"));
      return; // Don't consume key items

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

// --- Settings System ---
const settingsOverlay = document.getElementById("settings-overlay");
const btnCloseSettings = document.getElementById("btn-close-settings");
const textSpeedOptions = document.getElementById("text-speed-options");
const musicVolumeSlider = document.getElementById("music-volume-slider");
const musicVolumeValue = document.getElementById("music-volume-value");
const musicMuteCheckbox = document.getElementById("music-mute-checkbox");

function openSettings() {
  // Close side menu if open
  sideMenu.style.display = "none";
  settingsOverlay.style.display = "flex";
  refreshSettingsUI();
}

function refreshSettingsUI() {
  const s = (GAME && GAME.settings) ? GAME.settings : {};
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
}

if (btnCloseSettings) {
  btnCloseSettings.addEventListener("click", () => {
    settingsOverlay.style.display = "none";
  });
}

textSpeedOptions.querySelectorAll(".setting-btn").forEach(btn => {
  btn.addEventListener("click", async () => {
    const speed = parseFloat(btn.dataset.speed);
    if (!GAME.settings) GAME.settings = {};
    GAME.settings.textSpeed = speed;
    refreshSettingsUI();
    await autoSave();
  });
});

let volumeSaveTimeout = null;
musicVolumeSlider.addEventListener("input", () => {
  const vol = parseInt(musicVolumeSlider.value);
  musicVolumeValue.textContent = vol + "%";
  if (!GAME.settings) GAME.settings = {};
  GAME.settings.musicVolume = vol;
  // TODO: Apply volume to audio engine when implemented
  // Debounce autosave so we don't save on every pixel drag
  clearTimeout(volumeSaveTimeout);
  volumeSaveTimeout = setTimeout(() => autoSave(), 500);
});

musicMuteCheckbox.addEventListener("change", async () => {
  if (!GAME.settings) GAME.settings = {};
  GAME.settings.musicMuted = musicMuteCheckbox.checked;
  // TODO: Apply mute to audio engine when implemented
  await autoSave();
});

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
  log("> " + cmd);

  if (waitingForNameInput) {
    if (cmd.trim() !== "") {
      const validation = validateAndFormatName(cmd);
      if (!validation.valid) {
        log(`<span style="color:#ef4444;">'I... I'm sorry, I couldn't quite catch that. Could you say it again?' (${validation.reason})</span>`);
        return;
      }

      GAME.player.name = validation.name;
      waitingForNameInput = false;
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
        AVAILABLE_COMMANDS.map(c => " - " + c)
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

    case "/save":
      await saveGame();
      break;

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

    default:
      log("Unknown Command. For a list of commands, type /help.");
  }
};

function xpForNextLevel(level) {
  return 50 + (level - 1) * 25;
};

async function addXP(amount) {
  GAME.player.xp += amount;

  const needed = xpForNextLevel(GAME.player.level);

  if (GAME.player.xp >= needed) {
    GAME.player.xp -= needed;
    GAME.player.level++;
    log(`🎉 Level Up! You reached Level ${GAME.player.level}.`);
  }

  updateStatusBar();
  await autoSave();
};

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

async function saveGame() {
  const saves = await getAllSaves();

  GAME.system.lastSave = Date.now();
  const newSave = {
    id: "save_" + Date.now(),
    timestamp: Date.now(),
    playerName: GAME.player.name,
    chapter: GAME.story.chapter,
    scene: GAME.story.scene,
    data: GAME,
    logHistory: getCurrentLogHistory()
  };

  newSave.hash = await hashSaveObject({
    playerName: newSave.playerName,
    chapter: newSave.chapter,
    scene: newSave.scene,
    data: newSave.data,
    logHistory: newSave.logHistory
  });

  await putSave(newSave);

  logBlock("Game saved.", [
    `ID: ${newSave.id}`,
    `Time: ${new Date(newSave.timestamp).toLocaleString()}`
  ]);
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

async function addItem(itemObj) {
  // If stackable, try to find existing stack
  if (itemObj.stackable !== false) {
    const existing = GAME.inventory.find(i => i.id === itemObj.id);
    if (existing) {
      existing.quantity = (existing.quantity || 1) + (itemObj.quantity || 1);
      await autoSave();
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

btnSave.addEventListener("click", async () => await saveGame());
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

const WORLD_DATA = {
  locations: {
    "Willowvane": {
      name: "Willowvane",
      description: "The peaceful outskirts of the village. The air smells of pine and fresh earth.",
      npcs: ["Elderly Woman"],
      connections: ["Town Square"]
    },
    "Town Square": {
      name: "Town Square",
      description: "A bustling area with cobblestone paths. A dormant fountain stands at the center.",
      npcs: ["Elder"],
      connections: ["Willowvane", "Forest Entrance"]
    },
    "Forest Entrance": {
      name: "Forest Entrance",
      description: "The edge of a dark, dense forest. You hear distant, unsettling sounds.",
      npcs: [],
      connections: ["Town Square"]
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
      { name: "Heal", desc: "Restores 20% HP." }
    ],
    passives: []
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
      { name: "Slash", desc: "Deals 120% ATK damage." }
    ],
    passives: []
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
      { name: "Shield Bash", desc: "Deals 100% ATK damage and has a chance to stun." }
    ],
    passives: []
  },
  "hero_mage": {
    name: "Hero",
    class: CLASS.MAGE,
    rarity: RARITY.R,
    baseStats: {
      hp: 80, atk: 15, def: 5, spd: 7,
      mana: 70, stamina: 20,
      critRate: 0.05, guardRate: 0.0
    },
    growth: {
      hp: 8, atk: 3.5, def: 1.0, spd: 0.2,
      mana: 7, stamina: 2
    },
    abilities: [
      { name: "Arcane Bolt", desc: "Deals 140% ATK magic damage." }
    ],
    passives: []
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
      { name: "Quick Shot", desc: "Deals 110% ATK damage with high crit chance." }
    ],
    passives: []
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
      { name: "Heal", desc: "Restores 25% HP to an ally." }
    ],
    passives: []
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
      { name: "Mend", desc: "Restores 20% HP to an ally." }
    ],
    passives: []
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

  return TEAM_EFFECTS.filter(effect => effect.check(teamChars));
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

    // Check if reached current cap
    if (this.level < this.currentCap) {
      // console.log(`Cannot awaken: Level ${this.level} < Cap ${this.currentCap}`);
      return false;
    }
    // Check if there is a next cap in the normal array
    if (this.awakeningRank < this.rarity.caps.length - 1) {
      return true;
    }
    // Check if Hidden Potential is available
    if (this.rarity.hiddenCap && !this.hiddenPotentialUnlocked) {
      return true; // Special prompt for Hidden Potential
    }
    return false;
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
    this.level++;
    const template = CHARACTER_ROSTER[this.templateId];
    const growthMod = this.rarity.growthMod;
    // Apply Growth
    for (let stat in template.growth) {
      this.maxStats[stat] += template.growth[stat] * growthMod;
    }

    this.fullHeal();
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

      slot.innerHTML = `
        <div class="char-card-inner">
          <div class="char-name">${char.name}</div>
          <div class="char-info">${char.class}</div>
          <div class="char-info" style="font-size:0.8rem; margin-top:2px;">Lv ${char.level} / ${char.currentCap}</div>
          
          <div class="stat-bar"><div class="bar-fill hp-fill" style="width: ${(char.currentResources.hp / char.maxStats.hp) * 100}%"></div></div>
          ${char.currentResources.shield > 0 ? `<div class="stat-bar shield-bar"><div class="bar-fill shield-fill" style="width: ${(char.currentResources.shield / char.maxStats.hp) * 100}%"></div></div>` : ""}
          <div class="stat-bar"><div class="bar-fill mana-fill" style="width: ${(char.currentResources.mana / char.maxStats.mana) * 100}%"></div></div>
          
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
      slot.innerHTML = `<span style="color:#64748b">+ Empty Slot</span>`;
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

      if (activeCount <= 1) {
        removeBtn.disabled = true;
        removeBtn.style.opacity = "0.5";
        removeBtn.style.cursor = "not-allowed";
        removeBtn.title = "At least one character must remain in the party.";
      }

      removeBtn.onclick = (e) => {
        if (activeCount <= 1) return;
        e.stopPropagation();
        GAME.team[index] = null;
        renderTeamTab();
      };
      wrapper.appendChild(removeBtn);
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

    card.innerHTML = `
      <div class="char-name">${char.name} ${teamStatus}</div>
      <div class="char-info">${char.class}</div>
      ${char.currentResources.shield > 0 ? `<div class="stat-bar shield-bar" style="margin-bottom: 5px;"><div class="bar-fill shield-fill" style="width: ${(char.currentResources.shield / char.maxStats.hp) * 100}%"></div></div>` : ""}
      <div class="char-info">Lv ${char.level} / ${char.currentCap}</div>
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
        <div style="display:flex; gap:10px;">
           <button class="upgrade-btn" id="btn-lvlup">Level Up</button>
           <button class="upgrade-btn" id="btn-awaken" ${char.canAwaken() ? '' : 'disabled'}>Awaken</button>
        </div>
        ${char.canAwaken() ? '<div style="color:#fbbf24; font-size:0.8rem; margin-top:5px;">Awakening Available!</div>' : ''}
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
  `;

  // Bind actions
  document.getElementById("btn-detail-close").onclick = closeCharDetail;

  document.getElementById("btn-awaken").onclick = () => {
    if (char.awaken()) {
      openCharDetail(char); // Refresh
    }
  };
  document.getElementById("btn-lvlup").onclick = () => {
    char.levelUp(); // Simple implementation for now
    openCharDetail(char);
  };
}

function renderSkillsList(char) {
  let html = '';
  // Abilities
  char.templateId && CHARACTER_ROSTER[char.templateId].abilities.forEach((skill, idx) => {
    const lvl = char.skillLevels[idx] || 1;
    html += `
           <div class="skill-row">
             <div class="skill-info">
               <h4>${skill.name}</h4>
               <div class="skill-desc">${skill.desc}</div>
             </div>
             <button class="upgrade-btn" onclick="char.skillLevels[${idx}]++; openCharDetail(GAME.roster.find(c=>c.id=='${char.id}'))">Lv. ${lvl}</button>
           </div>`;
  });
  return html;
}

function closeCharDetail() {
  charDetailView.style.display = "none";
}

function renderEquipSlot(char, slotKey, label) {
  const item = char.equipment[slotKey];
  return `
      <div class="equip-slot ${item ? 'equipped' : ''}" onclick="alert('Equipment selection not implemented yet')">
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
  if (rarity.name === "Rare") return "#3b82f6";
  if (rarity.name === "Super Rare") return "#a855f7";
  if (rarity.name === "SSR") return "#eab308";
  if (rarity.name === "Ultra Rare") return "#ef4444";
  return "#fff";
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
        { desc: "Explore the Forest Entrance.", area: "Forest Entrance", type: "explore", current: 0, required: 1 }
      ]
    },
    {
      id: "m2", name: "Rising Shadows", desc: "Investigate reports of dark energy.", type: "main",
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
  comrade: [],
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
    const typeColor = type === 'main' ? '#f59e0b' : type === 'adventurer' ? '#22c55e' : '#a855f7';

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
          <span class="quest-type-badge" style="background:#f59e0b">DAILY</span>
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
function progressQuest(questId, amount = 1) {
  const quest = GAME.quests.active.find(q => q.id === questId);
  if (!quest || quest.objectiveIndex >= quest.objectives.length) return;

  const obj = quest.objectives[quest.objectiveIndex];
  obj.current = Math.min((obj.current || 0) + amount, obj.required || 1);

  if (obj.current >= (obj.required || 1)) {
    quest.objectiveIndex++;
    if (quest.objectiveIndex >= quest.objectives.length) {
      completeQuest(questId);
    } else {
      questLog(`${quest.name} — objective complete! Next: ${quest.objectives[quest.objectiveIndex].desc}`);
    }
  } else {
    questLog(`${quest.name} — ${obj.desc} (${obj.current}/${obj.required})`);
  }
}

// Complete a quest
function completeQuest(questId) {
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
  renderQuestList(currentQuestTab);
}

// Toggle quest tracking
function toggleTrackQuest(questId) {
  const quest = GAME.quests.active.find(q => q.id === questId);
  if (!quest) return;
  quest.tracked = !quest.tracked;
  questLog(`${quest.name} — ${quest.tracked ? 'Now tracking' : 'Stopped tracking'}`);
  renderQuestList(currentQuestTab);
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
    choicesList.push({
      text: `Talk to ${npcName}`,
      callback: () => handleCommand(`/talk ${npcName}`)
    });
  });

  // Travel Actions
  location.connections.forEach(targetLoc => {
    choicesList.push({
      text: `Go to ${targetLoc}`,
      callback: () => handleCommand(`/go ${targetLoc}`)
    });
  });

  if (choicesList.length > 0) {
    renderChoices(choicesList);
  } else {
    clearChoices();
  }
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

  // Quest specific dialogue
  if (npc === "Elder" && hasQuestObjectiveActive("m1", "Talk to the Elder in Town.")) {
    lines = [...npcData.dialogue.quest_m1];
    progressQuest("m1");
  }

  commandInput.disabled = true;
  commandSubmit.disabled = true;
  clearChoices();

  playDialogueSequence(lines, () => {
    commandInput.disabled = false;
    commandSubmit.disabled = false;
    commandInput.focus();
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
  const currentLoc = WORLD_DATA.locations[GAME.story.location];
  const target = currentLoc.connections.find(c => c.toLowerCase() === locName.toLowerCase());

  if (!target) {
    log(`You cannot go to "${locName}" from here.`);
    return;
  }

  GAME.story.location = target;
  updateStatusBar();
  log(`<br><strong>${target}</strong>`);
  log(WORLD_DATA.locations[target].description);

  // Check quest objective
  if (target === "Forest Entrance") {
    if (hasQuestObjectiveActive("m1", "Explore the Forest Entrance.")) {
      progressQuest("m1");
    }
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
function hasTrackedQuestForArea(area) {
  return GAME.quests.active.some(q => {
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
    btn.textContent = opt.text;
    btn.onclick = opt.callback;
    choices.appendChild(btn);
  });
}

function typeMessage(text, callback) {
  let i = 0;
  const baseSpeed = 30; // ms per char at 100%
  const multiplier = (GAME && GAME.settings && GAME.settings.textSpeed) ? GAME.settings.textSpeed : 1;
  const speed = Math.max(5, Math.round(baseSpeed / multiplier));

  // Create a paragraph for this message
  const p = document.createElement("p");
  outputLog.appendChild(p);

  function type() {
    if (i < text.length) {
      p.innerHTML += text.charAt(i);
      i++;
      outputLog.scrollTop = outputLog.scrollHeight;
      typewriterTimeout = setTimeout(type, speed);
    } else {
      if (callback) callback();
    }
  }

  type();
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
  typeMessage("She pauses, her finger tracing a scorched section of the Guild Card. 'Dear me... it seems the Role field is completely unreadable. It looks like it was caught in a magical fire.'", () => {
    setTimeout(() => {
      typeMessage("'What was your specialty again? Are you a Warrior, a Tank, a Mage, a Ranger, a Healer, or a Support?'", () => {
        renderChoices([
          { text: "Warrior", callback: () => finalizeCharacter("hero_warrior") },
          { text: "Tank", callback: () => finalizeCharacter("hero_tank") },
          { text: "Mage", callback: () => finalizeCharacter("hero_mage") },
          { text: "Ranger", callback: () => finalizeCharacter("hero_ranger") },
          { text: "Healer", callback: () => finalizeCharacter("hero_healer") },
          { text: "Support", callback: () => finalizeCharacter("hero_support") }
        ]);
      });
    }, 1000);
  });
}

function finalizeCharacter(templateId) {
  clearChoices();
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
        log("<em>Received: Adventurer's Guild Card</em>");
        log("<em>Received: Old Map</em>");

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
        log("<em>Received: 23 Bronze Coins, 4 Silver Coins</em>");
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

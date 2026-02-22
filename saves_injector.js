/**
 * SCRIPT HEROES - MAKI SAVE INJECTOR (FINAL V4)
 * 
 * Instructions:
 * 1. Open your game in the browser.
 * 2. Press F12 to open DevTools, and go to the Console tab.
 * 3. Copy and paste this ENTIRE script into the console and press Enter.
 * 4. Refresh the page and check your Load Menu!
 */

(async () => {
    console.log("%c Maki Save Injector Starting... ", "background: #3b82f6; color: #fff; font-weight: bold;");

    if (typeof crypto === 'undefined' || !crypto.subtle) {
        console.error("CRITICAL ERROR: 'crypto.subtle' is not available. This usually happens on non-secure (http/file) contexts. If the game's normal save system works, this should work too. If not, try running through a local server.");
        return;
    }

    const CLASS = { WARRIOR: "Warrior", TANK: "Tank", MAGE: "Mage", RANGER: "Ranger", HEALER: "Healer", SUPPORT: "Support" };
    const RARITY_R = { name: "Rare", growthMod: 1.0, caps: [20, 30, 40, 50, 60, 70] };

    const templates = {
        WARRIOR: {
            id: "hero_warrior", class: CLASS.WARRIOR,
            growth: { hp: 12, atk: 2.5, def: 2.0, spd: 0.15, mana: 2, stamina: 4 },
            base: { hp: 120, atk: 12, def: 10, spd: 6, mana: 20, stamina: 40 },
            abilities: [
                { name: "Slash", desc: "Deals 120% ATK damage.", mult: 1.2, cost: { stamina: 8 }, type: "attack" },
                { name: "Power Strike", desc: "Deals 150% ATK damage.", mult: 1.5, cost: { stamina: 15 }, type: "attack" }
            ],
            leaderSkill: { name: "Brave Heart", desc: "+5% ATK for the team.", effect: { atkMult: 1.05 } }
        },
        TANK: {
            id: "hero_tank", class: CLASS.TANK,
            growth: { hp: 15, atk: 1.5, def: 2.5, spd: 0.1, mana: 2, stamina: 4 },
            base: { hp: 150, atk: 8, def: 15, spd: 5, mana: 20, stamina: 40 },
            abilities: [
                { name: "Shield Bash", desc: "Deals 100% ATK damage. Chance to stun.", mult: 1.0, cost: { stamina: 10 }, type: "attack", stunChance: 0.3 },
                { name: "Fortify", desc: "Reduces incoming damage by 50% for 2 turns.", mult: 0, cost: { stamina: 12 }, type: "buff", effect: "fortify" }
            ],
            leaderSkill: { name: "Iron Defense", desc: "+10% Team DEF.", effect: { defMult: 1.1 } }
        },
        MAGE: {
            id: "hero_mage", class: CLASS.MAGE,
            growth: { hp: 8, atk: 3.5, def: 1.0, spd: 0.2, mana: 7, stamina: 2 },
            base: { hp: 80, atk: 12, def: 5, spd: 7, mana: 70, stamina: 20 },
            abilities: [
                { name: "Arcane Bolt", desc: "Deals 140% ATK magic damage.", mult: 1.4, cost: { mana: 15 }, type: "attack" },
                { name: "Fireball", desc: "Deals 180% ATK magic damage.", mult: 1.8, cost: { mana: 25 }, type: "attack" }
            ],
            leaderSkill: { name: "Mana Flow", desc: "+10% Team Mana Pool.", effect: { manaMult: 1.1 } }
        },
        RANGER: {
            id: "hero_ranger", class: CLASS.RANGER,
            growth: { hp: 9, atk: 2.5, def: 1.2, spd: 0.35, mana: 3, stamina: 4 },
            base: { hp: 90, atk: 12, def: 6, spd: 11, mana: 30, stamina: 40 },
            abilities: [
                { name: "Quick Shot", desc: "Deals 110% ATK damage. +15% crit chance.", mult: 1.1, cost: { stamina: 8 }, type: "attack", critBonus: 0.15 },
                { name: "Piercing Arrow", desc: "Deals 130% ATK damage. Ignores defense.", mult: 1.3, cost: { stamina: 14 }, type: "attack", ignoresDef: true }
            ],
            leaderSkill: { name: "Swift Wind", desc: "+10% Team SPD.", effect: { spdMult: 1.1 } }
        },
        HEALER: {
            id: "hero_healer", class: CLASS.HEALER,
            growth: { hp: 10, atk: 1.5, def: 1.5, spd: 0.1, mana: 5, stamina: 2 },
            base: { hp: 100, atk: 8, def: 8, spd: 6, mana: 50, stamina: 25 },
            abilities: [
                { name: "Heal", desc: "Restores 30% of max HP.", mult: 0.3, cost: { mana: 12 }, type: "heal" },
                { name: "Smite", desc: "Deals 110% ATK holy damage.", mult: 1.1, cost: { mana: 10 }, type: "attack" }
            ],
            leaderSkill: { name: "Devotion", desc: "+10% Healing Received for the team.", effect: { healRecMult: 1.1 } }
        },
        SUPPORT: {
            id: "hero_support", class: CLASS.SUPPORT,
            growth: { hp: 10, atk: 1.2, def: 1.8, spd: 0.2, mana: 7, stamina: 2 },
            base: { hp: 100, atk: 7, def: 9, spd: 8, mana: 60, stamina: 25 },
            abilities: [
                { name: "Mend", desc: "Restores 25% of max HP.", mult: 0.25, cost: { mana: 10 }, type: "heal" },
                { name: "Weaken", desc: "Reduces enemy ATK by 20% for 2 turns.", mult: 0, cost: { mana: 14 }, type: "debuff", effect: "weaken" }
            ],
            leaderSkill: { name: "Tactical Edge", desc: "+10% Team SPD.", effect: { spdMult: 1.1 } }
        }
    };

    function generateStats(type, level) {
        const t = templates[type];
        const g = level - 1;
        let stats = { critRate: t.base.critRate || 0, guardRate: t.base.guardRate || 0 };
        for (let s in t.base) {
            if (['critRate', 'guardRate'].includes(s)) continue;
            stats[s] = t.base[s] + t.growth[s] * g;
            if (s === 'hp') stats[s] = Math.floor(stats[s]);
        }
        return stats;
    }

    async function computeHash(save) {
        const relevant = { playerName: save.playerName, chapter: save.chapter, scene: save.scene, data: save.data, logHistory: save.logHistory };
        const json = JSON.stringify(relevant);
        const encoder = new TextEncoder();
        const data = encoder.encode(json);
        const hashBuffer = await crypto.subtle.digest('SHA-256', data);
        return Array.from(new Uint8Array(hashBuffer)).map(b => b.toString(16).padStart(2, '0')).join('');
    }

    const DB_NAME = "ScriptHeroesDB";
    const STORE_NAME = "saves";

    const preparedSaves = [];
    console.log("Pre-calculating save objects and hashes...");

    for (let className in templates) {
        const stats = generateStats(className, 20);
        const t = templates[className];

        const gameData = {
            player: { name: "Maki", level: 20, xp: 0, hp: stats.hp, maxHp: stats.hp, alignment: 0 },
            story: { chapter: 1, scene: 1, location: "Town Square", introCompleted: true, forestWolfDefeated: false },
            inventory: [
                { id: "guild_card", name: "Adventurer's Guild Card", type: "key", quantity: 1, rarity: "rare", icon: "🪪", description: "Standard Guild Card.", usable: true, onUse: "inspect_guild_card" },
                { id: "old_map", name: "Old Map", type: "key", quantity: 1, rarity: "rare", icon: "🗺️", description: "A map of Sural.", usable: true, onUse: "inspect_map" }
            ],
            weapons: [], sets: [], flags: {}, roster: [{
                id: "maki_hero", templateId: t.id, name: "Maki", class: t.class,
                rarity: RARITY_R, level: 20, xp: 0, awakeningRank: 0, currentCap: 20, hiddenPotentialUnlocked: false,
                maxStats: stats, currentResources: { ...stats, shield: 0 },
                growth: t.growth, abilities: t.abilities, passives: [], leaderSkill: t.leaderSkill,
                equipment: { head: null, chest: null, legs: null, feet: null, weapon: null, extra1: null, extra2: null, extra3: null },
                skillLevels: { 0: 1, 1: 1 },
                lore: "A wayward soul from a distant land, seeking purpose in a world consumed by shadows.",
                personal: "Loves: Discovery. Dislikes: Stagnation."
            }],
            team: ["maki_hero", null, null, null, null],
            quests: { active: [], completed: [], lastDailyDate: null, currentDaily: null },
            materials: { ability_fragment: 0 },
            system: { createdAt: Date.now(), lastSave: Date.now(), currentSaveId: `Maki_${className}` },
            settings: { textSpeed: 1, musicVolume: 100, musicMuted: false }
        };

        const saveObj = { id: `Maki_${className}`, timestamp: Date.now(), playerName: "Maki", chapter: 1, scene: 1, data: gameData, logHistory: [] };
        saveObj.hash = await computeHash(saveObj);
        preparedSaves.push(saveObj);
    }

    console.log("Opening IndexedDB to inject prepared saves...");
    const request = indexedDB.open(DB_NAME);

    request.onerror = (e) => console.error("Failed to open IndexedDB", e);

    request.onsuccess = (event) => {
        const db = event.target.result;
        if (!db.objectStoreNames.contains(STORE_NAME)) {
            console.error(`Store '${STORE_NAME}' not found.`);
            return;
        }

        const transaction = db.transaction(STORE_NAME, "readwrite");
        const store = transaction.objectStore(STORE_NAME);

        preparedSaves.forEach(save => {
            const putRequest = store.put(save);
            putRequest.onsuccess = () => console.log(`%c [OK] ${save.id} injected.`, "color: #22c55e;");
        });

        transaction.oncomplete = () => {
            console.log("%c SUCCESS: Maki saves injected! Refresh the page. ", "background: #22c55e; color: #fff; font-weight: bold;");
            db.close();
        };
    };
})();

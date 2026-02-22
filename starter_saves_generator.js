const crypto = require('crypto');
const fs = require('fs');

async function hashSaveObject(obj) {
    const json = JSON.stringify(obj);
    return crypto.createHash('sha256').update(json).digest('hex');
}

const CLASS = {
    WARRIOR: "Warrior",
    TANK: "Tank",
    MAGE: "Mage",
    RANGER: "Ranger",
    HEALER: "Healer",
    SUPPORT: "Support"
};

const templates = {
    WARRIOR: {
        id: "hero_warrior",
        growth: { hp: 12, atk: 2.5, def: 2.0, spd: 0.15, mana: 2, stamina: 4 },
        base: { hp: 120, atk: 12, def: 10, spd: 6, mana: 20, stamina: 40 }
    },
    TANK: {
        id: "hero_tank",
        growth: { hp: 15, atk: 1.5, def: 2.5, spd: 0.1, mana: 2, stamina: 4 },
        base: { hp: 150, atk: 8, def: 15, spd: 5, mana: 20, stamina: 40 }
    },
    MAGE: {
        id: "hero_mage",
        growth: { hp: 8, atk: 3.5, def: 1.0, spd: 0.2, mana: 7, stamina: 2 },
        base: { hp: 80, atk: 12, def: 5, spd: 7, mana: 70, stamina: 20 }
    },
    RANGER: {
        id: "hero_ranger",
        growth: { hp: 9, atk: 2.5, def: 1.2, spd: 0.35, mana: 3, stamina: 4 },
        base: { hp: 90, atk: 12, def: 6, spd: 11, mana: 30, stamina: 40 }
    },
    HEALER: {
        id: "hero_healer",
        growth: { hp: 10, atk: 1.5, def: 1.5, spd: 0.1, mana: 5, stamina: 2 },
        base: { hp: 100, atk: 8, def: 8, spd: 6, mana: 50, stamina: 25 }
    },
    SUPPORT: {
        id: "hero_support",
        growth: { hp: 10, atk: 1.2, def: 1.8, spd: 0.2, mana: 7, stamina: 2 },
        base: { hp: 100, atk: 7, def: 9, spd: 8, mana: 60, stamina: 25 }
    }
};

function generateStats(className, level) {
    const t = templates[className];
    const g = level - 1;
    let stats = {};
    for (let s in t.base) {
        stats[s] = t.base[s] + t.growth[s] * g;
        if (s === 'hp') stats[s] = Math.floor(stats[s]);
    }
    return stats;
}

async function createSave(className) {
    const stats = generateStats(className, 20);
    const templateId = templates[className].id;

    const gameData = {
        player: { name: "Maki", level: 20, xp: 0, hp: stats.hp, maxHp: stats.hp, alignment: 0 },
        story: { chapter: 1, scene: 1, location: "Town Square", introCompleted: true, forestWolfDefeated: false },
        inventory: [
            { id: "guild_card", name: "Adventurer's Guild Card", type: "key", quantity: 1, rarity: "rare", icon: "🪪", description: "...", usable: true, onUse: "inspect_guild_card" },
            { id: "old_map", name: "Old Map", type: "key", quantity: 1, rarity: "rare", icon: "🗺️", description: "...", usable: true, onUse: "inspect_map" }
        ],
        weapons: [],
        sets: [],
        flags: {},
        roster: [{
            id: "maki_hero",
            templateId: templateId,
            name: "Maki",
            class: className.charAt(0) + className.slice(1).toLowerCase(),
            rarity: { name: "Rare", growthMod: 1.0, caps: [20, 30, 40, 50, 60, 70] },
            level: 20,
            xp: 0,
            awakeningRank: 0,
            currentCap: 20,
            hiddenPotentialUnlocked: false,
            maxStats: stats,
            currentResources: { ...stats, shield: 0 },
            equipment: { head: null, chest: null, legs: null, feet: null, weapon: null, extra1: null, extra2: null, extra3: null },
            skillLevels: {}
        }],
        team: ["maki_hero", null, null, null, null],
        quests: { active: [], completed: [], lastDailyDate: null, currentDaily: null },
        materials: { ability_fragment: 0 },
        system: { createdAt: Date.now(), lastSave: Date.now(), currentSaveId: `Maki_${templateId}_Lv20` },
        settings: { textSpeed: 1, musicVolume: 100, musicMuted: false }
    };

    const saveObj = {
        id: `Maki_${className}`,
        timestamp: Date.now(),
        playerName: "Maki",
        chapter: 1,
        scene: 1,
        data: gameData,
        logHistory: []
    };

    saveObj.hash = await hashSaveObject({
        playerName: saveObj.playerName,
        chapter: saveObj.chapter,
        scene: saveObj.scene,
        data: saveObj.data,
        logHistory: saveObj.logHistory
    });

    return saveObj;
}

(async () => {
    const saves = [];
    for (let c in templates) {
        saves.push(await createSave(c));
    }
    fs.writeFileSync('maki_starter_saves.json', JSON.stringify(saves, null, 2));
    console.log("Generated maki_starter_saves.json");
})();

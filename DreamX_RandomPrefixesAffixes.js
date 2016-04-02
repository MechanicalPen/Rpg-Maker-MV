/*:
 * @plugindesc v1.14 Random prefixes/affixes
 * @author DreamX
 *
 * @param Default Chance
 * @desc If using chances for the prefix/affix, this is the default chance.
 * @default 10
 *
 * @help
 * This plugin must be named DreamX_RandomPrefixesAffixes in order for
 * parameters to work properly.
 *
 * Add <prefix:x,y,z> and/or <affix:x,y,z> to a weapon/armor's note
 * with the letters being weapon/armor ids. You can have as many ids
 * as you want. The ids must be the same type as the base item,
 * ie. weapon ids for a weapon, etc.
 * When the party gains that equipment, it'll randomly choose a prefix
 * and/or affix and add the traits, params, price and meta to a new item,
 * also changing the name. The new item is then added instead of the
 * base item.
 *
 * Example: <prefix:2,4,8,12,26> <affix:7,2>
 * If the base item is named "Sword", the prefix item is named "Strong"
 * and the affix item is named "Of Fire"
 * You would get Strong Sword Of Fire.
 *
 * If a prefix or affix item has <prefixAffixReplaceAnim:1> then its
 * anim will be used for the new item.
 *
 * If a prefix or affix item has <prefixAffixReplaceIcon:1> then its
 * icon will be used for the new item.
 *
 * The new item have the traits of both prefix and affix items and add their
 * params. For example, if the prefix item has +10 ATK and the base item has
 * +20 ATK, the new item wil have +30 ATK.
 * Meta will be a combination of the prefix and affix item meta, in other words,
 * the notetags.
 * Price will be the original plus the prices of the prefix and affix item.
 * Note will be the notes of the original, the prefix and the affix items
 * except that the meta and prefix notetag portions will be removed.
 *
 * If you use the wrong notetags for the prefix/affix (like IDs that don't
 * exist), the player simply doesn't get an item instead of the game crashing.
 *
 * Use <prefixAffixChance:x> with x being the percent chance of getting that
 * prefix or affix.
 * Example: <prefixAffixChance:25> for a 25% chance.
 *
 * Every prefix/affix with the same percentage gets added to the same percentage
 * pool.
 * A random number between 1 and 100 will be generated and the lowest
 * percentage pool that the random number is less than or equal to will be
 * chosen.
 *
 * For example, if the pools are 10%, 20% and 30% and the random number was 15,
 * you get a prefix/affix from the pool with percentage 20%.
 *
 * If you get over the highest percentage, you will get one of the
 * prefixes/affixes from the highest percentage pool. Having a combined
 * percentage (total of all chances for all prefix/affix choices for a base
 * item) of 100 is recommended but not required.
 *
 * If none of the prefix or affix items for the base item have a chance notetag,
 * then the item will be randomly chosen as normal with each prefix or affix
 * having an equal probability.
 *
 * If at least one but not all of the prefix/affix items for the base item has
 * a chance notetag, then the prefix/affixes that don't have a percent notetag
 * will be assigned the default chance specified in the parameter for this
 * plugin.
 * ============================================================================
 * Terms Of Use
 * ============================================================================
 * Free to use and modify for commercial and noncommercial games, with credit.
 * ============================================================================
 * Credits
 * ============================================================================
 * DreamX
 */

//=============================================================================
// Import
//=============================================================================
var Imported = Imported || {};
Imported.DreamX_RandomPrefixAffix = true;

var DreamX = DreamX || {};
DreamX.RandomPrefixAffix = DreamX.RandomPrefixAffix || {};

(function () {

    //==========================================================================
    // Parameter Variables
    //==========================================================================

    var parameters = PluginManager.parameters('DreamX_RandomPrefixesAffixes');

    var paramDefaultChance = parseInt(parameters['Default Chance'] || 10);

    DreamX.RandomPrefixAffix.Game_System_initialize
            = Game_System.prototype.initialize;
    Game_System.prototype.initialize = function () {
        DreamX.RandomPrefixAffix.Game_System_initialize.call(this);
        this.randomGenWeapons = [];
        this.randomGenArmors = [];
    };


    DreamX.RandomPrefixAffix.DataManager_extractSaveContents = DataManager.extractSaveContents;
    DataManager.extractSaveContents = function (contents) {
        DreamX.RandomPrefixAffix.DataManager_extractSaveContents.call(this, contents);
        for (var i = 0; i < $gameSystem.randomGenWeapons.length; i++) {
            $dataWeapons.push($gameSystem.randomGenWeapons[i]);
        }
        for (var i = 0; i < $gameSystem.randomGenArmors.length; i++) {
            $dataArmors.push($gameSystem.randomGenArmors[i]);
        }
        if (Imported.YEP_ItemCore) {
            if (Yanfly.Param.ItemMaxWeapons > 0) {
                var sortedWeaponPart = $dataWeapons.splice(Yanfly.Param.ItemStartingId + 1, $dataWeapons.length);
                sortedWeaponPart.sort(function (a, b) {
                    return a.id - b.id;
                });

                $dataWeapons = $dataWeapons.concat(sortedWeaponPart);
            }
            if (Yanfly.Param.ItemMaxArmors > 0) {
                var sortedArmorPart = $dataArmors.splice(Yanfly.Param.ItemStartingId + 1, $dataArmors.length);
                sortedArmorPart.sort(function (a, b) {
                    return a.id - b.id;
                });

                $dataArmors = $dataArmors.concat(sortedArmorPart);
            }
        }
    };


    DreamX.RandomPrefixAffix.makeChoices = function (arrayOfIDs, dataType) {
        var mapArray = [];
        var percentMap = new Map();
        var diceRoll;
        var choseIDPool = false;
        var poolIndex;

        // get rid of bad ids
        for (var i = 0; i < arrayOfIDs.length; i++) {
            if (!dataType[ arrayOfIDs[i] ]) {
                arrayOfIDs.splice(i, 1);
                i--;
            }
        }

        // first test if there are any percents among the ids
        var hasPercent = arrayOfIDs.some(function (id) {
            return dataType[id].meta.prefixAffixChance;
        });

        // if no percents, just return the array
        if (hasPercent === false) {
            return arrayOfIDs;
        }

        for (var i = 0; i < arrayOfIDs.length; i++) {
            var percent = dataType[ arrayOfIDs[i] ].meta.prefixAffixChance
                    ? dataType[ arrayOfIDs[i] ].meta.prefixAffixChance : paramDefaultChance;
            if (percentMap.has(percent)) {
                // push into array
                percentMap.get(percent).push(arrayOfIDs[i]);
            } else {
                // put in an array
                percentMap.set(percent, [arrayOfIDs[i]]);
            }
        }

        // get everything from the map
        percentMap.forEach(function (value, key, map) {
            // push an object with the percent and ids
            mapArray.push({percent: key, ids: value});
        });

        // sort the array from lowest percent to highest
        mapArray.sort(function (a, b) {
            return a.percent - b.percent;
        });

        //roll the dice
        diceRoll = Math.floor((Math.random() * 100) + 1);

        if (diceRoll <= mapArray[mapArray.length - 1].percent) {
            for (i = 0; i < mapArray.length && !choseIDPool; i++) {
                if (mapArray[i].percent >= diceRoll) {
                    poolIndex = i;
                    choseIDPool = true;
                }
            }
        } else {
            poolIndex = mapArray.length - 1;
        }

        return mapArray[poolIndex].ids;
    };

    DreamX.RandomPrefixAffix.makeItem = function (item, presetPrefixId, presetAffixId) {
        // the new item
        var newItem;

        // arrays of choices of prefix/affix items
        var prefixChoices = [];
        var affixChoices = [];

        // the prefix/affix item
        var prefixItem;
        var affixItem;

        // weapon or armor
        var dataType = item.wtypeId ? $dataWeapons : $dataArmors;

        if (presetPrefixId && dataType[presetPrefixId]) {
            prefixItem = dataType[presetPrefixId];
        }
        if (!prefixItem && item.meta.prefix) {
            prefixSplit = item.meta.prefix.trim().split(",");
            prefixChoices = this.makeChoices(prefixSplit, item.wtypeId
                    ? $dataWeapons : $dataArmors);

            if (prefixChoices.length >= 1) {
                var prefixID = prefixChoices[Math.floor(Math.random() * prefixChoices.length)];
                prefixItem = dataType[prefixID];
            }
        }
        if (presetAffixId && dataType[presetAffixId]) {
            affixItem = dataType[presetAffixId];
        }
        if (!affixItem && item.meta.affix) {
            affixSplit = item.meta.affix.trim().split(",");
            affixChoices = this.makeChoices(affixSplit, item.wtypeId
                    ? $dataWeapons : $dataArmors);

            if (affixChoices.length >= 1) {
                var affixID = affixChoices[Math.floor(Math.random() * affixChoices.length)];
                affixItem = dataType[affixID];
            }
        }

        // if incorrect notetag configuration, return undefined
        // (player doesn't get an item)
        if (!prefixItem && !affixItem) {
            return undefined;
        }

        // make a deep copy
        newItem = JSON.parse(JSON.stringify(item));
        newItem.note += "\n";

        if (prefixItem) {
            newItem.name = prefixItem.name + " " + newItem.name;
            newItem.traits = newItem.traits.concat(prefixItem.traits);
            for (var i = 0; i < prefixItem.params.length; i++) {
                newItem.params[i] += prefixItem.params[i];
            }
            newItem.price += prefixItem.price;
            newItem.description += prefixItem.description;
            newItem.note += prefixItem.note + "\n";
            for (notetag in prefixItem.meta) {
                newItem.meta[notetag] = prefixItem.meta[notetag];
            }
            if (prefixItem.meta.prefixAffixReplaceAnim) {
                newItem.animationId = prefixItem.animationId;
            }
            if (prefixItem.meta.prefixAffixReplaceIcon) {
                newItem.iconIndex = prefixItem.iconIndex;
            }
        }
        if (affixItem) {
            newItem.name = newItem.name + " " + affixItem.name;
            newItem.traits = newItem.traits.concat(affixItem.traits);
            for (var i = 0; i < affixItem.params.length; i++) {
                newItem.params[i] += affixItem.params[i];
            }
            newItem.price += affixItem.price;
            newItem.description += affixItem.description;
            newItem.note += affixItem.note + "\n";
            for (notetag in affixItem.meta) {
                newItem.meta[notetag] = affixItem.meta[notetag];
            }
            if (affixItem.meta.affixAffixReplaceAnim) {
                newItem.animationId = affixItem.animationId;
            }
            if (affixItem.meta.affixAffixReplaceIcon) {
                newItem.iconIndex = affixItem.iconIndex;
            }
        }

        // remove prefix and affix notetags from note
        newItem.note = newItem.note.replace(new RegExp("\<prefix:.+\>\\n?"), "")
                .replace(new RegExp("\<affix:.+\>\\n?"), "");

        // remove the affixes and prefixes from meta. we don't want repeats
        delete newItem.meta.prefix;
        delete newItem.meta.affix;

        newItem.id = item.wtypeId ? $dataWeapons.length : $dataArmors.length;
        if (item.wtypeId) {
            $dataWeapons.push(newItem);
            $gameSystem.randomGenWeapons.push(newItem);
        } else {
            $dataArmors.push(newItem);
            $gameSystem.randomGenArmors.push(newItem);
        }

        var processArray = ["", dataType[newItem.id]];

        if (Imported.YEP_AbsorptionBarrier) {
            DataManager.processABRNotetags2(processArray);
        }
        if (Imported.YEP_AutoPassiveStates) {
            DataManager.processAPSNotetags1(processArray);
        }
        if (Imported.YEP_BattleEngineCore) {
            DataManager.processBECNotetags4(processArray);
            DataManager.processBECNotetags5(processArray);
        }
        if (Imported.YEP_BuffsStatesCore) {
            DataManager.processBSCNotetags2(processArray);
        }
        if (Imported.YEP_CoreEngine) {
            DataManager.processCORENotetags1(processArray);
        }
        if (Imported.YEP_DamageCore) {
            DataManager.processDMGNotetags2(processArray);
        }
        if (Imported.YEP_DashToggle) {
            DataManager.processDashNotetags1(processArray);
        }
        if (Imported.YEP_ElementAbsorb) {
            DataManager.processEleAbsNotetags1(processArray);
        }
        if (Imported.YEP_ElementReflect) {
            DataManager.processEleRefNotetags1(processArray);
        }
        if (Imported.YEP_EquipCore) {
            DataManager.processEquipNotetags2(processArray);
        }
        if (Imported.YEP_ExtraEnemyDrops) {
            if (item.wtypeId) {
                DataManager.processEEDNotetagsW(processArray);
            } else {
                DataManager.processEEDNotetagsA(processArray);
            }
        }
        if (Imported.YEP_ExtraParamFormula) {
            DataManager.processXParamNotetags(processArray);
        }
        if (Imported.YEP_InstantCast) {
            DataManager.processInstantNotetags2(processArray);
        }
        if (Imported.YEP_ItemCore) {
            DataManager.processItemCoreNotetags(processArray);
        }
        if (Imported.YEP_ItemSynthesis) {
            if (item.wtypeId) {
                DataManager.processISNotetagsW(processArray);
            } else {
                DataManager.processISNotetagsA(processArray);
            }
        }
        if (Imported.YEP_JobPoints) {
            DataManager.processJPNotetags4(processArray);
        }
        if (Imported.YEP_LifeSteal) {
            DataManager.processLSNotetags1(processArray);
        }
        if (Imported.YEP_RowFormation) {
            DataManager.processRowNotetags3(processArray);
        }
        if (Imported.YEP_ShopMenuCore) {
            DataManager.processShopNotetags(processArray);
        }
        if (Imported.YEP_SkillCore) {
            DataManager.processGSCNotetags2(processArray);
        }
        if (Imported.YEP_SkillLearnSystem) {
            if (item.wtypeId) {
                DataManager.processSLSNotetagsW(processArray);
            } else {
                DataManager.processSLSNotetagsA(processArray);
            }
        }
        if (Imported.YEP_SpecialParamFormula) {
            DataManager.processSParamNotetags(processArray);
        }
        if (Imported.YEP_StealSnatch) {
            DataManager.processStealNotetags3(processArray);
            DataManager.processStealNotetags4(processArray);
            if (item.wtypeId) {
                DataManager.processStealNotetagsW(processArray);
            } else {
                DataManager.processStealNotetagsA(processArray);
            }
        }
        if (Imported.YEP_Taunt) {
            DataManager.processTauntNotetags1(processArray);
        }
        if (Imported.YEP_WeaponAnimation) {
            DataManager.processWANotetags1(processArray);
        }
        if (Imported.YEP_WeaponUnleash) {
            DataManager.processWULNotetags1(processArray);
        }
        if (Imported.YEP_X_ArmorScaling) {
            DataManager.processARSNotetags2(processArray);
        }
        if (Imported.YEP_X_BattleSysATB) {
            DataManager.processATBNotetags2(processArray);
        }
        if (Imported.YEP_X_BattleSysCTB) {
            DataManager.processCTBNotetags2(processArray);
        }
        if (Imported.YEP_X_ChangeBattleEquip) {
            DataManager.processCBENotetags(processArray);
        }
        if (Imported.YEP_X_CounterControl) {
            DataManager.processCounterNotetags2(processArray);
            if (item.wtypeId) {
                DataManager.processCounterNotetagsW(processArray);
            } else {
                DataManager.processCounterNotetagsA(processArray);
            }
        }
        if (Imported.YEP_X_CriticalControl) {
            DataManager.processCritNotetags2(processArray);
        }
        if (Imported.YEP_X_EquipRequirements) {
            DataManager.processEqReqNotetags1(processArray);
        }
        if (Imported.YEP_X_ItemDurability) {
            DataManager.processIDurNotetags1(processArray);
            DataManager.processIDurNotetags2(processArray);
        }
        if (Imported.YEP_X_ItemUpgrades) {
            DataManager.processUpgradeNotetags1(processArray);
        }
        if (Imported.YEP_X_LimitedSkillUses) {
            DataManager.processLSUNotetags3(processArray);
        }
        if (Imported.YEP_X_MoreCurrencies) {
            if (item.wtypeId) {
                DataManager.processMCNotetags1(processArray, 1);
            } else {
                DataManager.processMCNotetags1(processArray, 2);
            }
        }
        if (Imported.YEP_X_PartyLimitGauge) {
            DataManager.processPLGNotetags2(processArray);
        }
        if (Imported.YEP_X_SkillCostItems) {
            DataManager.processSCINotetags2(processArray);
            DataManager.processSCINotetags3(processArray);
        }
        if (Imported.YEP_X_SkillCooldowns) {
            DataManager.processSCDNotetags2(processArray);
            DataManager.processSCDNotetags3(processArray);
        }

        return newItem;
    };

    DreamX.RandomPrefixAffix.GainPrefixAffixItem = function (item, amount, includeEquip) {
        for (var i = 0; i < amount; i++) {
            $gameParty.gainItem(DreamX.RandomPrefixAffix.makeItem(JSON.parse(JSON.stringify(item))), 1, includeEquip);
        }
    }

    DreamX.RandomPrefixAffix.Game_Party_gainItem = Game_Party.prototype.gainItem;
    Game_Party.prototype.gainItem = function (item, amount, includeEquip) {
        // must have one of the meta tags and be a weapon/armor
        if (DreamX.RandomPrefixAffix.isConfiguredForPrefixAffix(item)) {
            DreamX.RandomPrefixAffix.GainPrefixAffixItem(item, amount, includeEquip);
        } else {
            DreamX.RandomPrefixAffix.Game_Party_gainItem.call(this, item, amount, includeEquip);
        }
    };

    DreamX.RandomPrefixAffix.isConfiguredForPrefixAffix = function (item) {
        if (item && (item.meta.prefix || item.meta.affix) && (item.wtypeId || item.atypeId)) {
            return true;
        }
        return false;
    };

    BattleManager.convertPrefixAffix = function () {
        for (var i = 0; i < this._rewards.items.length; i++) {
            var item = this._rewards.items[i];
            if (item && (item.meta.prefix || item.meta.affix) && (item.wtypeId || item.atypeId)) {
                this._rewards.items[i] = DreamX.RandomPrefixAffix.makeItem(JSON.parse(JSON.stringify(item)));
            }
        }
    };

    // since the new item names don't show up by default, must alias this and
    // make the new items before hand
    if (Imported.YEP_VictoryAftermath) {
        DreamX.RandomPrefixAffix.BattleManager_gainDropItems = BattleManager.gainDropItems;
        BattleManager.gainDropItems = function () {
            this.convertPrefixAffix();
            DreamX.RandomPrefixAffix.BattleManager_gainDropItems.call(this);
        };
    } else {
        DreamX.RandomPrefixAffix.BattleManager_displayDropItems = BattleManager.displayDropItems;
        BattleManager.displayDropItems = function () {
            this.convertPrefixAffix();
            DreamX.RandomPrefixAffix.BattleManager_displayDropItems.call(this);
        };
    }



    if (Imported.YEP_ItemCore) {
        DreamX.RandomPrefixAffix.DataManager_isIndependent = DataManager.isIndependent;
        DataManager.isIndependent = function (item) {
            if (DreamX.RandomPrefixAffix.isConfiguredForPrefixAffix(item)) {
                return false;
            }
            return DreamX.RandomPrefixAffix.DataManager_isIndependent.call(this, item);
        };
    }

})();

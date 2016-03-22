/*:
 * @plugindesc v1.4 Capture enemies 
 * 
 * <DreamX Capture Enemies>
 * @author DreamX
 *
 * @param Capture Success Message
 * @desc Message to display to when player captures an enemy Default: %1 was captured!
 * @default %1 was captured!
 *
 * @param Capture Fail Message
 * @desc Message to display to when player fails to capture an enemy Default: %1 was not captured!
 * @default %1 was not captured!
 *
 * @param Cannot Capture Message
 * @desc Message after capture attempt in battle where capture disallowed. Default: %2 blocked the capture!
 * @default %2 blocked the capture!
 *
 * @param Health Capture Rate Formula
 * @desc The formula that adds to the capture rate based on enemy health. Default: 50 - ((enemy.hp/enemy.mhp) * 50)
 * @default 50 - ((enemy.hp/enemy.mhp) * 50) 
 *
 * @param Capture Success Anim
 * @desc Animation to play on capture success. 0 - disable. Default: 0
 * @default 0
 *
 * @param Capture Fail Anim
 * @desc Animation to play on capture failure. 0 - disable. Default: 0
 * @default 0
 *
 * @param Message As Show Text
 * @desc true: display messages as show text command. false: display messages in the battlelog.
 * @default true
 * 
 * @param EXP From Capture
 * @desc Whether to give exp from enemies that were captured. Default: false
 * @default false
 * 
 * @param Level Up Instead of Duplicates
 * @desc Whether to level up a captured enemy instead of creating a duplicate 
 * when capturing the same type. Default: false
 * @default false
 * 
 * @param Level Up Message
 * @desc The message to display if an actor leveled up instead of being 
 * duplicated on capture. Default: %3 leveled up!
 * @default %3 leveled up!
 *
 * @help 
 * ============================================================================
 * How To Use
 * ============================================================================
 Must be used with Yanfly's Battle Engine Core to work properly.
 
 Put <capture_actor_id:x> into the notetag of an enemy, with x as the actor id.
 
 Put <capture:1> or <captureRate:x> into the notetag of a skill or item to 
 enable capture. <capture:1> guarantees capture while <captureRate:x> adds 
 x to the chance of capture.
 
 Put <captureRate:x> in the notetag of an actor to add x to the chance of 
 capture. Make sure this is the same actor id as you put in the enemy
 notetag.
 
 Put <captureRate:x> in the notetag of a state to add x to the chance of 
 capture when the enemy has that state.
 
 When you use the item or skill succesfully, the actor in that notetag will be 
 added. You can have duplicates. You can manually add actors to your party by 
 using the AddActor x y plugin command with x being the actor id and y being 
 the level. You can still have duplicates.
 
 Make a comment in the first page of a troop with <noCapture> to disable 
 capture for that battle. Make sure the comment only consists of that.
 
 Here are the text codes for the message parameters:
 %1 - The name of the enemy in the capture attempt
 %2 - The name of the troop in the database
 %3 - The name of the actor corresponding to the enemy
 * ============================================================================
 * Terms Of Use
 * ============================================================================
 * Free to use and modify for commercial and noncommercial games, with credit.
 * ============================================================================
 * Credits & Thanks
 * ============================================================================
 * DreamX
 * Thanks to Jeremy Cannady for reference from his Monster Breeding System script.
 */

var Imported = Imported || {};
Imported.DreamX_CaptureEnemy = true;

var DreamX = DreamX || {};
DreamX.CaptureEnemy = DreamX.CaptureEnemy || {};

(function () {

//=============================================================================
// Parameters
//=============================================================================
    var parameters = $plugins.filter(function (p) {
        return p.description.contains
                ('<DreamX Capture Enemies>');
    })[0].parameters; //Thanks to Iavra

    var parameterCaptureSuccessMsg = String(parameters['Capture Success Message']
            || '%1 was captured!');
    var parameterCaptureFailedMsg = String(parameters['Capture Fail Message']
            || '%1 was not captured!');
    var parameterCannotCaptureMsg = String(parameters['Cannot Capture Message']
            || '%2 blocked the capture!');
    var paramLvlUpMsg = String(parameters['Level Up Message']
            || '%3 leveled up!');
    var parameterHealthFormula = String(parameters['Health Capture Rate Formula']
            || '50 - ((enemy.hp/enemy.mhp) * 50)');
    var parameterCaptureAnim = parseInt(parameters['Capture Success Anim']
            || 0);
    var parameterCaptureFailAnim = parseInt(parameters['Capture Fail Anim']
            || 0);
    var parameterShowText = eval(parameters['Message As Show Text']
            || true);
    var paramEXPFromCapture = eval(parameters['EXP From Capture']
            || false);
    var paramLevelUpNoDuplicate = eval(parameters['Level Up Instead of Duplicates']
            || false);

    DreamX.CaptureEnemy.Game_Interpreter_pluginCommand =
            Game_Interpreter.prototype.pluginCommand;
    Game_Interpreter.prototype.pluginCommand = function (command, args) {
        DreamX.CaptureEnemy.Game_Interpreter_pluginCommand.call(this, command, args);
        switch (command) {
            case 'AddActor':
                if (args[0]) {
                    var level = args[1] ? args[1] : 1;
                    DreamX.CaptureEnemy.captureEnemy(args[0], level);
                }
                break;
        }
    };

    DreamX.CaptureEnemy.DataManager_extractSaveContents = DataManager.extractSaveContents;
    DataManager.extractSaveContents = function (contents) {
        DreamX.CaptureEnemy.DataManager_extractSaveContents.call(this, contents);
        for (var i = 0; i < $gameSystem.capturedActors.length; i++) {
            $dataActors.push($gameSystem.capturedActors[i]);
        }
    };

    DreamX.CaptureEnemy.Game_Actor_setup = Game_Actor.prototype.setup;
    Game_Actor.prototype.setup = function (actorId) {
        DreamX.CaptureEnemy.Game_Actor_setup.call(this, actorId);
        var actor = $dataActors[actorId];
        this._baseActorId = actor.baseActorId ? actor.baseActorId : actorId;
    };

    Game_Actor.prototype.baseActorId = function () {
        return this._baseActorId;
    };

    DreamX.CaptureEnemy.Game_Enemy_exp = Game_Enemy.prototype.exp;
    Game_Enemy.prototype.exp = function () {
        if ((paramEXPFromCapture === false)
                && (this._wasCaptured === true
                        || this._wasLevelUpCaptured === true)) {
            return 0;
        }
        return DreamX.CaptureEnemy.Game_Enemy_exp.call(this);
    };

    DreamX.CaptureEnemy.Game_System_initialize = Game_System.prototype.initialize;
    Game_System.prototype.initialize = function () {
        DreamX.CaptureEnemy.Game_System_initialize.call(this);
        this.capturedActors = [];
    };

    Game_Troop.prototype.isCaptureEnabled = function () {
        var list = this.troop().pages[0].list;
        var enabled = true;
        list.forEach(function (cmd) {
            if (cmd.code === 108 && cmd.parameters[0] === "<noCapture>") {
                enabled = false;
            }
        });
        return enabled;
    };

    DreamX.CaptureEnemy.CalculateResult = function (item, target) {
        // if capture is disabled for this battle
        if ($gameTroop.isCaptureEnabled() === false) {
            return "BattleCaptureDisabled";
        }

        // if the capture missed
        if (DreamX.CaptureEnemy.decideCapture(item, target) === false) {
            return "CaptureMissed";
        }

        return "CaptureSuccess";
    };

    DreamX.CaptureEnemy.ItemTargetConfiguredProperly = function (item, dataEnemyMeta) {
        if ((!item.meta.captureRate && !item.meta.capture)
                || !dataEnemyMeta.capture_actor_id) {
            return false;
        }

        return true;
    };

    DreamX.CaptureEnemy.actorAlreadyExists = function (actorId) {
        var exists = $gameParty.allMembers().some(function (actor) {
            return (actor.actorId() === actorId) || actor.baseActorId() === actorId;
        });
        return exists;
    };

    DreamX.CaptureEnemy.shouldLevelUpAnActor = function (actorId) {
        if (paramLevelUpNoDuplicate !== true) {
            return false;
        }
        return this.actorAlreadyExists(actorId);
    };

    DreamX.CaptureEnemy.levelUpDuplicateActors = function (actorId) {
        for (var i = 0; i < $gameParty.allMembers().length; i++) {
            var actor = $gameParty.allMembers()[i];
            if (actor.actorId() === actorId || actor.baseActorId() === actorId) {
                actor.levelUp();
                return;
            }
        }
    };

    DreamX.CaptureEnemy.Game_Action_applyItemUserEffect = Game_Action.prototype.applyItemUserEffect;
    Game_Action.prototype.applyItemUserEffect = function (target) {
        DreamX.CaptureEnemy.Game_Action_applyItemUserEffect.call(this, target);
        if (!target.isEnemy())
            return;
        var item = this.item();
        var dataEnemyMeta = $dataEnemies[target.enemyId()].meta;

        // if the item or target isn't configured correctly, return
        if (DreamX.CaptureEnemy.ItemTargetConfiguredProperly(item, dataEnemyMeta) === false) {
            return;
        }

        this.makeSuccess(target);

        var newActorId = dataEnemyMeta.capture_actor_id;
        var targetName = target.originalName();
        var troopName = $gameTroop.troop().name;
        var actorName = $dataActors[dataEnemyMeta.capture_actor_id].name;

        switch (DreamX.CaptureEnemy.CalculateResult(item, target)) {
            case "BattleCaptureDisabled":
                DreamX.CaptureEnemy.displayMessage(parameterCannotCaptureMsg.format(targetName, troopName, actorName));
                break;
            case "CaptureMissed":
                if (parameterCaptureFailAnim >= 1) {
                    target.startAnimation(parameterCaptureFailAnim, false, 0);
                }
                DreamX.CaptureEnemy.displayMessage(parameterCaptureFailedMsg.format(targetName, troopName, actorName));
                break;
            case "CaptureSuccess":
                DreamX.CaptureEnemy.levelUpDuplicateActors(newActorId);
                if (DreamX.CaptureEnemy.shouldLevelUpAnActor(newActorId)) {
                    DreamX.CaptureEnemy.levelUpDuplicateActors(newActorId);
                    DreamX.CaptureEnemy.displayMessage(paramLvlUpMsg.format(targetName, troopName, actorName));
                    target._wasLevelUpCaptured;
                } else {
                    var level = 1;
                    if (target.level && target.level >= 1) {
                        level = target.level;
                    }
                    DreamX.CaptureEnemy.captureEnemy(newActorId, level);
                    target._wasCaptured = true;
                }

                if (parameterCaptureAnim >= 1) {
                    target.startAnimation(parameterCaptureAnim, false, 0);
                }

                target.die();
                break;
        }
    };

    DreamX.CaptureEnemy.performCollapse = Game_Enemy.prototype.performCollapse;
    Game_Enemy.prototype.performCollapse = function () {
        DreamX.CaptureEnemy.performCollapse.call(this);
        var enemyName = this.originalName();
        var troopName = $gameTroop.troop().name;
        var actorId = this.enemy().meta.capture_actor_id;
        var actorName = $dataActors[actorId].name;

        if (this._wasCaptured) {
            DreamX.CaptureEnemy.displayMessage(parameterCaptureSuccessMsg.format(enemyName, troopName, actorName));
        }
    };

    DreamX.CaptureEnemy.displayMessage = function (message) {
        if (parameterShowText === true) {
            $gameMessage.add(message);
        } else {
            SceneManager._scene._logWindow.push('addText', message);
        }
    }

    DreamX.CaptureEnemy.stateCaptureRate = function (target) {
        var rate = 0;
        target.states().forEach(function (state) {
            rate += parseInt(state.meta.captureRate) || 0;
        });
        return rate;
    };

    DreamX.CaptureEnemy.healthCaptureRate = function (enemy) {
        return eval(parameterHealthFormula);
    };

    DreamX.CaptureEnemy.decideCapture = function (item, target) {
        if (item.meta.capture)
            return true;
        var dataTarget = $dataEnemies[target._enemyId];
        var dataTargetActor = $dataActors[dataTarget.meta.capture_actor_id];
        var rateCaptureItem = parseInt(item.meta.captureRate) || 0;
        var rateCaptureTarget = parseInt(dataTargetActor.meta.captureRate) || 0;
        var likelihood = rateCaptureItem + rateCaptureTarget +
                DreamX.CaptureEnemy.stateCaptureRate(target)
                + DreamX.CaptureEnemy.healthCaptureRate(target);

        if (likelihood <= 0)
            return false;
        var diceRoll = Math.floor((Math.random() * 100) + 1);

        if (diceRoll <= likelihood)
            return true;

        return false;
    };

    DreamX.CaptureEnemy.captureEnemy = function (actorId, level) {
        // default to level 1 if level not defined
        level = level || 1;
        var dataActor = $dataActors[actorId];
        // make a deep copy
        var CapturedEnemy = JSON.parse(JSON.stringify(dataActor));

        // give a new id
        CapturedEnemy.id = $dataActors.length;
        CapturedEnemy.baseActorId = actorId;

        // give a new starting level
        CapturedEnemy.initialLevel = level;

        $dataActors.push(CapturedEnemy);
        $gameParty.addActor(CapturedEnemy.id);
        $gameSystem.capturedActors.push(CapturedEnemy);
    };

    //=============================================================================
// Compatibility
//=============================================================================

})();

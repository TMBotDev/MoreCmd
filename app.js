"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.logger = void 0;
const BotDockingMgr_1 = require("../../modules/BotDockingMgr");
const logger_1 = require("../../tools/logger");
const guild_1 = require("./qq/guild");
const qun_1 = require("./qq/qun");
exports.logger = new logger_1.Logger("Test");
function onLoad() {
    let allBot = BotDockingMgr_1.BotDockingMgr.getBotMapIters();
    let iter = allBot.next();
    while (!iter.done) {
        let d = iter.value[1];
        let id = d.events.onInitSuccess.on(() => {
            //必须在初始化完成后才能获取登录号信息
            exports.logger.warn(`名称： ${d.Name}, 登录号： ${d.LoginInfo.user_id}`);
            (0, qun_1.Run)(d);
            (0, guild_1.GuildInit)(d);
            // d.sendGroupSign
            d.Client.send(`{"action": "send_group_sign", "data":{"group_id":-1}, "echo":-1}`);
            let id1 = d.events.onRawMessage.on((raw, ori) => {
                let r = JSON.parse(raw);
                if (r.echo == -1) {
                    exports.logger.info("RES: ", raw);
                    d.events.onRawMessage.un(id1); //只用一次的监听器,删除
                    ori(false, ""); //不执行
                }
            });
            d.events.onInitSuccess.un(id); //只用一次的监听器,删除
        });
        iter = allBot.next();
    }
}
onLoad();

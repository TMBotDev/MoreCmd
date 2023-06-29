"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.GuildInit = void 0;
const app_1 = require("../app");
function GuildInit(bot) {
    let gs = bot.guildSystem;
    if (!gs) {
        return app_1.logger.warn(bot.Name + "频道未开启！");
    }
    app_1.logger.info(bot.Name + " 共有" + gs.Guilds.size + "个频道");
}
exports.GuildInit = GuildInit;

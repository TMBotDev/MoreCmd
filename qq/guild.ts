import { OneBotDocking } from "../../../modules/OneBotDocking";
import { logger } from "../app";



export function GuildInit(bot: OneBotDocking) {
    let gs = bot.guildSystem;
    if (!gs) { return logger.warn(bot.Name + "频道未开启！"); }
    logger.info(bot.Name + " 共有" + gs.Guilds.size + "个频道");
}
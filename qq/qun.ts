import { OneBotDocking } from "../../../modules/OneBotDocking";
import { logger } from "../app";

function sleep(t: number) {
    return new Promise<void>(r => setTimeout(r, t));
}

export async function Run(bot: OneBotDocking) {
    await sleep(3000);
    let iter = bot.Groups.entries(), now = iter.next();
    while (!now.done) {
        let v = now.value[1];
        logger.info(bot.Name + " 群号: " + v.group_id, "拥有者: ", v.Owner?.user_id);
        now = iter.next();
    }
}
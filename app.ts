import { BotDockingMgr } from "../../modules/BotDockingMgr";
import { Logger } from "../../tools/logger";
import { GuildInit } from "./qq/guild";
import { Run } from "./qq/qun";


export let logger = new Logger("Test");

function onLoad() {
    let allBot = BotDockingMgr.getBotMapIters();
    let iter = allBot.next();
    while (!iter.done) {
        let d = iter.value[1];
        let id = d.events.onInitSuccess.on(() => {
            //必须在初始化完成后才能获取登录号信息
            logger.warn(`名称： ${d.Name}, 登录号： ${d.LoginInfo.user_id}`);
            Run(d);
            GuildInit(d);
            // d.sendGroupSign
            d.Client.send(`{"action": "send_group_sign", "data":{"group_id":-1}, "echo":-1}`);
            let id1 = d.events.onRawMessage.on((raw, ori) => {
                let r = JSON.parse(raw);
                if (r.echo == -1) {
                    logger.info("RES: ", raw);
                    d.events.onRawMessage.un(id1);//只用一次的监听器,删除
                    ori(false, "");//不执行
                }
            });
            d.events.onInitSuccess.un(id);//只用一次的监听器,删除
        });

        iter = allBot.next();
    }
}

onLoad();
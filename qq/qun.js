"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.Run = void 0;
const app_1 = require("../app");
function sleep(t) {
    return new Promise(r => setTimeout(r, t));
}
async function Run(bot) {
    await sleep(3000);
    let iter = bot.Groups.entries(), now = iter.next();
    while (!now.done) {
        let v = now.value[1];
        app_1.logger.info(bot.Name + " 群号: " + v.group_id, "拥有者: ", v.Owner?.user_id);
        now = iter.next();
    }
}
exports.Run = Run;

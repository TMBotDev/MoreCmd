"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.MoreCmdConf = exports.newCmd = exports.log = void 0;
const Global_1 = require("../../modules/RunTime/Global");
const TMBotCommand_1 = require("../../modules/TMBotCommand");
const data_1 = require("../../tools/data");
const file_1 = require("../../tools/file");
const logger_1 = require("../../tools/logger");
exports.log = new logger_1.Logger("MoreCmd");
function newCmd(cmd, des) {
    return TMBotCommand_1.ConsoleCmd.CmdSystem.newCommand(cmd, des, TMBotCommand_1.ConsoleCmd.CmdPerm);
}
exports.newCmd = newCmd;
exports.MoreCmdConf = new data_1.JsonConfigFileClass("./plugins/Data/MoreCmd/config.json", "{}");
function main() {
    let TMBotVer = Global_1.GlobalVar.Version.version;
    if (+TMBotVer.join() < 110) {
        exports.log.error(`加载此插件需要TMBot版本高于或等于[v1.1.0]!`);
        return;
    }
    let dir = (__dirname + "/commands").replace(/\\/g, "/");
    let files = file_1.FileClass.getFilesList(dir);
    files.forEach((file) => {
        if (file.split(".").pop() == "js") {
            require(`./commands/${file}`);
        }
    });
}
main();
//# sourceMappingURL=app.js.map
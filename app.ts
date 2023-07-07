import { TMBotCmd } from "../../modules/CmdSystem/CommandSystem";
import { GlobalVar } from "../../modules/RunTime/Global";
import { ConsoleCmd } from "../../modules/TMBotCommand";
import { JsonConfigFileClass } from "../../tools/data";
import { FileClass } from "../../tools/file";
import { Logger } from "../../tools/logger";

export let log = new Logger("MoreCmd");

export function newCmd(cmd: string, des: string) {
    return ConsoleCmd.CmdSystem.newCommand(cmd, des, ConsoleCmd.CmdPerm);
}

export let MoreCmdConf = new JsonConfigFileClass("./plugins/Data/MoreCmd/config.json", "{}");

function main() {
    let TMBotVer = GlobalVar.Version.version;
    if (+TMBotVer.join() < 110) {
        log.error(`加载此插件需要TMBot版本高于或等于[v1.1.0]!`);
        return;
    }
    let dir = (__dirname + "/commands").replace(/\\/g, "/");
    let files = FileClass.getFilesList(dir);
    files.forEach((file) => {
        if (file.split(".").pop() == "js") {
            try {
                require(`./commands/${file}`);
            } catch (e) {
                log.error(`加载 "${file}" 失败: ${(e || "<Null>").toString()}`);
            }
        }
    });
}

main();
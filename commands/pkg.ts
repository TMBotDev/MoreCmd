import { createWriteStream, fdatasync, statSync } from "fs";
import { TMBotCmd } from "../../../modules/CmdSystem/CommandSystem";
import { FileClass } from "../../../tools/file";
import { MoreCmdConf, log, newCmd } from "../app";
import { GlobalEvent } from "../../../modules/RunTime/Global";

import * as https from "https";
import path from "path";
import { ConsoleBar } from "../tools/consoleBar";
import * as http from "http";
import * as compressing from "compressing";

const format = (data: number) => {
    if (data > 1024 * 1024) {
        return (data / 1024 / 1024).toFixed(2) + "MB"
    }
    return (data / 1024).toFixed(2) + "KB";
};
const timeFormat = (data: number) => {
    if (data > 1000) {
        let sec = data / 1000;
        if (sec > 60) {
            let min = sec / 60;
            if (min > 60) {
                let h = min / 60;
                return h.toFixed(2) + "hour";
            }
            return min.toFixed(2) + "min";
        }
        return sec.toFixed(2) + "s";
    }
    return data + "ms";
}

let isWorking = false;
let TmpDir = "./plugins/Data/MoreCmd/Tmp";

MoreCmdConf.init("PkgRegistry", {
    "TMBot": {
        "gitee": "https://gitee.com/timidine/tmbot-plugin-registry/",
        "branch": "master"
    }
});

let PkgRegistry: { "gitee": string, "branch": string, "name": string } = MoreCmdConf.get("PkgRegistry")["TMBot"];

function CheckSources(pr: typeof PkgRegistry) {
    if (typeof (pr) != "object" || Array.isArray(PkgRegistry)) {
        throw new Error(`配置项${JSON.stringify(pr)}错误!`);
    } else if (typeof (pr.gitee) != "string") {
        throw new Error(`配置项"gitee"配置错误!`);
    } else if (typeof (pr.branch) != "string") {
        throw new Error(`配置项"branch"配置错误!`);
    } else if (typeof (pr.name) != "string") {
        throw new Error(`配置项"name"配置错误!`);
    }
    if (pr["gitee"].indexOf("https://gitee.com") != 0) {
        log.warn(`Pkg插件表地址暂时只支持gitee,您填写的地址(${pr.gitee})可能无法使用`);
    }
}

CheckSources(PkgRegistry);

let cmd = newCmd("pkg", "安装插件(支持网络安装和本地安装)[本地安装请输入压缩包路径]");
let InstallParam: [
    TMBotCmd.CommandParams.Enum,
    TMBotCmd.CommandParams.String
] = [
        new TMBotCmd.CommandParams.Enum("install", ["install", "i"]),
        new TMBotCmd.CommandParams.String("zip")
    ];

function onInstallExecute(cmd: TMBotCmd.TMBotCommand<any, any, any>, _runner: TMBotCmd.TMBotCommandRunner<any>, out: TMBotCmd.TMBotCommandOutput, params: typeof InstallParam) {
    (async () => {
        let file = params[0].value!;
        if (["https://", "http://"].find((v) => {
            return file.indexOf(v) == 0;
        }) != undefined) {//web
            await DownloadZip(new URL(file), (typeof (LL) != "undefined"));
        } else {
            let stand = FileClass.getStandardPath(file);
            if (!stand) { return out.error(`获取插件标准目录失败!`); }
            let dir = statSync(stand, { "throwIfNoEntry": false });
            if (!dir || dir.isDirectory()) {
                return out.error(`所输入的目录不为压缩包!`);
            }

        }
    })().then(() => cmd.RunningCompleted());
}

cmd.overload(InstallParam)(onInstallExecute);

let SearchParam: [
    TMBotCmd.CommandParams.Enum,
    TMBotCmd.CommandParams.String
] = [
        new TMBotCmd.CommandParams.Enum("search", ["search", "s"]),
        new TMBotCmd.CommandParams.String("name")
    ];

async function onSearchExecute(cmd: TMBotCmd.TMBotCommand<any, any, any>, _runner: TMBotCmd.TMBotCommandRunner<any>, out: TMBotCmd.TMBotCommandOutput, params: typeof SearchParam) {



    cmd.RunningCompleted();
}

cmd.overload(SearchParam)(onSearchExecute);


//#region cs
let sources: string[] = [];
//就一屎山,能跑就行
let list: typeof PkgRegistry[] = MoreCmdConf.get("PkgRegistry");
let RegistrySet: Set<typeof PkgRegistry> = new Set();

function getSetValue<T>(set: Set<T>, fn: (v: T) => boolean) {
    let iters = set.values();
    let iter = iters.next();
    while (!iter.done) {
        if (fn(iter.value)) {
            return iter.value;
        }
        iter = iters.next();
    }
    return undefined;
}

list.forEach((v) => {
    try {
        CheckSources(v);
    } catch (e) {
        log.warn(`源: ${JSON.stringify(v)} 异常: ${(e || "<Null>").toString()}`);
        return;
    }
    sources.push(v.name);
    RegistrySet.add(v);
});

let ChangeSourcesParam: [
    TMBotCmd.CommandParams.Enum,
    TMBotCmd.CommandParams.Enum
] = [
        new TMBotCmd.CommandParams.Enum("selSources", ["changesource", "cs"]),
        new TMBotCmd.CommandParams.Enum("Sources", sources)
    ];


function onChangeSourcesExecute(cmd: TMBotCmd.TMBotCommand<any, any, any>, _runner: TMBotCmd.TMBotCommandRunner<any>, out: TMBotCmd.TMBotCommandOutput, params: typeof ChangeSourcesParam) {
    let sources = getSetValue(RegistrySet, (v) => v.name == params[1].value);
    if (!sources) {
        out.error(`查找源"${params[1].value}"失败!`);
        return cmd.RunningCompleted();
    }
    PkgRegistry = sources;
    out.success(`更换TMBot_pkg源为${sources.name}成功!`);
    cmd.RunningCompleted();
}


cmd.overload(ChangeSourcesParam)(onChangeSourcesExecute);

//#endregion





cmd.setup();








function AutoRequest(url: URL, timeout?: number) {
    return new Promise<http.IncomingMessage | undefined>((ret) => {
        let args: any[] = [];
        args.push(url);
        if (!!timeout) {
            args.push({ "timeout": timeout });
        }
        args.push(ret);
        if (url.protocol == "https:") {
            (https as any).get(...args).on("timeout", () => {
                ret(undefined);
            });
        } else {
            (http as any).get(...args).on("timeout", () => {
                ret(undefined);
            });
        }
    });
}



//屎山
function DownloadZip(web: URL, bar: boolean) {
    // console.log(web.toString())
    let count = 0;
    let sid: NodeJS.Timer | number;
    let self = (async (res: (b: boolean) => void) => {
        if (sid == null) {
            sid = setTimeout(() => {
                log.error(`[PKG] 下载超时!`);
                res(false);
            }, 15 * 1000);
        }
        if (!FileClass.exists(TmpDir)) {
            FileClass.mkdir(TmpDir);
        }
        let path_ = path.join(TmpDir, "tmpZip.zip");
        if (FileClass.exists(path_)) {
            FileClass.writeTo(path_, "");
        }
        let stream = createWriteStream(path_);
        let cb: ConsoleBar;
        if (bar) {
            try {
                cb = new ConsoleBar();
            } catch (e) {
                log.warn(`[PKG] 创建进度条失败: ${(e instanceof Error) ? e.message : e}`);
            }
        }
        let fn = async (r: http.IncomingMessage) => {
            sid != null && clearInterval(sid);
            // console.log(r.headers)
            let size = +(r.headers["content-length"] || 0);
            if (size == 0) {
                if (!!cb) { cb.close(); }
                if (count == 5) {
                    log.error(`[PKG] 下载文件失败: 无法获取文件信息`);
                    res(false);
                } else {
                    count++;
                    res(await new Promise<boolean>(self));
                }
                return;
            }
            let sizeStr = format(size);
            if (!!cb) {
                cb.setDescription(`[PKG] 准备下载文件,大小: ${sizeStr}`);
                cb.tick(cb.OperationType.Auto);
                // setTimeout(() => { cb.cancelQuestion() }, 2000);
                try {
                    let promise = cb.question("请问是否继续?(y/n)");
                    if (!promise) { throw ""; }
                    let str = await promise;
                    if (str.toLowerCase() != "y") {
                        log.warn(`[PKG] 取消操作...`);
                        throw ``;
                    }
                } catch (_) {
                    cb.close();
                    res(false);
                    return;
                }
            }
            let now = 0;
            let startTime = Date.now() / 1000;
            r.on("end", () => {
                let endTime = Date.now() / 1000;
                if (!!cb) {
                    cb.close();
                }
                let time = ((endTime * 1000) - (startTime * 1000));
                log.info(`[PKG] 下载完成!平均速度: ${format(size / (endTime - startTime))}/s,文件大小: ${sizeStr},时间: ${timeFormat(time)}`);
                stream.end();
                stream.close();
                res(true);
            });
            r.on("data", (chunk) => {
                let time = Date.now() / 1000;
                // console.log(speed1)
                now += chunk.length;
                if (!!cb) {
                    let fm = format(now / (time - startTime));
                    if (now == size) {
                        cb.setDescription(`[PKG] 下载完成,${sizeStr}/${sizeStr} [${fm}/s]`);
                        cb.setProgress(100);
                    } else {
                        cb.setDescription(`[PKG] 正在下载: (${format(now)}/${sizeStr}) [${fm}/s]`);
                        cb.setProgress(Math.floor(now / size * 100));
                    }
                }
                stream.write(chunk);
            });
            r.on("error", (_err) => {
                log.info(`[PKG] ${web.toString()} 下载失败!`);
                if (!!cb) {
                    cb.close();
                }
                stream.close();
                FileClass.delete(path_);
                res(false);
            });
        };
        let rf = await AutoRequest(web);
        if (!rf) { return; }
        fn(rf);
    });
    return new Promise<boolean>(self);
}

function UnZip(dir: string, toDir: string) {
    log.warn(`[PKG] 解压缩操作不支持压缩文件的中文命名!可能会变成乱码!`);
    return new Promise<boolean>((return1, _throw1) => {
        let stand = FileClass.getStandardPath(dir);
        let toStand = FileClass.getStandardPath(toDir);
        if (!toStand) {
            log.error(`[PKG] 获取(${toDir})的标准目录失败!`);
            return1(false);
            return;
        }
        if (!stand) {
            log.error(`[PKG] 获取(${dir})的标准目录失败!`);
            return1(false);
            return;
        }
        let stat1 = statSync(stand, { "throwIfNoEntry": false });
        let stat2 = statSync(toStand, { "throwIfNoEntry": false })
        if (!stat1 || !stat1.isFile()) {
            log.error(`[PKG] 所选文件必须使用zip格式!`);
            return1(false);
            return;
        } else if (!stat2 || stat2.isFile()) {
            log.error(`[PKG] 解压路径必须为目录!`);
            return1(false);
            return;
        }
        let format = path.extname(stand).toLowerCase();
        let type: "gzip" | "tar" | "tgz" | "zip" = {
            ".gz": "gzip",
            ".tar": "tar",
            ".tgz": "tgz"
        }[format] as any || "zip";
        let d = compressing[type].uncompress(stand, toStand);
        d.then(() => {
            log.info(`[PKG] 解压成功!`);
            return1(true);
        }).catch((e) => {
            log.error(`解压缩失败: ${e.toString()}`);
            return1(false);
        });
    });
}



GlobalEvent.onTMBotInitd.on(async () => {
    // await DownloadZip(new URL("https://software.download.prss.microsoft.com/dbazure/Win10_22H2_Chinese_Simplified_x64v1.iso?t=7fc64478-2b22-4c44-aaa4-42203eece20d&e=1688631677&h=3cf633a3368cea936603d52d75b7efd7c55fba0cde9d9966721ba0bd2ce2d1a0"), true);
    // await DownloadZip(new URL(`https://gitee.com/timidine/mcbe-lite-loader-script-engine-tmessential/raw/main/TMET%E6%96%B0%E7%89%88%E6%9C%AC%E6%8F%92%E4%BB%B6api%E8%B0%83%E7%94%A8%E5%AE%9E%E4%BE%8B%E5%92%8C%E5%BC%80%E5%8F%91%E4%BE%9D%E8%B5%96%E5%8C%85.zip`), true);
    // await UnZip(`./plugins/Data/MoreCmd/Tmp/aaaa.zip`, "./a");

    // console.log("success");

    let a = await AutoRequest(new URL("https://raw.githubusercontent.com/TMBotDev/PluginRegistry/main/index.json"), 1000);
    console.log(typeof a);
});


import { createWriteStream, fstat, statSync } from "fs";
import { TMBotCmd } from "../../../modules/CmdSystem/CommandSystem";
import { FileClass } from "../../../tools/file";
import { MoreCmdConf, log, newCmd } from "../app";
import { GlobalEvent } from "../../../modules/RunTime/Global";

import * as https from "https";
import path from "path";
import { ConsoleBar } from "../tools/consoleBar";
import * as http from "http";
import * as compressing from "compressing";
// import * as p from "request-progress";

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
let SearchCache = {
    "cacheTime": 0,
    "content": [] as string[]
}

MoreCmdConf.init("PkgHeaders", {
    "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/114.0.0.0 Safari/537.36 Edg/114.0.1823.67",
    "Accept": "text/html,application/xhtml+xml,application/xml;q=0.9,image/webp,image/apng,*/*;q=0.8,application/signed-exchange;v=b3;q=0.7"
});

MoreCmdConf.init("PkgRegistry", {
    "TMBot": {
        "gitee": "https://gitee.com/timidine/tmbot-plugin-registry/",
        "index": "index.txt",
        "branch": "master"
    }
});

let PkgRegistry: { "gitee": string, "index": string, "branch": string } = MoreCmdConf.get("PkgRegistry")["TMBot"];

function CheckSources(pr: typeof PkgRegistry) {
    if (typeof (pr) != "object" || Array.isArray(PkgRegistry)) {
        throw new Error(`配置项${JSON.stringify(pr)}错误!`);
    } else if (typeof (pr.gitee) != "string") {
        throw new Error(`配置项"gitee"配置错误!`);
    } else if (typeof (pr.branch) != "string") {
        throw new Error(`配置项"branch"配置错误!`);
    } else if (typeof (pr.index) != "string") {
        throw new Error(`配置项"index"配置错误!`);
    }
    if (pr["gitee"].indexOf("https://gitee.com") != 0) {
        log.warn(`Pkg插件表地址不为gitee,您填写的地址(${pr.gitee})可能无法使用`);
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
        let name = params[1].value!;
        log.info(`[PKG] 尝试安装${name}...`);
        let info = JSON.parse(await getPluginInfo(name));
        log.info(`[PKG] 插件名: ${info["name"]}`);
        log.info(`[PKG] 插件介绍: ${info["description"]}`);
    })().then(() => cmd.RunningCompleted()).catch((e: Error) => {
        log.error(`[PKG] 下载失败!原因: ${e.message}`);
        cmd.RunningCompleted();
    });
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
    out.success(`正在搜索中...`);
    let plugins = await SearchPlugin(params[1].value!);
    let keys = Object.keys(plugins);
    keys.sort((a, b) => (plugins[a] - plugins[b]));
    let proms: Promise<string>[] = [];
    let nameList: string[] = [];
    keys.find((v, i) => {
        let r = AutoRequest(new URL(`${PkgRegistry.gitee}raw/${PkgRegistry.branch}/plugins/${v}`));
        // proms.push(r);
        nameList.push(v);

        proms.push(new Promise<string>(async (ret) => {
            let res = await r;
            if (!res) { return ret("&&&");/*error*/ }
            let str = "";
            res.on("data", (chunk) => {
                str += chunk.toString();
            });
            res.on("close", () => {
                ret(str);
            });
        }));


        // out.success(`${(i + 1)}.名称: ${v}`);
        // out.success(`  介绍:${}`)
        return i == 10 - 1;
    });
    let data = await Promise.all(proms);
    data.forEach((v, i) => {
        let tmp = nameList[i].split(".");
        tmp.pop();
        let name = tmp.join(".");
        try {
            let obj = JSON.parse(v);
            out.success(`${(i + 1)}.名称: ${name}`);
            out.success(`  介绍:${obj["description"] || "无"}`);
        } catch (_) {
            log.warn(`${i + 1}.获取"${name}"插件信息失败!`);
        }
    });
    if (data.length != 0) {
        out.success(`§e使用"pkg i 插件名"可以直接安装插件`);
    } else {
        out.error(`未搜索到指定插件`);
    }
    cmd.RunningCompleted();
}

cmd.overload(SearchParam)(onSearchExecute);


//#region cs
let sources: string[] = [];
//就一屎山,能跑就行
let obj: { [k: string]: typeof PkgRegistry } = MoreCmdConf.get("PkgRegistry");
let RegistryMap = new Map<string, typeof PkgRegistry>();

for (let key in obj) {
    let val = obj[key];
    sources.push(key);
    RegistryMap.set(key, val);
}

let ChangeSourcesParam: [
    TMBotCmd.CommandParams.Enum,
    TMBotCmd.CommandParams.Enum
] = [
        new TMBotCmd.CommandParams.Enum("selSources", ["changesource", "cs"]),
        new TMBotCmd.CommandParams.Enum("Sources", sources)
    ];


function onChangeSourcesExecute(cmd: TMBotCmd.TMBotCommand<any, any, any>, _runner: TMBotCmd.TMBotCommandRunner<any>, out: TMBotCmd.TMBotCommandOutput, params: typeof ChangeSourcesParam) {
    let sources = RegistryMap.get(params[1].value!);
    if (!sources) {
        out.error(`查找源"${params[1].value}"失败!`);
        return cmd.RunningCompleted();
    }
    PkgRegistry = sources;
    out.success(`更换TMBot_pkg源为"${params[1].value}"成功!`);
    cmd.RunningCompleted();
}


cmd.overload(ChangeSourcesParam)(onChangeSourcesExecute);

//#endregion





cmd.setup();




// let headers = {
//     "Accept": "text / html, application/ xhtml + xml, application/xml;q=0.9,image/webp, image / apng,*/*;q=0.8,application/signed-exchange;v=b3;q=0.7",
//     "Accept-Encoding": "gzip, deflate, br",
//     "Accept-Language": "zh,zh-CN;q=0.9",
//     "Cache-Control": "max-age=0",
//     "Connection": "keep-alive",
//     "Host": "gitee.com",
//     "If-None-Match": "W/\"8d942f67359a2b2103a24ad3fab85380eec87c42\"",
//     "Sec-Ch-Ua": "\"Not.A/Brand\";v=\"8\", \"Chromium\";v=\"114\", \"Microsoft Edge\";v=\"114\"",
//     "Sec-Ch-Ua-Mobile": "?0",
//     "Sec-Ch-Ua-Platform": "\"Windows\"",
//     "Sec-Fetch-Dest": "document",
//     "Sec-Fetch-Mode": "navigate",
//     "Sec-Fetch-Site": "none",
//     "Sec-Fetch-User": "?1",
//     "Upgrade-Insecure-Requests": "1",
//     "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/114.0.0.0 Safari/537.36 Edg/114.0.1823.67"
// }



function AutoRequest(url: URL, timeout?: number) {
    return new Promise<http.IncomingMessage | undefined>(async (ret) => {
        let args: any[] = [];
        args.push(url);
        let opts: { [k: string]: any } = {};
        opts["headers"] = MoreCmdConf.get("PkgHeaders");
        if (!!timeout) {
            opts["timeout"] = timeout;
        }
        args.push(opts);
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
function DownloadZip(web: URL, name: string, bar: boolean) {
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
        let path_ = path.join(TmpDir, name);
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

async function SearchPlugin(plugin: string) {
    let time = Date.now();
    if ((time - SearchCache.cacheTime) >= 1000 * 60) {//1 min cache
        let url = new URL(`${PkgRegistry.gitee}raw/${PkgRegistry.branch}/${PkgRegistry.index}`);
        // let url = new URL(`https://gitee.com/timidine/tmbot-plugin-registry/raw/master/index.txt`);
        let request = await AutoRequest(url, 1000 * 15);
        if (!!request) {
            let content = "";
            await new Promise<void>((r) => {
                request!.on("data", (chunk) => {
                    content += chunk + "";
                });
                request!.on("end", r);
            });
            if (content.indexOf("TMBotPluginIndex") != 0) {
                log.warn(`获取索引文件失败!使用缓存...`);
                log.warn(`信息: ${content}`);
            } else {
                let arr = content.replaceAll("\r\n", "\n").replaceAll("\r", "\n").split("\n");
                arr.shift();
                SearchCache.content = arr;
            }
        } else { log.warn(`获取索引文件失败!使用缓存...`); }
    }
    let arr = SearchCache.content;
    let weight: { [k: string]: number } = {};
    arr.forEach((v) => {
        let index = v.indexOf(plugin);
        if (index == -1) { return; }
        weight[v] = index;
    });
    return weight;
}

/**
 * 获取插件信息
 * @returns 可能失败,自行捕获parse错误
 * ``` js
 * {
 *     "name": string,
 *     "description": string,
 *     "source": string
 * }
 * ```
 */
function getPluginInfo(name: string) {
    let str = `${PkgRegistry.gitee}raw/${PkgRegistry.branch}/plugins/${name}`;
    if (name.split(".").pop() != "json") {
        str += ".json";
    }
    return new Promise<string>(async (re) => {
        let res = await AutoRequest(new URL(str));
        if (!res) {
            // log.warn(`获取"${v}"插件信息失败`);
            re("???");
            return;
        }
        let res1 = "";
        res.on("data", (chunk) => {
            res1 += chunk.toString();
        });
        res.on("end", () => { re(res1); });
    });
}

GlobalEvent.onTMBotInitd.on(async () => {
    // await DownloadZip(new URL("https://software.download.prss.microsoft.com/dbazure/Win10_22H2_Chinese_Simplified_x64v1.iso?t=9bc791af-98e1-4da3-828d-f6a6829ad2a6&e=1690720914&h=7ecaa253228fb7761c863d62001f6e6db13e06f4ea941740c84c739327daec0a"), "tmpZip.zip", true);
    await DownloadZip(new URL(`https://gitee.com/timidine/mcbe-lite-loader-script-engine-tmessential/raw/main/TMET%E6%96%B0%E7%89%88%E6%9C%AC%E6%8F%92%E4%BB%B6api%E8%B0%83%E7%94%A8%E5%AE%9E%E4%BE%8B%E5%92%8C%E5%BC%80%E5%8F%91%E4%BE%9D%E8%B5%96%E5%8C%85.zip`), "tmpZip.zip", true);
    // await UnZip(`./plugins/Data/MoreCmd/Tmp/aaaa.zip`, "./a");

    console.log("success");
});
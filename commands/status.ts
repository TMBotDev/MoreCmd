import { arch, cpus, release, version } from "os";
import { newCmd } from "../app";
import { memoryUsage } from "process";

const format = (data: number) => (data / 1024 / 1024).toFixed(2) + "MB";

let cmd = newCmd("status", "TMBot状态");
cmd.overload([])((fn, _runner, out, _par) => {
    out.success(`操作系统: ${version()}(${release()})`);
    out.success(`CPU架构: ${arch()}`);
    let cpu = cpus();
    let cores: string[] = [];
    cpu.forEach((v) => {
        cores.push(v.model);
    });
    out.success(`CPU参数(${cores.length}):`);
    cores.forEach((v, i) => {
        out.success(`${(i + 1)}-${v}`);
    });
    out.success(`V8内存使用情况: ${format(memoryUsage().heapTotal)}`);
    fn.RunningCompleted();
});
cmd.setup();
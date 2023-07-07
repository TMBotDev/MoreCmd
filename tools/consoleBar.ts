import { nextTick, stdin, stdout } from "process";
import { Interface } from "readline";
import { $$_GET_READLINE_INSTANCE_ } from "../../../modules/ReadLine";

let hasBar = false;

enum OperationType {
    Auto,
    Clear,
    Keep
}

export class ConsoleBar {
    static OperationType = OperationType;
    OperationType = OperationType;
    CursorTo0(clear: boolean) {
        let old = this.isSelfWrite;
        this.isSelfWrite = true;
        clear && stdout.clearLine(0);
        stdout.cursorTo(0);
        this.isSelfWrite = old;
    }
    private readline: Interface;
    private now = 0;
    private description = "";
    private nowStr = "";
    private isSelfWrite = false;
    private oriStdout: any;
    private inQuestion = false;
    private isFirstQuestion = false;
    private isCancel = false;
    constructor() {
        if (hasBar) {
            throw new Error(`已有进度条被创建!无法同时存在两个进度条!`);
        }
        this.readline = $$_GET_READLINE_INSTANCE_();
        if (!this.readline) { throw new Error("无法获取TMBot ReadLine实例,无法创建控制台进度条!可能TMBot正处于LL运行环境?"); }
        let ori = stdout.write as any;
        this.oriStdout = ori;
        stdout.write = (...args) => {
            if (this.inQuestion) {
                if (this.isFirstQuestion) {
                    ori.call(stdout, "\n");
                    this.isFirstQuestion = false;
                    stdout.moveCursor(0, -1);
                    console.log(this.nowStr);
                }
                if (args[0].toString().indexOf("\n") != -1) {
                    stdout.moveCursor(0, -1);
                    this.CursorTo0(true);
                }
                return ori.call(stdout, ...args);
            }
            if (!this.isSelfWrite) {
                this.CursorTo0(true);
                ori.call(stdout, ...args);
                // ori.call(stdout, "\n");
                ori.call(stdout, this.nowStr);
                // console.log("1")
                return true;
            }
            return ori.call(stdout, ...args);
        };
        hasBar = true;
    }
    buildBar(s: number) {
        let max = 20;
        let now = Math.floor(s / 5);
        (now > max) && (now = max);
        let empty = max - now;
        let str = "[";
        for (let i = 0; i < now; i++) {
            str += "#";
        }
        for (let i = 0; i < empty; i++) {
            str += "*";
        }
        return str + "]";
    }

    /**
     * 设置进度
     * @note 进度必须为0~100,不要在询问问题时进行调用
     */
    setProgress(x: number, tick = true, op: OperationType = OperationType.Auto) {
        if (x < 0 || x > 100) {
            return false;
        }
        if (this.inQuestion) { return false; }
        this.now = x;
        tick && this.tick(op);
    }
    setDescription(s: string) {
        this.description = s;
    }
    tick(op: OperationType = OperationType.Auto) {
        let NotCur = true;
        if (op == OperationType.Clear) {
            this.CursorTo0(true);
            NotCur = false;
        }
        let str = this.buildBar(this.now);
        let oldStr = this.nowStr;
        this.nowStr = str + " " + this.description;
        if (op == OperationType.Auto) {
            if (this.nowStr.length < oldStr.length) {
                this.CursorTo0(true);
                NotCur = false;
            }
        }
        if (NotCur) {
            this.CursorTo0(false);
        }
        this.isSelfWrite = true;
        stdout.write(this.nowStr);
        this.isSelfWrite = false;
    }
    /**
     * 询问问题
     * @param query 问题
     * @param fn 
     */
    question(query: string) {
        if (this.inQuestion) { return undefined; }
        this.inQuestion = true;
        this.isFirstQuestion = true;
        let promise = new Promise<string>((fn, e) => {
            // console.log(query)
            this.readline.question(query, (r) => {
                this.inQuestion = false;
                if (!this.isCancel) {
                    fn(r);
                } else {
                    e(undefined);
                }
            });
        });
        return promise;
    }
    cancelQuestion() {
        if (!this.inQuestion) { return false; }
        this.isCancel = true;
        stdin.push("\n");
        return true;
    }
    /**
     * 关闭
     * @note 不要在询问问题时进行调用
     */
    close() {
        if (this.inQuestion) { return false; }
        stdout.write = this.oriStdout;
        this.CursorTo0(true);
        hasBar = false;
    }
}
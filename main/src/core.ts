// noinspection JSUnusedGlobalSymbols

import {type FileLogWriterParams, type LogEntry, type LogEntryFormater, LogLevel, type LogWriter} from "./common.ts";
import {formater_simpleJson, formater_dateTypeTitleSourceData, formater_typeTitleSourceData_colored} from "./formaters.ts";
import "jopi-node-space";

//region Writers

export function newConsoleLogWriter(formater?: LogEntryFormater): LogWriter {
    if (!formater) {
        formater = formater_typeTitleSourceData_colored
    }

    return new ConsoleLogWriter(formater!);
}

class ConsoleLogWriter implements LogWriter {
    constructor(private readonly formater: LogEntryFormater) {
    }

    addEntry(entry: LogEntry): void {
        console.log(this.formater(entry));
    }

    addBatch(entries: LogEntry[]) {
        entries.forEach(e => this.addEntry(e));
    }
}

/**
 * Store the log entry.
 * Is used when we need to wait the Worker is fully initialized.
 */
class BufferLogWriter implements LogWriter {
    addEntry(entry: LogEntry): void {
        this.buffer.push(entry);
    }

    addBatch(entries: LogEntry[]): void {
        entries.forEach(e => this.addEntry(e));
    }

    flushTo(writer: LogWriter): void {
        const b = this.buffer;
        this.buffer = [];
        writer.addBatch(b);
    }

    private buffer: LogEntry[] = [];
}

class DefaultLogWriter implements LogWriter {
    /**
     * Use a buffer as the default internal.
     * Is mainly required for workers, which can receive messages when the worker isn't fully initialized.
     */
    internal: LogWriter = gBufferLogWriter;

    addEntry(entry: LogEntry): void {
        this.internal.addEntry(entry);
    }

    addBatch(entries: LogEntry[]) {
        this.internal.addBatch(entries);
    }
}

export class VoidLogWriter implements LogWriter {
    addBatch(_entries: LogEntry[]): void {
    }

    addEntry(_entry: LogEntry): void {
    }
}

export function setDefaultWriter(writer: LogWriter) {
    if (writer!==gBufferLogWriter) {
        if (gDefaultWriter.internal === gBufferLogWriter) {
            gBufferLogWriter.flushTo(writer);
        }
    }

    gDefaultWriter.internal = writer;
}

export function getDefaultWriter(): LogWriter {
    return gDefaultWriter.internal;
}

const gBufferLogWriter = new BufferLogWriter();
const gDefaultWriter = new DefaultLogWriter();

//endregion

//region Loggers

export abstract class JopiLogger {
    readonly #fullName: string;
    #onLog: LogWriter = gDefaultWriter;

    protected readonly hSpam: LogLevelHandler;
    protected readonly hInfo: LogLevelHandler;
    protected readonly hWarn: LogLevelHandler;
    protected readonly hError: LogLevelHandler;

    constructor(parent: JopiLogger|null, public readonly name: string) {
        this.#fullName = parent ? parent.#fullName + '.' + name : name;

        if (parent) {
            this.#onLog = parent.#onLog;
        }

        const me = this;

        this.hSpam = function (title?: string, data?: any) {
            me.#onLog.addEntry({
                level: LogLevel.SPAM,
                logger: me.#fullName, date: Date.now(), title, data});
        };

        this.hInfo = function (title?: string, data?: any) {
            me.#onLog.addEntry({
                level: LogLevel.INFO,
                logger: me.#fullName, date: Date.now(), title, data});
        };

        this.hWarn = function (title?: string, data?: any) {
            me.#onLog.addEntry({
                level: LogLevel.WARN,
                logger: me.#fullName, date: Date.now(), title, data});
        };

        this.hError = function (title?: string, data?: any) {
            me.#onLog.addEntry({
                level: LogLevel.ERROR,
                logger: me.#fullName, date: Date.now(), title, data});
        };
    }

    setLogWriter(callback: LogWriter) {
        if (!callback) callback = gDefaultWriter;
        this.#onLog = callback;
    }

    spam(_l?: (w: LogLevelHandler)=>void): boolean {
        return false;
    }

    info(_l?: (w: LogLevelHandler)=>void): boolean {
        return false;
    }

    warn(_l?: (w: LogLevelHandler)=>void) {
        return false;
    }

    error(_l?: (w: LogLevelHandler)=>void) {
        return false;
    }
}

//endregion

//region Log levels

export type LogLevelHandler = (title?: string, data?: any|undefined)=>void;

export function getLogLevelName(level: LogLevel) {
    switch (level) {
        case LogLevel.SPAM:
            return "SPAM";
        case LogLevel.ERROR:
            return "ERROR";
        case LogLevel.INFO:
            return "INFO";
        case LogLevel.WARN:
            return "WARN";
    }
}

export class LogSpamLevel extends JopiLogger {
    override spam(l?: (w: LogLevelHandler)=>void) {
        if (l) l(this.hSpam);
        return true;
    }

    override info(l?: (w: LogLevelHandler)=>void) {
        if (l) l(this.hInfo);
        return true;
    }

    override warn(l?: (w: LogLevelHandler)=>void) {
        if (l) l(this.hWarn);
        return true;
    }

    override error(l?: (w: LogLevelHandler)=>void) {
        if (l) l(this.hError);
        return true;
    }
}

export class LogInfoLevel extends JopiLogger {
    override info(l?: (w: LogLevelHandler)=>void) {
        if (l) l(this.hInfo);
        return true;
    }

    override warn(l?: (w: LogLevelHandler)=>void) {
        if (l) l(this.hWarn);
        return true;
    }

    override error(l?: (w: LogLevelHandler)=>void) {
        if (l) l(this.hError);
        return true;
    }
}

export class LogWarnLevel extends JopiLogger {
    override warn(l?: (w: LogLevelHandler)=>void) {
        if (l) l(this.hWarn);
        return true;
    }

    override error(l?: (w: LogLevelHandler)=>void) {
        if (l) l(this.hError);
        return true;
    }
}

export class LogErrorLevel extends JopiLogger {
    override error(l?: (w: LogLevelHandler)=>void) {
        if (l) l(this.hError);
        return true;
    }
}

//endregion

//region Log Delayer

interface LogDelayerParams {
    /**
     * How much time to wait before sending the log entries?
     * Default is 2 sec.
     */
    delayTime_sec?: number;

    /**
     * Allow flushing if an error is logged.
     * Default is true.
     */
    flushIfError?: boolean;

    /**
     * Allow flushing if a warning is logged.
     * Default is true.
     */
    flushIfWarn?: boolean;
}

export function newLogDelayer(base: LogWriter|null, params?: LogDelayerParams): LogWriter {
    return new LogDelayer(base, params);
}

/**
 * Will delay writing the logs.
 * Is useful for a log-writer with I/O, allowing to batch the I/O.
 */
class LogDelayer implements LogWriter {
    private readonly _delayTime_sec: number;
    private readonly _flushIfError: boolean;
    private readonly _flushIfWarn: boolean;
    private readonly _base: LogWriter;

    private entries: LogEntry[] = [];
    private timerId: number = 0;

    constructor(base: LogWriter|null, params?: LogDelayerParams) {
        if (!params) params = {};

        if (!base) base = gDefaultWriter.internal;
        this._base = base;

        this._delayTime_sec = params.delayTime_sec || 2;
        this._flushIfError = params.flushIfError !== false;
        this._flushIfWarn = params.flushIfWarn !== false;

        NodeSpace.app.onAppExiting(() => { this.flush() });
    }

    addEntry(entry: LogEntry) {
        this.entries.push(entry);

        if (entry.level <= LogLevel.WARN) {
            if (this._flushIfError && (entry.level === LogLevel.ERROR)) {
                this.flush();
                return;
            }

            if (this._flushIfWarn && (entry.level === LogLevel.ERROR)) {
                this.flush();
                return;
            }
        }

        if (!this.timerId) {
            // @ts-ignore
            this.timerId = setTimeout(() => this.flush(), this._delayTime_sec * 1000);

            // Allow the timer to not block the app exit.
            try {
                // @ts-ignore
                this.timerId.unref();
            }
            catch {
            }
        }
    }

    addBatch(entries: LogEntry[]) {
        entries.forEach(e => this.addEntry(e));
    }

    flush() {
        this.timerId = 0;

        if (!this.entries.length) return;
        let tmp = this.entries;
        this.entries = [];
        this._base.addBatch(tmp);
    }
}

//endregion

//region Workers

export function createWorker(filePath?: string, data?: any): Worker {
    if (!filePath) filePath = "./index";

    if (!filePath.endsWith(".js") && !filePath.endsWith(".ts")) {
        let myExt = import.meta.filename.split(".").pop();
        filePath += '.' + myExt;
    }

    let fileURL: URL;

    if (filePath && filePath.startsWith("./")) {
        fileURL = new URL(filePath, import.meta.url);
    } else {
        fileURL = new URL(filePath);
    }

    const worker = NodeSpace.thread.newWorker(fileURL, data);

    // Avoid blocking the app terminaison.
    NodeSpace.thread.unrefThisWorker(worker);

    NodeSpace.app.onAppExiting(() => {
        // Allow the work to know he must exit.
        worker.postMessage("APP_EXIT");
    });

    return worker;
}

export function newWorkerLogWriter(worker?: Worker): LogWriter {
    if (!worker) {
        worker = createWorker();
    }

    return new WorkerLogWriter(worker);
}

class WorkerLogWriter implements LogWriter {
    constructor(private readonly worker: Worker) {
    }

    addBatch(entries: LogEntry[]): void {
        //console.log("Posting batch message to worker:", entries);
        this.worker.postMessage(entries);
    }

    addEntry(entry: LogEntry): void {
        //console.log("Posting message to worker:", entry);
        this.worker.postMessage([entry]);
    }
}

if (!NodeSpace.thread.isMainThread) {
    function callback(data: any)
    {
        if (data === "APP_EXIT") {
            //console.log("Worker is exiting...");
            NodeSpace.app.declareAppExiting();
            NodeSpace.thread.closeCurrentThread();
        } else {
            const entries = data as LogEntry[];

            //entries.forEach(e => e.title = "[THE WORKER]" + e.title);
            //console.log("Worker received message", entries);

            if (entries.length > 1) {
                gDefaultWriter.internal.addBatch(entries);
            } else {
                gDefaultWriter.internal.addEntry(entries[0]);
            }
        }
    }

    if (NodeSpace.thread.currentWorker) {
        NodeSpace.thread.currentWorker.addEventListener("message", e => callback(e.data));
    }
}

//endregion

//region *** Server Side ***

//region FileWriter

export let _newFileWriter: undefined | ((formater?: LogEntryFormater, params?: FileLogWriterParams) => LogWriter);
export let _deleteLogsOlderThan_hours: undefined | ((hours: number, logDir?: string) => void);

export function newFileWriter(formater?: LogEntryFormater, params?: FileLogWriterParams): LogWriter {
    if (_newFileWriter) {
        return _newFileWriter(formater, params);
    }

    return newConsoleLogWriter(formater);
}

export function deleteLogsOlderThan_hours(hours: number, logDir?: string) {
    if (hours<1) hours = 1;

    if (_deleteLogsOlderThan_hours) {
        _deleteLogsOlderThan_hours(hours, logDir);
    }
}

if (NodeSpace.what.isServerSide) {
    // Calculating the path allows avoiding the bundler to include this dep automatically.
    const serverFilePath = "./server." + (import.meta.filename.split(".").pop());

    const File = await import(/* @vite-ignore */ serverFilePath);
    _newFileWriter = File.newFileWriter;
    _deleteLogsOlderThan_hours = File.deleteLogsOlderThan_hours;
}

export function newFileWriter_SimpleJson(params?: FileLogWriterParams): LogWriter {
    return newFileWriter(formater_simpleJson, params);
}

export function newFileWriter_dateTypeTitleSourceData(params?: FileLogWriterParams): LogWriter {
    return newFileWriter(formater_dateTypeTitleSourceData, params);
}

//endregion

//endregion

//region Presets

export function createWithConsolePreset(useDelay=false, useWorker=false): LogWriter {
    if (useWorker) {
        const workerWriter = newWorkerLogWriter(createWorker("./worker", {useConsole: true}));

        if (useDelay) {
            return newLogDelayer(workerWriter);
        } else {
            return workerWriter;
        }
    } else {
        if (useDelay) {
            return newLogDelayer(newConsoleLogWriter());
        } else {
            return newConsoleLogWriter();
        }
    }
}

export function useConsolePreset(useDelay=false, useWorker=false) {
    setDefaultWriter(createWithConsolePreset(useDelay, useWorker));
}

export function createWithFilePreset(useDelay=false, useWorker=false, fileParams?: FileLogWriterParams): LogWriter {
    if (useWorker) {
        const workerWriter = newWorkerLogWriter(createWorker("./worker", {useFile: true, params: fileParams}));

        if (useDelay) {
            return newLogDelayer(workerWriter);
        } else {
            return workerWriter;
        }
    } else {
        if (useDelay) {
            return newLogDelayer(newFileWriter(undefined, fileParams));
        } else {
            return newFileWriter_dateTypeTitleSourceData(fileParams);
        }
    }
}

export function useFilePreset(useDelay=false, useWorker=false, fileParams?: FileLogWriterParams) {
    setDefaultWriter(createWithFilePreset(useDelay, useWorker, fileParams));
}

// Note: do nothing for Worker, must keep it inside
// the default logger which is a buffer.
//
if (NodeSpace.thread.isMainThread) {
    // The default config.
    if (NodeSpace.what.isServerSide) {
        await useConsolePreset();
    } else {
        await useConsolePreset(false, false);
    }
}

//endregion
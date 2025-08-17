// noinspection JSUnusedGlobalSymbols

import {
    type FileLogWriterParams,
    type LogEntry,
    type LogEntryFormater,
    LogFileRotate,
    type LogWriter
} from "./common.ts";

import {formater_dateTypeTitleSourceData} from "./formaters.ts";

import path from "node:path";
import * as fs from "node:fs";
import * as fsPromise from "node:fs/promises";
import zlib from 'node:zlib';
import { pipeline } from 'node:stream/promises';

import "jopi-node-space";

//region FileLogWriter

export function newFileWriter(formater?: LogEntryFormater, params?: FileLogWriterParams): LogWriter {
    if (!formater) formater = formater_dateTypeTitleSourceData;
    if (!params) params = {};
    return new FileLogWriter(params, formater);
}

class FileLogWriter implements LogWriter, FileRotatorClient {
    private readonly fileName: string;
    private readonly logDir: string;
    private readonly rotate: LogFileRotate;
    private readonly zipArchive: boolean;
    private readonly maxFileSize_mb;

    private currentFilePath?: string;
    private fileStream?: fs.WriteStream;

    private isClosed = true;
    private buffer: LogEntry[] = [];

    private readonly formater: LogEntryFormater;

    constructor(params: FileLogWriterParams, formater: LogEntryFormater) {
        this.fileName = params.fileName || "logfile.log";
        this.logDir = path.resolve(params.logDir || "logs");
        this.rotate = params.rotate || LogFileRotate.NO_ROTATE;
        this.zipArchive = params.zipArchive || false;
        this.maxFileSize_mb = params.maxFileSize_mb || 100;

        this.formater = formater;
        this.fileStream = this.openFile(params.clearFileOnStart === true);
        if (this.rotate===LogFileRotate.ON_SIZE) addToFileRotator(this);

        // Use 'onAppExited' and not 'onAppExiting' to close
        // the stream only when the logs have been pushed.
        //
        NodeSpace.app.onAppExited(() => {
            //console.log("FileLogWriter: closing file");

            if (this.isClosed) {
                // Will flush current messages.
                this.declareOpen();
                this.declareClosed();
            }

            if (this.fileStream) {
                try { this.fileStream.end(); }
                catch {}
            }
        });

        this.declareOpen();
    }

    private openFile(clearFileContent: boolean = false): fs.WriteStream {
        const logFile = path.join(this.logDir, this.fileName);
        this.currentFilePath = logFile;

        fs.mkdirSync(this.logDir, { recursive: true });

        if (clearFileContent) {
            try { fs.unlinkSync(logFile); }
            catch {}
        }

        return fs.createWriteStream(logFile, { flags: 'a' });
    }

    //region LogWriter

    addEntry(entry: LogEntry): void {
        if (this.isClosed) {
            //console.log("FileLogWriter: buffering log entry");
            this.buffer!.push(entry);
        }
        else {
            this.fileStream!.write(this.formater(entry) + "\n");
        }
    }

    addBatch(entries: LogEntry[]): void {
        entries.forEach(e => this.addEntry(e));
    }

    //endregion

    //region FileRotatorClient

    flush() {
        this.fileStream!.end();
    }

    onBeforeFileRotation(): Promise<void> {
        if (this.isClosed) return Promise.resolve();
        this.declareClosed();

        return new Promise(r => this.fileStream!.end(r));
    }

    private declareClosed() {
        if (!this.isClosed) {
            this.isClosed = true;
            this.buffer = [];
        }
    }

    private declareOpen() {
        if (this.isClosed) {
            this.fileStream = this.openFile();

            this.addBatch(this.buffer!);
            this.buffer = [];
        }

        this.isClosed = false;
    }

    onAfterFileRotation() {
        this.declareOpen();
    }

    getMaxFileSize_mb(): number {
        return this.maxFileSize_mb;
    }

    getFilePath(): string {
        return this.currentFilePath!;
    }

    mustGzipAfterRotation(): boolean {
        return this.zipArchive;
    }

    //endregion
}

//region File Rotator

const FILE_ROTATOR_INTERVAL_MS = 1000 * 5;

interface FileRotatorClient {
    flush(): void;
    onBeforeFileRotation: ()=>Promise<void>;
    onAfterFileRotation: ()=>void;
    getMaxFileSize_mb(): number;
    getFilePath(): string;
    mustGzipAfterRotation(): boolean;
}

const gFileRotatorClients: FileRotatorClient[] = [];
let gIsFileRotatorStarted = false;

function addToFileRotator(client: FileRotatorClient) {
    gFileRotatorClients.push(client);

    if (!gIsFileRotatorStarted) {
        gIsFileRotatorStarted = true;
        startFileRotator();
    }
}

function startFileRotator() {
    async function compressFileGzip(filePath: string) {
        const readStream = fs.createReadStream(filePath);
        const writeStream = fs.createWriteStream(filePath + ".gz");
        const gzip = zlib.createGzip();

        await pipeline(readStream, gzip, writeStream);
    }

    async function renameFile(filePath: string) {
        const originalDir = path.dirname(filePath);
        const originalExt = path.extname(filePath);
        const originalBaseName = path.basename(filePath, originalExt);

        const now = new Date();
        const dateString = digit(now.getFullYear(), 4) + digit(now.getUTCMonth(), 2) + digit(now.getUTCDay(), 2) + '-' + digit(now.getUTCHours(), 2) + digit(now.getUTCMinutes(), 2) + digit(now.getUTCSeconds(), 2);

        const newFileName = `${originalBaseName}_${dateString}${originalExt}`;
        const newFilePath = path.join(originalDir, newFileName);

        await fsPromise.rename(filePath, newFilePath);
        return newFilePath;
    }

    function digit(value: number, length: number): string {
        return value.toString().padStart(length, '0');
    }

    async function check() {
        if (hasHotReload) return;

        await Promise.all(gFileRotatorClients.map(async c => {
            const filePath = c.getFilePath();
            let mustRotate = false;

            try {
                const stats = await fsPromise.stat(filePath);
                const fileSizeInMB = stats.size / (1024 * 1024);
                mustRotate = fileSizeInMB > c.getMaxFileSize_mb();

                if (mustRotate) {
                    await c.onBeforeFileRotation();
                    let newFilePath = await renameFile(filePath);
                    c.onAfterFileRotation();

                    if (c.mustGzipAfterRotation()) {
                        await compressFileGzip(newFilePath);
                        await fsPromise.unlink(newFilePath);
                    }
                }
            } catch (e: any) {
                // File isn't created yet?
                if (e.code==="ENOENT") return;

                console.error(e);
            }
        }));

        if (!hasHotReload) {
            // Avoid using timer if hot reload.
            const timer = setTimeout(check, FILE_ROTATOR_INTERVAL_MS);

            // Allow the application to stop, even if we have this timer.
            timer.unref();
        }
    }

    check().then();
}

NodeSpace.app.onAppExiting(() => {
    gFileRotatorClients.forEach(c => c.flush());
});

let hasHotReload = false;

NodeSpace.app.onHotReload(() => {
    hasHotReload = true;
    gFileRotatorClients.forEach(c => c.flush());
});

//endregion

//region Old files remover

const ONE_HOUR = 1000 * 60 * 60;

export function deleteLogsOlderThan_hours(hours: number, logDir: string) {
    async function checkOldFiles() {
        await cleanupOldFiles(logDir, oldFilesMaxTime);
        const timerId = setTimeout(checkOldFiles, ONE_HOUR);

        // Allow not blocking the app execution ends.
        timerId.unref();
    }

    if (!logDir) logDir = "logs";
    logDir = path.resolve(logDir);

    const oldFilesMaxTime = hours * ONE_HOUR;
    checkOldFiles().then();
}

async function cleanupOldFiles(directoryPath: string, maxTime: number) {
    try {
        let stats = await fsPromise.stat(directoryPath);
        if (!stats.isDirectory()) return;
    } catch {
        return;
    }

    const files = await fsPromise.readdir(directoryPath);
    const now = Date.now();

    await Promise.all(files.map(async (file) => {
        const filePath = path.join(directoryPath, file);

        try {
            const stats = await fsPromise.stat(filePath);

            if (stats.isFile()) {
                const fileAge = now - stats.mtime.getTime();

                if (fileAge > maxTime) {
                    await fsPromise.unlink(filePath);
                }
            }
        } catch {
            console.warn(`Can't remove old log file ${filePath}`);
        }
    }));
}

//endregion

//endregion
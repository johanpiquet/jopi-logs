export interface LogEntry {
    level: LogLevel;
    logger: string;

    date: number;
    title?: string;
    data?: any;
}

export type LogEntryFormater = (entry: LogEntry)=>string;

export enum LogLevel {
    SPAM = 8,
    INFO = 4,
    WARN = 2,
    ERROR = 0,
}

export interface LogWriter {
    addEntry(entry: LogEntry): void;
    addBatch(entries: LogEntry[]): void;
}

export enum LogFileRotate {
    NO_ROTATE,
    ON_SIZE
}

export interface FileLogWriterParams {
    /**
     * In which dir must we write the logs?
     * Default is ./logs
     */
    logDir?: string;

    /**
     * The name of the file, with his extension.
     * A prefix and a suffix can be added.
     * The default is logfile.log
     */
    fileName?: "server";

    /**
     * How to rotate the logs?
     * The default is LogRotate.NO_ROTATE
     */
    rotate?: LogFileRotate;

    /**
     * The max size of the file.
     * Once reached, a rotation is automatically done.
     */
    maxFileSize_mb?: number;

    /**
     * If true, then the log file will be gzipped after rotation.
     * Default is false.
     */
    zipArchive?: true;
}

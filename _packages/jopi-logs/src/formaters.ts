const RED = "\x1b[31m";
const GREY = "\x1b[90m";
const RESET = "\x1b[0m";
const ORANGE = "\x1b[38;5;208m";
const LIGHT_BLUE = "\x1b[96m";

import {type LogEntry, type LogEntryFormater, LogLevel} from "./common.ts";

export function formatDate1(timeStamp: number): string {
    const date = new Date(timeStamp);
    return date.toISOString();
}

export const formater_simpleJson: LogEntryFormater = (entry: LogEntry) => {
    return JSON.stringify(entry);
};

export const formater_dateTypeTitleSourceData: LogEntryFormater = (entry: LogEntry) => {
    const date = formatDate1(entry.date);

    let json = entry.data ? JSON.stringify(entry.data) : "";
    const title = (entry.title || "").padEnd(50, " ");

    json = entry.logger + " |>" + json;

    switch (entry.level) {
        case LogLevel.ERROR:
            return `${date} - ERROR - ${title}${json}`;
        case LogLevel.WARN:
            return `${date} - WARN  - ${title}${json}`;
        case LogLevel.INFO:
            return `${date} - INFO  - ${title}${json}`;
        case LogLevel.SPAM:
            return `${date} - SPAM  - ${title}${json}`;
    }
}

export const formater_typeTitleSourceData_colored: LogEntryFormater = (entry: LogEntry) => {
    let json = entry.data ? JSON.stringify(entry.data) : "";
    const title = (entry.title || "").padEnd(50, " ");

    json = entry.logger + " " + json;

    switch (entry.level) {
        case LogLevel.ERROR:
            return `${RED}error${RESET} - ${title}${GREY}${json}${RESET}`;
        case LogLevel.WARN:
            return `${ORANGE}warn ${RESET} - ${title}${GREY}${json}${RESET}`;
        case LogLevel.INFO:
            return `${LIGHT_BLUE}info ${RESET} - ${title}${GREY}${json}${RESET}`;
        case LogLevel.SPAM:
            return `${GREY}spam ${RESET} - ${title}${GREY}${json}${RESET}`;
    }
}
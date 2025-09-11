export declare enum LogLevel {
    DEBUG = 0,
    INFO = 1,
    WARN = 2,
    ERROR = 3
}
declare class Logger {
    private level;
    private logFile;
    private logStream;
    constructor(level?: string, logFile?: string);
    private parseLogLevel;
    private initializeLogFile;
    private log;
    debug(message: string, ...args: any[]): void;
    info(message: string, ...args: any[]): void;
    warn(message: string, ...args: any[]): void;
    error(message: string, ...args: any[]): void;
    close(): void;
}
export declare const logger: Logger;
export {};
//# sourceMappingURL=logger.d.ts.map
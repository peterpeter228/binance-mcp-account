import fs from 'fs';
import path from 'path';
export var LogLevel;
(function (LogLevel) {
    LogLevel[LogLevel["DEBUG"] = 0] = "DEBUG";
    LogLevel[LogLevel["INFO"] = 1] = "INFO";
    LogLevel[LogLevel["WARN"] = 2] = "WARN";
    LogLevel[LogLevel["ERROR"] = 3] = "ERROR";
})(LogLevel || (LogLevel = {}));
class Logger {
    level;
    logFile;
    logStream = null;
    constructor(level = 'info', logFile) {
        this.level = this.parseLogLevel(level);
        this.logFile = logFile || path.join(process.cwd(), 'logs/binance-mcp-server.log');
        this.initializeLogFile();
    }
    parseLogLevel(level) {
        switch (level.toLowerCase()) {
            case 'debug':
                return LogLevel.DEBUG;
            case 'info':
                return LogLevel.INFO;
            case 'warn':
                return LogLevel.WARN;
            case 'error':
                return LogLevel.ERROR;
            default:
                return LogLevel.INFO;
        }
    }
    initializeLogFile() {
        try {
            // 确保日志目录存在
            const logDir = path.dirname(this.logFile);
            if (!fs.existsSync(logDir)) {
                fs.mkdirSync(logDir, { recursive: true });
            }
            // 创建写入流
            this.logStream = fs.createWriteStream(this.logFile, { flags: 'a' });
            // 监听错误事件
            this.logStream.on('error', (err) => {
                console.error('日志文件写入错误:', err);
            });
            console.log(`日志将写入文件: ${this.logFile}`);
        }
        catch (error) {
            console.error('初始化日志文件失败:', error);
        }
    }
    log(level, message, ...args) {
        if (level >= this.level) {
            const timestamp = new Date().toISOString();
            const levelName = LogLevel[level];
            const logMessage = `[${timestamp}] [${levelName}] ${message}`;
            const argsString = args.length > 0
                ? ' ' + args.map((arg) => (typeof arg === 'object' ? JSON.stringify(arg, null, 2) : String(arg))).join(' ')
                : '';
            const fullMessage = logMessage + argsString + '\n';
            // 输出到控制台
            console.log(logMessage, ...args);
            // 写入文件
            if (this.logStream) {
                this.logStream.write(fullMessage);
            }
        }
    }
    debug(message, ...args) {
        this.log(LogLevel.DEBUG, message, ...args);
    }
    info(message, ...args) {
        this.log(LogLevel.INFO, message, ...args);
    }
    warn(message, ...args) {
        this.log(LogLevel.WARN, message, ...args);
    }
    error(message, ...args) {
        this.log(LogLevel.ERROR, message, ...args);
    }
    // 关闭日志流
    close() {
        if (this.logStream) {
            this.logStream.end();
            this.logStream = null;
        }
    }
}
export const logger = new Logger(process.env.LOG_LEVEL || 'info');
//# sourceMappingURL=logger.js.map
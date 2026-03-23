import {
    get,
    exists,
    urlToFilename,
    recursiveMkdir,
    getPageLinks,
} from "./utils.js";
import { dirname } from "node:path";
import { writeFile, readFile } from "node:fs";
import { EventEmitter } from "node:events";

const url = process.argv[2] || "https://sxyz.blog/";
const maxDepth = parseInt(process.argv[3]) || 3;
const concurrency = parseInt(process.argv[4]) || 2;

class TaskQueue extends EventEmitter {
    constructor(concurrency) {
        super();
        this.queue = [];
        this.running = 0;
        this.done = 0;
        this.concurrency = concurrency;
    }

    push(task) {
        this.queue.push(task);
        process.nextTick(this.next.bind(this));
        return this;
    }

    next() {
        if (this.running === 0 && this.queue.length == 0) {
            return this.emit("empty");
        }
        while (this.running < this.concurrency && this.queue.length > 0) {
            const task = this.queue.shift();
            ++this.running;
            task((err, url) => {
                if (err) {
                    this.emit("error", `Download Error: ${err}`);
                }
                --this.running;
                ++this.done;
                // invoke listeners synchronously !!!
                this.emit("downloaded", this.done, url);
                process.nextTick(this.next.bind(this));
            });
        }
    }

    stats() {
        return {
            running: this.running,
            size: this.queue.length,
        };
    }
}

function spiderRun(url, maxDepth, tasks, callback) {
    const filename = urlToFilename(url);
    exists(filename, (err, alreadyExists) => {
        if (err) {
            return callback(err);
        }

        if (alreadyExists) {
            if (!filename.endsWith(".html")) {
                return callback("not html");
            }
            readFile(filename, "utf8", (err, content) => {
                if (err) {
                    return callback(err);
                }
                spiderLinks(url, content, maxDepth, tasks);
                return callback(null, url);
            });
        }
        console.log(`Downloading ${url} into ${filename}`);
        get(url, (err, result) => {
            if (err) {
                return callback(err);
            }

            recursiveMkdir(dirname(filename), (err) => {
                if (err) {
                    return callback(err);
                }
                writeFile(filename, result, (err) => {
                    if (err) {
                        return callback(err);
                    }
                    if (filename.endsWith(".html")) {
                        spiderLinks(url, result.toString(), maxDepth, tasks);
                    }
                    return callback(null, url);
                });
            });
        });
    });
}

function spiderLinks(currentUrl, body, maxDepth, tasks) {
    if (--maxDepth === 0) {
        return;
    }

    const links = getPageLinks(currentUrl, body);
    if (links.length === 0) {
        return;
    }

    links.forEach((link) => {
        spider(link, maxDepth, tasks);
    });
}

// Run
const clawing = new Set();
function spider(url, maxDepth, tasks) {
    if (clawing.has(url)) {
        return;
    }
    clawing.add(url);

    tasks.push((done) => {
        spiderRun(url, maxDepth, tasks, done);
    });
}
const tasks = new TaskQueue(concurrency);
spider(url, maxDepth, tasks);
tasks.on("error", (err) => console.log(err));
tasks.on("downloaded", (index, url) => console.log(`${index}: ${url}`));
tasks.on("empty", () => console.log("Download Completed!"));

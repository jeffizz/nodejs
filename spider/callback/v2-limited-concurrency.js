import {
    get,
    exists,
    urlToFilename,
    recursiveMkdir,
    getPageLinks,
} from "./utils.js";
import { dirname } from "node:path";
import { writeFile, readFile } from "node:fs";
import { TaskQueue } from "./TaskQueue.js";

const url = process.argv[2] || "https://sxyz.blog/";
const maxDepth = parseInt(process.argv[3]) || 2;
const concurrency = parseInt(process.argv[4]) || 2;

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
            return readFile(filename, "utf8", (err, content) => {
                if (err) {
                    return callback(err);
                }
                spiderLinks(url, content, maxDepth, tasks);
                return callback(null, "read:" + url);
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
                        spiderLinks(url, result.toString("utf8"), maxDepth, tasks);
                    }
                    return callback(null, "down:" + url);
                });
            });
        });
    });
}

function spiderLinks(currentUrl, body, maxDepth, tasks) {
    if (maxDepth === 0) {
        return;
    }

    const links = getPageLinks(currentUrl, body);
    if (links.length === 0) {
        return;
    }

    links.forEach((link) => {
        spider(link, maxDepth - 1, tasks);
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
tasks.on("error", (err) => console.log(err));
tasks.on("downloaded", (index, url) => console.log(`${index}: ${url}`));
tasks.on("empty", () => console.log("Download Completed!"));
spider(url, maxDepth, tasks);

import {
    get,
    exists,
    urlToFilename,
    recursiveMkdir,
    getPageLinks,
} from "./utils.js";
import { dirname } from "node:path";
import { writeFile, readFile } from "node:fs/promises";
import { TaskQueue } from "./TaskQueue.js";

const url = process.argv[2] || "https://sxyz.blog/";
const maxDepth = parseInt(process.argv[3]) || 2;
const concurrency = parseInt(process.argv[4]) || 2;

function spiderRun(url, maxDepth, queue) {

    const filename = urlToFilename(url)

    return exists(filename)
        .then(alreadyExists => {
            if (alreadyExists) {
                if (filename.endsWith(".html")) {
                    return readFile(filename, { encoding: "utf8" }).then(content => {
                        spiderLinks(url, content, maxDepth, queue)
                        return "read:" + url;
                    });
                }
            }

            return download(url, filename).then((content) => {
                spiderLinks(url, content, maxDepth, queue);
                return "down:" + url;
            })
        });
}

function download(url, filename) {

    // Arrow functions without {} implicitly return the result of the expression
    return get(url).then(content =>
        recursiveMkdir(dirname(filename)).then(() =>
            writeFile(filename, content.toString("utf8"))
                .then(() =>
                    content.toString("utf8")
                )
        )
    )

}

function spiderLinks(url, content, maxDepth, queue) {
    if (maxDepth === 0) {
        throw new Error("reach max depth!");
    }

    const links = getPageLinks(url, content);

    links.forEach(link => {
        spider(link, maxDepth - 1, queue)
    })
}


const spidering = new Set();
function spider(url, maxDepth, queue) {

    if (spidering.has(url)) {
        return;
    }

    spidering.add(url);

    queue.push(() => {
        return spiderRun(url, maxDepth, queue);
    })
}

const queue = new TaskQueue(concurrency)
queue.on("error", (err) => console.log(`Download Error: ${err}`))
queue.on("downloaded", (index, url) => console.log(`${index}: ${url}`))
queue.on("empty", () => console.log(`Download Completed!`))
spider(url, maxDepth, queue)

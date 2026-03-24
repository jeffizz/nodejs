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

async function spiderRun(url, maxDepth, queue) {

    const filename = urlToFilename(url);

    if (!filename.endsWith(".html")) {
        return;
    }

    let content
    if (!(await exists(filename))) {
        content = await get(url);
        await recursiveMkdir(dirname(filename));
        await writeFile(filename, content.toString("utf8"));
    }

    if (!content) {
        content = await readFile(filename, { encoding: 'utf8' });
    }

    if (maxDepth == 0) {
        throw new Error("reach max depth")
    }

    const links = getPageLinks(url, content.toString("utf8"));

    links.forEach(link => {
        spider(link, maxDepth - 1, queue)
    })

    return url;
}

const spidering = new Set();
function spider(url, maxDepth, queue) {
    if (spidering.has(url)) {
        return;
    }
    spidering.add(url);
    queue.push(() => spiderRun(url, maxDepth, queue))
}

const queue = new TaskQueue(concurrency)
queue.on("error", (err) => console.log(`Download Error: ${err}`))
queue.on("downloaded", (index, url) => console.log(`${index}: ${url}`))
queue.on("empty", () => console.log(`Download Completed!`))
spider(url, maxDepth, queue)

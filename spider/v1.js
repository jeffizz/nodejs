import {
    get,
    exists,
    urlToFilename,
    recursiveMkdir,
    getPageLinks,
} from "./utils.js";
import { dirname } from "node:path";
import { writeFile, readFile } from "node:fs";

const url = process.argv[2] || "https://sxyz.blog/";
const maxDepth = parseInt(process.argv[3]) || 3;

function spider(url, maxDepth) {
    const filename = urlToFilename(url);
    exists(filename, (err, alreadyExists) => {
        if (err) {
            console.log(err);
            return;
        }
        if (alreadyExists) {
            if (!filename.endsWith(".html")) {
                return;
            }
            readFile(filename, "utf8", (err, content) => {
                if (err) {
                    return;
                }
                spiderLinks(url, content, maxDepth);
            });
        }

        console.log(`Downloading ${url} into ${filename}`);
        get(url, (err, result) => {
            if (err) {
                console.log(err);
                return;
            }

            recursiveMkdir(dirname(filename), (err) => {
                if (err) {
                    console.log(err);
                    return;
                }

                writeFile(filename, result, (err) => {
                    if (err) {
                        console.log(err);
                        return;
                    }
                    spiderLinks(url, result.toString(), maxDepth);
                });
            });
        });
    });
}

function spiderLinks(url, content, maxDepth) {
    const links = getPageLinks(url, content);

    if (--maxDepth === 0) {
        console.log("Reached max depth, skipping", url);
        return;
    }

    links.forEach((link) => {
        spider(link, maxDepth);
    });
}

spider(url, maxDepth);

import { EventEmitter } from "node:events";

export class TaskQueue extends EventEmitter {
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


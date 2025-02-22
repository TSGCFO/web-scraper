interface QueueNode<T> {
    data: T;
    priority: number;
}

export class PriorityQueue<T> {
    private items: QueueNode<T>[];
    private maxSize: number;

    constructor(maxSize: number) {
        this.items = [];
        this.maxSize = maxSize;
    }

    async enqueue(data: T, priority: number): Promise<void> {
        if (this.items.length >= this.maxSize) {
            throw new Error('Queue is full');
        }

        const node: QueueNode<T> = { data, priority };
        let added = false;

        for (let i = 0; i < this.items.length; i++) {
            if (this.items[i].priority > priority) {
                this.items.splice(i, 0, node);
                added = true;
                break;
            }
        }

        if (!added) {
            this.items.push(node);
        }
    }

    async dequeue(): Promise<T | null> {
        if (this.isEmpty()) {
            return null;
        }
        return this.items.shift()!.data;
    }

    peek(): T | null {
        if (this.isEmpty()) {
            return null;
        }
        return this.items[0].data;
    }

    isEmpty(): boolean {
        return this.items.length === 0;
    }

    isFull(): boolean {
        return this.items.length >= this.maxSize;
    }

    size(): number {
        return this.items.length;
    }

    clear(): void {
        this.items = [];
    }

    getItems(): T[] {
        return this.items.map(item => item.data);
    }
}
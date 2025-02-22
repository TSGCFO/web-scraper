import { PriorityQueue } from '../../src/utils/priority-queue';

describe('PriorityQueue', () => {
    let queue: PriorityQueue<string>;
    const maxSize = 5;

    beforeEach(() => {
        queue = new PriorityQueue<string>(maxSize);
    });

    describe('enqueue', () => {
        it('should add items with correct priority order', async () => {
            await queue.enqueue('low', 3);
            await queue.enqueue('high', 1);
            await queue.enqueue('medium', 2);

            expect(queue.getItems()).toEqual(['high', 'medium', 'low']);
        });

        it('should throw error when queue is full', async () => {
            for (let i = 0; i < maxSize; i++) {
                await queue.enqueue(`item${i}`, i);
            }

            await expect(queue.enqueue('overflow', 1)).rejects.toThrow('Queue is full');
        });
    });

    describe('dequeue', () => {
        it('should return null when queue is empty', async () => {
            expect(await queue.dequeue()).toBeNull();
        });

        it('should return items in priority order', async () => {
            await queue.enqueue('low', 3);
            await queue.enqueue('high', 1);
            await queue.enqueue('medium', 2);

            expect(await queue.dequeue()).toBe('high');
            expect(await queue.dequeue()).toBe('medium');
            expect(await queue.dequeue()).toBe('low');
        });
    });

    describe('peek', () => {
        it('should return null when queue is empty', () => {
            expect(queue.peek()).toBeNull();
        });

        it('should return highest priority item without removing it', async () => {
            await queue.enqueue('low', 3);
            await queue.enqueue('high', 1);

            expect(queue.peek()).toBe('high');
            expect(queue.size()).toBe(2);
        });
    });

    describe('size and state checks', () => {
        it('should correctly report empty state', () => {
            expect(queue.isEmpty()).toBe(true);
            expect(queue.size()).toBe(0);
        });

        it('should correctly report full state', async () => {
            for (let i = 0; i < maxSize; i++) {
                await queue.enqueue(`item${i}`, i);
            }

            expect(queue.isFull()).toBe(true);
            expect(queue.size()).toBe(maxSize);
        });
    });

    describe('clear', () => {
        it('should remove all items from queue', async () => {
            await queue.enqueue('item1', 1);
            await queue.enqueue('item2', 2);

            queue.clear();

            expect(queue.isEmpty()).toBe(true);
            expect(queue.size()).toBe(0);
        });
    });
});
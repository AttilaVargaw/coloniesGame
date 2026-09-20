export class LinkedListNode<T> {
    id: string
    _next: LinkedListNode<T> | null = null
    _prev: LinkedListNode<T> | null = null
    data: T

    constructor(id: string, data: any) {
        this.id = id
        this.data = data
    }

    get next() {
        return this._next
    }

    set next(next: LinkedListNode<T> | null) {
        this._next = next
    }
}

export class CumulativeLinkedListIterator<T> implements Iterator<{ data: T; id: string }> {
    next(): IteratorResult<{ data: T; id: string }> {
        if (!this.node?.next) {
            return { value: null, done: true }
        }

        const nextNode = this.node.next
        const mergedData = { ...this.node.data, ...nextNode.data }
        this.node = nextNode

        return { value: { data: mergedData, id: nextNode.id }, done: false }
    }

    constructor(private node: LinkedListNode<T> | null) { }
}

export class CumulativeLinkedList<T> {
    head: LinkedListNode<T> = new LinkedListNode<T>('HEAD', {})

    readonly size: number

    get cumulative() {
        return { [Symbol.iterator]: () => new CumulativeLinkedListIterator(this.head) }
    }

    constructor(o: Record<string, Partial<T>>) {
        const entries = Object.entries(o)

        this.head.next = new LinkedListNode(entries[0][0], entries[0][1])
        this.size = entries.length

        let current = this.head.next

        for(let i = 0; i < entries.length - 1; i++) {
            current.next = new LinkedListNode(entries[i + 1][0], entries[i + 1][1])
            current.next._prev = current
            current = current.next
        }
    }
}

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

export class CumulativeLinkedListIterator<T> implements Iterator<LinkedListNode<T>> {
    next(): IteratorResult<LinkedListNode<T>, any> {
        if(this.node?.next) {
            const data = { ...this.node.data, ...this.node.next.data }
            this.node = this.node.next
            this.node.data = data

            // console.log(this.node.data)

            return { value: this.node, done: false }
        } else {
            return { value: null, done: true }
        }
    }

    constructor(private node: LinkedListNode<T> | null) { }
}

export class CumulativeLinkedList<T> {
    head: LinkedListNode<T> = new LinkedListNode<T>('HEAD', {})

    readonly size: number

    get cumulative() {
        return { [Symbol.iterator]: () => new CumulativeLinkedListIterator(this.head) }
    }

    constructor(o: Record<string, any>) {
        const nodes = Object.values(o)

        this.head.next = new LinkedListNode("", nodes[0])
        this.size = nodes.length

        let current = this.head.next

        for(let i = 0; i < nodes.length - 1; i++) {
            current.next = new LinkedListNode("", nodes[i + 1])
            current.next._prev = current
            current = current.next
        }
    }
}

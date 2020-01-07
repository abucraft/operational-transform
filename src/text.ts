export type OperationType = 'retain' | 'insert' | 'delete'

export type Operation = {
    t: OperationType,
    v: number | string
}

function apply(baseStr: string, ops: Operation[]): string {
    var index = 0;
    for (var i = 0; i < ops.length; i++) {
        var op = ops[i]
        switch (op.t) {
            case 'retain':
                index += op.v as number
                break;
            case 'insert':
                baseStr = baseStr.substring(0, i) + (op.v as string) + baseStr.substring(i)
                index += (op.v as string).length
        }
    }
}
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
                break;
            case 'delete':
                baseStr = baseStr.substring(0, index) + baseStr.substring(index + (op.v as number))
                break;
        }
    }
    return baseStr
}

/**
 * Transform two single operations op1 and op2 based on each other.
 * The return value is [restOp1, restOp2, op2', op1']
 * Because the two operation may not be the exact same length, so there will be one operation left.
 * If op1 length is larger than op2, the rest operation of op1 will be returned by restOp1
 */
export type SingleOperationTransform = (op1: Operation, op2: Operation) => Operation[][]

/**
 * Transform ops1 and ops2, returns a pair of transformed operations ops2' and ops1'.
 * apply(apply(str, ops1), ops2') == apply(apply(str, ops2), ops1')
 * This function assume ops1 happens before ops2
 */
export function transform(ops1: Operation[], ops2: Operation[]): Operation[][] {
    var newOps2: Operation[] = []
    var newOps1: Operation[] = []
    var op1Index = 0
    var op2Index = 0
    var op1: Operation | undefined, op2: Operation | undefined;
    while (op1Index < ops1.length || op2Index < ops2.length) {
        if (op1Index === ops1.length && op1 === undefined) {
            //append all the rest op2 to the newOps2
            append(newOps2, op2)
            appendList(newOps2, ops2.slice(op2Index))
            break;
        }
        if (op2Index === ops2.length && op2 === undefined) {
            append(newOps1, op1)
            appendList(newOps1, ops1.slice(op1Index))
            break;
        }
        // if op1 is undefined, then it will take a new operation from ops1 and increase the index
        op1 = op1 || ops1[op1Index++]
        op2 = op2 || ops2[op2Index++]
        var transformFn = transformMap[op1.t][op2.t]
        var [restOp1, restOp2, transOp2, transOp1] = transformFn(op1, op2)
        op1 = restOp1[0]
        op2 = restOp2[0]
        appendList(newOps2, transOp2)
        appendList(newOps1, transOp1)
    }
    return [newOps2, newOps1]
}

/**
 * Compose two single operations op1 and op2 into one operation.
 * returns [restOp, restOp2, composedOp]
 */
export type SingleOperationCompose = (op1: Operation, op2: Operation) => (Operation | undefined)[]

/**
 * Compose operation ops1 and ops2 return composedOps. So that apply(apply(str, ops1), ops2) == apply(str, composedOps)
 */
export function compose(ops1: Operation[], ops2: Operation[]): Operation[] {

}

/**
 * append operation to an existing operation list
 */
function append(ops: Operation[], op: Operation | undefined): void {
    if (op) {
        if (ops.length > 0 && ops[ops.length - 1].t === op.t) {
            // if op.t is retain or delete, the new value is the sum number
            // if op.t is insert, the new value is concated string
            // both ways is to add
            ops[ops.length - 1].v += op.v as any
        } else ops.push(op)
    }
}

/**
 * append following operation list to an existing one
 */
function appendList(ops: Operation[], newOps: Operation[]): void {
    if (newOps.length > 0) {
        append(ops, newOps[0])
        var rest = newOps.slice(1)
        ops.splice(ops.length, 0, ...rest)
    }
}

const InsertInsertTransform: SingleOperationTransform = (op1, op2) => {
    return [
        [], [],
        [{ t: "retain", v: (op1.v as string).length }, op2],
        [op1]
    ]
}

const InsertRetainTransform: SingleOperationTransform = (op1, op2) => {
    return [
        [],
        [op2],
        [{ t: "retain", v: (op1.v as string).length }],
        [op1]
    ]
}

const InsertDeleteTransform: SingleOperationTransform = (op1, op2) => {
    return [
        [], [],
        [{ t: "retain", v: (op1.v as string).length }, op2],
        [op1]
    ]
}

const DeleteInsertTransform: SingleOperationTransform = (op1, op2) => {
    return [
        [], [],
        [op2],
        [{ t: "retain", v: (op2.v as string).length }, op1]
    ]
}

const DeleteRetainTransform: SingleOperationTransform = (op1, op2) => {
    var diff = op1.v as number - (op2.v as number)
    return [
        diff > 0 ? [{ t: "delete", v: diff }] : [],
        diff < 0 ? [{ t: "retain", v: -diff }] : [],
        [],
        diff > 0 ? [{ t: "delete", v: op2.v }] : [op1]
    ]
}

const DeleteDeleteTransform: SingleOperationTransform = (op1, op2) => {
    var diff = op1.v as number - (op2.v as number)
    return [
        diff > 0 ? [{ t: "delete", v: diff }] : [],
        diff < 0 ? [{ t: "delete", v: -diff }] : [],
        [], []
    ]
}

const RetainInsertTransform: SingleOperationTransform = (op1, op2) => {
    return [
        [op1],
        [],
        [op2],
        [{ t: "retain", v: op2.v }]
    ]
}

const RetainRetainTransform: SingleOperationTransform = (op1, op2) => {
    var diff = op1.v as number - (op2.v as number)
    return [
        diff > 0 ? [{ t: "retain", v: diff }] : [],
        diff < 0 ? [{ t: "retain", v: -diff }] : [],
        [], []
    ]
}

const RetainDeleteTransform: SingleOperationTransform = (op1, op2) => {
    var diff = op1.v as number - (op2.v as number)
    return [
        diff > 0 ? [{ t: "retain", v: diff }] : [],
        diff < 0 ? [{ t: "delete", v: -diff }] : [],
        diff < 0 ? [{ t: "delete", v: op1.v }] : [op2],
        []
    ]
}

const transformMap = {
    "insert": {
        "insert": InsertInsertTransform,
        "retain": InsertRetainTransform,
        "delete": InsertDeleteTransform
    },
    "delete": {
        "insert": DeleteInsertTransform,
        "retain": DeleteRetainTransform,
        "delete": DeleteDeleteTransform
    },
    "retain": {
        "insert": RetainInsertTransform,
        "retain": RetainRetainTransform,
        "delete": RetainDeleteTransform
    }
}

const InsertInsertCompose: SingleOperationCompose = (op1, op2) => [undefined, undefined, { t: "insert", v: (op2.v as string) + (op1.v as string) }]
const InsertRetainCompose: SingleOperationCompose = (op1, op2) => [undefined, op2, op1]
const InsertDeleteCompose: SingleOperationCompose = (op1, op2) => {
    var diff = (op1.v as string).length - (op2.v as number)
    return [
        diff > 0 ? { t: "insert", v: (op1.v as string).slice(op2.v as number) } : undefined,
        diff < 0 ? { t: "delete", v: -diff } : undefined,
        undefined
    ]
}

const RetainInsertCompose: SingleOperationCompose = (op1, op2) => [op1, undefined, op2]
const RetainRetainCompose: SingleOperationCompose = (op1, op2) => {
    var diff = (op1.v as number) - (op2.v as number)
    return [
        diff > 0 ? { t: "retain", v: diff } : undefined,
        diff < 0 ? { t: "retain", v: -diff } : undefined,
        { t: "retain", v: Math.min(op1.v as number, op2.v as number) }
    ]
}
const RetainDeleteCompose: SingleOperationCompose = (op1, op2) => {
    var diff = (op1.v as number) - (op2.v as number)
    return [
        diff > 0 ? { t: "retain", v: diff } : undefined,
        diff < 0 ? { t: "delete", v: -diff } : undefined,
        { t: "delete", v: Math.min(op1.v as number, op2.v as number) }
    ]
}

const composeMap = {
}
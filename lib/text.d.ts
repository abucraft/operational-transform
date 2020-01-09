export declare type OperationType = 'retain' | 'insert' | 'delete';
export declare type Operation = {
    t: OperationType;
    v: number | string;
};
export declare function apply(baseStr: string, ops: Operation[]): string;
/**
 * Transform two single operations op1 and op2 based on each other.
 * The return value is [restOp1, restOp2, op2', op1']
 * Because the two operation may not be the exact same length, so there will be one operation left.
 * If op1 length is larger than op2, the rest operation of op1 will be returned by restOp1
 */
export declare type SingleOperationTransform = (op1: Operation, op2: Operation) => Operation[][];
/**
 * Transform ops1 and ops2, returns a pair of transformed operations ops2' and ops1'.
 * apply(apply(str, ops1), ops2') == apply(apply(str, ops2), ops1')
 * This function assume ops1 happens before ops2
 */
export declare function transform(ops1: Operation[], ops2: Operation[]): Operation[][];
/**
 * Compose two single operations op1 and op2 into an operation list.
 * returns [restOps1, restOps2, composedOps]
 */
export declare type SingleOperationCompose = (op1: Operation, op2: Operation) => Operation[][];
/**
 * Compose operation ops1 and ops2 return composedOps. So that apply(apply(str, ops1), ops2) == apply(str, composedOps)
 */
export declare function compose(ops1: Operation[], ops2: Operation[]): Operation[];

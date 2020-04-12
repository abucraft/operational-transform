import { apply, transform, Operation, compose, transformOnce, append } from './text';

const ChannelHeight = 150;

enum ClientState {
    Synchronized,
    Awaiting,
    AwaitingWithBuffer
}

type Message = {
    version?: number
    clientName?: string
    operations: Operation[]
}
class Channel {
    client: Client
    server: Server
    clientMessageList: Message[]
    serverMessageList: Message[]
    clientReceiveDisabled: boolean = false
    constructor(c: Client, s: Server) {
        this.client = c
        this.server = s
        this.client.attachChanel(this)
        this.server.attachChanel(this)
        this.clientMessageList = []
        this.serverMessageList = []
    }

    clientSendMessage(m: Message) {
        this.clientMessageList.push(m)
    }

    acceptClientMessage() {
        var m = this.clientMessageList.shift()
        m && this.server.onReceiveMessage(m)
    }

    serverSendMessage(m: Message) {
        this.serverMessageList.push(m)
    }

    acceptServerMessage() {
        if (!this.clientReceiveDisabled) {
            var m = this.serverMessageList.shift()
            m && this.client.onReceiveMessage(m)
        }
    }

    disableClientReceive() {
        this.clientReceiveDisabled = true
    }

    enableClientReceive() {
        this.clientReceiveDisabled = false
    }

}

abstract class ChanelEndPoint {
    abstract attachChanel(c: Channel): void
    abstract onReceiveMessage(m: Message): void
}
class Client extends ChanelEndPoint {
    version = 0;
    text: string;
    name: string;
    sentOutOperations: Operation[] = []
    operationBuffer: Operation[] = []
    channel?: Channel

    constructor(name: string, t: string) {
        super()
        this.name = name
        this.text = t
    }

    attachChanel(c: Channel) {
        this.channel = c
    }

    onClientChange(operations: Operation[]) {
        if (operations.length === 0) {
            return;
        }
        if (this.sentOutOperations.length === 0) {
            var message: Message = {
                version: this.version,
                clientName: this.name,
                operations: [...operations]
            }
            this.channel?.clientSendMessage(message)
            this.sentOutOperations = operations
        } else {
            // console.log(operations)
            this.operationBuffer = compose(this.operationBuffer, operations)
        }
    }

    onReceiveMessage(m: Message) {
        if (m.clientName === this.name) {
            this.sentOutOperations = []
            this.version = m.version as number
            if (this.sentOutOperations.length) {
                this.sentOutOperations = []
            }
            if (this.operationBuffer.length) {
                var message: Message = {
                    version: this.version,
                    clientName: this.name,
                    operations: this.operationBuffer
                }
                this.channel?.clientSendMessage(message)
                this.sentOutOperations = this.operationBuffer
                this.operationBuffer = []
            }
        }
    }

    getClientState() {
        if (this.sentOutOperations.length === 0) {
            return ClientState.Synchronized
        } else if (this.operationBuffer.length === 0) {
            return ClientState.Awaiting
        } else return ClientState.AwaitingWithBuffer
    }
}

abstract class Server extends ChanelEndPoint {
    channels: Channel[] = []
    operationsList: Message[] = []
    version: number = 0
    text: string

    constructor(t: string) {
        super()
        this.text = t
    }

    attachChanel(c: Channel) {
        this.channels.push(c)
    }
}

function operationsToHtmlStr(operations: Operation[]): string {
    return operations.map(op => {
        let strcontent = op.t === "insert" ? visualizeLB(op.v as string) : op.v
        return `<span title="${strcontent}" class="${op.t} op-text">${op.t}("${strcontent}")</span>`
    }).join('')
}


function visualizeLB(str: string) {
    return str.replace(/\n/g, '\\n')
}

function createMessagePopOverContent(m: Message) {
    return $(`<table class="table table-condensed table-noheader">
        ${m.clientName !== undefined ? `<tr><td><strong>Author</strong></td><td>${m.clientName}</td></tr>` : ""}
        ${m.version !== undefined ? `<tr><td><strong>Revision</strong></td><td>${m.version}</td></tr>` : ""}
        <tr><td><strong>Changeset</strong></td><td>${operationsToHtmlStr(m.operations)}</td></tr>
        </table>`)[0]
}

type JQueryElement = any

const MessageAnimationTime = 500

class ChannelUI extends Channel {
    node: HTMLElement
    clientMessageElements: JQueryElement[] = []
    serverMessageElements: JQueryElement[] = []
    constructor(node: HTMLElement, c: Client, s: Server) {
        super(c, s)
        this.node = node
        $(node).css("height", `${ChannelHeight}px`)
    }

    clientSendMessage(m: Message) {
        super.clientSendMessage(m)
        var messageElement = $(`<div class="message ${m.clientName}" style="top:${ChannelHeight + 50}px;"></div>`)
        $(this.node).find(".up .connection").append(messageElement)
        messageElement.popover({
            title: 'Operation',
            trigger: 'hover',
            html: true,
            content: createMessagePopOverContent(m)
        })
        setTimeout(() => {
            messageElement.css("top", `${ChannelHeight / 2}px`)
        }, 10)
        this.clientMessageElements.push(messageElement)
        this.enableClientSend()
    }

    enableClientSend() {
        let that = this
        $(that.node).find('.up a').removeClass("disabled").click(function () {
            var sentElment = that.clientMessageElements.shift()
            sentElment.css("top", "-50px")
            setTimeout(() => {
                that.acceptClientMessage()
                sentElment.popover('destroy')
                sentElment.remove()
            }, MessageAnimationTime)
        })
    }

    acceptClientMessage() {
        super.acceptClientMessage()
        $(this.node).find('.up a').addClass("disabled").off('click')
    }

    serverSendMessage(m: Message) {
        super.serverSendMessage(m)
        var messageElement = $(`<div class="message ${m.clientName}${m.version}" style="top:${-50}px;"></div>`)
        messageElement.popover({
            title: 'Operation',
            trigger: 'hover',
            html: true,
            content: createMessagePopOverContent(m)
        })
        $(this.node).find(".down .connection").append(messageElement)
        this.serverMessageElements.push(messageElement)
        setTimeout(() => {
            this.adjustServerMessagePosition()
        }, 10)
        this.enableClientReceive()
    }

    adjustServerMessagePosition() {
        var padding = 30
        var restHeight = ChannelHeight - 2 * padding
        var gap = restHeight / (this.serverMessageElements.length + 1)
        this.serverMessageElements.forEach((element, idx) => {
            element.css('top', `${padding + (this.serverMessageElements.length - idx) * gap}px`)
        })
    }

    acceptServerMessage() {
        super.acceptServerMessage()
        if (this.serverMessageElements.length === 0) {
            this.disableClientReceive()
        }
    }

    disableClientReceive() {
        super.disableClientReceive()
        $(this.node).find('.down a').addClass('disabled').off('click')
    }

    enableClientReceive() {
        let that = this
        let arrow = $(that.node).find('.down a')
        super.enableClientReceive()
        if (arrow.hasClass('disabled')) {
            arrow.removeClass("disabled").click(function () {
                var sentElment = that.serverMessageElements.shift()
                sentElment.css("top", `${ChannelHeight + 50}px`)
                that.adjustServerMessagePosition()
                setTimeout(() => {
                    that.acceptServerMessage()
                    sentElment.popover('destroy')
                    sentElment.remove()
                }, MessageAnimationTime)
            })
        }
    }
}

type LabelOperations = {
    label?: string
    operations: Operation[]
}

const VisibleOpBlockCount = 4
const OpBlockHeight = 30
const OperationWidth = 350
const pipeAreaHeight = 150
const PipeAnimationTime = 600
const OpsBlockAnimationTime = 400

function cloneOperations(ops: LabelOperations) {
    ops.operations = [...ops.operations]
}

class TransformModal {
    beforeOperations: LabelOperations[]
    afterOperations: LabelOperations[]
    transformedBeforeOps: LabelOperations[] = []
    transformedAfterOps: LabelOperations[] = []
    onFinish?: (transformedAfterOps: LabelOperations[], transformedBeforeOps: LabelOperations[]) => void
    constructor(beforeOperations: LabelOperations[], afterOperations: LabelOperations[]) {
        this.beforeOperations = beforeOperations
        this.afterOperations = afterOperations
        this.beforeOperations.forEach(cloneOperations)
        this.afterOperations.forEach(cloneOperations)
        var modalElm = $("#transformModal")
        if (modalElm.css("display") !== "none") {
            throw "Transform Modal is already opened"
        }
        if (beforeOperations.length === 0 || afterOperations.length === 0) {
            throw "Transform operations must not be empty"
        }
        setTimeout(() => {
            modalElm.modal("show")
            modalElm.find('.finish-btn').attr('disabled', true)

            modalElm.find(`.transform-area .processing .operations-area>div>div`).css("height", `${VisibleOpBlockCount * OpBlockHeight}px`)

            var currentBeforeOps = this.beforeOperations.shift() as LabelOperations
            var currentAfterOps = this.afterOperations.shift() as LabelOperations;
            function createOpsBlocks(opss: LabelOperations[], position: 'left' | 'right') {
                opss.unshift = function (ops) {
                    var opsBlock = $(`<div class="ops-block" style="left:0px">${ops.label}</div>`)
                    opsBlock.css('left', `-${OperationWidth}px`)
                    modalElm.find(`.transform-area.before .waiting .${position}`).append(opsBlock)
                    setTimeout(() => {
                        opsBlock.css('left', '0px')
                    }, 10)
                    return Array.prototype.unshift.call(this, ops)
                }
                opss.shift = function () {
                    var ops = Array.prototype.shift.call(this)
                    if (ops) {
                        modalElm.find(`.transform-area.before .waiting .${position} div`).last().remove()
                    }
                    return ops
                }
                return opss.map(ops => {
                    return modalElm.find(`.transform-area.before .waiting .${position}`).prepend(`<div class="ops-block" style="left:0px">${ops.label}</div>`)
                })
            }

            createOpsBlocks(this.beforeOperations, 'left');
            createOpsBlocks(this.afterOperations, 'right');

            function opValueToString(op: Operation) {
                return `${op.t === "insert" ? '"' + op.v + '"' : op.v}`
            }
            function createOpBlock(op: Operation) {
                return $(`<div class="op-block ${op.t}" title="${op.v}">${opValueToString(op)}</div>`)
            }
            function initOpBlocks(ops: LabelOperations, position: 'left' | 'right') {
                modalElm.find(`.transform-area.before .processing .title .${position}`).text(ops.label)
                var operations = ops.operations
                var currentWaitingOpBlock: JQueryElement = null
                var currentBlocks: JQueryElement[] = []
                for (let i = 0; i < operations.length; i++) {
                    let block = createOpBlock(operations[i])
                    modalElm.find(`.transform-area.before .processing .operations-area .${position}`).prepend(block)
                    currentBlocks.push(block)
                }
                if (operations.length > VisibleOpBlockCount) {
                    currentWaitingOpBlock = $('<div class="op-block collapse">...</div>')
                    currentWaitingOpBlock.css('top', `-${OpBlockHeight}px`)
                    modalElm.find(`.transform-area.before .processing .operations-area .${position}`).prepend(currentWaitingOpBlock)
                    setTimeout(() => {
                        currentWaitingOpBlock && currentWaitingOpBlock.css('top', '0px')
                    }, 10)
                }
                operations.shift = function () {
                    if (this.length > 0) {
                        var elm = currentBlocks.shift()
                        elm.css("bottom", '0px')
                        setTimeout(() => {
                            elm.css("bottom", `-${OpBlockHeight}px`)
                            setTimeout(() => {
                                elm.remove()
                            }, 200)
                        }, 10)
                    }
                    var op = Array.prototype.shift.apply(this)
                    if (this.length == VisibleOpBlockCount) {
                        let animatingBlock = currentWaitingOpBlock
                        animatingBlock.css('top', '0px')
                        setTimeout(() => {
                            animatingBlock.remove()
                        }, 200)
                        currentWaitingOpBlock = null
                    }
                    return op
                }
                operations.unshift = function (op) {
                    var newElm = createOpBlock(op)
                    newElm.css("left", `-${OperationWidth}px`)
                    newElm.css("position", "absolute")
                    modalElm.find(`.transform-area.before .processing .operations-area .${position}`).append(newElm)
                    currentBlocks.unshift(newElm)
                    setTimeout(() => {
                        newElm.css("left", `0px`)
                        setTimeout(() => {
                            newElm.css('position', '')
                        }, 200)
                    }, 10)
                    if (currentBlocks.length > VisibleOpBlockCount) {
                        if (currentWaitingOpBlock === null) {
                            currentWaitingOpBlock = $('<div class="op-block collapse">...</div>')
                            currentWaitingOpBlock.css('top', `-${OpBlockHeight}px`)
                            modalElm.find(`.transform-area.before .processing .operations-area .${position}`).prepend(currentWaitingOpBlock)
                            setTimeout(() => {
                                currentWaitingOpBlock && currentWaitingOpBlock.css('top', '0px')
                            }, 10)
                        }
                    }
                    Array.prototype.unshift.call(this, op)
                    return 1
                }
            }
            initOpBlocks(currentBeforeOps as LabelOperations, 'left')
            initOpBlocks(currentAfterOps as LabelOperations, 'right')

            var transformedBeforeOps: Operation[] = []
            var transformedAfterOps: Operation[] = []
            var transformedBeforeBlocks: LabelOperations[] = []
            var transformedAfterBlocks: LabelOperations[] = []

            function bindTransformedBlocks(blocks: LabelOperations[], position: 'left' | 'right') {
                blocks.push = function (block) {
                    modalElm.find(`.transform-area.after .waiting .${position}`).prepend(`<div class="ops-block" style="left:0px">${block.label}</div>`)
                    return Array.prototype.push.call(this, block)
                }
                blocks.shift = function () {
                    var oldBlock = modalElm.find(`.transform-area.after .waiting .${position} > *`).last()
                    setTimeout(() => {
                        oldBlock.css('left', `-${OperationWidth}px`)
                        setTimeout(() => {
                            oldBlock.remove()
                        }, OpsBlockAnimationTime)
                    }, 10)
                    return Array.prototype.shift.apply(this)
                }
            }
            bindTransformedBlocks(transformedBeforeBlocks, 'left')
            bindTransformedBlocks(transformedAfterBlocks, 'right')
            bindTransformedOps(transformedBeforeOps, 'left')
            bindTransformedOps(transformedAfterOps, 'right')

            function displayTranslateElm(op: Operation, position: 'left' | 'right', cb?: () => void) {
                var translateElm = createOpBlock(op)
                modalElm.find('.transform-btn').attr('disabled', true)
                modalElm.find(`.transform-area.after .pipe-area .${position}`).prepend(translateElm)
                translateElm.css('top', '0px')
                setTimeout(() => {
                    translateElm.css("top", `${pipeAreaHeight}px`)
                    setTimeout(() => {
                        translateElm.remove()
                        modalElm.find('.transform-btn').attr('disabled', false)
                        cb && cb()
                    }, PipeAnimationTime)
                }, 10)
            }

            function bindTransformedOps(ops: Operation[], position: 'left' | 'right') {
                var collapsedBock: any = null
                ops.push = function (op) {
                    var index = this.length
                    displayTranslateElm(op, position, () => {
                        var elm = createOpBlock(op)
                        elm.addClass(`op${index}`);
                        elm.css('top', `-${OpBlockHeight}px`)
                        modalElm.find(`.transform-area.after .operations-area .${position}`).prepend(elm)
                        setTimeout(() => {
                            elm.css("top", "0px")
                        }, 10)
                    })
                    if (index === VisibleOpBlockCount) {
                        if (collapsedBock === null) {
                            collapsedBock = $('<div class="op-block collapse">...</div>')
                            collapsedBock.css("bottom", `-${OpBlockHeight}px`)
                            modalElm.find(`.transform-area.after .processing .operations-area .${position}`).prepend(collapsedBock)
                            setTimeout(() => {
                                collapsedBock.css("bottom", "0px")
                            }, 10)
                        }
                    }
                    return Array.prototype.push.call(this, op)
                }
            }

            function appendToTransformedOps(operations: Operation[], transOps: Operation[], position: 'left' | 'right') {
                var previousLength = operations.length
                transOps.forEach(op => {
                    let beforeLength = operations.length
                    append(operations, op)
                    if (beforeLength === operations.length) {
                        displayTranslateElm(op, position)
                    }
                })
                if (previousLength > 0) {
                    let previousOp = operations[previousLength - 1]
                    setTimeout(() => {
                        modalElm.find(`.transform-area.after .operations-area .${position} .op${previousLength - 1}`).text(opValueToString(previousOp))
                    }, PipeAnimationTime)
                }
            }

            function clearAfterOperationsArea() {
                modalElm.find('.transform-area.after .operations-area .left').empty()
                modalElm.find('.transform-area.after .operations-area .right').empty()
            }

            modalElm.find('.transform-btn').click(() => {
                if (currentBeforeOps.operations.length === 0 && currentAfterOps.operations.length === 0) {
                    var before = { label: currentBeforeOps.label + "'", operations: transformedBeforeOps }
                    var after = { label: currentAfterOps.label + "'", operations: transformedAfterOps }
                    clearAfterOperationsArea()
                    transformedBeforeOps = []
                    transformedAfterOps = []
                    bindTransformedOps(transformedBeforeOps, 'left')
                    bindTransformedOps(transformedAfterOps, 'right')

                    transformedBeforeBlocks.push(before)
                    transformedAfterBlocks.push(after)
                    if (this.afterOperations.length > 0) {
                        transformedBeforeBlocks.shift()
                        this.beforeOperations.unshift(before)
                    } else if (this.beforeOperations.length > 0) {
                        while (transformedAfterBlocks.length > 0) {
                            var ops = transformedAfterBlocks.shift() as LabelOperations
                            this.afterOperations.push(ops)
                        }
                    }
                    if (this.beforeOperations.length !== 0) {
                        currentBeforeOps = this.beforeOperations.shift() as LabelOperations
                        currentAfterOps = this.afterOperations.shift() as LabelOperations
                        initOpBlocks(currentBeforeOps, 'left')
                        initOpBlocks(currentAfterOps, 'right')
                    } else {
                        modalElm.find('.finish-btn').attr('disabled', false)
                        modalElm.find('.transform-btn').attr('disabled', true)
                        modalElm.find('.finish-btn').click(() => {
                            this.onFinish && this.onFinish(transformedAfterBlocks, transformedBeforeBlocks)
                            modalElm.find('.finish-btn').off()
                            modalElm.find('.transform-btn').off()
                            modalElm.find('.transform-btn').attr('disabled', false)
                            modalElm.find('.transform-area.after .waiting>div').empty()
                            modalElm.modal("hide")
                        })

                    }
                } else {
                    var [transOp2, transOp1] = transformOnce(currentBeforeOps?.operations, currentAfterOps?.operations)
                    appendToTransformedOps(transformedBeforeOps, transOp1, 'left')
                    appendToTransformedOps(transformedAfterOps, transOp2, 'right')
                }
            })
        }, 1)
    }
}

//Only for single insert/remove operation
function getChangeSet(textBefore: string, textAfter: string): Operation[] {
    var retain = 0
    var idx1 = 0
    var idx2 = 0
    // console.log("Before: ", textBefore)
    // console.log("After: ", textAfter)
    while (idx1 < textBefore.length && idx2 < textAfter.length) {
        if (textBefore[idx1] === textAfter[idx2]) {
            retain++;
            idx1++;
            idx2++;
        } else {
            break;
        }
    }
    var retainOps = retain !== 0 ? [{ t: "retain", v: retain } as Operation] : []

    if (textBefore.length >= textAfter.length) {
        // maybe both delete and insert
        var deleteCount = textBefore.length - textAfter.length
        idx1 = idx1 + deleteCount
        var insertIdx = idx2
        var insertLength = 0
        while (idx1 < textBefore.length && idx2 < textAfter.length) {
            if (textBefore[idx1] !== textAfter[idx2]) {
                idx1++;
                idx2++;
                deleteCount++;
                insertLength++;
            } else {
                break;
            }
        }
        var insertOps = insertLength !== 0 ? [{ t: "insert", v: textAfter.substr(insertIdx, insertLength) } as Operation] : []
        return [...retainOps, { t: "delete", v: deleteCount }, ...insertOps]
    } else {
        return [...retainOps, { t: "insert", v: textAfter.substr(retain, textAfter.length - textBefore.length) }]
    }
}


class ClientUI extends Client {
    node: HTMLElement
    codeMirror: any
    changeTriggerByCode: boolean = false
    constructor(node: HTMLElement, name: string, t: string) {
        super(name, t)
        this.node = node
        $(node).find('.name').text(name)
        this.syncStatusUI()
        this.codeMirror = CodeMirror($(node).find('.text-input')[0], {
            lineNumbers: true,
            lineWrapping: true,
            value: t
        })

        this.codeMirror.on("change", (cm: any, changeObj: any) => {
            if (!this.changeTriggerByCode) {
                var changedText = cm.getValue()
                var operations = getChangeSet(this.text, changedText)
                this.text = changedText
                this.onClientChange(operations)
            } else {
                this.changeTriggerByCode = false
            }
        })
    }

    setValue(t: string) {
        this.changeTriggerByCode = true
        this.codeMirror.setValue(t)
    }

    onClientChange(operations: Operation[]) {
        super.onClientChange(operations)
        this.syncStatusUI()
    }

    syncStatusUI() {
        var stateArea = $(this.node).find('.state-area')
        $(this.node).find('.state-area .message').popover('destroy')
        $(this.node).find(".revision-area").text(this.version.toString())
        stateArea.empty()
        if (this.sentOutOperations.length) {
            var amdiv = $(`<div class="message ${this.name}"></div>`).popover({
                title: 'Operation',
                trigger: 'hover',
                html: true,
                content: createMessagePopOverContent({
                    operations: this.sentOutOperations
                })
            })
            stateArea.append(amdiv)
        }
        var state = super.getClientState()
        var statestr = ""
        switch (state) {
            case ClientState.Awaiting:
                statestr = "Awaiting"
                break;
            case ClientState.AwaitingWithBuffer:
                statestr = "Awaiting With Buffer"
                break;
            case ClientState.Synchronized:
                statestr = "Synchronized"
                break
        }
        stateArea.append(`<span>${statestr}</span>`)
        if (this.operationBuffer.length) {
            var bfdiv = $(`<div class="message ${this.name}"></div>`).popover({
                title: 'Operation',
                trigger: 'hover',
                html: true,
                content: createMessagePopOverContent({
                    operations: this.operationBuffer
                })
            })
            stateArea.append(bfdiv)
        }
    }

    onReceiveMessage(m: Message) {
        super.onReceiveMessage(m)
        if (m.clientName === this.name) {
            this.syncStatusUI()
        } else {
            if (this.getClientState() === ClientState.Synchronized) {
                this.text = apply(this.text, m.operations)
                this.setValue(this.text)
                this.version = m.version || 0
                this.syncStatusUI()
            } else {
                this.channel?.disableClientReceive()
                var selfOperations: LabelOperations[] = []
                if (this.sentOutOperations.length) {
                    selfOperations.push({
                        label: "Sent Out Operations",
                        operations: this.sentOutOperations
                    })
                }
                if (this.operationBuffer.length) {
                    selfOperations.push({
                        label: "Pending Operations",
                        operations: this.operationBuffer
                    })
                }
                var modal = new TransformModal([{ label: m.clientName, operations: m.operations }], selfOperations)
                modal.onFinish = (transformedAfterOps, transformedBeforeOps) => {
                    transformedBeforeOps.forEach(lbop => {
                        this.text = apply(this.text, lbop.operations)
                    })
                    this.setValue(this.text)
                    transformedAfterOps.forEach((lbop, index) => {
                        if (index === 0) {
                            this.sentOutOperations = lbop.operations
                        }
                        if (index === 1) {
                            this.operationBuffer = lbop.operations
                        }
                    })
                    this.syncStatusUI()
                    this.channel?.enableClientReceive()
                }
            }
        }
    }
}

class ServerUI extends Server {
    messageElements: JQueryElement[] = []
    node: HTMLElement
    constructor(node: HTMLElement, t: string) {
        super(t)
        this.node = node
        $(this.node).find('.content-area').text(this.text)
        $(this.node).find('.revision-area').text(this.version.toString())
    }

    applyLabelOperation(lbop: LabelOperations, clientName: string) {
        this.text = apply(this.text, lbop.operations)
        this.version++;
        var transformedOpMsg = {
            clientName: clientName,
            version: this.version,
            operations: lbop.operations
        }
        var newMsgElm = $(`<div class="message ${clientName}-${this.version}"></div>`).popover({
            title: 'Operation',
            trigger: 'hover',
            html: true,
            content: createMessagePopOverContent(transformedOpMsg)
        })
        $(this.node).find('.history-area').append(newMsgElm)
        this.messageElements.push(newMsgElm)
        this.operationsList.push(transformedOpMsg)
        $(this.node).find('.content-area').text(this.text)
        $(this.node).find('.revision-area').text(this.version.toString())
        this.channels.forEach((ch) => {
            ch.serverSendMessage(transformedOpMsg)
        })
    }

    onReceiveMessage(m: Message) {
        var clientVersion = m.version || 0
        if (clientVersion === this.version) {
            this.applyLabelOperation({ label: m.clientName, operations: m.operations }, m.clientName as string)
        } else {
            var composedBeforeOperations: Operation[] = []
            for (var i = clientVersion; i < this.version; i++) {
                composedBeforeOperations = compose(composedBeforeOperations, this.operationsList[i].operations)
            }
            var modal = new TransformModal([{ label: "Previous Operations", operations: composedBeforeOperations }], [{ label: m.clientName, operations: m.operations }])
            modal.onFinish = (transformedAfterOps, transformedBeforeOps) => {
                transformedAfterOps.forEach(lbop => {
                    this.applyLabelOperation(lbop, m.clientName as string)
                })
            }
        }
    }
}


$("#transformModal").modal({ backdrop: 'static', keyboard: false, show: false })

$('.client-container').clone().appendTo('.clients-container')
var initText = "hello world"
var client1 = new ClientUI($('.client')[0], 'Alice', initText)
var client2 = new ClientUI($('.client')[1], 'Bob', initText)
var server = new ServerUI($('#server')[0], initText)
var chanel1 = new ChannelUI($('.chanels')[0], client1, server)
var chanel2 = new ChannelUI($('.chanels')[1], client2, server)
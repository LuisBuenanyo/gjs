/*
 * Copyright (c) 2015 Endless Mobile, Inc.
 *
 * Permission is hereby granted, free of charge, to any person obtaining a copy
 * of this software and associated documentation files (the "Software"), to
 * deal in the Software without restriction, including without limitation the
 * rights to use, copy, modify, merge, publish, distribute, sublicense, and/or
 * sell copies of the Software, and to permit persons to whom the Software is
 * furnished to do so, subject to the following conditions:
 *
 * The above copyright notice and this permission notice shall be included in
 * all copies or substantial portions of the Software.
 *
 * THE SOFTWARE IS PROVIDED "AS IS", WITHOUT WARRANTY OF ANY KIND, EXPRESS OR
 * IMPLIED, INCLUDING BUT NOT LIMITED TO THE WARRANTIES OF MERCHANTABILITY,
 * FITNESS FOR A PARTICULAR PURPOSE AND NONINFRINGEMENT. IN NO EVENT SHALL THE
 * AUTHORS OR COPYRIGHT HOLDERS BE LIABLE FOR ANY CLAIM, DAMAGES OR OTHER
 * LIABILITY, WHETHER IN AN ACTION OF CONTRACT, TORT OR OTHERWISE, ARISING
 * FROM, OUT OF OR IN CONNECTION WITH THE SOFTWARE OR THE USE OR OTHER DEALINGS
 * IN THE SOFTWARE.
 *
 * Authored By: Sam Spilsbury <sam@endlessm.com>
 */

const __debugger = new Debugger(debuggee);

function _copyProperties(properties, from, to) {
    for (let prop of properties) {
        if (!from.hasOwnProperty(prop))
            throw new Error("Assertion failure: required property " + required);
        to[prop] = from[prop];
    }
}

function _StopInfo(infoProperties) {
    _copyProperties(['what', 'type', 'url', 'line', 'func'],
                    infoProperties,
                    this);
}

function _createStopInfoForFrame(what, type, frame) {
    let name = frame.callee ? (frame.callee.name ? frame.callee.name : "(anonymous)") : "(toplevel)";

    return new _StopInfo({
        what: what,
        type: type,
        url: frame.script.url,
        line: frame.script.getOffsetLine(frame.offset),
        func: name
    })
}

function _createEnum() {
    const argumentsLen = arguments.length;
    let enumObject = {};
    let index = 0;

    while (index !== arguments.length) {
        enumObject[arguments[index]] = index;
        index++;
    }

    return enumObject;
}

const DebuggerEventTypes = _createEnum('FRAME_ENTERED');

function DebuggerCommandController(onStop) {

    /* Some matchers. If a command satisfies the matcher property
     * then recurse into the value properties or apply th
     * remaining arguments to the function */
    const Exactly = function(node, array) {
        if (array.length > 0)
            return array[0] === node;
        return false;
    };

    const NoneRemaining = function(node, array) {
        return array.length === 0;
    };

    /* Handlers for various debugger actions */
    const onFrameEntered = function(frame) {
        onStop(_createStopInfoForFrame('Frame entered',
                                       DebuggerEventTypes.FRAME_ENTERED,
                                       frame))
        return undefined;
    };

    /* A map of commands to syntax tree / function. This is traversed
     * in process(). Each property name in a tree corresponds to a
     * matcher name defined in matchers. If, upon calling the function
     * specified by that name, the result is true, then continue to
     * traverse the tree. If the value is an object, then it is
     * traversed as a sub-tree with the front of the array popped
     * off. If it is a function, then the function is applied to
     * the array */
    const commands = {
        step: {
            match: Exactly,
            tree: {
                frame: {
                    match: Exactly,
                    tree: {
                        _: {
                            match: NoneRemaining,
                            func: function() {
                                __debugger.onEnterFrame = onFrameEntered;
                            }
                        }
                    }
                }
            }
        },
        disable: {
            match: Exactly,
            tree: {
                step: {
                    match: Exactly,
                    tree: {
                        frame: {
                            match: Exactly,
                            tree: {
                                _: {
                                    match: NoneRemaining,
                                    func: function() {
                                        __debugger.onEnterFrame = undefined;
                                    }
                                }
                            }
                        }
                    }
                }
            }
        }
    };

    const process = function(tree, commandArray) {
        Object.keys(tree).forEach(function(key) {
            if (tree[key].match(key, commandArray)) {
                let remainingCommands = commandArray;
                remainingCommands.shift();
                /* There's a tree on this node, recurse into that tree */
                if (tree[key].hasOwnProperty('tree')) {
                    process(tree[key].tree, remainingCommands);
                } else if (tree[key].hasOwnProperty('func')) {
                    /* Apply the function to the remaining arguments */
                    tree[key].func.apply(this, remainingCommands);
                }
            }
        })
    };

    this.handleInput = function(inputArray) {
        process(commands, inputArray);
    }
}

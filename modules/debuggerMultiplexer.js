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

const Lang = imports.lang;

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

function _appendUnique(array, element) {
    if (array.indexOf(element) === -1) {
        array.push(element);
    }
}

const DebuggerEventTypes = _createEnum('PROGRAM_STARTED',
                                       'FRAME_ENTERED',
                                       'SINGLE_STEP');

const DebuggerCommandState = _createEnum('RETURN_CONTROL',
                                         'MORE_INPUT',
                                         'NOT_PROCESSED');

function DebuggerCommandController(onStop, interactiveStart) {

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

    const callUserFunctionUntilTrue = function(userFunction) {
        let result = false;
        while (!result) {
            warning("Repeating \n" + new Error().stack);
            result = userFunction.apply(this,
                                        Array.prototype.slice.call(arguments, 1));
        }
    }

    /* Handlers for various debugger actions */
    const onFrameEntered = function(frame) {
        let stopInfo = _createStopInfoForFrame('Frame entered',
                                               DebuggerEventTypes.FRAME_ENTERED,
                                               frame);
        callUserFunctionUntilTrue(onStop, stopInfo);
        return undefined;
    };

    const onSingleStep = function() {
        /* 'this' inside the onSingleStep handler is the frame itself. */
        warning("Single step event\n");
        let stopInfo = _createStopInfoForFrame('Single step',
                                               DebuggerEventTypes.SINGLE_STEP,
                                               this);
        callUserFunctionUntilTrue(onStop, stopInfo);
    }

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
                                return DebuggerCommandState.MORE_INPUT;
                            }
                        }
                    }
                },
                _: {
                    match: NoneRemaining,
                    func: function() {
                        /* Set __debugger.onEnterFrame to only watch for
                         * new scripts, upon which we will set the
                         * onStep handler. Set the onStep handlers of
                         * any other scripts we know about too */
                        __debugger.onEnterFrame = Lang.bind(this, function(frame) {
                            _appendUnique(this._trackingFrames, frame);
                            frame.onStep = onSingleStep;
                        });

                        /* Append current frame ot trackingFrames */
                        let currentFrame = __debugger.getNewestFrame();
                        if (currentFrame)
                            _appendUnique(this._trackingFrames,
                                          currentFrame);

                        for (let frame of this._trackingFrames)
                            frame.onStep = onSingleStep;

                        return DebuggerCommandState.MORE_INPUT;
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
                                        return DebuggerCommandState.MORE_INPUT;
                                    }
                                }
                            }
                        },
                        _: {
                            match: NoneRemaining,
                            func: function() {
                                __debugger.onEnterFrame = undefined;
                                for (frame of this._trackingFrames) {
                                    frame.onStep = undefined;
                                }
                                this._trackingFrames = [];
                                return DebuggerCommandState.MORE_INPUT;
                            }
                        }
                    }
                }
            }
        },
        cont: {
            match: Exactly,
            tree: {
                _: {
                    match: NoneRemaining,
                    func: function() {
                        /* Does nothing. This will cause us to return true
                         * and the debugger will just continue execution */
                        return DebuggerCommandState.RETURN_CONTROL;
                    }
                }
            }
        }
    };

    this._process = function(tree, commandArray) {
        let commandState = DebuggerCommandState.NOT_PROCESSED;

        for (let key of Object.keys(tree)) {
            if (tree[key].match(key, commandArray)) {
                let remainingCommands = commandArray.slice();
                remainingCommands.shift();
                /* There's a tree on this node, recurse into that tree */
                if (tree[key].hasOwnProperty('tree')) {
                    commandState = this._process(tree[key].tree,
                                                 remainingCommands);
                } else if (tree[key].hasOwnProperty('func')) {
                    /* Apply the function to the remaining arguments */
                    commandState = tree[key].func.apply(this, remainingCommands);
                    break;
                }
            }
        }

        return commandState;
    };

    warning("Called into debugger command controller " + new Error().stack);

    /* For the very first frame, we intend to stop and ask the user what to do. This
     * hook gets cleared upon being reached */
    if (interactiveStart === true) {
        __debugger.onEnterFrame = function (frame) {
            __debugger.onEnterFrame = undefined;
            let stopInfo = _createStopInfoForFrame('Program started',
                                                   DebuggerEventTypes.PROGRAM_STARTED,
                                                   frame);
            callUserFunctionUntilTrue(onStop, stopInfo);
            return undefined;
        }
    }

    this._trackingFrames = [];
    this.handleInput = function(inputArray) {
        const result = this._process(commands, inputArray);
        if (result == DebuggerCommandState.NOT_PROCESSED)
            warning('Could not parse command set ' + inputArray);

        return result;
    }
}

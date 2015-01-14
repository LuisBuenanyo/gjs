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

const GObject = imports.gi.GObject;
const Lang = imports.lang;

function _DebugMultiplexerLockHolder(multiplexer, unregisterFunc) {
    this._active = true;
    this.unregister = function() {
        if (this._active) {
            unregisterFunc.call(multiplexer);
            this.active = false;
        }
    }
}

function _CreateMultiplexerLockHolder(unregisterFuncName) {
    let _lockHolderPrototype = function(multiplexer) {
        _DebugMultiplexerLockHolder.call(this,
                                         multiplexer,
                                         multiplexer[unregisterFuncName]);
    }

    _lockHolderPrototype.prototype = Object.create(_DebugMultiplexerLockHolder.prototype);
    _lockHolderPrototype.prototype.constructor = _lockHolderPrototype;

    return _lockHolderPrototype;
}

const _EnterFrameLockHolder = _CreateMultiplexerLockHolder("_unregisterEnterFrameLockHolder")

/* This script could be eval'd multiple times, but there's no
 * way to unregister GType classes once they've been registered.
 * So scan for GType names until we find one that isn't valid */
let classNumber = 0;
let className = null;
while (1) {
    let name = 'DebuggerMultiplexer' + classNumber;
    let type = GObject.type_from_name('Gjs' + name);
    if (type.name === null) {
        className = name;
        break;
    }
    classNumber++;
}

/* We have to do this while we don't have any frames on the stack */
let __debugger = new Debugger(debuggee);

const DebuggerMultiplexer = new Lang.Class({
    Name: className,
    GTypeName: 'Gjs' + className,
    Extends: GObject.Object,
    Signals: {
        'single-step': { param_types: [ GObject.TYPE_INT, GObject.TYPE_STRING ] },
        'enter-frame': { param_types: [ GObject.TYPE_STRING, GObject.TYPE_STRING ] }
    },
    
    _init: function(props) {
        this.parent(props);

        this._breakpoint_handlers = {}
        this._dbg = __debugger;

        this._enter_frame_lock_count = 0;
        this._single_step_lock_count = 0;
        this._breakpoint_handlers = {};
    },

    addBreakpointHandler: function(filename, line, callback) {
    },
    
    enableSingleStep: function() {
    },
    
    enableFrameEntry: function(callback) {

        /* Do all this before setting onEnterFrame to avoid
         * spurious onEnterFrame calls */
        this._enter_frame_lock_count++;
        this.connect('enter-frame', callback);

        let lock = new _EnterFrameLockHolder(this);

        if (this._enter_frame_lock_count === 1) {
            this._dbg.onEnterFrame = Lang.bind(this, function(frame) {
                let name = frame.callee ? (frame.callee.name ? frame.callee.name : "(anonymous)") : "(toplevel)"
                this.emit('enter-frame', name, frame.script.url);
            });
        }

        return lock;
    },

    _unregisterBreakpointHandler: function(filename, line) {
        this._breakpointer_handlers[filename + ":" + line] = undefined;
    },
    
    _unregisterEnterFrameLockHolder: function() {
        this._enter_frame_lock_count--;
        if (this._enter_frame_lock_count === 0) {
            this._dbg.onEnterFrame = undefined;
        }
    },
});
    

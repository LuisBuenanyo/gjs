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

function BreakpointHandle(multiplexer, filename, line) {
    this.unregister = function() {
        
    }
}

function SingleStepLockHolder(multiplexer) {
    this.unregister = function() {
        multiplexer._unregisterSingleStepLockHolder();
    }
}

function EnterFrameLockHolder(multiplexer) {
    this.unregister = function() {
        multiplexer._unregisterEnterFrameLockHolder();
    }
}

const DebuggerMultiplexer = new Lang.Class({
    Name: 'DebuggerMultiplexer',
    GTypeName: 'GjsDebuggerMultiplexer',
    Extends: GObject.Object,
    Signals: {
        'single-step': { param_types: [ GObject.TYPE_INT, GObject.TYPE_STRING ] },
        'enter-frame': { param_types: [ GObject.TYPE_STRING, GObject.TYPE_STRING ] }
    },
    
    _init: function(props) {
         this.parent(props);

         this._breakpoint_handlers = {}
    },

    addBreakpointHandler: function(filename, line, callback) {
    },
    
    enableSingleStep: function() {
    },
    
    enableFrameEntry: function() {
    },

    _unregisterBreakpointHandler: function(filename, line) {
        this._breakpointer_handlers[filename + ":" + line] = undefined;
    },
    
    _unregisterEnterFrameLockHolder: function(filename, line) {
        this._enter_frame_lock_count--;
        if (this._enter_frame_lock_count === 0) {
        }
    },

    _unregisterSingleStepLockHolder: function(filename, line) {
        this._enter_frame_lock_count--;
        if (this._enter_frame_lock_count === 0) {
        }
    },
});
    

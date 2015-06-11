// -*- mode: js; indent-tabs-mode: nil -*-

const Gio = imports.gi.Gio;
const GObject = imports.gi.GObject;
const JSUnit = imports.jsUnit;
const Lang = imports.lang;

const MyInterface = new Lang.Interface({
    Name: 'MyInterface',
});

const MyInterfaceGObject = new Lang.Class({
    Name: 'MyInterfaceGObject',
    Extends: GObject.Object,
    Implements: [ MyInterface ],

    _init: function (props={}) {
        this.parent(props);
    }
});

function testGObjectClassCanImplementInterface() {
    new MyInterfaceGObject();
}

function testGObjectCanImplementInterfacesFromJSAndC() {
    const MyHybridObject = new Lang.Class({
        Name: 'MyHybridObject',
        Extends: GObject.Object,
        Implements: [ MyInterface, Gio.Initable ],

        _init: function (props={}) {
            this.parent(props);
        }
    });
    new MyHybridObject();
}

JSUnit.gjstestRun(this, JSUnit.setUp, JSUnit.tearDown);

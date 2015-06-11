const Lang = imports.lang;
const GObject = imports.gi.GObject;

const MyGObjectInterface = new GObject.Interface({
    Name: 'MyGObjectInterface',
    GTypeName: 'ArbitraryGTypeName',
    Properties: {
        'interface-prop': GObject.ParamSpec.string('interface-prop',
            'Interface property', 'Must be overridden in implementation',
            GObject.ParamFlags.READABLE,
            'foobar'),
    },
    Signals: {
        'interface-signal': {}
    },
});

const MyGObject = new Lang.Class({
    Name: 'MyGObject',
    Extends: GObject.Object,
    Implements: [ MyGObjectInterface ],
    Properties: {
        'interface-prop': GObject.ParamSpec.string('interface-prop', 'override',
            'override', GObject.ParamFlags.READABLE, 'foobar'),
    },
});

printerr(MyGObjectInterface);
printerr(MyGObjectInterface.$gtype);
printerr(MyGObjectInterface.constructor);
printerr(MyGObjectInterface.constructor.$gtype);
printerr(MyGObjectInterface.constructor.constructor);
printerr(MyGObjectInterface.constructor.constructor.$gtype);
printerr(MyGObjectInterface.constructor.constructor.constructor);

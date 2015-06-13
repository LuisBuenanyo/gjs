// -*- mode: js; indent-tabs-mode: nil -*-

const Gio = imports.gi.Gio;
const GLib = imports.gi.GLib;
const GObject = imports.gi.GObject;
const JSUnit = imports.jsUnit;
const Lang = imports.lang;
const Mainloop = imports.mainloop;

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

const MyGObjectInterface = new Lang.Interface({
    Name: 'MyGObjectInterface',
    GTypeName: 'ArbitraryGTypeName',
    Requires: [ GObject.Object ],
    Properties: {
        'interface-prop': GObject.ParamSpec.string('interface-prop',
            'Interface property', 'Must be overridden in implementation',
            GObject.ParamFlags.READABLE,
            'foobar')
    },
    Signals: {
        'interface-signal': {}
    },

    requiredG: Lang.Interface.UNIMPLEMENTED,
    optionalG: function () {
        return 'MyGObjectInterface.optionalG()';
    }
});

const MyOtherGObjectInterface = new Lang.Interface({
    Name: 'MyOtherGObjectInterface',
    Requires: [ MyGObjectInterface ],

    optionalG: function () {
        return 'MyOtherGObjectInterface.optionalG()\n' +
            MyGObjectInterface.optionalG(this);
    }
});

const MyInitableInterface = new Lang.Interface({
    Name: 'MyInitableInterface',
    Requires: [ GObject.Object, Gio.Initable ]
});

const MyGObject = new Lang.Class({
    Name: 'MyGObject',
    Extends: GObject.Object,
    Implements: [ MyGObjectInterface ],
    Properties: {
        'interface-prop': GObject.ParamSpec.string('interface-prop', 'override',
            'override', GObject.ParamFlags.READABLE, 'foobar'),
        'class-prop': GObject.ParamSpec.string('class-prop', 'Class property',
            'A property that is not on the interface',
            GObject.ParamFlags.READABLE, 'meh')
    },
    Signals: {
        'class-signal': {},
    },

    get interface_prop() {
        return 'foobar';
    },

    get class_prop() {
        return 'meh';
    },

    _init: function (props={}) {
        this.parent(props);
    },
    requiredG: function () {},
    optionalG: function () {
        return MyGObjectInterface.optionalG(this);
    }
});

const MyMinimalGObject = new Lang.Class({
    Name: 'MyMinimalGObject',
    Extends: GObject.Object,
    Implements: [ MyGObjectInterface ],
    Properties: {
        'interface-prop': GObject.ParamSpec.string('interface-prop', 'override',
            'override', GObject.ParamFlags.READABLE, 'foobar')
    },

    _init: function (props={}) {
        this.parent(props);
    },
    requiredG: function () {}
});

const MyOtherGObject = new Lang.Class({
    Name: 'MyOtherGObject',
    Extends: GObject.Object,
    Implements: [ MyGObjectInterface, MyOtherGObjectInterface ],
    Properties: {
        'interface-prop': GObject.ParamSpec.string('interface-prop', 'override',
            'override', GObject.ParamFlags.READABLE, 'foobar')
    },

    _init: function (props={}) {
        this.parent(props);
    },
    requiredG: function () {},
    optionalG: function () {
        return MyOtherGObjectInterface.optionalG(this);
    }
});

function testGObjectClassCanImplementInterface() {
    let obj = new MyInterfaceGObject();
    JSUnit.assertTrue(obj.constructor.implements(MyInterface));
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
    let obj = new MyHybridObject();
    JSUnit.assertTrue(obj.constructor.implements(MyInterface));
    JSUnit.assertTrue(obj.constructor.implements(Gio.Initable));
}

function testGObjectInterfaceIsInstanceOfInterfaces() {
    JSUnit.assertTrue(MyGObjectInterface instanceof Lang.Interface);
    JSUnit.assertTrue(MyGObjectInterface instanceof GObject.Interface);
}

function testGObjectInterfaceCannotBeInstantiated() {
    JSUnit.assertRaises(() => new MyGObjectInterface());
}

function testGObjectInterfaceTypeName() {
    JSUnit.assertEquals('ArbitraryGTypeName', MyGObjectInterface.$gtype.name);
}

function testGObjectCanImplementInterface() {
    let obj = new MyGObject();
    JSUnit.assertTrue(obj.constructor.implements(MyGObjectInterface));
}

function testGObjectImplementingInterfaceHasCorrectClassObject() {
    JSUnit.assertEquals('[object GObjectClass for MyGObject]', MyGObject.toString());
    let obj = new MyGObject();
    JSUnit.assertEquals(MyGObject, obj.constructor);
    JSUnit.assertEquals('[object GObjectClass for MyGObject]',
        obj.constructor.toString());
}

function testGObjectCanImplementBothGObjectAndNonGObjectInterfaces() {
    const MyHybridGObject = new Lang.Class({
        Name: 'MyHybridGObject',
        Extends: GObject.Object,
        Implements: [ MyInterface, MyGObjectInterface ],
        Properties: {
            'interface-prop': GObject.ParamSpec.string('interface-prop',
                'override', 'override', GObject.ParamFlags.READABLE, 'foobar')
        },

        _init: function (props={}) {
            this.parent(props);
        },
        required: function () {},
        requiredG: function () {}
    });
    let obj = new MyHybridGObject();
    JSUnit.assertTrue(obj.constructor.implements(MyInterface));
    JSUnit.assertTrue(obj.constructor.implements(MyGObjectInterface));
}

function testGObjectCanImplementRequiredFunction() {
    let obj = new MyGObject();
    obj.requiredG();
}

function testGObjectMustImplementRequiredFunction () {
    JSUnit.assertRaises(() => new Lang.Class({
        Name: 'MyBadObject',
        Extends: GObject.Object,
        Implements: [ MyGObjectInterface ],
        Properties: {
            'interface-prop': GObject.ParamSpec.string('interface-prop',
                'override', 'override', GObject.ParamFlags.READABLE, 'foobar')
        }
    }));
}

function testGObjectDoesntHaveToImplementOptionalFunction() {
    let obj = new MyMinimalGObject();
    JSUnit.assertTrue(obj.constructor.implements(MyGObjectInterface));
}

function testGObjectCanDeferToInterfaceOptionalFunction() {
    let obj = new MyMinimalGObject();
    JSUnit.assertEquals('MyGObjectInterface.optionalG()', obj.optionalG());
}

function testGObjectCanChainUpToInterface() {
    let obj = new MyGObject();
    JSUnit.assertEquals('MyGObjectInterface.optionalG()', obj.optionalG());
}

function testGObjectInterfaceCanRequireOtherInterface() {
    let obj = new MyOtherGObject();
    JSUnit.assertTrue(obj.constructor.implements(MyGObjectInterface));
    JSUnit.assertTrue(obj.constructor.implements(MyOtherGObjectInterface));
}

function testGObjectInterfaceCanChainUpToOtherInterface() {
    let obj = new MyOtherGObject();
    JSUnit.assertEquals('MyOtherGObjectInterface.optionalG()\nMyGObjectInterface.optionalG()',
        obj.optionalG());
}

function testGObjectDefersToLastInterfaceOptionalFunction() {
    const MyOtherMinimalGObject = new Lang.Class({
        Name: 'MyOtherMinimalGObject',
        Extends: GObject.Object,
        Implements: [ MyGObjectInterface, MyOtherGObjectInterface ],
        Properties: {
            'interface-prop': GObject.ParamSpec.string('interface-prop',
                'override', 'override', GObject.ParamFlags.READABLE, 'foobar')
        },

        _init: function (props={}) {
            this.parent(props);
        },
        requiredG: function () {}
    });
    let obj = new MyOtherMinimalGObject();
    JSUnit.assertEquals('MyOtherGObjectInterface.optionalG()\nMyGObjectInterface.optionalG()',
        obj.optionalG());
}

function testGObjectClassMustImplementAllRequiredInterfaces() {
    JSUnit.assertRaises(() => new Lang.Class({
        Name: 'MyBadObject',
        Implements: [ MyOtherGObjectInterface ],
        required: function () {}
    }));
}

function testGObjectClassMustImplementRequiredInterfacesInCorrectOrder() {
    JSUnit.assertRaises(() => new Lang.Class({
        Name: 'MyBadObject',
        Implements: [ MyOtherGObjectInterface, MyGObjectInterface ],
        required: function () {}
    }));
}

function testGObjectInterfaceCanRequireInterfaceFromC() {
    JSUnit.assertRaises(() => new Lang.Class({
        Name: 'MyBadObject',
        Implements: [ MyInitableInterface ]
    }));
}

function testGObjectHasInterfaceSignalsAndClassSignals() {
    let obj = new MyGObject();
    let interface_signal_emitted = false, class_signal_emitted = false;
    obj.connect('interface-signal', () => {
        interface_signal_emitted = true;
        Mainloop.quit('signal');
    });
    obj.connect('class-signal', () => {
        class_signal_emitted = true;
        Mainloop.quit('signal');
    });
    GLib.idle_add(GLib.PRIORITY_DEFAULT, () => obj.emit('interface-signal'));
    Mainloop.run('signal');
    GLib.idle_add(GLib.PRIORITY_DEFAULT, () => obj.emit('class-signal'));
    Mainloop.run('signal');
    JSUnit.assertTrue(interface_signal_emitted);
    JSUnit.assertTrue(class_signal_emitted);
}

function testGObjectHasInterfacePropertiesAndClassProperties() {
    let obj = new MyGObject();
    JSUnit.assertEquals('foobar', obj.interface_prop);
    JSUnit.assertEquals('meh', obj.class_prop);
}

// Failing to override an interface property doesn't raise an error but instead
// logs a critical warning.
function testGObjectMustOverrideInterfaceProperties() {
    GLib.test_expect_message('GLib-GObject', GLib.LogLevelFlags.LEVEL_CRITICAL,
        "Object class * doesn't implement property 'interface-prop' from " +
        "interface 'ArbitraryGTypeName'");
    new Lang.Class({
        Name: 'MyNaughtyObject',
        Extends: GObject.Object,
        Implements: [ MyGObjectInterface ],
        _init: function (props={}) {
            this.parent(props);
        },
        requiredG: function () {}
    });
    // g_test_assert_expected_messages() is a macro, not introspectable
    GLib.test_assert_expected_messages_internal('Gjs', 'testGObjectInterface.js',
        416, 'testGObjectMustOverrideInterfaceProperties');
}

// This makes sure that we catch the case where the metaclass (e.g.
// GtkWidgetClass) doesn't specify a meta-interface. In that case we get the
// meta-interface from the metaclass's parent.
function testInterfaceIsOfCorrectTypeForMetaclass() {
    const MyMeta = new Lang.Class({
        Name: 'MyMeta',
        Extends: GObject.Class
    });
    const MyMetaObject = new MyMeta({
        Name: 'MyMetaObject'
    });
    const MyMetaInterface = new Lang.Interface({
        Name: 'MyMetaInterface',
        Requires: [ MyMetaObject ]
    });
    JSUnit.assertTrue(MyMetaInterface instanceof GObject.Interface);
}

function testSubclassImplementsTheSameInterfaceAsItsParent() {
    const SubObject = new Lang.Class({
        Name: 'SubObject',
        Extends: MyGObject
    });
    let obj = new SubObject();
    JSUnit.assertTrue(obj.constructor.implements(MyGObjectInterface));
    JSUnit.assertEquals('foobar', obj.interface_prop);  // override not needed
}

function testSubclassCanReimplementTheSameInterfaceAsItsParent() {
    const SubImplementer = new Lang.Class({
        Name: 'SubImplementer',
        Extends: MyGObject,
        Implements: [ MyGObjectInterface ]
    });
    let obj = new SubImplementer();
    JSUnit.assertTrue(obj.constructor.implements(MyGObjectInterface));
    JSUnit.assertEquals('foobar', obj.interface_prop);  // override not needed
}

JSUnit.gjstestRun(this, JSUnit.setUp, JSUnit.tearDown);

// -*- mode: js; indent-tabs-mode: nil -*-

const JSUnit = imports.jsUnit;
const Lang = imports.lang;
const GObject = imports.gi.GObject;

const MyInterface = new Lang.Interface({
    Name: 'MyInterface',

    required: null,  // signifies a function that must be overridden

    optional: function () {
        return 'MyInterface.optional()';
    },

    optionalGeneric: function () {
        return 'MyInterface.optionalGeneric()';
    },
});

const MyOtherInterface = new Lang.Interface({
    Name: 'MyOtherInterface',
    Requires: [ MyInterface ],

    optional: function () {
        return 'MyOtherInterface.optional()\n' +
            MyInterface.prototype.optional.apply(this, arguments);
    },

    optionalGeneric: function () {
        return 'MyOtherInterface.optionalGeneric()\n' +
            MyInterface.optionalGeneric();
    },
});

const MyObject = new Lang.Class({
    Name: 'MyObject',
    Implements: [ MyInterface ],

    _init: function () {
        this.parent();
        this.my_object_init_called = true;
    },

    required: function () {},

    optional: function () {
        return MyInterface.prototype.optional.apply(this, arguments);
    },

    optionalGeneric: function () {
        return MyInterface.optionalGeneric();
    },
});

const MyMinimalObject = new Lang.Class({
    Name: 'MyMinimalObject',
    Implements: [ MyInterface ],

    required: function () {},
});

const MyOtherObject = new Lang.Class({
    Name: 'MyOtherObject',
    Implements: [ MyInterface, MyOtherInterface ],

    required: function () {},

    optional: function () {
        return MyOtherInterface.prototype.optional.apply(this, arguments);
    },

    optionalGeneric: function () {
        return MyOtherInterface.optionalGeneric();
    },
});

function testInterfaceIsInstanceOfLangInterface() {
    JSUnit.assertTrue(MyInterface instanceof Lang.Interface);
    JSUnit.assertTrue(MyOtherInterface instanceof Lang.Interface);
}

function testInterfaceCannotBeInstantiated() {
    JSUnit.assertRaises(() => new MyInterface());
}

function testObjectCanImplementInterface() {
    new MyObject();
}

function testObjectCanImplementRequiredFunction() {
    let implementer = new MyObject();
    implementer.required();
}

function testClassMustImplementRequiredFunction() {
    JSUnit.assertRaises(() => new Lang.Class({
        Name: 'MyBadObject',
        Implements: [ MyInterface ],
    }));
}

function testClassDoesntHaveToImplementOptionalFunction() {
    new MyMinimalObject();
}

function testObjectCanDeferToInterfaceOptionalFunction() {
    let myObject = new MyMinimalObject();
    JSUnit.assertEquals('MyInterface.optional()', myObject.optional());
}

function testObjectCanChainUpToInterface() {
    let myObject = new MyObject();
    JSUnit.assertEquals('MyInterface.optional()', myObject.optional());
}

function testInterfaceCanChainUpToOtherInterface() {
    let myOtherObject = new MyOtherObject();
    JSUnit.assertEquals('MyOtherInterface.optional()\nMyInterface.optional()',
        myOtherObject.optional());
}

function testObjectCanChainUpToInterfaceWithGeneric() {
    let myObject = new MyObject();
    JSUnit.assertEquals('MyInterface.optionalGeneric()',
        myObject.optionalGeneric());
}

function testInterfaceCanChainUpToOtherInterfaceWithGeneric() {
    let myOtherObject = new MyOtherObject();
    JSUnit.assertEquals('MyOtherInterface.optionalGeneric()\nMyInterface.optionalGeneric()',
        myOtherObject.optionalGeneric());
}

function testClassMustImplementAllRequiredInterfaces() {
    JSUnit.assertRaises(() => new Lang.Class({
        Name: 'MyBadObject',
        Implements: [ MyOtherInterface ],
        required: function () {},
    }));
}

function testClassMustImplementRequiredInterfacesInCorrectOrder() {
    JSUnit.assertRaises(() => new Lang.Class({
        Name: 'MyBadObject',
        Implements: [ MyOtherInterface, MyInterface ],
        required: function () {},
    }));
}

JSUnit.gjstestRun(this, JSUnit.setUp, JSUnit.tearDown);

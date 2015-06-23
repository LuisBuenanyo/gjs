// -*- mode: js; indent-tabs-mode: nil -*-

const JSUnit = imports.jsUnit;
const Lang = imports.lang;

const MyInterface = new Lang.Interface({
    Name: 'MyInterface',

    required: Lang.Interface.UNIMPLEMENTED,

    optional: function () {
        return 'MyInterface.optional()';
    },

    optionalGeneric: function () {
        return 'MyInterface.optionalGeneric()';
    },

    usesThis: function () {
        return this._interfacePrivateMethod();
    },

    _interfacePrivateMethod: function () {
        return 'interface private method';
    },

    get some_prop() {
        return 'MyInterface.some_prop getter';
    },

    set some_prop(value) {
        this.some_prop_setter_called = true;
    }
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
            MyInterface.optionalGeneric(this);
    }
});

const MyObject = new Lang.Class({
    Name: 'MyObject',
    Implements: [ MyInterface ],

    _init: function () {
        this.parent();
    },

    required: function () {},

    optional: function () {
        return MyInterface.prototype.optional.apply(this, arguments);
    },

    optionalGeneric: function () {
        return MyInterface.optionalGeneric(this);
    }
});

const MyDemandingInterface = new Lang.Interface({
    Name: 'MyDemandingInterface',
    Requires: [ MyObject, MyOtherInterface ],
});

const MyMinimalObject = new Lang.Class({
    Name: 'MyMinimalObject',
    Implements: [ MyInterface ],

    required: function () {}
});

const MyOtherObject = new Lang.Class({
    Name: 'MyOtherObject',
    Implements: [ MyInterface, MyOtherInterface ],

    required: function () {},

    optional: function () {
        return MyOtherInterface.prototype.optional.apply(this, arguments);
    },

    optionalGeneric: function () {
        return MyOtherInterface.optionalGeneric(this);
    }
});

function testInterfaceIsInstanceOfLangInterface() {
    JSUnit.assertTrue(MyInterface instanceof Lang.Interface);
    JSUnit.assertTrue(MyOtherInterface instanceof Lang.Interface);
}

function testInterfaceCannotBeInstantiated() {
    JSUnit.assertRaises(() => new MyInterface());
}

function testObjectCanImplementInterface() {
    let obj = new MyObject();
    JSUnit.assertTrue(obj.constructor.implements(MyInterface));
}

function testObjectImplementingInterfaceHasCorrectConstructor() {
    let obj = new MyObject();
    JSUnit.assertEquals(MyObject, obj.constructor);
}

function testObjectCanImplementRequiredFunction() {
    let implementer = new MyObject();
    implementer.required();
}

function testClassMustImplementRequiredFunction() {
    JSUnit.assertRaises(() => new Lang.Class({
        Name: 'MyBadObject',
        Implements: [ MyInterface ]
    }));
}

function testClassDoesntHaveToImplementOptionalFunction() {
    let obj = new MyMinimalObject();
    JSUnit.assertTrue(obj.constructor.implements(MyInterface));
}

function testObjectCanDeferToInterfaceOptionalFunction() {
    let obj = new MyMinimalObject();
    JSUnit.assertEquals('MyInterface.optional()', obj.optional());
}

function testObjectCanChainUpToInterface() {
    let obj = new MyObject();
    JSUnit.assertEquals('MyInterface.optional()', obj.optional());
}

function testObjectCanDeferToInterfaceGetterAndSetter() {
    let obj = new MyObject();
    JSUnit.assertEquals('MyInterface.some_prop getter', obj.some_prop);
    obj.some_prop = 'foobar';
    JSUnit.assertTrue(obj.some_prop_setter_called);
}

function testObjectCanOverrideInterfaceGetter() {
    const MyGetterObject = new Lang.Class({
        Name: 'MyGetterObject',
        Implements: [ MyInterface ],
        required: function () {},
        get some_prop() {
            return 'MyGetterObject.some_prop getter';
        }
    });
    let obj = new MyGetterObject();
    JSUnit.assertEquals('MyGetterObject.some_prop getter', obj.some_prop);
}

function testObjectCanOverrideInterfaceSetter() {
    const MySetterObject = new Lang.Class({
        Name: 'MySetterObject',
        Implements: [ MyInterface ],
        required: function () {},
        set some_prop(value) {  /* setter without getter */// jshint ignore:line
            this.overridden_some_prop_setter_called = true;
        }
    });
    let obj = new MySetterObject();
    obj.some_prop = 'foobar';
    JSUnit.assertTrue(obj.overridden_some_prop_setter_called);
    JSUnit.assertUndefined(obj.some_prop_setter_called);
}

function testInterfaceCanRequireOtherInterface() {
    let obj = new MyOtherObject();
    JSUnit.assertTrue(obj.constructor.implements(MyInterface));
    JSUnit.assertTrue(obj.constructor.implements(MyOtherInterface));
}

function testInterfaceCanChainUpToOtherInterface() {
    let obj = new MyOtherObject();
    JSUnit.assertEquals('MyOtherInterface.optional()\nMyInterface.optional()',
        obj.optional());
}

function testObjectCanChainUpToInterfaceWithGeneric() {
    let obj = new MyObject();
    JSUnit.assertEquals('MyInterface.optionalGeneric()',
        obj.optionalGeneric());
}

function testInterfaceCanChainUpToOtherInterfaceWithGeneric() {
    let obj = new MyOtherObject();
    JSUnit.assertEquals('MyOtherInterface.optionalGeneric()\nMyInterface.optionalGeneric()',
        obj.optionalGeneric());
}

function testObjectDefersToLastInterfaceOptionalFunction() {
    const MyOtherMinimalObject = new Lang.Class({
        Name: 'MyOtherMinimalObject',
        Implements: [ MyInterface, MyOtherInterface ],

        required: function () {}
    });
    let obj = new MyOtherMinimalObject();
    JSUnit.assertEquals('MyOtherInterface.optionalGeneric()\nMyInterface.optionalGeneric()',
        obj.optionalGeneric());
}

function testClassMustImplementAllRequiredInterfaces() {
    JSUnit.assertRaises(() => new Lang.Class({
        Name: 'MyBadObject',
        Implements: [ MyOtherInterface ],
        required: function () {}
    }));
}

function testClassMustImplementRequiredInterfacesInCorrectOrder() {
    JSUnit.assertRaises(() => new Lang.Class({
        Name: 'MyBadObject',
        Implements: [ MyOtherInterface, MyInterface ],
        required: function () {}
    }));
}

function testInterfacesCanBeImplementedOnAParentClass() {
    const MyParentalObject = new Lang.Class({
        Name: 'MyParentalObject',
        Extends: MyObject,
        Implements: [ MyOtherInterface ],
    });
    let obj = new MyParentalObject();
    JSUnit.assertTrue(obj.constructor.implements(MyInterface));
    JSUnit.assertTrue(obj.constructor.implements(MyOtherInterface));
}

function testInterfacesCanRequireBeingImplementedOnASubclass() {
    const MyConformingObject = new Lang.Class({
        Name: 'MyConformingObject',
        Extends: MyObject,
        Implements: [ MyOtherInterface, MyDemandingInterface ]
    });
    let obj = new MyConformingObject();
    JSUnit.assertTrue(obj.constructor.implements(MyInterface));
    JSUnit.assertTrue(obj.constructor.implements(MyOtherInterface));
    JSUnit.assertTrue(obj.constructor.implements(MyDemandingInterface));
}

function testObjectsMustSubclassIfRequired() {
    JSUnit.assertRaises(() => new Lang.Class({
        Name: 'MyNonConformingObject',
        Implements: [ MyInterface, MyOtherInterface, MyDemandingInterface ],
        required: function () {},
    }));
}

function testInterfaceMethodsCanCallOtherInterfaceMethods() {
    let obj = new MyObject();
    JSUnit.assertEquals('interface private method', obj.usesThis());
}

function testSubclassImplementsTheSameInterfaceAsItsParent() {
    const SubObject = new Lang.Class({
        Name: 'SubObject',
        Extends: MyObject
    });
    let obj = new SubObject();
    JSUnit.assertTrue(obj.constructor.implements(MyInterface));
}

function testSubclassCanReimplementTheSameInterfaceAsItsParent() {
    const SubImplementer = new Lang.Class({
        Name: 'SubImplementer',
        Extends: MyObject,
        Implements: [ MyInterface ]
    });
    let obj = new SubImplementer();
    JSUnit.assertTrue(obj.constructor.implements(MyInterface));
}

JSUnit.gjstestRun(this, JSUnit.setUp, JSUnit.tearDown);

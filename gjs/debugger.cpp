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

#include <sys/stat.h>
#include <gio/gio.h>

#include "gjs-module.h"
#include "importer.h"

static JSClass debugger_global_class = {
    "GjsDebuggerCompartment",
    JSCLASS_GLOBAL_FLAGS_WITH_SLOTS(GJS_GLOBAL_SLOT_LAST),
    JS_PropertyStub,
    JS_DeletePropertyStub,
    JS_PropertyStub,
    JS_StrictPropertyStub,
    JS_EnumerateStub,
    JS_ResolveStub,
    JS_ConvertStub,
    NULL,
    NULL /* checkAccess */,
    NULL /* call */,
    NULL /* hasInstance */,
    NULL /* construct */,
    NULL,
    { NULL }
};

static JSBool
debugger_warning(JSContext *context,
                 unsigned   argc,
                 jsval     *vp)
{
    jsval *argv = JS_ARGV(context, vp);
    char *s;
    JSExceptionState *exc_state;
    JSString *jstr;

    if (argc != 1) {
        gjs_throw(context, "Must pass a single argument to warning()");
        return JS_FALSE;
    }

    JS_BeginRequest(context);

    /* JS_ValueToString might throw, in which we will only
     *log that the value could be converted to string */
    exc_state = JS_SaveExceptionState(context);
    jstr = JS_ValueToString(context, argv[0]);
    if (jstr != NULL)
        argv[0] = STRING_TO_JSVAL(jstr);    // GC root
    JS_RestoreExceptionState(context, exc_state);

    if (jstr == NULL) {
        g_message("JS LOG: <cannot convert value to string>");
        JS_EndRequest(context);
        return JS_TRUE;
    }

    if (!gjs_string_to_utf8(context, STRING_TO_JSVAL(jstr), &s)) {
        JS_EndRequest(context);
        return JS_FALSE;
    }

    g_message("JS COVERAGE WARNING: %s", s);
    g_free(s);

    JS_EndRequest(context);
    JS_SET_RVAL(context, vp, JSVAL_VOID);
    return JS_TRUE;
}

static JSBool
debugger_get_file_contents(JSContext *context,
                           unsigned   argc,
                           jsval     *vp)
{
    JSBool ret = JS_FALSE;
    JS::CallArgs args = JS::CallArgsFromVp(argc, vp);
    char *filename = NULL;
    GFile *file = NULL;
    char *script = NULL;
    gsize script_len;
    JSString *script_jsstr;
    GError *error = NULL;

    if (!gjs_parse_call_args(context, "getFileContents", "s", args,
                             "filename", &filename))
        goto out;

    file = g_file_new_for_commandline_arg(filename);

    if (!g_file_load_contents(file,
                              NULL,
                              &script,
                              &script_len,
                              NULL,
                              &error)) {
        gjs_throw(context, "Failed to load contents for filename %s: %s", filename, error->message);
        goto out;
    }

    args.rval().setString(JS_NewStringCopyN(context, script, script_len));
    ret = JS_TRUE;

 out:
    g_clear_error(&error);
    if (file)
        g_object_unref(file);
    g_free(filename);
    g_free(script);
    return ret;
}

static JSFunctionSpec debugger_funcs[] = {
    { "warning", JSOP_WRAPPER (debugger_warning), 1, GJS_MODULE_PROP_FLAGS },
    { "getFileContents", JSOP_WRAPPER (debugger_get_file_contents), 1, GJS_MODULE_PROP_FLAGS },
    { NULL },
};

static void
debugger_multiplexer_tracer(JSTracer *trc, void *data)
{
    JSObject *object = (JSObject *)data;
    JS_CallObjectTracer(trc, &object, "debugger_multiplexer");
} 

JSObject *
gjs_get_debugger_multiplexer(GjsContext     *gjs_context)
{
    static const char *debugger_multiplexer_script = "resource:///org/gnome/gjs/modules/debuggerMultiplexer.js";
    GError    *error = NULL;
    JSContext *context = (JSContext *) gjs_context_get_native_context(gjs_context);
    JSAutoRequest ar(context);

    JS::CompartmentOptions options;
    options.setVersion(JSVERSION_LATEST);

    JS::RootedObject debuggee(context, JS_GetGlobalObject(context));
    JS::RootedObject debugger_compartment(context,
                                          JS_NewGlobalObject(context,
                                                             &debugger_global_class,
                                                             NULL,
                                                             options));

    /* Enter compartment of the debugger and initialize it with the debuggee */
    JSAutoCompartment compartment(context, debugger_compartment);
    JS::RootedObject debuggeeWrapper(context, debuggee);
    if (!JS_WrapObject(context, debuggeeWrapper.address())) {
        gjs_throw(context, "Failed to wrap debuggee");
        return NULL;
    }

    JS::RootedValue debuggeeWrapperValue(context, JS::ObjectValue(*debuggeeWrapper));
    if (!JS_SetProperty(context, debugger_compartment, "debuggee", debuggeeWrapperValue.address())) {
        gjs_throw(context, "Failed to set debuggee property");
        return NULL;
    }

    if (!JS_InitStandardClasses(context, debugger_compartment)) {
        gjs_throw(context, "Failed to init standard classes");
        return NULL;
    }

    JS::RootedObject wrapped_importer(JS_GetRuntime(context),
                                      gjs_wrap_root_importer_in_compartment(context,
                                                                            debugger_compartment));;
    
    if (!wrapped_importer) {
        gjs_throw(context, "Failed to wrap root importer in debugger compartment");
        return NULL;
    }

    /* Now copy the global root importer (which we just created,
     * if it didn't exist) to our global object
     */
    if (!gjs_define_root_importer_object(context, debugger_compartment, wrapped_importer)) {
        gjs_throw(context, "Failed to set 'imports' on debugger compartment");
        return NULL;
    }

    if (!JS_DefineDebuggerObject(context, debugger_compartment)) {
        gjs_throw(context, "Failed to init Debugger");
        return NULL;
    }

    if (!JS_DefineFunctions(context, debugger_compartment, &debugger_funcs[0]))
        g_error("Failed to init debugger helper functions");

    if (!gjs_eval_file_with_scope(context,
                                  debugger_multiplexer_script,
                                  debugger_compartment,
                                  &error)) {
        g_error("Failed to evaluate debugger script %s", error->message);
    }

    jsval debugger_multiplexer_prototype_value;
    if (!JS_GetProperty(context, debugger_compartment, "DebuggerMultiplexer", &debugger_multiplexer_prototype_value) || !JSVAL_IS_OBJECT(debugger_multiplexer_prototype_value)) {
        gjs_throw(context, "Failed to get DebuggerMultiplexer object");
    }
    
    JS::RootedObject debugger_multiplexer_constructor (context,
                                                       JSVAL_TO_OBJECT(debugger_multiplexer_prototype_value));
    JS::RootedObject debugger_multiplexer (context,
                                           JS_New(context,
                                                  debugger_multiplexer_constructor,
                                                  0,
                                                  NULL));
    if (!debugger_multiplexer) {
        gjs_throw(context, "Failed to create DebuggerMultiplexer instance");
        return NULL;
    }

    JS_AddExtraGCRootsTracer(JS_GetRuntime(context),
                             debugger_multiplexer_tracer,
                             debugger_multiplexer);

    return debugger_multiplexer;
}

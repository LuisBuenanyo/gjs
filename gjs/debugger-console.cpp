/* -*- mode: C; c-basic-offset: 4; indent-tabs-mode: nil; -*- */
/* vim: set ts=8 sw=4 et tw=78:
 *
 * ***** BEGIN LICENSE BLOCK *****
 * Version: MPL 1.1/GPL 2.0/LGPL 2.1
 *
 * The contents of this file are subject to the Mozilla Public License Version
 * 1.1 (the "License"); you may not use this file except in compliance with
 * the License. You may obtain a copy of the License at
 * http://www.mozilla.org/MPL/
 *
 * Software distributed under the License is distributed on an "AS IS" basis,
 * WITHOUT WARRANTY OF ANY KIND, either express or implied. See the License
 * for the specific language governing rights and limitations under the
 * License.
 *
 * The Original Code is Mozilla Communicator client code, released
 * March 31, 1998.
 *
 * The Initial Developer of the Original Code is
 * Netscape Communications Corporation.
 * Portions created by the Initial Developer are Copyright (C) 1998
 * the Initial Developer. All Rights Reserved.
 *
 * Contributor(s):
 *
 * Alternatively, the contents of this file may be used under the terms of
 * either of the GNU General Public License Version 2 or later (the "GPL"),
 * or the GNU Lesser General Public License Version 2.1 or later (the "LGPL"),
 * in which case the provisions of the GPL or the LGPL are applicable instead
 * of those above. If you wish to allow use of your version of this file only
 * under the terms of either the GPL or the LGPL, and not to allow others to
 * use your version of this file under the terms of the MPL, indicate your
 * decision by deleting the provisions above and replace them with the notice
 * and other provisions required by the GPL or the LGPL. If you do not delete
 * the provisions above, a recipient may use your version of this file under
 * the terms of any one of the MPL, the GPL or the LGPL.
 *
 * Use to implement debugger console:
 *   Copyright (c) 2015 Endless Mobile, Inc.
 *   Authored By: Sam Spilsbury <sam@endlessm.com>
 *
 * ***** END LICENSE BLOCK ***** */

#include <sys/stat.h>
#include <gio/gio.h>

#include "gjs-module.h"
#include "importer.h"

JSObject * gjs_get_debugger_compartment(GjsContext *gjs_context);

#include <stdio.h>
#include <readline/readline.h>
#include <readline/history.h>

static JSBool
debugger_console_output(JSContext *context,
                        unsigned   argc,
                        jsval     *vp)
{
    JS::RootedValue argv (JS_GetRuntime(context),
                          *(JS_ARGV(context, vp)));
    JSAutoRequest   ar(context);
    JSString        *jstr = NULL;
    char            *s = NULL;

    if (argc != 1) {
        gjs_throw(context, "Must pass a single argument to warning()");
        return JS_FALSE;
    }

    JS_BeginRequest(context);

    /* JS_ValueToString might throw, in which we will only
     * log that the value could be converted to string */
    JSExceptionState *exc_state = JS_SaveExceptionState(context);
    jstr = JS_ValueToString(context, argv);
    if (jstr != NULL)
        argv = STRING_TO_JSVAL(jstr);    // GC root
    JS_RestoreExceptionState(context, exc_state);

    if (jstr == NULL) {
        g_message("DEBUGGER ERROR: <cannot convert value to string>");
        return JS_TRUE;
    }

    if (!gjs_string_to_utf8(context, STRING_TO_JSVAL(jstr), &s)) {
        return JS_FALSE;
    }

    printf("%s", s);
    g_free(s);

    JS_SET_RVAL(context, vp, JSVAL_VOID);

    return JS_TRUE;
}

static JSBool
debugger_console_readline(JSContext *context,
                          unsigned   argc,
                          jsval     *vp)
{
    JSAutoRequest ar(context);
    jsval         ret;

    char *line = g_strdup("\0");
    while (line[0] == '\0') {
        g_free(line);
        line = readline("gjsdb> ");

        /* EOF, return null */
        if (!line) {
            JS_SET_RVAL(context, vp, JSVAL_VOID);
            return JS_TRUE;
        }
    }

    /* Add line to history and convert it to a
     * JSString so that we can pass it back as
     * the return value */
    add_history(line);

    if (!gjs_string_from_utf8(context, line, strlen(line), &ret) ||
        !JSVAL_IS_STRING(ret)) {
        gjs_throw(context, "Failed to convert readline string to jsval");
        return JS_TRUE;
    }
    JS_SET_RVAL(context, vp, ret);
    return JS_TRUE;
}

static JSFunctionSpec debugger_funcs[] = {
    { "output", JSOP_WRAPPER (debugger_console_output), 1, GJS_MODULE_PROP_FLAGS },
    { "readline", JSOP_WRAPPER (debugger_console_readline), 0, GJS_MODULE_PROP_FLAGS },
    { NULL },
};

JSObject *
gjs_setup_debugger_console(GjsContext *context)
{
    JSContext *js_context = (JSContext *) gjs_context_get_native_context(context);
    JS::RootedObject debugger_compartment(JS_GetRuntime(js_context),
                                          gjs_get_debugger_compartment(context));
    JSAutoRequest ar(js_context);
    JSAutoCompartment ac(js_context, debugger_compartment);

    const char *readline_script = "const __debuggerCommandController = new DebuggerCommandController(function(info) {\n"
                                  "    output('Received ' + info.what +\n"
                                  "           '(program stopped at ' + info.url + ':' + info.line + ')\\n');\n"
                                  "    let next_command = readline();\n"
                                  "    if (__debuggerCommandController.handleInput(next_command.split(' ')) == DebuggerCommandState.RETURN_CONTROL)\n"
                                  "        return true;\n"
                                  "    return false;\n"
                                  "}, true);\n";

    printf("Evaluating script\n");
    jsval retval;
    if (!gjs_eval_with_scope(js_context,
                             debugger_compartment,
                             readline_script,
                             strlen(readline_script),
                             "<debugger script>",
                             &retval)) {
        gjs_log_exception(js_context);
        return NULL;
    }

    if (!JS_DefineFunctions(js_context, debugger_compartment, debugger_funcs)) {
        gjs_throw(js_context, "Failed to define debugger console functions");
        return NULL;
    }

    return debugger_compartment;
}

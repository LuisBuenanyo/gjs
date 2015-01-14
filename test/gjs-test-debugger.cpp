/*
 * Copyright © 2014 Endless Mobile, Inc.
 *
 * This program is free software; you can redistribute it and/or modify
 * it under the terms of the GNU General Public License as published by
 * the Free Software Foundation; either version 2 of the License, or
 * (at your option) any later version.
 *
 * This program is distributed in the hope that it will be useful,
 * but WITHOUT ANY WARRANTY; without even the implied warranty of
 * MERCHANTABILITY or FITNESS FOR A PARTICULAR PURPOSE.  See the
 * GNU General Public License for more details.
 *
 * You should have received a copy of the GNU General Public License
 * along with this program; if not, write to the Free Software Foundation,
 * Inc., 59 Temple Place - Suite 330, Boston, MA 02111-1307, USA.
 *
 * Authored By: Sam Spilsbury <sam@endlessm.com>
 */

#include <errno.h>
#include <string.h>
#include <stdlib.h>
#include <stdio.h>
#include <unistd.h>

#include <sys/types.h>
#include <fcntl.h>
#include <ftw.h>

#include <glib.h>
#include <gio/gio.h>
#include <gjs/gjs.h>
#include <gjs/coverage.h>
#include <gjs/gjs-module.h>

JSObject * gjs_get_debugger_multiplexer(GjsContext *gjs_context); /* The truth is that I'm just a lazy bugger */

typedef struct _GjsDebuggerFixture {
    GjsContext           *context;
    JS::Heap<JSObject *>  debugger_multiplexer_object;
    char                 *temporary_js_script_directory_name;
    char                 *temporary_js_script_filename;
    int                   temporary_js_script_open_handle;
} GjsDebuggerFixture;

static void
write_to_file(int        handle,
              const char *contents)
{
    if (write(handle,
              (gconstpointer) contents,
              sizeof(char) * strlen(contents)) == -1)
        g_error("Failed to write %s to file", contents);
}

static void
write_to_file_at_beginning(int        handle,
                           const char *content)
{
    if (ftruncate(handle, 0) == -1)
        g_print("Error deleting contents of test temporary file: %s\n", strerror(errno));
    lseek(handle, 0, SEEK_SET);
    write_to_file(handle, content);
}

static int
unlink_if_node_is_a_file(const char *path, const struct stat *sb, int typeflag)
{
    if (typeflag == FTW_F)
        unlink(path);
    return 0;
}

static int
rmdir_if_node_is_a_dir(const char *path, const struct stat *sb, int typeflag)
{
    if (typeflag == FTW_D)
        rmdir(path);
    return 0;
}

static void
recursive_delete_dir_at_path(const char *path)
{
    /* We have to recurse twice - once to delete files, and once
     * to delete directories (because ftw uses preorder traversal) */
    ftw(path, unlink_if_node_is_a_file, 100);
    ftw(path, rmdir_if_node_is_a_dir, 100);
}

static void
gjs_debugger_fixture_set_up(gpointer      fixture_data,
                            gconstpointer user_data)
{
    GjsDebuggerFixture *fixture = (GjsDebuggerFixture *) fixture_data;
    const char         *js_script = "function f () { return 1; }\n";

    fixture->temporary_js_script_directory_name = g_strdup("/tmp/gjs_coverage_tmp.XXXXXX");
    fixture->temporary_js_script_directory_name =
        mkdtemp (fixture->temporary_js_script_directory_name);

    if (!fixture->temporary_js_script_directory_name)
        g_error ("Failed to create temporary directory for test files: %s\n", strerror (errno));

    fixture->temporary_js_script_filename = g_strconcat(fixture->temporary_js_script_directory_name,
                                                        "/",
                                                        "gjs_coverage_script_XXXXXX.js",
                                                        NULL);
    fixture->temporary_js_script_open_handle =
        mkstemps(fixture->temporary_js_script_filename, 3);

    /* Allocate a strv that we can pass over to gjs_coverage_new */
    const char *coverage_paths[] = {
        fixture->temporary_js_script_filename,
        NULL
    };

    const char *search_paths[] = {
        fixture->temporary_js_script_directory_name,
        NULL
    };

    fixture->context = gjs_context_new_with_search_path((char **) search_paths);
    fixture->debugger_multiplexer_object = gjs_get_debugger_multiplexer(fixture->context);

    write_to_file(fixture->temporary_js_script_open_handle, js_script);
}

static void
gjs_debugger_fixture_tear_down(gpointer      fixture_data,
                               gconstpointer user_data)
{
    GjsDebuggerFixture *fixture = (GjsDebuggerFixture *) fixture_data;
    unlink(fixture->temporary_js_script_filename);
    g_free(fixture->temporary_js_script_filename);
    close(fixture->temporary_js_script_open_handle);
    recursive_delete_dir_at_path(fixture->temporary_js_script_directory_name);
    g_free(fixture->temporary_js_script_directory_name);

    fixture->debugger_multiplexer_object = NULL;
    g_object_unref(fixture->context);
    gjs_clear_thread_runtime();
}

static void
test_debugger_eval_script_for_success(gpointer fixture_data,
                                      gconstpointer user_data)
{
    GjsDebuggerFixture *fixture = (GjsDebuggerFixture *) fixture_data;

    /* Just evaluate a script (the debugger is enabled) and check that
     * it succeeds */
    GError *error = NULL;
    gjs_context_eval_file(fixture->context,
                          fixture->temporary_js_script_filename,
                          NULL,
                          &error);

    g_assert_no_error(error);
}

typedef struct _FixturedTest {
    gsize            fixture_size;
    GTestFixtureFunc set_up;
    GTestFixtureFunc tear_down;
} FixturedTest;

static void
add_test_for_fixture(const char      *name,
                     FixturedTest    *fixture,
                     GTestFixtureFunc test_func,
                     gconstpointer    user_data)
{
    g_test_add_vtable(name,
                      fixture->fixture_size,
                      user_data,
                      fixture->set_up,
                      test_func,
                      fixture->tear_down);
}

void gjs_test_add_tests_for_debugger()
{
    FixturedTest debugger_fixture = {
        sizeof(GjsDebuggerFixture),
        gjs_debugger_fixture_set_up,
        gjs_debugger_fixture_tear_down
    };

    add_test_for_fixture("/gjs/debugger/evaluate_script_for_success",
                         &debugger_fixture,
                         test_debugger_eval_script_for_success,
                         NULL);
}
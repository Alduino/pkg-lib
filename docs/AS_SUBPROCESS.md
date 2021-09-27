# Using pkg-lib as a subprocess

## Detecting watch mode events

If you are calling `pkg-lib watch` and you are not providing a TTY, pkg-lib will include machine readable log messages so you can figure out what’s happening. The machine-readable portion of these messages follow semver.

Any machine readable messages are in the format `@pl[args:separated:by:colons]`. They will always be at the start of a log message, and there may be a human readable form after the machine-readable section, in the same line (which does not follow semver).

Currently, there are two possible messages: `w:b` (sent just before a new build starts), and `w:c` (sent once a build is complete). Each of these has a third argument, which specifies what build tasks are queued – in `w:b`, this will specify what builds are going to run, and in `w:c`, having any means the build failed. This argument includes a collection of characters which can be in any order. Each character means the matching task is queued:

- `p` is for the preparation stage (mostly if configuration files changed)
- `c` is for the code bundling stage (if any source code changed)
- `t` is for the typescript features stage (if the tsconfig or the documentation generator changed).

Note that some tasks may run even if their character isn’t in the list, if it is required by another specified task. The ground truth of queue to actual triggers can be found [in the source code](../src/commands/watch.ts#L220).

### Example messages

- `@pl[w:b:c] Beginning new watch mode build.` - A new build started that will rebuild the source code
- `@pl[w:c:] Watch mode build complete. Type r+enter to build again, or q+enter to quit.` - A build completed successfully
- `@pl[w:c:t] Watch mode build complete. Type r+enter to build again, or q+enter to quit.` - A Typescript build failed

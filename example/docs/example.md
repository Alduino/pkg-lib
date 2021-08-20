## `export function checkDev(): void`
Logs if we're running in dev mode or production mode
### Remarks
Logs the value of `__DEV__` and `NODE_ENV` separately
## `export function checkInvariant(): void`
Checks if the invariant functions are working
## `export default function example(name: string): string`
Returns "Hello, {name}!"
### Parameters
 - `name: string`: The name to say hello to
## `export <Example {...props: ExampleProps} />`
Renders "Hello, {name}!"
### Parameters
 - `{ name }: ExampleProps`
### Returns
`ReactElement`: The rendered React element
## `export interface ExampleProps `
### `name?: string`
The name of the person
## `export default function invariant(check: unknown, message: string): asserts check`
If `check` is false, throws an error with the specified message
### Parameters
 - `check: unknown`: The value to check
 - `message: string`: The message to set in the error
### Returns
`asserts check`: Only if `check` is true
## `export function warning(check: unknown, message: string): void`
Logs the specified warning message if `check` is false
### Parameters
 - `check: unknown`: The value to check
 - `message: string`: The message to log
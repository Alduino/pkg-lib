import {ReactElement} from "react";

export interface ExampleProps {
    /**
     * The name of the person
     */
    name?: string;
}

/**
 * Renders "Hello, {name}!"
 * @returns The rendered React element
 */
export function Example({name}: ExampleProps): ReactElement {
    return <p>Hello, {name}!</p>;
}
